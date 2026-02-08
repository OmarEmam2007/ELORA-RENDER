const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');

const MODERATOR_ROLE = '1467467348595314740';
const ADMIN_ROLE = '1467466915902394461';
const JAILED_ROLE = '1467467538551279769';
const CASINO_LOGS_ID = '1467466000214655150';

module.exports = {
    name: 'unjail',
    async execute(message, client, args) {
        // Check moderator or admin role
        if (!message.member.roles.cache.has(MODERATOR_ROLE) && !message.member.roles.cache.has(ADMIN_ROLE)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You do not have permission to use this command.')] });
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please mention a user.')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ User not found in this server.')] });
        }

        // Remove jailed role
        const jailedRole = message.guild.roles.cache.get(JAILED_ROLE);
        if (jailedRole && targetMember.roles.cache.has(JAILED_ROLE)) {
            await targetMember.roles.remove(jailedRole).catch(() => {});
        }

        // Update user profile
        let userProfile = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
        if (userProfile) {
            userProfile.jailed = false;
            userProfile.jailReleaseTime = null;
            await userProfile.save();
        }

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.SUCCESS)
            .setDescription(`✅ Unjailed **${targetUser.username}**.`)
            .setFooter(THEME.FOOTER)
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Log to casino logs
        const logChannel = message.guild.channels.cache.get(CASINO_LOGS_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.SUCCESS)
                .setDescription(`🔓 **Unjail** | ${message.author} unjailed ${targetUser}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
};
