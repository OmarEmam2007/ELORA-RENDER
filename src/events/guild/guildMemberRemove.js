const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        try {
            const goodbyeChannelId = client.config.goodbyeChannelId;
            if (!goodbyeChannelId) return; // No goodbye channel configured

            const channel = member.guild.channels.cache.get(goodbyeChannelId);
            if (!channel) {
                console.error(`Goodbye channel ${goodbyeChannelId} not found.`);
                return;
            }

            const embed = new EmbedBuilder()
                .setDescription(`━━━━━━━━━━━━━━━━━━━━━━━━\n**Farewell, ${member.user.tag}.**\nYour presence will be missed.\n━━━━━━━━━━━━━━━━━━━━━━━━`)
                .setColor(client.config.colors.primary)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Member Count: ${member.guild.memberCount}` })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            console.log(`👋 Goodbye message sent for ${member.user.tag} (${member.id})`);
        } catch (error) {
            console.error('Error sending goodbye message:', error);
        }
    },
};
