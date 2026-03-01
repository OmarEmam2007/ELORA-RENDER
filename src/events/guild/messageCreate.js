const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkLink, checkRateLimit } = require('../../utils/securityUtils');
const { unfurlSocialLink } = require('../../services/socialUnfurlService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../../models/User');
const CustomReply = require('../../models/CustomReply');
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
        // 1. Basic Sanity Checks
        if (!message || message.author?.bot || !message.guild || !message.content) return;

        const MESSAGE_DEBUG = process.env.MESSAGE_DEBUG === '1';
        if (MESSAGE_DEBUG) {
            console.log(`[MSG] ${message.guild.id}:${message.channelId} ${message.author.id} :: ${String(message.content || '').slice(0, 120)}`);
        }

        // 2. Hard sanity probe
        if (message.content.trim().toLowerCase() === 'elora probe') {
            try {
                return await message.reply('probe-ok');
            } catch (_) { }
        }

        // 3. Social Unfurl (TikTok/Instagram) - MUST RUN BEFORE COMMANDS/FILTERS
        try {
            const unfurledUrl = await unfurlSocialLink(message.content);
            if (unfurledUrl) {
                // If it's just a link, we unfurl and continue. 
                // We don't 'return' here because the user might want to run a command in the same message or the filter might need to check it.
                // However, usually, if a link is detected, we just provide the video.
                await message.reply({ content: ` **Video Unfurled:**\n${unfurledUrl}` }).catch(() => {});
            }
        } catch (e) {
            console.error('[UNFURL] Error:', e);
        }

        // 4. Prefix Commands - HIGHEST PRIORITY
        try {
            if (typeof handlePrefixCommand === 'function') {
                const wasCommand = await handlePrefixCommand(message, client);
                if (wasCommand) return; // Command executed, stop processing.
            }
        } catch (e) {
            console.error('[PREFIX] Error:', e);
        }

        // 5. Anti-Swear Filter (Middleware Style)
        let isViolation = false;
        try {
            const modSettings = await ModSettings.findOne({ guildId: message.guild.id }).catch(() => null);
            // Support both 'enabled' and 'antiSwearEnabled' just in case
            const antiSwearEnabled = modSettings?.enabled !== false && modSettings?.antiSwearEnabled !== false;
            
            const isServerOwner = message.guild?.ownerId === message.author.id;
            const isAdministrator = message.member?.permissions?.has(PermissionFlagsBits.Administrator);
            
            const whitelistRoles = Array.isArray(modSettings?.whitelistRoles) ? modSettings.whitelistRoles : [];
            const whitelistChannels = Array.isArray(modSettings?.whitelistChannels) ? modSettings.whitelistChannels : [];
            const isWhitelisted = Boolean(
                (message.channelId && whitelistChannels.includes(message.channelId)) ||
                (message.member?.roles?.cache && whitelistRoles.some(r => message.member.roles.cache.has(r)))
            );

            if (antiSwearEnabled && !isServerOwner && !isAdministrator && !isWhitelisted) {
                const rawText = String(message.content || '');
                const withoutCustomEmoji = rawText.replace(/<a?:\w+:\d+>/g, ' ');
                const withoutUnicodeEmoji = withoutCustomEmoji.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, ' ');
                const textForModeration = withoutUnicodeEmoji.replace(/\s+/g, ' ').trim();

                const hardcodedBlacklist = ['احا', 'a7a', 'كسمك', 'nigger', 'niga', 'fuck', 'shit'];
                const customBlacklist = Array.isArray(modSettings?.customBlacklist) ? modSettings.customBlacklist : [];
                
                const detector = typeof detectProfanityAI === 'function'
                    ? detectProfanityAI
                    : (typeof detectProfanityHybrid === 'function' ? detectProfanityHybrid : async (c, o) => detectProfanitySmart(c, o));

                const detection = await detector(textForModeration || message.content, {
                    extraTerms: [...hardcodedBlacklist, ...customBlacklist],
                    whitelist: Array.isArray(modSettings?.antiSwearWhitelist) ? modSettings.antiSwearWhitelist : []
                });

                if (detection?.isViolation) {
                    isViolation = true;
                    const threshold = modSettings?.antiSwearThreshold ? Math.max(2, Math.min(20, Number(modSettings.antiSwearThreshold))) : 5;

                    await message.delete().catch(() => {});

                    const detectedWord = (detection.matches || [])[0] || '';
                    const isArabic = /[\u0600-\u06FF]/.test(detectedWord);
                    const warnMsg = isArabic 
                        ? `⚠️ ${message.author}, ممنوع الشتائم في هذا السيرفر!` 
                        : `⚠️ ${message.author}, Profanity is not allowed in this server!`;

                    const publicWarn = await message.channel.send(warnMsg).catch(() => null);
                    if (publicWarn) {
                        setTimeout(() => publicWarn.delete().catch(() => {}), 5000);
                    }

                    const key = `${message.guild.id}:${message.author.id}`;
                    let userProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id }).catch(() => null);
                    if (!userProfile) userProfile = new User({ userId: message.author.id, guildId: message.guild.id });

                    const prevCount = Number(userProfile.antiSwearWarningsCount || 0);
                    const nextCount = Math.min(threshold, prevCount + 1);
                    userProfile.antiSwearWarningsCount = nextCount;
                    userProfile.antiSwearLastAt = new Date();
                    await userProfile.save().catch(() => { });
                    global.antiSwearWarnings.set(key, { count: nextCount, lastAt: Date.now() });

                    await message.author.send(`Your message in **${message.guild.name}** was removed for prohibited language. Warning: ${nextCount}/${threshold}`).catch(() => { });

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
                }
            }
        } catch (e) {
            console.error('[ANTISWEAR] Error:', e);
        }

        if (isViolation) return;

        // 6. AI Chat / Mention Response
        let isReplyToBot = false;
        if (message.reference?.messageId) {
            try {
                const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                isReplyToBot = Boolean(refMsg && refMsg.author?.id === client.user.id);
            } catch (_) { }
        }

        const botMentioned = Boolean(message.mentions?.users?.has(client.user.id)) || isReplyToBot;
        if (botMentioned) {
            const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim().toLowerCase();
            if (cleanContent.includes('i love you') || cleanContent.includes('بحبك')) {
                return await message.reply('بحبك أكتر يا قلبي ❤️').catch(() => {});
            }

            if (process.env.GEMINI_API_KEY) {
                try {
                    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                    const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
                    if (cleanContent.length > 0) {
                        const result = await chatModel.generateContent(`You are Elora, a digital assistant. Respond: ${cleanContent}`);
                        const response = await result.response;
                        return await message.reply(response.text()).catch(() => {});
                    }
                } catch (e) {
                    console.error('[AI CHAT] Error:', e);
                }
            }
        }

        // 7. Custom Auto-Replies
        try {
            const customReplies = await CustomReply.find({ guildId: message.guild.id, enabled: true }).catch(() => []);
            const triggerText = message.content.trim().toLowerCase();
            for (const cr of customReplies) {
                const trigger = cr.trigger.toLowerCase();
                if (cr.matchType === 'startsWith' ? triggerText.startsWith(trigger) : triggerText === trigger) {
                    return await message.reply(cr.reply).catch(() => {});
                }
            }
        } catch (e) {
            console.error('[CUSTOM REPLIES] Error:', e);
        }

        // 8. Sovereign Nexus Buffer
        if (message.content.length > 3) {
            global.messageBuffer.push(`${message.author.username}: ${message.content}`);
            if (global.messageBuffer.length > 50) global.messageBuffer.shift();
        }

        // 9. Chat Leveling (XP)
        try {
            const now = Date.now();
            let profile = await User.findOne({ userId: message.author.id, guildId: message.guild.id }).catch(() => null);
            if (!profile) profile = new User({ userId: message.author.id, guildId: message.guild.id });

            if (now - (profile.lastMessageTimestamp || 0) > 60000) {
                profile.xp = (profile.xp || 0) + Math.floor(Math.random() * 10) + 15;
                profile.lastMessageTimestamp = now;
                let needed = (profile.level || 1) * 100;
                if (profile.xp >= needed) {
                    profile.xp -= needed;
                    profile.level = (profile.level || 1) + 1;
                }
                await profile.save().catch(() => {});
            }
        } catch (e) {
            console.error('[LEVELING] Error:', e);
        }
    }
};
