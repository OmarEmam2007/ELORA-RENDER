const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildLogChannel } = require('../../utils/getGuildLogChannel');
const ModSettings = require('../../models/ModSettings');
const User = require('../../models/User');
const THEME = require('../../utils/theme');
const { detectProfanitySmart } = require('../../utils/moderation/coreDetector');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage, client) {
        if (!oldMessage.author || oldMessage.author.bot) return;
        // Fetch full message if partial (edits often arrive partial depending on cache/intents)
        try {
            if (newMessage?.partial) {
                newMessage = await newMessage.fetch().catch(() => newMessage);
            }
            if (oldMessage?.partial) {
                oldMessage = await oldMessage.fetch().catch(() => oldMessage);
            }
        } catch (e) {
            // best-effort
        }

        const oldContent = String(oldMessage?.content || '');
        const newContent = String(newMessage?.content || '');
        if (oldContent === newContent) return; // Only process content changes

        const ANTISWEAR_DEBUG = process.env.ANTISWEAR_DEBUG === '1';

        // --- 🤖 Smart Anti-Swearing on EDIT ---
        try {
            const guild = newMessage.guild || oldMessage.guild;
            if (!guild) return;

            const member = newMessage.member || oldMessage.member;

            let modSettings = null;
            try {
                modSettings = await ModSettings.findOne({ guildId: guild.id }).catch(() => null);
            } catch (e) {
                modSettings = null;
            }

            const isModLiteEnabled = modSettings?.enabled !== false;
            const whitelistRoles = Array.isArray(modSettings?.whitelistRoles) ? modSettings.whitelistRoles : [];
            const whitelistChannels = Array.isArray(modSettings?.whitelistChannels) ? modSettings.whitelistChannels : [];

            const channelId = newMessage.channelId || oldMessage.channelId;
            const isWhitelisted = Boolean(
                (channelId && whitelistChannels.includes(channelId)) ||
                (member?.roles?.cache && whitelistRoles.some(r => member.roles.cache.has(r)))
            );

            const isServerOwner = guild?.ownerId && oldMessage.author.id === guild.ownerId;
            const isAdministrator = Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
            const shouldApplyAntiSwear = isModLiteEnabled && !isWhitelisted && !isServerOwner && !isAdministrator;

            if (ANTISWEAR_DEBUG) {
                console.log('[ANTISWEAR][EDIT] gates=', {
                    enabled: isModLiteEnabled,
                    isWhitelisted,
                    isServerOwner,
                    isAdministrator,
                    shouldApplyAntiSwear,
                });
            }

            if (shouldApplyAntiSwear) {
                if (!newContent) return;
                const detection = detectProfanitySmart(newContent, {
                    extraTerms: Array.isArray(modSettings?.customBlacklist) ? modSettings.customBlacklist : [],
                    whitelist: Array.isArray(modSettings?.antiSwearWhitelist) ? modSettings.antiSwearWhitelist : []
                });

                if (ANTISWEAR_DEBUG) console.log('[ANTISWEAR][EDIT] detection=', detection);

                if (detection?.isViolation) {
                    const threshold = Math.max(2, Math.min(20, Number(modSettings?.antiSwearThreshold || 5)));

                    await newMessage.delete().catch((e) => {
                        if (ANTISWEAR_DEBUG) console.log('[ANTISWEAR][EDIT] delete failed:', e?.message || e);
                    });

                    const key = `${guild.id}:${oldMessage.author.id}`;
                    let userProfile = await User.findOne({ userId: oldMessage.author.id, guildId: guild.id }).catch(() => null);
                    if (!userProfile) userProfile = new User({ userId: oldMessage.author.id, guildId: guild.id });

                    const prevCount = Number(userProfile.antiSwearWarningsCount || 0);
                    const nextCount = Math.min(threshold, prevCount + 1);
                    userProfile.antiSwearWarningsCount = nextCount;
                    userProfile.antiSwearLastAt = new Date();
                    await userProfile.save().catch(() => { });

                    const warnText =
                        `Your edited message was removed because it contained prohibited language.\n` +
                        `Warning: ${nextCount}/${threshold}. If you reach ${threshold} warnings, you will be timed out for 1 hour.`;
                    await oldMessage.author.send(warnText).catch(() => { });

                    const logChannel = await getGuildLogChannel(guild, client);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setTitle('Smart Anti-Swearing (Edit)')
                            .setDescription('Blocked an edited message containing prohibited language.')
                            .addFields(
                                { name: 'User', value: `${oldMessage.author.tag} (\`${oldMessage.author.id}\`)`, inline: true },
                                { name: 'Channel', value: `${newMessage.channel} (\`${channelId}\`)`, inline: true },
                                { name: 'Warnings', value: `\`${nextCount}/${threshold}\``, inline: true },
                                { name: 'Detected', value: `\`${(detection.matches || []).slice(0, 10).join(', ') || 'n/a'}\``, inline: false },
                                { name: 'Before', value: `\`\`\`${String(oldMessage.content || '').slice(0, 450)}\`\`\``, inline: false },
                                { name: 'After', value: `\`\`\`${String(newMessage.content || '').slice(0, 450)}\`\`\``, inline: false }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(() => { });
                    }

                    if (nextCount >= threshold) {
                        if (member?.moderatable) {
                            await member.timeout(60 * 60 * 1000, `Smart Anti-Swearing: ${threshold} warnings`).catch(() => { });
                        }
                        await User.findOneAndUpdate(
                            { userId: oldMessage.author.id, guildId: guild.id },
                            { antiSwearWarningsCount: 0, antiSwearLastAt: new Date() },
                            { upsert: true }
                        ).catch(() => { });
                    }

                    return;
                }
            }
        } catch (e) {
            console.error('[ANTISWEAR][EDIT] error:', e);
        }

        const logChannel = await getGuildLogChannel(oldMessage.guild, client);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('📝 Message Edited')
            .addFields(
                { name: 'Author', value: `${oldMessage.author.tag}`, inline: true },
                { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
                { name: 'Before', value: oldMessage.content || '[No Content]' },
                { name: 'After', value: newMessage.content || '[No Content]' }
            )
            .setColor(client.config.colors.info)
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    },
};
