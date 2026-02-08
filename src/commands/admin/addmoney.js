const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');
const { parseAmount } = require('../../utils/amountParser');

const ADMIN_ROLE = '1467466915902394461';
const CASINO_LOGS_ID = '1467466000214655150';

module.exports = {
    name: 'addmoney',
    aliases: ['add'],
    async execute(message, client, args) {
        // Check admin role
        if (!message.member.roles.cache.has(ADMIN_ROLE)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You do not have permission to use this command.')] });
        }

        const targetUser = message.mentions.users.first();
        const amount = parseAmount(args[1]);

        if (!targetUser) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please mention a user.')] });
        }

        if (!amount || amount === 'all' || amount <= 0) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please specify a valid amount (supports k notation: 3k = 3000).')] });
        }

        let userProfile = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
        if (!userProfile) {
            userProfile = new User({ userId: targetUser.id, guildId: message.guild.id });
        }

        userProfile.wallet = (userProfile.wallet || 0) + amount;
        await userProfile.save();

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.SUCCESS)
            .setDescription(`✅ Added \`${amount.toLocaleString()}\` coins to **${targetUser.username}**'s wallet.`)
            .setFooter(THEME.FOOTER)
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Log to casino logs
        const logChannel = message.guild.channels.cache.get(CASINO_LOGS_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.ACCENT)
                .setDescription(`💰 **Admin Action** | ${message.author} added \`${amount.toLocaleString()}\` coins to ${targetUser}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
};
