const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember, client) {
        // Nickname Change Logger
        if (oldMember.nickname !== newMember.nickname) {
            let logChannel = oldMember.guild.channels.cache.get(client.config.logChannelId);
            if (!logChannel) {
                logChannel = oldMember.guild.channels.cache.find(c => c.name.toLowerCase().includes('logs') && c.isTextBased());
            }
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🏷️ Nickname Changed')
                    .addFields(
                        { name: 'User', value: `${newMember.user.tag}`, inline: true },
                        { name: 'Before', value: oldMember.nickname || oldMember.user.username },
                        { name: 'After', value: newMember.nickname || newMember.user.username }
                    )
                    .setColor(client.config.colors.info)
                    .setTimestamp();
                logChannel.send({ embeds: [embed] });
            }
        }
    },
};
