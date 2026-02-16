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

// --- Load Handlers ONLY to Main Bot ---
        
        // 1. بنحمل أوامر البريفكس الأول
        const { loadPrefixCommands } = require('./handlers/prefixCommandHandler');
        await loadPrefixCommands(client1);

        // 2. بنحمل أوامر السلاش
        await loadCommands(client1);

        // 3. آخر حاجة بنشغل الإيفنتس عشان البوت يكون جاهز بالأوامر
        await loadEvents(client1);
      

        // --- Status Logic for Clones ---
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
                setBotStatus(client);
                // استراحة 5 ثواني بين كل بوت وبوت
                await new Promise(resolve => setTimeout(resolve, 5000)); 
            } catch (err) {
                console.error(`❌ ${name} failed:`, err.message);
            }
        };

        await loginBot(client1, process.env.TOKEN, 'Main Bot');
        await loginBot(client2, process.env.TOKEN_2, 'Clone 1');
        await loginBot(client3, process.env.TOKEN_3, 'Clone 2');

        // --- 🌀 The Hallucination Channel (Hourly Chronicle) ---
        // const cron = require('node-cron');
        // const { generateChronicle } = require('./nexus/gemini');

        // Run every hour (0 * * * * = at minute 0 of every hour)
        // cron.schedule('0 * * * *', async () => {
        //     try {
        //         console.log('📜 Nexus Chronicle: Generating...');

        //         if (!global.messageBuffer || global.messageBuffer.length === 0) {
        //             console.log('⚠️ No messages to chronicle.');
        //             return;
        //         }

        //         // Generate the Chronicle
        //         const chronicle = await generateChronicle(global.messageBuffer);

        //         // Find the Welcome Channel by ID
        //         const guild = client1.guilds.cache.first();
        //         if (!guild) return;

        //         const channel = guild.channels.cache.get('1461484367728869397');

        //         if (!channel) {
        //             console.log('⚠️ Welcome channel not found.');
        //             return;
        //         }

        //         // Send the Chronicle
        //         await channel.send({
        //             content: `## 📜 The Chronicle of ${new Date().toLocaleTimeString()}\n\n${chronicle}`
        //         });

        //         console.log('✅ Chronicle posted.');

        //         // Clear the buffer after posting
        //         global.messageBuffer = [];

        //     } catch (error) {
        //         console.error('❌ Chronicle Error:', error);
        //     }
        // });

        // console.log('🌀 Hallucination Channel: Active (Hourly)');

        // console.log('🌀 Hallucination Channel: Active (Hourly)');

        // --- 🔔 Dynamic Auto-Bump Reminder System ---
        const Bump = require('./models/Bump');
        const checkBumps = async () => {
            try {
                const guilds = client1.guilds.cache;
                for (const [guildId, guild] of guilds) {
                    const bumpData = await Bump.findOne({ guildId: guildId, reminded: false });
                    if (bumpData && Date.now() >= bumpData.nextBumpTime.getTime()) {
                        const bumpChannel = guild.channels.cache.get('1461760293968285879') || guild.channels.cache.find(c => c.name.includes('bump'));
                        if (!bumpChannel) continue;

                        const { EmbedBuilder } = require('discord.js');
                        const embed = new EmbedBuilder()
                            .setTitle('✨ Server Growth Protocol')
                            .setDescription('```ansi\n\u001b[1;36m╔═══════════════════════════════╗\n║   🚀 READY TO BUMP! 🚀       ║\n╚═══════════════════════════════╝\u001b[0m\n```\nIt has been **2 hours** since the last successful bump. Use `/bump` now to boost our community visibility!')
                            .addFields(
                                { name: '📍 Command', value: '`/bump`', inline: true },
                                { name: '📡 Provider', value: '`Disboard.org`', inline: true }
                            )
                            .setColor('#00ffd5')
                            .setImage('https://i.imgur.com/8N4Y8Q9.png') // Optional placeholder for a sleek banner
                            .setFooter({ text: 'Sovereign Nexus • Growth Systems', iconURL: client1.user.displayAvatarURL() })
                            .setTimestamp();

                        await bumpChannel.send({
                            content: '## 🔔 Time to Bump!',
                            embeds: [embed]
                        });

                        bumpData.reminded = true;
                        await bumpData.save();
                        console.log(`✅ Dynamic Bump reminder sent for ${guild.name}`);
                    }
                }
            } catch (error) {
                console.error('❌ Dynamic Bump Error:', error);
            }
        };

        // Check every 30 seconds
        setInterval(checkBumps, 30 * 1000);
        console.log('🔔 Dynamic Bump Reminder System: Active (Real-time Detection)');

        // --- 🌙 LIFE SIM DAILY CYCLE (24h Automation) ---
        const cron = require('node-cron');
        const LifeSimService = require('./services/lifeSimService');
        const lifeSimService = new LifeSimService(client1);
        const { EmbedBuilder } = require('discord.js');
        const THEME = require('./utils/theme');

        // Run daily at midnight UTC (adjust timezone as needed)
        cron.schedule('0 0 * * *', async () => {
            try {
                console.log('🌙 Life Sim: Starting daily cycle...');

                const guilds = client1.guilds.cache;
                for (const [guildId, guild] of guilds) {
                    try {
                        const results = await lifeSimService.runDailyCycle(guildId);
                        const config = lifeSimService.getConfig();

                        // Send logs to life-sim-logs channel
                        const logChannel = guild.channels.cache.get(config.channels.LIFE_SIM_LOGS);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setColor(THEME.COLORS.ACCENT)
                                .setAuthor({ name: '🌙 Daily Cycle Report' })
                                .setDescription(
                                    `**Passive Income Paid:** ${results.passiveIncomePaid.toLocaleString()} coins\n` +
                                    `**Taxes Collected:** ${results.taxesCollected.toLocaleString()} coins\n` +
                                    `**Repossessions:** ${results.repossessions.length}\n\n` +
                                    `${results.errors.length > 0 ? `**Errors:** ${results.errors.length}` : '✅ No errors'}`
                                )
                                .setTimestamp();

                            if (results.repossessions.length > 0) {
                                const reposList = results.repossessions.slice(0, 10).map(r => 
                                    `${r.type === 'property' ? '🏠' : '🚗'} ${r.id} - ${r.reason}`
                                ).join('\n');
                                logEmbed.addFields({
                                    name: 'Repossessions',
                                    value: reposList.length > 0 ? reposList : 'None',
                                    inline: false
                                });
                            }

                            await logChannel.send({ embeds: [logEmbed] });
                        }

                        // Announce major repossessions in city-hall
                        if (results.repossessions.length > 0) {
                            const cityHall = guild.channels.cache.get(config.channels.CITY_HALL);
                            if (cityHall) {
                                const majorRepos = results.repossessions.filter(r => 
                                    r.type === 'property' || r.type === 'vehicle'
                                );

                                if (majorRepos.length > 0) {
                                    for (const repo of majorRepos.slice(0, 3)) { // Max 3 announcements
                                        const announcement = new EmbedBuilder()
                                            .setColor(THEME.COLORS.ERROR)
                                            .setAuthor({ name: '🏛️ City Announcement' })
                                            .setDescription(
                                                `**Foreclosure Notice**\n\n` +
                                                `${repo.type === 'property' ? '🏠 Property' : '🚗 Vehicle'} **${repo.id}** has been repossessed.\n` +
                                                `Reason: ${repo.reason}`
                                            )
                                            .setTimestamp();
                                        await cityHall.send({ embeds: [announcement] });
                                    }
                                }
                            }
                        }

                        console.log(`✅ Life Sim daily cycle completed for ${guild.name}`);
                    } catch (guildError) {
                        console.error(`❌ Life Sim error for guild ${guild.name}:`, guildError);
                    }
                }

                console.log('✅ Life Sim: Daily cycle completed for all guilds');
            } catch (error) {
                console.error('❌ Life Sim Daily Cycle Error:', error);
            }
        });

        console.log('🌙 Life Sim Daily Cycle: Active (Runs daily at midnight UTC)');

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

