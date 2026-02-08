const path = require('path');
const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const {
    joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    demuxProbe,
} = require('@discordjs/voice');
const play = require('play-dl');

async function initializePlayDL() {
    try {
        // تصفير أولي
        await play.setToken({ youtube: { cookie: "" } });

        // البروكسي - اتأكد إنه بين علامات تنصيص " "
        const myProxy = "http://178.170.43.129:8082"; 

        if (myProxy && myProxy.startsWith('http')) {
            try {
                await play.setToken({
                    youtube: { proxy: myProxy }
                });
                console.log(`📡 [PROXY] Active: ${myProxy}`);
            } catch (pErr) {
                console.error("⚠️ Proxy split error - skipping proxy");
            }
        }

        // الكوكيز - لو فاضية أو مش JSON سليم المكتبة بتضرب split
        const cookiePath = path.join(__dirname, '../../cookies.json');
        if (fs.existsSync(cookiePath)) {
            const data = fs.readFileSync(cookiePath, 'utf8').trim();
            if (data && data !== "[]" && data !== "") {
                try {
                    const cookiesArray = JSON.parse(data);
                    await play.setToken({ youtube: { cookie: cookiesArray } });
                    console.log("✅ [COOKIES] Loaded!");
                } catch (e) { console.error("⚠️ Cookies JSON invalid"); }
            }
        }

        await play.setToken({
            user_agent: ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36']
        });
        console.log("✅ Play-DL Ready!");
    } catch (error) {
        console.error("❌ Final Setup error:", error.message);
    }
}

class MusicService {
    constructor(client, options = {}) {
        this.client = client;
        this.group = options.group || 'default';
        this.guildStates = new Map();
    }

    _getState(guildId) {
        if (!this.guildStates.has(guildId)) {
            const player = createAudioPlayer();
            const state = {
                guildId, voiceChannelId: null, textChannelId: null, controllerMessageId: null,
                queue: [], nowPlaying: null, looping: false, volume: 1,
                player, connection: null, playing: false, resource: null,
            };

            player.on(AudioPlayerStatus.Idle, async () => {
                const s = this.guildStates.get(guildId);
                if (!s) return;
                if (s.nowPlaying && s.looping) return this._playNow(guildId, s.nowPlaying).catch(() => { });
                s.nowPlaying = null; s.playing = false;
                await this._playNext(guildId).catch(() => { });
            });

            this.guildStates.set(guildId, state);
        }
        return this.guildStates.get(guildId);
    }

