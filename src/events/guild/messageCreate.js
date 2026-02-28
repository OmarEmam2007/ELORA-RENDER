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
// Map<`${guildId}:${userId}`, { count: number, lastAt: number }>
if (!global.antiSwearWarnings) global.antiSwearWarnings = new Map();

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const OMAR_ROLE_ID = '1461766723274412126';
        const HUSSAM_USER_ID = '1461766927306457109';

        const text = message.content?.trim() || '';
        const mentionsThisBot = message.mentions.has(client.user);
        const saysILoveYou = /i\s+love\s+you/i.test(text);

        console.log(`[DEBUG] msg="${text}" | mentionsBot=${mentionsThisBot} | saysILoveYou=${saysILoveYou}`);

        if (mentionsThisBot && saysILoveYou) {
            const isOmar = message.member?.roles?.cache?.has(OMAR_ROLE_ID);
            const isHussam = message.author.id === HUSSAM_USER_ID;

            if (isHussam && client.isElora2) {
                await message.reply('i love you too hussam i can\'t stop thinking about you 😭🤍');
            } else if (isOmar && !isHussam) {
                await message.reply('i love you too omar you are only mine 🤭🤍');
            } else if (!isOmar && !isHussam) {
                await message.reply('stfu bitch you are not my hussam');
            }
            return;
        }

        // Smart Anti-Swearing is implemented below using detectProfanitySmart (active).

        // --- Sovereign Nexus: The Hallucination Buffer ---
        if (message.content && message.content.length > 3) {
            const entry = `${message.author.username}: ${message.content}`;
            global.messageBuffer.push(entry);
            // Buffer Cap to keep memory light
            if (global.messageBuffer.length > 50) global.messageBuffer.shift();
        }

        // Prefix check moved to end to allow passive systems (Link/Anti-Virus) to work globally
        // if (!message.content.startsWith(client.config.prefix)) return;

        // --- 🛡️ Lightweight Moderation (Normal/Strict) ---
        // English-only for all new moderation outputs.
        let modSettings = null;
        try {
            modSettings = await ModSettings.findOne({ guildId: message.guild.id }).catch(() => null);
        } catch (e) {
            modSettings = null;
        }

        const isModLiteEnabled = modSettings?.enabled !== false;
        const modLiteMode = modSettings?.mode || 'normal';

        const whitelistRoles = Array.isArray(modSettings?.whitelistRoles) ? modSettings.whitelistRoles : [];
        const whitelistChannels = Array.isArray(modSettings?.whitelistChannels) ? modSettings.whitelistChannels : [];

        const isWhitelisted = Boolean(
            (message.channelId && whitelistChannels.includes(message.channelId)) ||
            (message.member?.roles?.cache && whitelistRoles.some(r => message.member.roles.cache.has(r)))
        );

        // Note: do NOT bypass anti-swearing for ManageMessages/ManageGuild.
        // Only Server Owner and Administrators are ignored.

        const isServerOwner = message.guild?.ownerId && message.author.id === message.guild.ownerId;
        const isAdministrator = Boolean(message.member?.permissions?.has(PermissionFlagsBits.Administrator));

        // Defaults tuned for NORMAL.
        const sensitivity = Math.max(1, Math.min(5, Number(modSettings?.sensitivity || 3)));
        const spamWindowMs = modLiteMode === 'strict' ? 6000 : 5000;
        const spamLimit = modLiteMode === 'strict' ? (6 - sensitivity) : (7 - sensitivity);
        const timeoutSeconds = modLiteMode === 'strict' ? 120 : 60;

        const shouldApplyModLite = isModLiteEnabled && !isWhitelisted;

        // Anti-swear bypass: ignore server owner and administrators.
        const shouldApplyAntiSwear = shouldApplyModLite && !isServerOwner && !isAdministrator;

        // --- 🤖 Smart Anti-Swearing (EN/AR/EGY + Franco) ---
        // False-positive safe: boundary-aware matching after normalization.
        // Action: delete, DM warning count, log, timeout at threshold.
        if (shouldApplyAntiSwear) {
            try {
                if (message.author.bot) return;
                const detection = detectProfanitySmart(message.content, {
                    extraTerms: Array.isArray(modSettings?.customBlacklist) ? modSettings.customBlacklist : [],
                    whitelist: Array.isArray(modSettings?.antiSwearWhitelist) ? modSettings.antiSwearWhitelist : []
                });
                if (detection?.isViolation) {
                    const threshold = Math.max(2, Math.min(20, Number(modSettings?.antiSwearThreshold || 5)));

                    // 1) Delete message
                    await message.delete().catch(() => { });

                    // 2) Track warnings (MongoDB persistence via User model)
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
                    const warnText =
                        `Your message was removed because it contained prohibited language.\n` +
                        `Warning: ${nextCount}/${threshold}. If you reach ${threshold} warnings, you will be timed out for 1 hour.`;
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
                        // Reset in DB + cache
                        await User.findOneAndUpdate(
                            { userId: message.author.id, guildId: message.guild.id },
                            { antiSwearWarningsCount: 0, antiSwearLastAt: new Date() },
                            { upsert: true }
                        ).catch(() => { });
                        global.antiSwearWarnings.set(key, { count: 0, lastAt: Date.now() });

                        const logChannel2 = await getGuildLogChannel(message.guild, client);
                        if (logChannel2) {
                            const embed2 = new EmbedBuilder()
                                .setColor(THEME.COLORS.WARNING)
                                .setTitle('Smart Anti-Swearing')
                                .setDescription(`User reached ${threshold} warnings. Applied a 1-hour timeout (best-effort).`)
                                .addFields(
                                    { name: 'User', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
                                    { name: 'Action', value: message.member?.moderatable ? 'Timeout (1 hour)' : 'Timeout failed (not moderatable)', inline: true }
                                )
                                .setTimestamp();
                            await logChannel2.send({ embeds: [embed2] }).catch(() => { });
                        }
                    }

                    return;
                }
            } catch (e) {
                console.error('Smart Anti-Swearing error:', e);
            }
        }

        // 1) Anti-Invite Links (always on in normal/strict)
        if (shouldApplyModLite) {
            const linkType = checkLink(message.content);
            if (linkType === 'INVITE') {
                await message.delete().catch(() => { });

                const warningMsg = await message.channel.send({
                    content: `${message.author}, invite links are not allowed here.`
                }).catch(() => null);
                if (warningMsg) setTimeout(() => warningMsg.delete().catch(() => { }), 6000);

                // Log to mod logs channel (best-effort)
                const logChannel = await getGuildLogChannel(message.guild, client);
                if (logChannel) {
                    const caseId = (await ModLog.countDocuments({ guildId: message.guild.id }).catch(() => 0)) + 1;
                    await ModLog.create({
                        guildId: message.guild.id,
                        caseId,
                        userId: message.author.id,
                        type: 'Link',
                        content: message.content,
                        severity: 'Severe',
                        confidence: 100,
                        status: 'Active'
                    }).catch(() => null);

                    const embed = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('Lightweight Moderation')
                        .setDescription('Blocked an invite link.')
                        .addFields(
                            { name: 'User', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                            { name: 'Channel', value: `${message.channel} (\`${message.channelId}\`)`, inline: true },
                            { name: 'Mode', value: `\`${modLiteMode}\``, inline: true },
                            { name: 'Content', value: `\`\`\`${String(message.content || '').slice(0, 900)}\`\`\``, inline: false }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] }).catch(() => { });
                }

                return;
            }
        }

        // --- 🛡️ Antivirus: Mass Mention & File Scan ---

        // 1. Mass Mention (Ping Spam)
        // Limit: Max 5 user pings per message.
        if (message.mentions.users.size > 5) {
            await message.delete().catch(() => { });
            if (message.member.moderatable) {
                await message.member.timeout(10 * 60 * 1000, 'Antivirus: Mass Mention Spam');
            }
            const msg = await message.channel.send(`${message.author}, 🛡️ **Antivirus**: Mass mentioning is not allowed.`);
            setTimeout(() => msg.delete().catch(() => { }), 5000);
            return;
        }

        // 2. Malicious File Scanner
        // Block .exe, .scr, .bat, .vbs files
        if (message.attachments.size > 0) {
            const forbiddenExts = ['.exe', '.scr', '.bat', '.vbs', '.cmd', '.msi'];
            const hasMalware = message.attachments.some(att => forbiddenExts.some(ext => att.name.toLowerCase().endsWith(ext)));

            if (hasMalware) {
                await message.delete().catch(() => { });
                await message.member.ban({ reason: 'Antivirus: Malicious File Upload Detected', deleteMessageSeconds: 604800 }).catch(() => { });
                await message.channel.send(`🛡️ **Antivirus**: banned ${message.author} for uploading malicious files.`);
                return;
            }
        }

        // --- 🎥 Media Fixer (TikTok, Insta, X) ---
        // Auto-convert links to embeddable versions
        // tiktok.com -> vxtiktok.com
        // instagram.com -> ddinstagram.com
        // twitter.com/x.com -> fxtwitter.com

        const content = message.content;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = content.match(urlRegex);

        if (urls) {
            let shouldReplace = false;
            let newContent = content;

            urls.forEach(url => {
                let fixedUrl = null;

                if (url.includes('tiktok.com')) {
                    // vxtiktok is down/legal issues. Using tnktok.
                    fixedUrl = url.replace('tiktok.com', 'tnktok.com');
                } else if (url.includes('instagram.com')) {
                    fixedUrl = url.replace('instagram.com', 'ddinstagram.com');
                } else if (url.includes('twitter.com')) {
                    fixedUrl = url.replace('twitter.com', 'fxtwitter.com');
                } else if (url.includes('x.com')) {
                    fixedUrl = url.replace('x.com', 'fxtwitter.com');
                } else if (url.includes('youtube.com/shorts/')) {
                    // Fix Shorts to play as normal videos
                    fixedUrl = url.replace('youtube.com/shorts/', 'youtube.com/watch?v=');
                }

                if (fixedUrl) {
                    newContent = newContent.replace(url, fixedUrl);
                    shouldReplace = true;
                }
            });

            if (shouldReplace) {
                // Delete original and send fixed version as a webhook-style impersonation or just a clean repost
                // Simple Repost: "User: [Link]"
                await message.delete().catch(() => { });
                await message.channel.send(`**${message.author.username}**: ${newContent}`);
                return; // Stop here, don't trigger other XP stuff logic on the fixed message
            }
        }

        // 2. Anti-Spam (Auto-Punish)
        // Limit: 5 messages in 5 seconds
        if (shouldApplyModLite && checkRateLimit(message.guild.id, message.author.id, 'message', spamLimit, spamWindowMs)) {
            try {
                const didTimeout = Boolean(message.member?.moderatable);
                if (didTimeout) {
                    await message.member.timeout(timeoutSeconds * 1000, 'Anti-Spam: Sending messages too fast');
                }

                const notice = await message.channel.send({
                    content: `${message.author}, please slow down. Continued spam may result in more severe actions.`
                }).catch(() => null);
                if (notice) setTimeout(() => notice.delete().catch(() => { }), 7000);

                const logChannel = await getGuildLogChannel(message.guild, client);
                if (logChannel) {
                    const caseId = (await ModLog.countDocuments({ guildId: message.guild.id }).catch(() => 0)) + 1;
                    await ModLog.create({
                        guildId: message.guild.id,
                        caseId,
                        userId: message.author.id,
                        type: 'Spam',
                        content: message.content,
                        severity: modLiteMode === 'strict' ? 'Severe' : 'Mild',
                        confidence: 100,
                        status: 'Active'
                    }).catch(() => null);

                    const embed = new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setTitle('Lightweight Moderation')
                        .setDescription('Detected message spam rate-limit.')
                        .addFields(
                            { name: 'User', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                            { name: 'Channel', value: `${message.channel} (\`${message.channelId}\`)`, inline: true },
                            { name: 'Mode', value: `\`${modLiteMode}\``, inline: true },
                            { name: 'Threshold', value: `\`${spamLimit} msgs / ${Math.round(spamWindowMs / 1000)}s\``, inline: true },
                            { name: 'Action', value: didTimeout ? `Timeout \`${timeoutSeconds}s\`` : 'No action (not moderatable)', inline: true }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] }).catch(() => { });
                }
            } catch (e) {
                console.error(`Failed to handle spammer ${message.author.tag}:`, e);
            }
        }

        // 3. Leveling / XP System
        const cooldown = 60 * 1000; // 1 minute
        let userProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id });

        if (!userProfile) {
            userProfile = new User({ userId: message.author.id, guildId: message.guild.id });
        }

        const now = Date.now();
        if (now - userProfile.lastMessageTimestamp > cooldown) {
            const xpGain = Math.floor(Math.random() * 10) + 15; // Random 15-25 XP
            userProfile.xp += xpGain;
            userProfile.lastMessageTimestamp = now;

            // Level Up Logic: Level * 100 XP required for next level
            const neededXp = userProfile.level * 100;
            if (userProfile.xp >= neededXp) {
                userProfile.level++;
                userProfile.xp -= neededXp;
                await message.channel.send(`🎉 ${message.author}, you leveled up to **Level ${userProfile.level}**!`);
                // Could assign roles here
            }

            await userProfile.save();
        }

        // --- 🔔 Dynamic Disboard Bump Detection ---
        if (message.author.id === '302050872383242240') { // DISBOARD ID
            const isSuccess = message.embeds[0]?.description?.includes('Bump done!') || message.content.includes('Bump done!');
            if (isSuccess) {
                const nextBump = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 Hours
                await Bump.findOneAndUpdate(
                    { guildId: message.guild.id },
                    { nextBumpTime: nextBump, reminded: false },
                    { upsert: true, new: true }
                );
                console.log(`✅ Disboard Bump detected in ${message.guild.name}. Next reminder set for: ${nextBump.toLocaleTimeString()}`);
            }
        }

        // --- 🔐 SOVEREIGN HEIST KEYWORD LISTENER ---
        try {
            if (heistCommand && typeof heistCommand.handleMessage === 'function') {
                await heistCommand.handleMessage(message);
            }
        } catch (e) {
            console.error('Heist handleMessage error:', e);
        }

        // --- 🎮 ELORA PREFIX COMMAND HANDLER ---
        const messageContent = message.content.trim();
        const eloraPrefix = /^elora\s+/i;
        
        if (eloraPrefix.test(messageContent)) {
            // --- 💬 ELORA PHRASE RESPONDER ---
            // Handles: "elora do you love me" / "elora do u love me"
            const lowered = messageContent.toLowerCase();
            if (lowered === 'elora do you want larin to shut up' || lowered === 'elora do u want larin to shut up') {
                const OWNER_ROLE_ID = '1461766723274412126';
                const hasOwnerRole = message.member?.roles?.cache?.has(OWNER_ROLE_ID);
                const isOwnerId = client?.config?.ownerId && message.author.id === client.config.ownerId;
                if (hasOwnerRole || isOwnerId) {
                    await message.reply('YES PLZ SHE IS SO ANNOYING').catch(() => { });
                }
                return;
            }

            // --- 🧠 CUSTOM REPLIES (DB-Driven) ---
            // Prevent spam/loops: 1 reply per 3s per user.
            if (!client.customReplyCooldown) client.customReplyCooldown = new Map();
            const last = client.customReplyCooldown.get(message.author.id) || 0;
            if (Date.now() - last > 3000) {
                try {
                    const contentLower = messageContent.toLowerCase();

                    // Fetch a small set to keep it fast.
                    const replies = await CustomReply.find({ guildId: message.guild.id, enabled: true })
                        .sort({ updatedAt: -1 })
                        .limit(200)
                        .catch(() => []);

                    let matched = null;
                    for (const r of replies) {
                        const trig = (r.trigger || '').trim().toLowerCase();
                        if (!trig) continue;

                        if (r.matchType === 'startsWith') {
                            if (contentLower.startsWith(trig)) {
                                matched = r;
                                break;
                            }
                        } else {
                            if (contentLower === trig) {
                                matched = r;
                                break;
                            }
                        }
                    }

                    if (matched) {
                        client.customReplyCooldown.set(message.author.id, Date.now());
                        await message.reply(matched.reply).catch(() => { });
                        return;
                    }
                } catch (e) {
                    // Best-effort only
                }
            }

            // Check if user is jailed (role or database)
            const JAILED_ROLE = process.env.JAILED_ROLE_ID || '1467467538551279769';
            let userProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id }).catch(() => null);
            
            // Check role
            if (message.member.roles.cache.has(JAILED_ROLE)) {
                // Check if jail time expired
                if (userProfile && userProfile.jailed && userProfile.jailReleaseTime) {
                    if (new Date() >= userProfile.jailReleaseTime) {
                        // Auto-unjail
                        userProfile.jailed = false;
                        userProfile.jailReleaseTime = null;
                        await userProfile.save().catch(() => {});
                        await message.member.roles.remove(JAILED_ROLE).catch(() => {});
                    } else {
                        return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You are currently Jailed and cannot participate.')] });
                    }
                } else {
                    return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You are currently Jailed and cannot participate.')] });
                }
            }

            // Check cooldown (7 seconds)
            const { checkCooldown, getRemainingCooldown } = require('../../utils/commandCooldown');
            if (checkCooldown(message.author.id, 7000)) {
                const remaining = getRemainingCooldown(message.author.id, 7000);
                const seconds = Math.ceil(remaining / 1000);
                return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription(`⏳ Please wait **${seconds}** second(s) before using another command.`)] });
            }

            // Parse command
            const args = messageContent.replace(/^elora\s+/i, '').trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            if (!commandName) return;

            const command = client.prefixCommands?.get(commandName);
            if (!command) return;

            try {
                await command.execute(message, client, args);
            } catch (error) {
                console.error(`Error executing elora command ${commandName}:`, error);
                const errEmbed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`❌ **Command Error**: An unexpected error occurred while running \`${commandName}\`.`);
                await message.reply({ embeds: [errEmbed] }).catch(() => { });
            }
            return; // Stop processing other prefix handlers
        }

        // --- 🎮 ARABIC BAN SHORTCUT (اديهولوا) ---
        // Usage: اديهولوا @User
        if (messageContent.toLowerCase().startsWith('اديهولوا')) {
            if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                const err = new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`${THEME.ICONS.CROSS} You need **Ban Members** permission to use this.`);
                await message.reply({ embeds: [err] }).catch(() => { });
                return;
            }

            const mentionedUser = message.mentions.users.first();
            if (!mentionedUser) {
                const guide = new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`${THEME.ICONS.CROSS} **Usage:** \`اديهولوا @User\``);
                await message.reply({ embeds: [guide] }).catch(() => { });
                return;
            }

            if (mentionedUser.id === message.author.id) {
                const err = new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`${THEME.ICONS.CROSS} You can't ban yourself.`);
                await message.reply({ embeds: [err] }).catch(() => { });
                return;
            }

            const targetMember = await message.guild.members.fetch(mentionedUser.id).catch(() => null);
            if (!targetMember) {
                const err = new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`${THEME.ICONS.CROSS} **Error:** User not found in this server.`);
                await message.reply({ embeds: [err] }).catch(() => { });
                return;
            }

            if (!targetMember.bannable) {
                const err = new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`${THEME.ICONS.CROSS} **Privilege Error:** Can't ban **${mentionedUser.tag}** (higher role / missing permissions).`);
                await message.reply({ embeds: [err] }).catch(() => { });
                return;
            }

            try {
                await mentionedUser.send(`🔨 **Banned from ${message.guild.name}**`).catch(() => { });
                await targetMember.ban({ reason: `Arabic shortcut ban by ${message.author.tag}` });
                await message.reply('اديتهولوا يا كبير 😆').catch(() => { });
            } catch (error) {
                console.error('Arabic ban shortcut error:', error);
                const err = new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`${THEME.ICONS.CROSS} **Error:** Ban failed.`);
                await message.reply({ embeds: [err] }).catch(() => { });
            }
            return;
        }

        // --- 🎮 HYBRID COMMAND HANDLER (Original Prefix Support) ---
        if (message.content.startsWith(client.config.prefix)) {
            const args = message.content.slice(client.config.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            const command = client.commands.get(commandName);
            if (!command) return;

            try {
                // Compatible with both Interaction and Message
                await command.execute(message, client, args);
            } catch (error) {
                console.error(`Error executing command ${commandName}:`, error);
                const { EmbedBuilder } = require('discord.js');
                const errEmbed = new EmbedBuilder()
                    .setColor('#ff4b4b')
                    .setDescription(`❌ **Command Error**: An unexpected error occurred while running \`${commandName}\`.`);
                await message.reply({ embeds: [errEmbed] }).catch(() => { });
            }
        }
    },
};