// --- 🎭 نظام تقمص شخصية البوت (Master-Slave System) ---

client1.on('messageCreate', async (message) => {
    // تجاهل رسايل البوتات عشان ميحصلش تكرار لا نهائي
    if (message.author.bot) return;

    const CONTROL_CHANNEL_ID = '1472317340375843041'; // قناتك السرية
    const PUBLIC_CHANNEL_ID = '1462025794481164461';  // الشات العام

    // 1. من حسابك (في القناة السرية) -> يروح للناس في العام
    if (message.channel.id === CONTROL_CHANNEL_ID) {
        const publicChannel = client1.channels.cache.get(PUBLIC_CHANNEL_ID);
        if (publicChannel) {
            // لو بعت رسالة نصية
            if (message.content) {
                await publicChannel.send(message.content);
            }
            // لو بعت صورة أو ملف، البوت هينقله برضه
            if (message.attachments.size > 0) {
                await publicChannel.send({ files: Array.from(message.attachments.values()) });
            }
        }
    }

    // 2. من الناس (في العام) -> يجيلك في القناة السرية عشان تعرف تتابع
    else if (message.channel.id === PUBLIC_CHANNEL_ID) {
        const controlChannel = client1.channels.cache.get(CONTROL_CHANNEL_ID);
        if (controlChannel) {
            // هينقلك كلام الشخص واسمه عشان تعرف ترد على مين
            await controlChannel.send(`**[${message.author.username}]:** ${message.content || ''}`);
            
            // لو حد بعت صورة في العام، هتوصلك برضه في قناة التحكم
            if (message.attachments.size > 0) {
                await controlChannel.send({ files: Array.from(message.attachments.values()) });
            }
        }
    }
});

// --- 🎙️ نظام التحدث الصوتي (Elora TTS Master-Slave) ---
const googleTTS = require('google-tts-api');
const { createAudioResource, createAudioPlayer, joinVoiceChannel, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');

const VOICE_CONTROL_CHANNEL_ID = '1472935170138046558'; 
const TARGET_VOICE_CHANNEL_ID = '1461761956158636033'; 
const GUILD_ID = '1461451253606383810';                

client1.on('messageCreate', async (message) => {
    // التأكد إنك أنت اللي بتكتب وفي القناة الصح
    if (message.author.bot || message.channel.id !== VOICE_CONTROL_CHANNEL_ID) return;

    try {
        // 1. توليد رابط الصوت من النص (يدعم العربية)
        const url = googleTTS.getAudioUrl(message.content, {
            lang: 'ar',
            slow: false,
            host: 'https://translate.google.com',
        });

        // 2. الدخول للقناة الصوتية
        const connection = joinVoiceChannel({
            channelId: TARGET_VOICE_CHANNEL_ID,
            guildId: GUILD_ID,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        // 3. إعداد المشغل (Player)
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play,
            },
        });

        const resource = createAudioResource(url);

        player.play(resource);
        connection.subscribe(player);

        // 4. مسح رسالتك عشان محدش يشوف إنك "الملقن"
        if (message.deletable) {
            await message.delete().catch(() => {});
        }

        // إشعار بسيط ليك في الكونسول (اختياري)
        console.log(`🔊 Elora is speaking: ${message.content}`);

    } catch (error) {
        console.error('❌ TTS System Error:', error);
    }
});

module.exports = client1; // Export main client for compatibility
