const { EmbedBuilder } = require('discord.js');
const { getGuildLogChannel } = require('../../utils/getGuildLogChannel');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage, client) {
        if (!oldMessage.author || oldMessage.author.bot) return;
        if (oldMessage.content === newMessage.content) return; // Only process content changes

        const logChannel = await getGuildLogChannel(oldMessage.guild, client);
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
