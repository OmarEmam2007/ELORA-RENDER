require('dotenv').config();
const dns = require('dns');

// أجبر البوت يشوف يوتيوب بالعناوين دي ويتخطى حظر الـ DNS
dns.setServers([
    '8.8.8.8', // Google DNS
    '1.1.1.1', // Cloudflare DNS
    '208.67.222.222' // OpenDNS
]);

// --- 🛠️ الجزء المسؤول عن تشغيل اليوتيوب وديسكورد (ضعه في البداية) ---
const DISCORD_IP = '162.159.138.232'; 
const originalLookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
    // حل مشكلة اتصال ديسكورد
    if (hostname === 'discord.com' || hostname === 'gateway.discord.gg') {
        if (typeof options === 'function') { callback = options; options = {}; }
        return originalLookup(DISCORD_IP, options, callback);
    }
    // حل مشكلة اليوتيوب (Errno -5)
    if (hostname.includes('youtube') || hostname.includes('googlevideo') || hostname.includes('youtu.be')) {
        if (typeof options === 'function') { callback = options; options = {}; }
        options.all = true;
        // توجيه مباشر لسيرفرات جوجل لفك الحظر
        return originalLookup('142.250.181.238', options, callback); 
    }
    return originalLookup.apply(this, arguments);
};

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Elora Swarm is Online! 🚀🚀🚀'));
app.listen(7860, () => console.log('✅ Server is running on port 7860'));
// -----------------------------------------------------------
// ------------------------------------------
// ------------------------------------------
// --------------------------------
const { Client, GatewayIntentBits, Collection, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { StreamType, AudioPlayerStatus, joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const mongoose = require('mongoose');
const { loadEvents } = require('./handlers/eventHandler');
const { loadCommands } = require('./handlers/commandHandler');

// Configuration for all bots
const clientOptions = {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],
};

// Create 3 Clients
const client1 = new Client(clientOptions); // MAIN BOT
const client2 = new Client(clientOptions); // CLONE 1
const client3 = new Client(clientOptions); // CLONE 2

// Add identifiers
client1.isElora2 = false;
client2.isElora2 = true;  // This is Elora 2
client3.isElora2 = false;

// Attach clones to main client for easy access
client1.clones = [client1, client2, client3]; // Array of all available bots
client1.commands = new Collection();
client1.config = require('../config.json');

// --- Member Count VC (top of server list) ---
client1._memberCount = {
    channelIds: new Map(),
    updateTimers: new Map(),
    lastRenameAt: new Map()
};

client1._formatMemberCountName = (count) => `ɴᴏ. ᴏғ ᴍᴇᴍʙᴇʀs : ${count}`;

client1._ensureMemberCountChannel = async (guild) => {
    try {
        const existingId = client1._memberCount.channelIds.get(guild.id);
        const cached = existingId ? guild.channels.cache.get(existingId) : null;
        if (cached && cached.type === 2) return cached;

        // Try to find by prefix if we lost the ID.
        const found = guild.channels.cache.find(c => c.type === 2 && typeof c.name === 'string' && c.name.startsWith('ɴᴏ. ᴏғ ᴍᴇᴍʙᴇʀs :'));
        if (found) {
            client1._memberCount.channelIds.set(guild.id, found.id);
            return found;
        }

        const everyoneId = guild.roles.everyone.id;
        const channel = await guild.channels.create({
            name: client1._formatMemberCountName(guild.memberCount),
            type: 2,
            permissionOverwrites: [
                { id: everyoneId, deny: ['Connect', 'Speak'] }
            ]
        });

        // Put it at the very top.
        await channel.setPosition(0).catch(() => { });
        client1._memberCount.channelIds.set(guild.id, channel.id);
        return channel;
    } catch (e) {
        console.error('[MemberCount] ensure channel error:', e);
        return null;
    }
};

client1.updateMemberCountChannel = async (guildId) => {
    const guild = client1.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = await client1._ensureMemberCountChannel(guild);
    if (!channel) return;

    const desiredName = client1._formatMemberCountName(guild.memberCount);
    if (channel.name === desiredName) return;

    // Rate-limit safety: don't rename too frequently.
    const now = Date.now();
    const last = client1._memberCount.lastRenameAt.get(guildId) || 0;
    if (now - last < 15_000) return;

    try {
        await channel.setName(desiredName);
        client1._memberCount.lastRenameAt.set(guildId, Date.now());
    } catch (e) {
        // If Discord rate-limits renames, retry later without crashing.
        const retryAfterMs = Number(e?.retry_after) ? Number(e.retry_after) * 1000 : 30_000;
        console.error('[MemberCount] rename failed, will retry:', e?.message || e);
        client1._memberCount.lastRenameAt.set(guildId, Date.now());
        setTimeout(() => client1.updateMemberCountChannel(guildId).catch(() => { }), retryAfterMs).unref?.();
    }
};

client1.queueMemberCountUpdate = (guildId) => {
    const timers = client1._memberCount.updateTimers;
    if (timers.has(guildId)) clearTimeout(timers.get(guildId));
    const t = setTimeout(() => {
        timers.delete(guildId);
        client1.updateMemberCountChannel(guildId).catch(() => { });
    }, 3_000);
    timers.set(guildId, t);
};

// Add isElora2 property to clones
client2.isElora2 = true;
client3.isElora2 = false;

const MusicService = require('./services/musicService');
client1.music = new MusicService(client1, { group: 'elora-1' });
client2.music = new MusicService(client2, { group: 'elora-2' });
client3.music = new MusicService(client3, { group: 'elora-3' });

const setupCloneMusicButtons = (client) => {
    client.on('interactionCreate', async (interaction) => {
        try {
            if (!interaction.isButton()) return;
            if (!client.music) return;
            if (![
                'music_toggle',
                'music_stop',
                'music_skip',
                'music_loop',
                'music_queue',
                'music_vol_down',
                'music_vol_up',
            ].includes(interaction.customId)) return;
            await client.music.handleButton(interaction);
        } catch (e) {
            // ignore
        }
    });
};

setupCloneMusicButtons(client2);
setupCloneMusicButtons(client3);

// Connect to Database (Only once)
(async () => {
    try {
        if (process.env.MONGO_URI) {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('✅ Connected to MongoDB');
        }

// --- Load Handlers to All Bots ---
        const { loadPrefixCommands } = require('./handlers/prefixCommandHandler');
        
        // تحميل الأوامر والإيفنتس لكل البوتات لضمان عملها جميعاً
        await loadPrefixCommands(client1);
        await loadCommands(client1);
        await loadEvents(client1);
        
        // Clones only get status, no command/event loading to prevent triple replies
        const { ActivityType } = require('discord.js');
        const setBotStatus = (client) => {
            const update = () => {
                if (client.user) {
                    client.user.setActivity('Elora Modern Security', {
                        type: ActivityType.Streaming,
                        url: 'https://www.twitch.tv/discord'
                    });
                }
            };
            update();
            setInterval(update, 60 * 1000);
        };

// Login Bots one by one with a delay to avoid ENOTFOUND/Abort errors
        const loginBot = async (client, token, name) => {
            try {
                await client.login(token);
                console.log(`✅ ${name} Logged In`);
                if (client !== client1) setBotStatus(client);
                // استراحة 5 ثواني بين كل بوت وبوت
                await new Promise(resolve => setTimeout(resolve, 5000)); 
            } catch (err) {
                console.error(`❌ ${name} failed:`, err.message);
            }
        };

        await loginBot(client1, process.env.TOKEN, 'Main Bot');

        await loginBot(client2, process.env.TOKEN_2, 'Clone 1');
        await loginBot(client3, process.env.TOKEN_3, 'Clone 2');

    } catch (error) {
        console.error('❌ Error starting swarm:', error);
    }
})();

// --- Global Error Handling ---
process.on('unhandledRejection', (reason, p) => {
    console.error('❌ [Unhandled Rejection]', reason);
});
process.on('uncaughtException', (error) => {
    console.error('❌ [Uncaught Exception]', error);
});

// NOTE:
// bot.js used to register extra `client1.on('messageCreate', ...)` listeners.
// These bypass the centralized event handler system (src/handlers/eventHandler.js)
// and can cause moderation logic to appear "not working" due to duplicated/side-effect handlers.
// If you still need these features, we should move them into dedicated event modules
// under src/events/guild/ with clear ordering and guardrails.
// --- نظام التواصل الخاص (DM Bridge) ---

// إعدادات الـ IDs (استبدلها بالأرقام الصحيحة الخاصة بك)
const BRIDGE_CONFIG = {
    SOURCE_CHANNEL_ID: '1477679223920656585', // ايدي القناة في السيرفر
    TARGET_USER_ID: '1476148590270222429'     // ايدي الشخص اللي هيستلم في الخاص
};

client1.on('messageCreate', async (message) => {
    // تجاهل رسائل البوتات
    if (message.author.bot) return;

    // 1. من السيرفر للخاص: لو كتبت في القناة المحددة، البوت يبعت للشخص
    if (message.channel.id === BRIDGE_CONFIG.SOURCE_CHANNEL_ID) {
        try {
            const targetUser = await client1.users.fetch(BRIDGE_CONFIG.TARGET_USER_ID);
            if (targetUser) {
                await targetUser.send(`**وصلتك رسالة جديدة:**\n${message.content}`);
                await message.react('✅'); // تأكيد الإرسال
            }
        } catch (error) {
            console.error('❌ فشل إرسال الرسالة للخاص:', error);
            message.reply('⚠️ لم أتمكن من إرسال الرسالة، ربما المستخدم أغلق الخاص (DM).');
        }
    }

    // 2. من الخاص للسيرفر: لو الشخص رد على البوت في الخاص، الرسالة تظهر في القناة
    if (message.channel.type === 1) { // 1 تعني DMChannel
        // نتحقق أن المرسل هو الشخص المستهدف
        if (message.author.id === BRIDGE_CONFIG.TARGET_USER_ID) {
            try {
                const sourceChannel = await client1.channels.fetch(BRIDGE_CONFIG.SOURCE_CHANNEL_ID);
                if (sourceChannel) {
                    const embed = new EmbedBuilder()
                        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                        .setDescription(message.content)
                        .setColor('#00ff00')
                        .setTimestamp()
                        .setFooter({ text: 'رد جديد من الخاص' });

                    await sourceChannel.send({ embeds: [embed] });
                }
            } catch (error) {
                console.error('❌ فشل إعادة توجيه الرسالة للقناة:', error);
            }
        }
    }
});
module.exports = client1; // Export main client for compatibility
