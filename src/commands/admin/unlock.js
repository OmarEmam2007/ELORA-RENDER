const { PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    name: 'unlock',
    async execute(message, client, args) {
        if (!message.guild) return;

        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ You need **Manage Channels** permission to use this.');
        }

        const me = message.guild.members.me || (await message.guild.members.fetchMe().catch(() => null));
        if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ I need **Manage Channels** permission.');
        }

        const unlockAll = (args[0] || '').toLowerCase() === 'all';

        const applyUnlock = async (channel) => {
            if (!channel || !channel.permissionOverwrites) return false;
            if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return false;
            const reason = `Unlocked by ${message.author.tag}`;

            // 1) Reset @everyone overwrites
            await channel.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                    SendMessages: null,
                    SendMessagesInThreads: null,
                    AddReactions: null
                },
                { reason }
            );

            // 2) Remove explicit DENIES we applied on other roles during lock.
            // We do NOT restore old "allow" states (since we didn't snapshot), we just clear the denies.
            let cleared = 0;
            for (const overwrite of channel.permissionOverwrites.cache.values()) {
                if (overwrite.type !== 0) continue; // only roles
                if (overwrite.id === message.guild.roles.everyone.id) continue;

                const deny = overwrite.deny;
                if (deny?.has(PermissionFlagsBits.SendMessages) || deny?.has(PermissionFlagsBits.SendMessagesInThreads) || deny?.has(PermissionFlagsBits.AddReactions)) {
                    await channel.permissionOverwrites.edit(
                        overwrite.id,
                        {
                            SendMessages: null,
                            SendMessagesInThreads: null,
                            AddReactions: null
                        },
                        { reason }
                    ).catch(() => { });
                    cleared++;
                }
            }

            channel.__eloraUnlockCleared = cleared;
            return true;
        };

        try {
            if (!unlockAll) {
                const ok = await applyUnlock(message.channel);
                if (!ok) return message.reply('❌ This channel type is not supported for unlock.');
                const cleared = message.channel.__eloraUnlockCleared || 0;
                return message.reply(`🔓 Channel unlocked.${cleared ? ` (Cleared ${cleared} role overwrite(s))` : ''}`);
            }

            let okCount = 0;
            let failCount = 0;

            const channels = message.guild.channels.cache
                .filter((c) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type));

            for (const [, ch] of channels) {
                try {
                    const ok = await applyUnlock(ch);
                    if (ok) okCount++;
                    else failCount++;
                } catch (_) {
                    failCount++;
                }
            }

            return message.reply(`🔓 Unlocked channels: **${okCount}**${failCount ? ` | Failed: **${failCount}**` : ''}`);
        } catch (e) {
            return message.reply(`❌ Error: ${e.message || e}`);
        }
    },
};