    async _ensureConnection(guildId, voiceChannelId) {
        const guild = this.client.guilds.cache.get(guildId);
        const state = this._getState(guildId);
        if (state.connection && state.voiceChannelId === voiceChannelId) return state.connection;

        const connection = joinVoiceChannel({
            channelId: voiceChannelId, guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, group: this.group,
        });

        state.connection = connection; state.voiceChannelId = voiceChannelId;
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000).catch(e => {
            connection.destroy(); state.connection = null; throw e;
        });
        connection.subscribe(state.player);
        return connection;
    }

    // --- تعديل دالة البحث للهروب من الحظر ---
    async _resolveQuery(query) {
        try {
            const isYouTubeUrl = play.yt_validate(query) === 'video';
            let videoInfo;

            if (isYouTubeUrl) {
                // استخدام check_all_status: false لتخطي فحص يوتيوب للسيرفر
                videoInfo = await play.video_info(query, { check_all_status: false });
            } else {
                const searchResults = await play.search(query, { limit: 1, source: { youtube: 'video' } });
                if (searchResults && searchResults.length > 0) {
                    videoInfo = await play.video_info(searchResults[0].url, { check_all_status: false });
                } else { throw new Error('No results'); }
            }

            const video = videoInfo.video_details;
            return { url: video.url, title: video.title, thumbnail: video.thumbnails?.[0]?.url, duration: video.durationInSec };
        } catch (error) {
            console.warn('⚠️ YT Blocked, trying SoundCloud...');
            // محاولة ساوند كلاود كحل بديل تلقائي
            const sc = await play.search(query, { limit: 1, source: { soundcloud: 'tracks' } }).catch(() => []);
            if (sc.length > 0) {
                return { url: sc[0].url, title: "[SC] " + (sc[0].name || sc[0].title), thumbnail: sc[0].thumbnail, duration: sc[0].durationInSec };
            }
            throw new Error("All sources blocked.");
        }
    }

    // --- تعديل دالة جلب الصوت لتقليل الحظر ---
    async _getAudioUrl(videoUrl) {
        // استخدام quality: 0 (جودة منخفضة) و htmert: false لتقليل كشف البوت
        return await play.stream(videoUrl, { 
            quality: 0, 
            discordPlayerCompatibility: true, 
            htmert: false,
            fallback: true 
        });
    }

    async _playNow(guildId, track) {
        const state = this._getState(guildId);
        try {
            const stream = await this._getAudioUrl(track.url);
            const resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
            resource.volume?.setVolume(state.volume);
            state.nowPlaying = track; state.playing = true; state.resource = resource;
            state.player.play(resource);
            await this.updateController(guildId).catch(() => { });
        } catch (error) {
            console.error('Play error:', error);
            state.playing = false; await this._playNext(guildId);
        }
    }

    async _playNext(guildId) {
        const state = this._getState(guildId);
        if (state.playing) return;
        const next = state.queue.shift();
        if (!next) { state.nowPlaying = null; return this.updateController(guildId).catch(() => { }); }
        await this._playNow(guildId, next).catch(() => this._playNext(guildId));
    }

    async enqueueByIds({ guildId, voiceChannelId, textChannelId, userId, query }) {
        const state = this._getState(guildId);
        state.textChannelId = textChannelId;
        await this._ensureConnection(guildId, voiceChannelId);
        const res = await this._resolveQuery(query);
        const track = { ...res, requestedBy: userId };

        if (!state.nowPlaying && !state.playing) {
            state.nowPlaying = track; await this._playNow(guildId, track);
        } else {
            state.queue.push(track); await this.updateController(guildId).catch(() => { });
        }
        return track;
    }

    togglePause(guildId) {
        const s = this._getState(guildId);
        s.player.state.status === AudioPlayerStatus.Paused ? s.player.unpause() : s.player.pause();
    }
    setVolume(guildId, vol) {
        const s = this._getState(guildId);
        s.volume = Math.max(0, Math.min(2, vol));
        if (s.resource?.volume) s.resource.volume.setVolume(s.volume);
    }
    skip(guildId) { this._getState(guildId).player.stop(true); }
    stop(guildId) {
        const s = this._getState(guildId);
        s.queue = []; s.nowPlaying = null; s.playing = false;
        try { s.player.stop(true); s.connection?.destroy(); } catch (_) { }
        s.connection = null;
    }
    toggleLoop(guildId) { const s = this._getState(guildId); s.looping = !s.looping; }

    _buildControllerComponents(guildId) {
        const s = this._getState(guildId);
        const paused = s.player.state.status === AudioPlayerStatus.Paused;
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('music_toggle').setStyle(ButtonStyle.Secondary).setLabel(paused ? 'Resume' : 'Pause'),
                new ButtonBuilder().setCustomId('music_skip').setStyle(ButtonStyle.Primary).setLabel('Skip'),
                new ButtonBuilder().setCustomId('music_stop').setStyle(ButtonStyle.Danger).setLabel('Stop'),
                new ButtonBuilder().setCustomId('music_loop').setStyle(s.looping ? ButtonStyle.Success : ButtonStyle.Secondary).setLabel(s.looping ? 'Loop: ON' : 'Loop: OFF'),
                new ButtonBuilder().setCustomId('music_queue').setStyle(ButtonStyle.Secondary).setLabel('Queue')
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('music_vol_down').setStyle(ButtonStyle.Secondary).setLabel('Vol -'),
                new ButtonBuilder().setCustomId('music_vol_up').setStyle(ButtonStyle.Secondary).setLabel('Vol +')
            )
        ];
    }

    _buildControllerEmbed(guildId) {
        const s = this._getState(guildId);
        const now = s.nowPlaying;
        const qLines = s.queue.slice(0, 5).map((t, i) => `${i + 1}. ${t.title}`).join('\n');
        const embed = new EmbedBuilder().setColor('#111827').setTitle('Music Control Panel').setTimestamp();
        embed.setDescription(now ? `**Now Playing:**\n${now.title}` : '**Now Playing:**\nNothing');
        if (now?.thumbnail) embed.setThumbnail(now.thumbnail);
        embed.addFields(
            { name: 'Queue', value: qLines.length ? qLines : 'Empty', inline: false },
            { name: 'Volume', value: `${Math.round(s.volume * 100)}%`, inline: true },
            { name: 'Loop', value: s.looping ? 'ON' : 'OFF', inline: true }
        );
        return embed;
    }

    async updateController(guildId) {
        const s = this._getState(guildId);
        if (!s.textChannelId) return;
        const channel = await this.client.channels.fetch(s.textChannelId).catch(() => null);
        if (!channel) return;
        const embed = this._buildControllerEmbed(guildId);
        const components = this._buildControllerComponents(guildId);
        if (s.controllerMessageId) {
            const msg = await channel.messages.fetch(s.controllerMessageId).catch(() => null);
            if (msg) return await msg.edit({ embeds: [embed], components });
        }
        const sent = await channel.send({ embeds: [embed], components });
        s.controllerMessageId = sent.id;
    }

    async handleButton(interaction) {
        const gId = interaction.guildId;
        const s = this._getState(gId);
        if (!s.voiceChannelId) return interaction.reply({ content: '❌ No active session.', ephemeral: true });
        switch (interaction.customId) {
            case 'music_toggle': this.togglePause(gId); break;
            case 'music_skip': this.skip(gId); break;
            case 'music_stop': this.stop(gId); break;
            case 'music_loop': this.toggleLoop(gId); break;
            case 'music_vol_down': this.setVolume(gId, s.volume - 0.1); break;
            case 'music_vol_up': this.setVolume(gId, s.volume + 0.1); break;
        }
        await interaction.deferUpdate().catch(() => { });
        await this.updateController(gId).catch(() => { });
    }
}

module.exports = MusicService;