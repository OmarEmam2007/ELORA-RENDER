const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    async execute(message, client, args) {
        const type = args[0]?.toLowerCase() || 'money';
        const sortKey = type === 'xp' || type === 'level' ? 'xp' : 'wallet';

        const topUsers = await User.find({ guildId: message.guild.id })
            .sort({ [sortKey]: -1 })
            .limit(10);

        if (!topUsers.length) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ No users found yet!')] });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏆 Top 10 - ${type === 'xp' || type === 'level' ? 'Levels' : 'Rich List'}`)
            .setColor(THEME.COLORS.ACCENT)
            .setTimestamp();

        let description = '';
        for (let i = 0; i < topUsers.length; i++) {
            const userProfile = topUsers[i];
            const user = await client.users.fetch(userProfile.userId).catch(() => null);
            const tag = user ? user.username : 'Unknown User';
            const wallet = (userProfile.wallet || 0) + (userProfile.bank || 0);
            const value = type === 'xp' || type === 'level' ? `Lvl ${userProfile.level} (${userProfile.xp} XP)` : `${wallet.toLocaleString()} Coins`;

            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            description += `${medal} **${tag}** - ${value}\n`;
        }

        embed.setDescription(description);
        embed.setFooter(THEME.FOOTER);

        await message.reply({ embeds: [embed] });
    }
};
