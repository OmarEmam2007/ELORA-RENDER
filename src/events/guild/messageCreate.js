const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkLink, checkRateLimit } = require('../../utils/securityUtils');
const User = require('../../models/User');
const ModSettings = require('../../models/ModSettings');
const ModLog = require('../../models/ModLog');
const Bump = require('../../models/Bump');
const { analyzeMessage } = require('../../utils/moderation/coreDetector');
const { createLogEmbed } = require('../../utils/moderation/modernLogger');
const { logDetection } = require('../../utils/moderation/patternLearner');
const THEME = require('../../utils/theme');
const heistCommand = require('../../commands/economy/heist');

// Global buffer initialization (if not exists)
if (!global.messageBuffer) global.messageBuffer = [];

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

        // --- 🛡️ SMART MULTILINGUAL MODERATION SYSTEM (DISABLED) ---
        /*
        try {
            const settings = await ModSettings.findOne({ guildId: message.guild.id }) || { enabled: true, sensitivity: 3 };

            if (settings.enabled && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                const analysis = await analyzeMessage(message.content);

                if (analysis.isViolation) {
                    // 1. Log the detection for learning
                    analysis.matches.forEach(m => logDetection(message.guild.id, m));

                    // 2. Delete the offending message
                    await message.delete().catch(() => { });

                    // 3. Send Ephemeral Warning (using simple ephemeral reply if slash, but since this is messageCreate, we send and delete)
                    const warning = await message.channel.send({
                        content: `⚠️ ${message.author}, your message was removed for containing inappropriate language. Repeated violations may result in sanctions.`
                    });
                    setTimeout(() => warning.delete().catch(() => { }), 7000);

                    // 4. Create a Case in DB
                    const caseCount = await ModLog.countDocuments({ guildId: message.guild.id }) + 1;
                    const modCase = await ModLog.create({
                        guildId: message.guild.id,
                        caseId: caseCount,
                        userId: message.author.id,
                        content: message.content, // Should ideally store censored version in future
                        severity: analysis.severity,
                        confidence: analysis.confidence,
                        type: 'Profanity'
                    });

                    // 5. Send to Log Channel
                    if (settings.logChannelId) {
                        const logChannel = message.guild.channels.cache.get(settings.logChannelId);
                        if (logChannel) {
                            const logData = {
                                user: message.author,
                                channel: message.channel,
                                action: 'Message Deleted',
                                severity: analysis.severity,
                                confidence: analysis.confidence,
                                violationType: 'Profanity',
                                originalMessage: message.content,
                                matches: analysis.matches,
                                reason: analysis.reason,
                                caseId: caseCount
                            };
                            const { embeds, components } = createLogEmbed(logData);
                            await logChannel.send({ embeds, components });
                        }
                    }

                    return; // STOP processing this message!
                }
            }
        } catch (error) {
            console.error('❌ Smart Mod Error:', error);
        }
        */

        // --- Sovereign Nexus: The Hallucination Buffer ---
        if (message.content && message.content.length > 3) {
            const entry = `${message.author.username}: ${message.content}`;
            global.messageBuffer.push(entry);
            // Buffer Cap to keep memory light
            if (global.messageBuffer.length > 50) global.messageBuffer.shift();
        }

        // Prefix check moved to end to allow passive systems (Link/Anti-Virus) to work globally
        // if (!message.content.startsWith(client.config.prefix)) return;

        // 1. Link Protection
        const linkType = checkLink(message.content);
        if (linkType === 'INVITE') {
            // Allow admins/mods to post
            if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                await message.delete().catch(() => { });
                const warningMsg = await message.channel.send({
                    content: `${message.author}, ⚠️ Unauthorized invite links are not allowed!`
                });
                setTimeout(() => warningMsg.delete().catch(() => { }), 5000);
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
        if (checkRateLimit(message.guild.id, message.author.id, 'message', 5, 5000)) {
            // Mute the user
            try {
                if (message.member.moderatable) {
                    await message.member.timeout(60 * 1000, 'Anti-Spam: Sending messages too fast');
                    await message.channel.send(`${message.author} has been muted for 1 minute for spamming.`);
                }
            } catch (e) {
                console.error(`Failed to mute spammer ${message.author.tag}:`, e);
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
