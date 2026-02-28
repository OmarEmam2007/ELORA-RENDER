const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkLink, checkRateLimit } = require('../../utils/securityUtils');
const User = require('../../models/User');
const ModSettings = require('../../models/ModSettings');
const ModLog = require('../../models/ModLog');
const Bump = require('../../models/Bump');
const { analyzeMessage, detectProfanitySmart } = require('../../utils/moderation/coreDetector');
const { createLogEmbed } = require('../../utils/moderation/modernLogger');
const { logDetection } = require('../../utils/moderation/patternLearner');
const CustomReply = require('../../models/CustomReply');
const THEME = require('../../utils/theme');
const heistCommand = require('../../commands/economy/heist');
const { getGuildLogChannel } = require('../../utils/getGuildLogChannel');

// Global buffer initialization (if not exists)
if (!global.messageBuffer) global.messageBuffer = [];

// Smart Anti-Swearing: warnings tracker
if (!global.antiSwearWarnings) global.antiSwearWarnings = new Map();

// Module load marker (helps confirm the correct file is loaded in production)
console.log('✅ [Events] Loaded guild/messageCreate.js');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const ANTISWEAR_DEBUG = process.env.ANTISWEAR_DEBUG === '1';
        if (ANTISWEAR_DEBUG) {
            console.log(
                `[ANTISWEAR] fired guild=${message.guild.id} channel=${message.channelId} author=${message.author.id} ` +
                `partial=${Boolean(message.partial)} contentLen=${String(message.content || '').length}`
            );
        }

        // --- 🤖 Smart Anti-Swearing (EN/AR/EGY + Franco) ---
        let modSettings = null;
        try {
            modSettings = await ModSettings.findOne({ guildId: message.guild.id }).catch(() => null);
        } catch (e) {
            modSettings = null;
        }

        const isModLiteEnabled = modSettings?.enabled !== false;
        const whitelistRoles = Array.isArray(modSettings?.whitelistRoles) ? modSettings.whitelistRoles : [];
        const whitelistChannels = Array.isArray(modSettings?.whitelistChannels) ? modSettings.whitelistChannels : [];
        const isWhitelisted = Boolean(
            (message.channelId && whitelistChannels.includes(message.channelId)) ||
            (message.member?.roles?.cache && whitelistRoles.some(r => message.member.roles.cache.has(r)))
        );

        const isServerOwner = message.guild?.ownerId && message.author.id === message.guild.ownerId;
        const isAdministrator = Boolean(message.member?.permissions?.has(PermissionFlagsBits.Administrator));

        const shouldApplyAntiSwear = isModLiteEnabled && !isWhitelisted && !isServerOwner && !isAdministrator;

        if (shouldApplyAntiSwear) {
            try {
                const detection = detectProfanitySmart(message.content, {
                    extraTerms: Array.isArray(modSettings?.customBlacklist) ? modSettings.customBlacklist : [],
                    whitelist: Array.isArray(modSettings?.antiSwearWhitelist) ? modSettings.antiSwearWhitelist : []
                });

                if (ANTISWEAR_DEBUG) console.log('[ANTISWEAR] detection=', detection);

                if (detection?.isViolation) {
                    const threshold = Math.max(2, Math.min(20, Number(modSettings?.antiSwearThreshold || 5)));

                    await message.delete().catch(() => { });

                    const key = `${message.guild.id}:${message.author.id}`;
                    let userProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id }).catch(() => null);
                    if (!userProfile) userProfile = new User({ userId: message.author.id, guildId: message.guild.id });

                    const prevCount = Number(userProfile.antiSwearWarningsCount || 0);
                    const nextCount = Math.min(threshold, prevCount + 1);
                    userProfile.antiSwearWarningsCount = nextCount;
                    userProfile.antiSwearLastAt = new Date();
                    await userProfile.save().catch(() => { });
                    global.antiSwearWarnings.set(key, { count: nextCount, lastAt: Date.now() });

                    const warnText =
                        `Your message was removed because it contained prohibited language.\n` +
                        `Warning: ${nextCount}/${threshold}. If you reach ${threshold} warnings, you will be timed out for 1 hour.`;
                    await message.author.send(warnText).catch(() => { });

                    const logChannel = await getGuildLogChannel(message.guild, client);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setTitle('Smart Anti-Swearing')
                            .setDescription('Blocked a message containing prohibited language.')
                            .addFields(
                                { name: 'User', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
                                { name: 'Channel', value: `${message.channel} (\`${message.channelId}\`)`, inline: true },
                                { name: 'Warnings', value: `\`${nextCount}/${threshold}\``, inline: true },
                                { name: 'Detected', value: `\`${(detection.matches || []).slice(0, 10).join(', ') || 'n/a'}\``, inline: false },
                                { name: 'Message', value: `\`\`\`${String(message.content || '').slice(0, 900)}\`\`\``, inline: false }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(() => { });
                    }

                    if (nextCount >= threshold) {
                        if (message.member?.moderatable) {
                            await message.member.timeout(60 * 60 * 1000, `Smart Anti-Swearing: ${threshold} warnings`).catch(() => { });
                        }
                        await User.findOneAndUpdate(
                            { userId: message.author.id, guildId: message.guild.id },
                            { antiSwearWarningsCount: 0, antiSwearLastAt: new Date() },
                            { upsert: true }
                        ).catch(() => { });
                        global.antiSwearWarnings.set(key, { count: 0, lastAt: Date.now() });
                    }

                    return;
                }
            } catch (e) {
                console.error('[ANTISWEAR] error:', e);
            }
        }

        // --- Sovereign Nexus: The Hallucination Buffer ---
        if (message.content && message.content.length > 3) {
            const entry = `${message.author.username}: ${message.content}`;
            global.messageBuffer.push(entry);
            if (global.messageBuffer.length > 50) global.messageBuffer.shift();
        }

        // --- 🛡️ Lightweight Moderation (Anti-Invite, etc.) ---
        try {
            const modSettings = await ModSettings.findOne({ guildId: message.guild.id }).catch(() => null);
            const isModLiteEnabled = modSettings?.enabled !== false;
            if (isModLiteEnabled) {
                const linkType = checkLink(message.content);
                if (linkType === 'INVITE') {
                    await message.delete().catch(() => { });
                    const warningMsg = await message.channel.send(`${message.author}, invite links are not allowed here.`).catch(() => null);
                    if (warningMsg) setTimeout(() => warningMsg.delete().catch(() => { }), 6000);
                    return;
                }
            }
        } catch (e) {
            console.error('[MODERATION] Error:', e);
        }
    }
};
