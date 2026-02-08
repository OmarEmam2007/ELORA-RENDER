const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');
const { parseAmount } = require('../../utils/amountParser');

module.exports = {
    name: 'dep',
    aliases: ['deposit'],
    async execute(message, client, args) {
        const parsedAmount = parseAmount(args[0]);
        
        if (!parsedAmount || parsedAmount === 'all' || parsedAmount <= 0) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please specify a valid amount to deposit (supports k notation: 3k = 3000, or use `all`).')] });
        }

        let userProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!userProfile) {
            userProfile = new User({ userId: message.author.id, guildId: message.guild.id });
        }

        const walletBalance = userProfile.wallet || 0;
        const amount = parsedAmount === 'all' ? walletBalance : parsedAmount;

        if (walletBalance < amount) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You don\'t have enough coins in your wallet.')] });
        }

        userProfile.wallet = walletBalance - amount;
        userProfile.bank = (userProfile.bank || 0) + amount;
        await userProfile.save();

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.SUCCESS)
            .setDescription(`✅ Deposited \`${amount.toLocaleString()}\` coins to your bank.\n\n💵 Wallet: \`${userProfile.wallet.toLocaleString()}\`\n🏦 Bank: \`${userProfile.bank.toLocaleString()}\``)
            .setFooter(THEME.FOOTER)
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};
