const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const THEME = require('../../utils/theme');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kicks a user from the server with Lunar authority.')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option => option.setName('target').setDescription('The user to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the kick')),

    async execute(interaction, client, args) {
        // --- 1. Hybrid Input Handling ---
        const isSlash = interaction.isChatInputCommand?.();
        const user = isSlash ? interaction.user : interaction.author;

        let targetUser, reason;

        if (isSlash) {
            targetUser = interaction.options.getUser('target');
            reason = interaction.options.getString('reason') || 'Minor Infraction';
        } else {
            // Prefix: !kick @User [Reason]
            const targetId = args[0]?.replace(/[<@!>]/g, '');
            if (!targetId) {
                const guide = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`${THEME.ICONS.CROSS} **Usage:** \`!kick @User [Reason]\``);
                return interaction.reply({ embeds: [guide] });
            }

            try {
                targetUser = await client.users.fetch(targetId);
            } catch (e) {
                return interaction.reply({ content: `${THEME.ICONS.CROSS} **Target Lost:** User not found.`, ephemeral: true });
            }

            reason = args.slice(1).join(' ') || 'Minor Infraction';
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: `${THEME.ICONS.CROSS} **Error:** User not physically present in this dimension (server).`, ephemeral: true });
        }

        const SPECIAL_EXECUTOR_ID = '1380794290350981130';
        const SPECIAL_TARGET_ID = '1258440001616744542';
        if (user?.id === SPECIAL_EXECUTOR_ID && targetUser?.id === SPECIAL_TARGET_ID) {
            return interaction.reply({ content: "AhMeD_kErA has complete control now, i can't kick him." });
        }

        if (!member.kickable) {
            const err = new EmbedBuilder()
                .setColor(THEME.COLORS.ERROR)
                .setDescription(`🚫 **Privilege Error:** Cannot kick **${targetUser.tag}** (Higher Rank).`);
            return interaction.reply({ embeds: [err], ephemeral: true });
        }

        // --- 2. Pseudo-Animation ---
        const frames = [
            '⚠️ Initiating Removal Protocol...',
            '📉 Decreasing Social Credit...',
            '👢 Calibrating Boot...',
            '💨 Execute.'
        ];

        let msg;
        const initialEmbed = new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription(`${frames[0]}`);

        if (isSlash) {
            await interaction.reply({ embeds: [initialEmbed] });
            msg = interaction;
        } else {
            msg = await interaction.reply({ embeds: [initialEmbed] });
        }

        // Play Animation
        for (let i = 1; i < frames.length; i++) {
            await new Promise(r => setTimeout(r, 700));
            if (isSlash) await interaction.editReply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription(`${frames[i]}`)] });
            else await msg.edit({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription(`${frames[i]}`)] });
        }

        // --- 3. Execution ---
        try {
            await targetUser.send(`👢 **Kicked from ${interaction.guild.name}**\nReason: ${reason}`).catch(() => { });

            await member.kick(reason);

            const successEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING) // Yellow/Gold for Kicks
                .setAuthor({ 
                    name: '👢 KICK EXECUTED', 
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }) 
                })
                .setDescription(
                    `**Target:** ${targetUser.tag}\n` +
                    `**Reason:** ${reason}\n` +
                    `**Moderator:** ${user}`
                )
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            if (isSlash) await interaction.editReply({ embeds: [successEmbed] });
            else await msg.edit({ embeds: [successEmbed] });

        } catch (error) {
            console.error(error);
            const errEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.ERROR)
                .setDescription('❌ **Error:** Kick sequence failed.');

            if (isSlash) await interaction.editReply({ embeds: [errEmbed] });
            else await msg.edit({ embeds: [errEmbed] });
        }
    },
};
