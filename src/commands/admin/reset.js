const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');

const ADMIN_ROLE = '1467466915902394461';
const CASINO_LOGS_ID = '1467466000214655150';

module.exports = {
    name: 'reset',
    async execute(message, client, args) {
        // Check admin role
        if (!message.member.roles.cache.has(ADMIN_ROLE)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You do not have permission to use this command.')] });
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please mention a user.')] });
        }

        let userProfile = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
        if (!userProfile) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ User profile not found.')] });
        }

        userProfile.wallet = 0;
        userProfile.bank = 0;
        userProfile.inventory = [];
        await userProfile.save();

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.SUCCESS)
            .setDescription(`✅ Reset **${targetUser.username}**'s economy data.`)
            .setFooter(THEME.FOOTER)
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Log to casino logs
        const logChannel = message.guild.channels.cache.get(CASINO_LOGS_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING)
                .setDescription(`🔄 **Admin Action** | ${message.author} reset ${targetUser}'s economy`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
};
