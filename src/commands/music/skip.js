const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const THEME = require('../../utils/theme');
const { buildAssetAttachment } = require('../../utils/responseAssets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song'),
    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You must be in a voice channel.');
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            return interaction.reply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
        }

        const guildId = interaction.guild.id;
        let botInChannel = null;
        for (const bot of client.clones || [client]) {
            const g = bot.guilds.cache.get(guildId);
            if (!g) continue;
            if (g.members.me?.voice?.channelId === voiceChannel.id) {
                botInChannel = bot;
                break;
            }
        }

        if (!botInChannel?.music) {
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ No music bot in your voice channel.');
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            return interaction.reply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
        }

        try {
            const q = botInChannel.music.getQueue(guildId);
            if (!q.nowPlaying) {
                const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Nothing is playing right now.');
                const badAsset = buildAssetAttachment('wrong');
                if (badAsset?.url) err.setImage(badAsset.url);
                return interaction.reply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
            }

            const loading = new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription('⏳ Skipping...');
            const loadingAsset = buildAssetAttachment('loading');
            if (loadingAsset?.url) loading.setImage(loadingAsset.url);
            await interaction.reply({ embeds: [loading], files: loadingAsset?.attachment ? [loadingAsset.attachment] : [] });

            botInChannel.music.skip(guildId);
            await botInChannel.music.updateController(guildId).catch(() => { });
            const ok = new EmbedBuilder().setColor(THEME.COLORS.SUCCESS).setDescription('⏭️ Skipped.');
            const okAsset = buildAssetAttachment('ok');
            if (okAsset?.url) ok.setImage(okAsset.url);
            await interaction.editReply({ embeds: [ok], files: okAsset?.attachment ? [okAsset.attachment] : [] });
        } catch (e) {
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`❌ Error: ${e.message || e}`);
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            await interaction.reply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
        }
    }
};
