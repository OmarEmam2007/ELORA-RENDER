const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const THEME = require('../../utils/theme');
const { buildAssetAttachment } = require('../../utils/responseAssets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music in YOUR channel.'),
    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Join a voice channel first.');
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
            botInChannel.music.stop(guildId);
            const ok = new EmbedBuilder().setColor(THEME.COLORS.SUCCESS).setDescription('⏹️ Stopped.');
            const okAsset = buildAssetAttachment('ok');
            if (okAsset?.url) ok.setImage(okAsset.url);
            await interaction.reply({ embeds: [ok], files: okAsset?.attachment ? [okAsset.attachment] : [] });
        } catch (e) {
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`❌ Error: ${e.message || e}`);
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            await interaction.reply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
        }
    },
};
