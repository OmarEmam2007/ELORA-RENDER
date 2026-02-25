const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const THEME = require('../../utils/theme');
const { getGuildLogChannel } = require('../../utils/getGuildLogChannel');

module.exports = {
    name: 'messageDelete',
    async execute(message, client) {
        if (!message.author) return; 
        if (message.author.bot) return;

        const logChannel = await getGuildLogChannel(message.guild, client);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .addFields(
                { name: 'Author', value: `${message.author.tag}`, inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Content', value: message.content || '[No Content/Image]' }
            )
            .setColor(THEME.COLORS.GRAVITY)
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    },
};
