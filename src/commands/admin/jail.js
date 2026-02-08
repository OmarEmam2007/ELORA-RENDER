const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');

const MODERATOR_ROLE = '1467467348595314740';
const ADMIN_ROLE = '1467466915902394461';
const JAILED_ROLE = '1467467538551279769';
const CASINO_LOGS_ID = '1467466000214655150';

module.exports = {
    name: 'jail',
    async execute(message, client, args) {
        // Check moderator or admin role
        if (!message.member.roles.cache.has(MODERATOR_ROLE) && !message.member.roles.cache.has(ADMIN_ROLE)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You do not have permission to use this command.')] });
        }

        const targetUser = message.mentions.users.first();
        const duration = parseInt(args[1]); // Duration in hours

        if (!targetUser) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please mention a user.')] });
        }

        if (!duration || isNaN(duration) || duration <= 0) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please specify a valid duration in hours.')] });
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ User not found in this server.')] });
        }

        // Add jailed role
        const jailedRole = message.guild.roles.cache.get(JAILED_ROLE);
        if (jailedRole) {
            await targetMember.roles.add(jailedRole).catch(() => {});
        }

        // Update user profile
        let userProfile = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
        if (!userProfile) {
            userProfile = new User({ userId: targetUser.id, guildId: message.guild.id });
        }

        userProfile.jailed = true;
        userProfile.jailReleaseTime = new Date(Date.now() + duration * 60 * 60 * 1000);
        await userProfile.save();

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.WARNING)
            .setDescription(`🔒 Jailed **${targetUser.username}** for **${duration}** hour(s).`)
            .setFooter(THEME.FOOTER)
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Log to casino logs
        const logChannel = message.guild.channels.cache.get(CASINO_LOGS_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.ERROR)
                .setDescription(`🔒 **Jail** | ${message.author} jailed ${targetUser} for ${duration} hour(s)`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
};
