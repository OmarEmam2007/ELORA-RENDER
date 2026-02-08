const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');
const { parseAmount } = require('../../utils/amountParser');

module.exports = {
    name: 'give',
    aliases: ['pay', 'transfer'],
    async execute(message, client, args) {
        const targetUser = message.mentions.users.first();
        const amount = parseAmount(args[1]);

        if (!targetUser || targetUser.bot) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please mention a valid user.')] });
        }

        if (!amount || amount === 'all' || amount <= 0) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please specify a valid amount (supports k notation: 3k = 3000).')] });
        }

        if (targetUser.id === message.author.id) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You cannot give money to yourself.')] });
        }

        let senderProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!senderProfile) {
            senderProfile = new User({ userId: message.author.id, guildId: message.guild.id });
        }

        let receiverProfile = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
        if (!receiverProfile) {
            receiverProfile = new User({ userId: targetUser.id, guildId: message.guild.id });
        }

        // Check if sender has The Whale role (0% tax)
        const hasWhaleRole = message.member.roles.cache.has('1467467891627655310');
        const taxRate = hasWhaleRole ? 0 : 0.05;
        const tax = Math.floor(amount * taxRate);
        const totalCost = amount + tax;

        if ((senderProfile.wallet || 0) < totalCost) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`❌ You need \`${totalCost.toLocaleString()}\` coins (including ${tax > 0 ? `${(taxRate * 100)}% tax` : 'no tax'}).`)] });
        }

        senderProfile.wallet = (senderProfile.wallet || 0) - totalCost;
        receiverProfile.wallet = (receiverProfile.wallet || 0) + amount;
        await senderProfile.save();
        await receiverProfile.save();

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.SUCCESS)
            .setDescription(`✅ You gave \`${amount.toLocaleString()}\` coins to ${targetUser}${tax > 0 ? `\n💰 Tax: \`${tax.toLocaleString()}\` coins (${(taxRate * 100)}%)` : '\n💸 **The Whale**: No tax applied!'}`)
            .setFooter(THEME.FOOTER)
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};
