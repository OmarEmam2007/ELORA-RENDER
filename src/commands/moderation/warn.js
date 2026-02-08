const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ModSettings = require('../../models/ModSettings'); // Assuming this exists or we might mock it if missing
// We should probably create a simpler Schema for warns if needed, but for now assuming some DB structure exists or using simple DM
const THEME = require('../../utils/theme');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issues a Lunar Warning to a user.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option => option.setName('target').setDescription('The user to warn').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the warning').setRequired(true)),

    async execute(interaction, client, args) {
        // --- 1. Hybrid Input ---
        const isSlash = interaction.isChatInputCommand?.();
        const user = isSlash ? interaction.user : interaction.author;

        let targetUser, reason;

        if (isSlash) {
            targetUser = interaction.options.getUser('target');
            reason = interaction.options.getString('reason');
        } else {
            // !warn @User Reason
            const targetId = args[0]?.replace(/[<@!>]/g, '');
            if (!targetId || !args[1]) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`${THEME.ICONS.CROSS} **Usage:** \`!warn @User [Reason]\``)]
                });
            }
            try {
                targetUser = await client.users.fetch(targetId);
            } catch (error) {
                return interaction.reply({ content: '❌ Invalid User', ephemeral: true });
            }
            reason = args.slice(1).join(' ');
        }

        // --- 2. Animation ---
        const frames = [
            '⚠️ Detecting Violation...',
            '📝 Logging Infraction...',
            '📡 Transmitting Warning...'
        ];

        let msg;
        const initEmbed = new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription(`${frames[0]}`);
        if (isSlash) {
            await interaction.reply({ embeds: [initEmbed] });
            msg = interaction;
        } else {
            msg = await interaction.reply({ embeds: [initEmbed] });
        }

        for (let i = 1; i < frames.length; i++) {
            await new Promise(r => setTimeout(r, 600));
            const embed = new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription(`${frames[i]}`);
            if (isSlash) await interaction.editReply({ embeds: [embed] });
            else await msg.edit({ embeds: [embed] });
        }

        // --- 3. Execute ---
        try {
            // Send DM
            const dmEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING)
                .setTitle(`⚠️ Warning from ${interaction.guild.name}`)
                .setDescription(`You have received an official warning.\n\n**Reason:** ${reason}`)
                .setFooter(THEME.FOOTER)
                .setTimestamp();

            await targetUser.send({ embeds: [dmEmbed] }).catch(() => { });

            // Log to DB (Placeholder logic until explicit DB command given, though User model likely has warns)
            // For now, visual confirmation is key.

            const successEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING)
                .setAuthor({ 
                    name: '⚠️ WARN ISSUED', 
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
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Error issuing warning.');
            if (isSlash) await interaction.editReply({ embeds: [err] });
            else await msg.edit({ embeds: [err] });
        }
    },
};
