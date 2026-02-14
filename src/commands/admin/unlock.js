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
            await channel.permissionOverwrites.edit(
                message.guild.roles.everyone,
                { SendMessages: null },
                { reason: `Unlocked by ${message.author.tag}` }
            );
            return true;
        };

        try {
            if (!unlockAll) {
                const ok = await applyUnlock(message.channel);
                if (!ok) return message.reply('❌ This channel type is not supported for unlock.');
                return message.reply('🔓 Channel unlocked.');
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
