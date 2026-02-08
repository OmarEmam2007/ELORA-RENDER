const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'nick',
    async execute(message, client, args) {
        if (!message.guild) return;

        if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return message.reply('❌ You need **Manage Nicknames** permission to use this.');
        }

        const me = message.guild.members.me || (await message.guild.members.fetchMe().catch(() => null));
        if (!me?.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return message.reply('❌ I need **Manage Nicknames** permission.');
        }

        const target = message.mentions.members.first();
        if (!target) {
            return message.reply('❌ Usage: `elora nick @member NewNickname` أو `elora nick @member reset`');
        }

        const mentionIndex = args.findIndex((a) => a.includes('<@'));
        const nickname = args.slice(Math.max(mentionIndex, 0) + 1).join(' ').trim();

        if (!nickname) {
            return message.reply('❌ Please provide a nickname. مثال: `elora nick @member mr.x` أو `elora nick @member reset`');
        }

        const lowered = nickname.toLowerCase();
        const shouldReset = ['reset', 'clear', 'off', 'remove', 'none', 'default'].includes(lowered);

        if (shouldReset) {
            try {
                await target.setNickname(null);
                return message.reply(`✅ Nickname cleared for **${target.user.username}**`);
            } catch (e) {
                return message.reply('❌ I cannot change this user nickname (role hierarchy / missing permission).');
            }
        }

        if (nickname.length > 32) {
            return message.reply('❌ Nickname is too long (max 32).');
        }

        try {
            await target.setNickname(nickname);
            return message.reply(`✅ Nickname updated for **${target.user.username}** to **${nickname}**`);
        } catch (e) {
            return message.reply('❌ I cannot change this user nickname (role hierarchy / missing permission).');
        }
    },
};
