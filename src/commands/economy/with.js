const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');
const { parseAmount } = require('../../utils/amountParser');

module.exports = {
    name: 'with',
    aliases: ['withdraw'],
    async execute(message, client, args) {
        const parsedAmount = parseAmount(args[0]);
        
        if (!parsedAmount || (parsedAmount !== 'all' && parsedAmount <= 0)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please specify a valid amount to withdraw (supports k notation: 3k = 3000, or use `all`).')] });
        }

        let userProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!userProfile) {
            userProfile = new User({ userId: message.author.id, guildId: message.guild.id });
        }

        const bankBalance = userProfile.bank || 0;
        const withdrawAmount = parsedAmount === 'all' ? bankBalance : parsedAmount;

        if (bankBalance < withdrawAmount) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You don\'t have enough coins in your bank.')] });
        }

        userProfile.bank = bankBalance - withdrawAmount;
        userProfile.wallet = (userProfile.wallet || 0) + withdrawAmount;
        await userProfile.save();

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.SUCCESS)
            .setDescription(`✅ Withdrew \`${withdrawAmount.toLocaleString()}\` coins from your bank.\n\n💵 Wallet: \`${userProfile.wallet.toLocaleString()}\`\n🏦 Bank: \`${userProfile.bank.toLocaleString()}\``)
            .setFooter(THEME.FOOTER)
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};
