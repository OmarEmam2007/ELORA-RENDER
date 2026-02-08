const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const THEME = require('../../utils/theme');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Temporarily silences a user using Lunar stasis.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option => option.setName('target').setDescription('The user to timeout').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the silence')),

    async execute(interaction, client, args) {
        // --- 1. Hybrid Input ---
        const isSlash = interaction.isChatInputCommand?.();
        const user = isSlash ? interaction.user : interaction.author;

        let targetUser, duration, reason;

        if (isSlash) {
            targetUser = interaction.options.getUser('target');
            duration = interaction.options.getInteger('duration');
            reason = interaction.options.getString('reason') || 'Temporal Stasis Protocol';
        } else {
            // Prefix: !timeout @User [Duration] [Reason]
            const targetId = args[0]?.replace(/[<@!>]/g, '');
            if (!targetId || !args[1]) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`${THEME.ICONS.CROSS} **Usage:** \`!timeout @User [Minutes] [Reason]\``)]
                });
            }
            try {
                targetUser = await client.users.fetch(targetId);
            } catch (error) {
                return interaction.reply({ content: '❌ Invalid User', ephemeral: true });
            }

            duration = parseInt(args[1]);
            if (isNaN(duration)) return interaction.reply('❌ Invalid duration number.');
            reason = args.slice(2).join(' ') || 'Temporal Stasis Protocol';
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ User not in server.', ephemeral: true });
        if (!member.moderatable) return interaction.reply({ content: '⛔ Cannot timeout this user (Higher Rank).', ephemeral: true });

        // --- 2. Animation ---
        const frames = [
            '🧊 Initializing Stasis Field...',
            '⏳ Warping Timeline...',
            '🔇 Applying Silence...',
            '🧊 Stasis Complete.'
        ];

        let msg;
        const initEmbed = new EmbedBuilder().setColor(THEME.COLORS.ACCENT).setDescription(`${frames[0]}`);

        if (isSlash) {
            await interaction.reply({ embeds: [initEmbed] });
            msg = interaction;
        } else {
            msg = await interaction.reply({ embeds: [initEmbed] });
        }

        for (let i = 1; i < frames.length; i++) {
            await new Promise(r => setTimeout(r, 600));
            const embed = new EmbedBuilder().setColor(THEME.COLORS.ACCENT).setDescription(`${frames[i]}`);
            if (isSlash) await interaction.editReply({ embeds: [embed] });
            else await msg.edit({ embeds: [embed] });
        }

        // --- 3. Execute ---
        try {
            await member.timeout(duration * 60 * 1000, reason);

            const dmEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING)
                .setTitle(`🔇 Silenced in ${interaction.guild.name}`)
                .setDescription(`You remain in stasis for **${duration} minutes**.\nReason: ${reason}`)
                .setTimestamp();
            await targetUser.send({ embeds: [dmEmbed] }).catch(() => { });

            const successEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.ACCENT)
                .setAuthor({ 
                    name: '🔇 STASIS ACTIVE', 
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }) 
                })
                .setDescription(
                    `**Target:** ${targetUser.tag}\n` +
                    `**Duration:** ${duration} minutes\n` +
                    `**Reason:** ${reason}\n` +
                    `**Moderator:** ${user}`
                )
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            if (isSlash) await interaction.editReply({ embeds: [successEmbed] });
            else await msg.edit({ embeds: [successEmbed] });

        } catch (error) {
            console.error(error);
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Stasis field collapse (Error).');
            if (isSlash) await interaction.editReply({ embeds: [err] });
            else await msg.edit({ embeds: [err] });
        }
    },
};
