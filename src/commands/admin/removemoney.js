const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');
const { parseAmount } = require('../../utils/amountParser');

const ADMIN_ROLE = '1467466915902394461';
const CASINO_LOGS_ID = '1467466000214655150';

module.exports = {
    name: 'removemoney',
    aliases: ['remove', 'rm'],
    async execute(message, client, args) {
        // Check admin role
        if (!message.member.roles.cache.has(ADMIN_ROLE)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You do not have permission to use this command.')] });
        }

        const targetUser = message.mentions.users.first();
        const parsedAmount = parseAmount(args[1]);

        if (!targetUser) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please mention a user.')] });
        }

        if (!parsedAmount || (parsedAmount !== 'all' && parsedAmount <= 0)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please specify a valid amount or use `all`.')] });
        }

        let userProfile = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
        if (!userProfile) {
            userProfile = new User({ userId: targetUser.id, guildId: message.guild.id });
        }

        const totalMoney = (userProfile.wallet || 0) + (userProfile.bank || 0);
        const amount = parsedAmount === 'all' ? totalMoney : parsedAmount;

        if (totalMoney < amount) {
            userProfile.wallet = 0;
            userProfile.bank = 0;
        } else {
            if ((userProfile.wallet || 0) >= amount) {
                userProfile.wallet = (userProfile.wallet || 0) - amount;
            } else {
                const remaining = amount - (userProfile.wallet || 0);
                userProfile.wallet = 0;
                userProfile.bank = Math.max(0, (userProfile.bank || 0) - remaining);
            }
        }

        await userProfile.save();

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.SUCCESS)
            .setDescription(`✅ Removed \`${amount.toLocaleString()}\` coins from **${targetUser.username}**.`)
            .setFooter(THEME.FOOTER)
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Log to casino logs
        const logChannel = message.guild.channels.cache.get(CASINO_LOGS_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.ERROR)
                .setDescription(`💰 **Admin Action** | ${message.author} removed \`${amount.toLocaleString()}\` coins from ${targetUser}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
};
