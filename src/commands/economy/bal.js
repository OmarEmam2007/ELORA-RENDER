const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');

module.exports = {
    name: 'bal',
    aliases: ['balance', 'money', 'wallet'],
    async execute(message, client, args) {
        const targetUser = message.mentions.users.first() || message.author;
        let userProfile = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });

        if (!userProfile) {
            userProfile = new User({ userId: targetUser.id, guildId: message.guild.id });
            await userProfile.save();
        }

        const total = (userProfile.wallet || 0) + (userProfile.bank || 0);

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.ACCENT)
            .setAuthor({
                name: `${targetUser.username}'s Balance`,
                iconURL: targetUser.displayAvatarURL({ dynamic: true })
            })
            .addFields(
                { name: '💵 Wallet', value: `\`${(userProfile.wallet || 0).toLocaleString()}\` coins`, inline: true },
                { name: '🏦 Bank', value: `\`${(userProfile.bank || 0).toLocaleString()}\` coins`, inline: true },
                { name: '💰 Total', value: `\`${total.toLocaleString()}\` coins`, inline: true }
            )
            .setFooter(THEME.FOOTER)
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};
