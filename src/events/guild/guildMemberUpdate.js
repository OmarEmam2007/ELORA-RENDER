const { EmbedBuilder } = require('discord.js');
const { PermissionFlagsBits } = require('discord.js');
const NicknameLock = require('../../models/NicknameLock');

module.exports = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember, client) {
        // Nickname Change Logger
        if (oldMember.nickname !== newMember.nickname) {
            // --- 🔒 Nickname Lock Enforcement ---
            try {
                const OWNER_ROLE_ID = '1461766723274412126';
                const hasOwnerRole = newMember.roles?.cache?.has(OWNER_ROLE_ID);
                const isOwnerId = client?.config?.ownerId && newMember.id === client.config.ownerId;
                const isStaff = newMember.permissions?.has(PermissionFlagsBits.ManageNicknames);

                if (!hasOwnerRole && !isOwnerId && !isStaff) {
                    const lock = await NicknameLock.findOne({ guildId: newMember.guild.id, userId: newMember.id, locked: true }).catch(() => null);
                    if (lock) {
                        const desired = lock.nickname || null;

                        // Avoid pointless calls.
                        if ((newMember.nickname || null) !== desired) {
                            // Revert nickname back.
                            await newMember.setNickname(desired, 'Nickname lock enforced').catch(() => { });
                            return; // Stop here to avoid logging the enforced revert as a user action.
                        }
                    }
                }
            } catch (e) {
                // Best-effort
            }

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
