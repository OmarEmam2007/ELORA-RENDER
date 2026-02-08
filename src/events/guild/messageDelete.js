const { EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'messageDelete',
    async execute(message, client) {
        if (!message.author) return; 
        if (message.author.bot) return;

        // 1. Get Log Channel from Config
        const logChannel = message.guild.channels.cache.get(client.config.logChannelId);

        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .addFields(
                { name: 'Author', value: `${message.author.tag}`, inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Content', value: message.content || '[No Content/Image]' }
            )
            .setColor(client.config.colors.error)
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    },
};
