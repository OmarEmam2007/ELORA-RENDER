const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const THEME = require('../../utils/theme');
const { buildAssetAttachment } = require('../../utils/responseAssets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play or queue a song')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('YouTube URL or search query')
                .setRequired(true)
        ),
    async execute(interaction, client) {
        const query = interaction.options.getString('song');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You must be in a voice channel.');
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            return interaction.reply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
        }

        if (voiceChannel.type === ChannelType.GuildStageVoice) {
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Stage channels are not supported. Use a normal voice channel.');
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            return interaction.reply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
        }

        const guildId = interaction.guild.id;

        let chosenBot = null;

        // 1) If a bot is already in this voice channel, use it
        for (const bot of client.clones || [client]) {
            const g = bot.guilds.cache.get(guildId);
            if (!g) continue;
            if (g.members.me?.voice?.channelId === voiceChannel.id) {
                chosenBot = bot;
                break;
            }
        }

        // 2) Otherwise find a free bot in this guild
        if (!chosenBot) {
            for (const bot of client.clones || [client]) {
                const g = bot.guilds.cache.get(guildId);
                if (!g) continue;
                if (!g.members.me?.voice?.channelId) {
                    chosenBot = bot;
                    break;
                }
            }
        }

        if (!chosenBot || !chosenBot.music) {
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ No available music bot right now.');
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            return interaction.reply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
        }

        await interaction.deferReply();
        try {
            const loading = new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription('⏳ Adding to queue...');
            const loadingAsset = buildAssetAttachment('loading');
            if (loadingAsset?.url) loading.setImage(loadingAsset.url);
            await interaction.editReply({ embeds: [loading], files: loadingAsset?.attachment ? [loadingAsset.attachment] : [] });

            const track = await chosenBot.music.enqueueByIds({
                guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
                userId: interaction.user.id,
                query,
            });

            const ok = new EmbedBuilder()
                .setColor(THEME.COLORS.SUCCESS)
                .setDescription(`✅ Added: **${track.title}**\n\nBot: **${chosenBot.user.username}**`);
            const okAsset = buildAssetAttachment('ok');
            if (okAsset?.url) ok.setImage(okAsset.url);
            await interaction.editReply({ embeds: [ok], files: okAsset?.attachment ? [okAsset.attachment] : [] });
        } catch (e) {
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`❌ Error: ${e.message || e}`);
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            await interaction.editReply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [] });
        }
    },
};
