const { EmbedBuilder } = require('discord.js');
const { getGuildLogChannel } = require('../../utils/getGuildLogChannel');

module.exports = {
    name: 'guildUpdate',
    async execute(oldGuild, newGuild, client) {
        try {
            const logChannel = await getGuildLogChannel(newGuild, client);
            if (!logChannel) return;

            const changes = [];

            if (oldGuild.name !== newGuild.name) {
                changes.push({ name: 'Name', value: `${oldGuild.name} ➜ ${newGuild.name}`, inline: false });
            }

            if ((oldGuild.iconURL() || null) !== (newGuild.iconURL() || null)) {
                changes.push({ name: 'Icon', value: 'Server icon was updated.', inline: false });
            }

            if (!changes.length) return;

            const embed = new EmbedBuilder()
                .setTitle('🛠️ Server Updated')
                .setColor(client?.config?.colors?.info || '#5865F2')
                .addFields(changes)
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => { });
        } catch (e) {
            console.error('guildUpdate log error:', e);
        }
    }
};
