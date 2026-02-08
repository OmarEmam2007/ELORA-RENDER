const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resumes the paused music'),
    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
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
            return interaction.reply({ content: '❌ No music bot in your voice channel.', ephemeral: true });
        }

        try {
            const q = botInChannel.music.getQueue(guildId);
            if (!q.nowPlaying) {
                return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
            }
            if (!q.paused) {
                return interaction.reply({ content: '▶️ The music is already playing!', ephemeral: true });
            }
            botInChannel.music.togglePause(guildId);
            await botInChannel.music.updateController(guildId).catch(() => { });
            await interaction.reply('▶️ Resumed.');
        } catch (e) {
            await interaction.reply({ content: `❌ Error: ${e.message || e}`, ephemeral: true });
        }
    }
};
