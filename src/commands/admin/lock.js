const { PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    name: 'lock',
    async execute(message, client, args) {
        if (!message.guild) return;

        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ You need **Manage Channels** permission to use this.');
        }

        const me = message.guild.members.me || (await message.guild.members.fetchMe().catch(() => null));
        if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ I need **Manage Channels** permission.');
        }

        const lockAll = (args[0] || '').toLowerCase() === 'all';

        const applyLock = async (channel) => {
            if (!channel || !channel.permissionOverwrites) return false;
            if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return false;
            const reason = `Locked by ${message.author.tag}`;

            // 1) Lock @everyone
            await channel.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                    SendMessages: false,
                    SendMessagesInThreads: false,
                    AddReactions: false
                },
                { reason }
            );

            // 2) If any role overwrite explicitly ALLOWS sending, deny it too.
            // This prevents cases where a "Members" role has SendMessages: true.
            let tightened = 0;
            for (const overwrite of channel.permissionOverwrites.cache.values()) {
                if (overwrite.type !== 0) continue; // only roles
                if (overwrite.id === message.guild.roles.everyone.id) continue;

                const allow = overwrite.allow;
                if (allow?.has(PermissionFlagsBits.SendMessages) || allow?.has(PermissionFlagsBits.SendMessagesInThreads)) {
                    await channel.permissionOverwrites.edit(
                        overwrite.id,
                        {
                            SendMessages: false,
                            SendMessagesInThreads: false
                        },
                        { reason }
                    ).catch(() => { });
                    tightened++;
                }
            }

            channel.__eloraLockTightened = tightened;
            return true;
        };

        try {
            if (!lockAll) {
                const ok = await applyLock(message.channel);
                if (!ok) return message.reply('❌ This channel type is not supported for lock.');
                const tightened = message.channel.__eloraLockTightened || 0;
                return message.reply(`🔒 Channel locked.${tightened ? ` (Tightened ${tightened} role overwrite(s))` : ''}`);
            }

            let okCount = 0;
            let failCount = 0;

            const channels = message.guild.channels.cache
                .filter((c) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type));

            for (const [, ch] of channels) {
                try {
                    const ok = await applyLock(ch);
                    if (ok) okCount++;
                    else failCount++;
                } catch (_) {
                    failCount++;
                }
            }

            return message.reply(`🔒 Locked channels: **${okCount}**${failCount ? ` | Failed: **${failCount}**` : ''}`);
        } catch (e) {
            return message.reply(`❌ Error: ${e.message || e}`);
        }
    },
};
