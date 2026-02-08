const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage, client) {
        if (!oldMessage.author || oldMessage.author.bot) return;
        if (oldMessage.content === newMessage.content) return; // Only process content changes

        // 1. Try to find by ID from config (Best)
        let logChannel = oldMessage.guild.channels.cache.get(client.config.logChannelId);

        // 2. Fallback: Try to find by name
        if (!logChannel) {
            logChannel = oldMessage.guild.channels.cache.find(c => c.name.toLowerCase().includes('logs') && c.isTextBased());
        }
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('📝 Message Edited')
            .addFields(
                { name: 'Author', value: `${oldMessage.author.tag}`, inline: true },
                { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
                { name: 'Before', value: oldMessage.content || '[No Content]' },
                { name: 'After', value: newMessage.content || '[No Content]' }
            )
            .setColor(client.config.colors.info)
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    },
};
