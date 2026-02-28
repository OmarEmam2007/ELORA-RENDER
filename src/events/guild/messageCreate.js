const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkLink, checkRateLimit } = require('../../utils/securityUtils');
const { unfurlSocialLink } = require('../../services/socialUnfurlService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../../models/User');
const ModSettings = require('../../models/ModSettings');
const ModLog = require('../../models/ModLog');
const { detectProfanitySmart, detectProfanityHybrid, detectProfanityAI } = require('../../utils/moderation/coreDetector');
const THEME = require('../../utils/theme');
const { getGuildLogChannel } = require('../../utils/getGuildLogChannel');
const { handlePrefixCommand } = require('../../handlers/prefixCommandHandler');

// Global buffer initialization (if not exists)
if (!global.messageBuffer) global.messageBuffer = [];

// Smart Anti-Swearing: warnings tracker
if (!global.antiSwearWarnings) global.antiSwearWarnings = new Map();

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const MESSAGE_DEBUG = process.env.MESSAGE_DEBUG === '1';
        if (MESSAGE_DEBUG) {
            console.log(`[MSG] ${message.guild.id}:${message.channelId} ${message.author.id} :: ${String(message.content || '').slice(0, 120)}`);
        }

        // Hard sanity probe to confirm messageCreate is firing in production
        if (String(message.content || '').trim().toLowerCase() === 'elora probe') {
            try {
                await message.reply('probe-ok');
            } catch (_) {
                // ignore
            }
        }

        // --- 📱 Social Unfurl (TikTok/Instagram) ---
        try {
            const unfurledUrl = await unfurlSocialLink(message.content);
            if (unfurledUrl) {
                await message.reply({ content: `🎬 **Video Unfurled:**\n${unfurledUrl}` });
            }
        } catch (e) {
            console.error('[UNFURL] Error:', e);
        }

        // --- 🤖 AI Chat / Mention Response ---
        const botMentioned = message.mentions.has(client.user) || 
                           (message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id);
        
        if (botMentioned && !message.author.bot) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
                
                const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim();
                if (cleanContent.length > 0) {
                    const result = await chatModel.generateContent(`You are Elora, a helpful and friendly digital assistant with a lunar theme. Respond to this message: ${cleanContent}`);
                    const response = await result.response;
                    return await message.reply(response.text());
                }
            } catch (e) {
                console.error('[AI CHAT] Error:', e);
            }
        }

        // --- 🎮 Prefix Commands (e.g. "elora nick", "elora money") ---
        try {
            if (typeof handlePrefixCommand === 'function') {
                const wasCommand = await handlePrefixCommand(message, client);
                if (wasCommand) return; // Only stop if a command was actually executed
            }
        } catch (e) {
            console.error('[PREFIX] Error:', e);
        }

        // --- 🛡️ Lightweight Moderation (Anti-Invite, etc.) ---
        const hasStickers = Boolean(message.stickers && message.stickers.size > 0);
        const rawText = String(message.content || '');
        const withoutCustomEmoji = rawText.replace(/<a?:\w+:\d+>/g, ' ');
        const withoutUnicodeEmoji = withoutCustomEmoji.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, ' ');
        const textForModeration = withoutUnicodeEmoji.replace(/\s+/g, ' ').trim();
        if (hasStickers && !textForModeration) return;

        const ANTISWEAR_DEBUG = process.env.ANTISWEAR_DEBUG === '1';

        // --- 🤖 Smart Anti-Swearing (PRIORITY #1) ---
        try {
            // Fetch modSettings for thresholds and whitelists
            const modSettings = await ModSettings.findOne({ guildId: message.guild.id }).catch(() => null);

            // Anti-swear switch (independent from other moderation). Default ON.
            const antiSwearEnabled = modSettings?.antiSwearEnabled !== false;
            
            // Bypass logic: ignore Server Owner and Administrators
            const isServerOwner = message.guild?.ownerId === message.author.id;
            const isAdministrator = message.member?.permissions?.has(PermissionFlagsBits.Administrator);
            
            const whitelistRoles = Array.isArray(modSettings?.whitelistRoles) ? modSettings.whitelistRoles : [];
            const whitelistChannels = Array.isArray(modSettings?.whitelistChannels) ? modSettings.whitelistChannels : [];
            const isWhitelisted = Boolean(
                (message.channelId && whitelistChannels.includes(message.channelId)) ||
                (message.member?.roles?.cache && whitelistRoles.some(r => message.member.roles.cache.has(r)))
            );

            // ONLY apply if not Owner, not Admin, and not Whitelisted
            if (antiSwearEnabled && !isServerOwner && !isAdministrator && !isWhitelisted) {
                // Check if it's a prefix command first to avoid blocking commands that might contain flagged words
                const text = String(message.content || '').trim();
                const eloraPrefix = /^elora\s+/i;
                const legacyPrefix = client?.config?.prefix ? String(client.config.prefix) : null;
                const bangPrefix = '!';
                const isCommand = eloraPrefix.test(text) || (legacyPrefix && text.startsWith(legacyPrefix)) || text.startsWith(bangPrefix) || text.startsWith('!');

                // Hardcoded common terms + DB custom terms
                const hardcodedBlacklist = ['احا', 'a7a', 'كسمك', 'nigger', 'niga', 'fuck', 'shit'];
                const customBlacklist = Array.isArray(modSettings?.customBlacklist) ? modSettings.customBlacklist : [];
                
                const detector = typeof detectProfanityAI === 'function'
                    ? detectProfanityAI
                    : (typeof detectProfanityHybrid === 'function' ? detectProfanityHybrid : async (c, o) => detectProfanitySmart(c, o));

                const detection = await detector(textForModeration || message.content, {
                    extraTerms: [...hardcodedBlacklist, ...customBlacklist],
                    whitelist: Array.isArray(modSettings?.antiSwearWhitelist) ? modSettings.antiSwearWhitelist : []
                });

                if (ANTISWEAR_DEBUG) {
                    console.log(`[ANTISWEAR] Checking: "${message.content}" | Violation: ${detection.isViolation} | source=${detection.source || 'rules'}`);
                }

                if (detection?.isViolation) {
                    // If it's a command, we might want to let it pass or handle it differently.
                    // For now, if it's a command, we WON'T delete it here to let the command handler work.
                    if (!isCommand) {
                        const threshold = modSettings?.antiSwearThreshold ? Math.max(2, Math.min(20, Number(modSettings.antiSwearThreshold))) : 5;

                        // 1) Delete message
                        await message.delete().catch(() => {});

                        // Send a temporary public warning (Language-aware)
                        const detectedWord = (detection.matches || [])[0] || '';
                        const isArabic = /[\u0600-\u06FF]/.test(detectedWord);
                        const warnMsg = isArabic 
                            ? `⚠️ ${message.author}, ممنوع الشتائم في هذا السيرفر!` 
                            : `⚠️ ${message.author}, Profanity is not allowed in this server!`;

                        const publicWarn = await message.channel.send(warnMsg).catch(() => null);
                        if (publicWarn) {
                            setTimeout(() => publicWarn.delete().catch(() => {}), 5000);
                        }

                        // 2) Track warnings
                        const key = `${message.guild.id}:${message.author.id}`;
                        let userProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id }).catch(() => null);
                        if (!userProfile) userProfile = new User({ userId: message.author.id, guildId: message.guild.id });

                        const prevCount = Number(userProfile.antiSwearWarningsCount || 0);
                        const nextCount = Math.min(threshold, prevCount + 1);
                        userProfile.antiSwearWarningsCount = nextCount;
                        userProfile.antiSwearLastAt = new Date();
                        await userProfile.save().catch(() => { });
                        global.antiSwearWarnings.set(key, { count: nextCount, lastAt: Date.now() });

                        // 3) DM user
                        const warnText = `Your message was removed because it contained prohibited language.\nWarning: ${nextCount}/${threshold}. If you reach ${threshold} warnings, you will be timed out for 1 hour.`;
                        await message.author.send(warnText).catch(() => { });

                        // 4) Log to log channel
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

                        // 5) Auto punish at threshold
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

                        return; // Stop processing if it's a violation and NOT a command
                    }
                }
            }
        } catch (e) {
            console.error('[ANTISWEAR] Priority check error:', e);
        }

        // --- 🧪 Debug Test Command ---
        if (message.content === '!test') {
            const contentAvailable = message.content.length > 0;
            return message.reply(`✅ **Elora Debug Mode**\n- Content Length: \`${message.content.length}\`\n- Content Available: \`${contentAvailable}\`\n- Intents Status: ${contentAvailable ? 'OK' : 'FAIL'}`);
        }

        // --- Sovereign Nexus: The Hallucination Buffer ---
        if (message.content && message.content.length > 3) {
            const entry = `${message.author.username}: ${message.content}`;
            global.messageBuffer.push(entry);
            if (global.messageBuffer.length > 50) global.messageBuffer.shift();
        }

        // Prefix commands are already handled.
    }
};
