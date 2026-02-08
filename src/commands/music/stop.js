const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music in YOUR channel.'),
    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.reply({ content: '❌ Join the voice channel first.', ephemeral: true });

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
            botInChannel.music.stop(guildId);
            await interaction.reply('⏹️ Stopped.');
        } catch (e) {
            await interaction.reply({ content: `❌ Error: ${e.message || e}`, ephemeral: true });
        }
    },
};
