const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Shows the current music queue')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Queue page number')
                .setMinValue(1)
        ),
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

        const q = botInChannel.music.getQueue(guildId);
        const page = interaction.options.getInteger('page') || 1;
        const itemsPerPage = 10;
        const totalPages = Math.max(1, Math.ceil(q.queue.length / itemsPerPage));
        if (page > totalPages) {
            return interaction.reply({ content: `❌ There are only ${totalPages} pages.`, ephemeral: true });
        }

        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, q.queue.length);
        const queueLines = q.queue.slice(startIndex, endIndex).map((t, idx) => `${startIndex + idx + 1}. ${t.title}`).join('\n');

        const embed = new EmbedBuilder()
            .setAuthor({ name: `🎵 Music Queue - Page ${page}/${totalPages}`, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(
                `**Now Playing:**\n${q.nowPlaying ? q.nowPlaying.title : 'Nothing'}\n\n` +
                `**Queue:**\n${queueLines.length ? queueLines : 'Empty'}\n\n` +
                `**Stats:** ${q.queue.length} songs • Loop: ${q.looping ? 'ON' : 'OFF'} • ${q.paused ? 'Paused' : 'Playing'}`
            )
            .setColor('#0099FF')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
