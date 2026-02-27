const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const WarnCase = require('../../models/WarnCase');
const THEME = require('../../utils/theme');
const { buildAssetAttachment } = require('../../utils/responseAssets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user and manage warning cases.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Issue a warning to a user.')
                .addUserOption(option => option.setName('target').setDescription('The user to warn').setRequired(true))
                .addStringOption(option => option.setName('reason').setDescription('Reason for the warning').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List warnings for a user.')
                .addUserOption(option => option.setName('target').setDescription('The user').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('clear')
                .setDescription('Clear all warnings for a user.')
                .addUserOption(option => option.setName('target').setDescription('The user').setRequired(true))
        ),

    async execute(interaction, client, args) {
        if (!interaction.isChatInputCommand?.()) return;
        if (!interaction.guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });

        const sub = interaction.options.getSubcommand();

        if (sub === 'list') {
            const target = interaction.options.getUser('target');
            const warns = await WarnCase.find({ guildId: interaction.guildId, userId: target.id })
                .sort({ createdAt: -1 })
                .limit(20)
                .catch(() => []);

            const desc = warns.length
                ? warns.map((w, i) => `**${i + 1}.** <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R> — ${w.reason} (by <@${w.moderatorId}>)`).join('\n')
                : 'No warnings found.';

            const embed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING)
                .setTitle(`⚠️ Warnings for ${target.tag}`)
                .setDescription(desc)
                .setFooter(THEME.FOOTER);

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'clear') {
            const target = interaction.options.getUser('target');
            const res = await WarnCase.deleteMany({ guildId: interaction.guildId, userId: target.id }).catch(() => null);
            const deleted = res?.deletedCount || 0;
            return interaction.reply({ content: `✅ Cleared ${deleted} warning(s) for ${target}.`, ephemeral: true });
        }

        if (sub !== 'add') return;

        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason');

        await interaction.deferReply({ ephemeral: true });

        try {
            await WarnCase.create({
                guildId: interaction.guildId,
                userId: targetUser.id,
                moderatorId: interaction.user.id,
                reason
            });

            const warnCount = await WarnCase.countDocuments({ guildId: interaction.guildId, userId: targetUser.id }).catch(() => 0);

            const dmEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING)
                .setTitle(`⚠️ Warning from ${interaction.guild.name}`)
                .setDescription(`You have received an official warning.\n\n**Reason:** ${reason}\n**Total Warnings:** ${warnCount}`)
                .setFooter(THEME.FOOTER)
                .setTimestamp();

            await targetUser.send({ embeds: [dmEmbed] }).catch(() => { });

            let timeoutApplied = false;
            if (warnCount >= 3) {
                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (member?.moderatable) {
                    const twelveHoursMs = 12 * 60 * 60 * 1000;
                    await member.timeout(twelveHoursMs, 'Auto-timeout: reached warning threshold (3)').catch(() => null);
                    timeoutApplied = true;
                }
            }

            const successEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING)
                .setAuthor({
                    name: '⚠️ WARNING ISSUED',
                    iconURL: targetUser.displayAvatarURL({ dynamic: true })
                })
                .setDescription(
                    `**Target:** ${targetUser.tag}\n` +
                    `**Reason:** ${reason}\n` +
                    `**Moderator:** ${interaction.user}\n` +
                    `**Total Warnings:** ${warnCount}\n` +
                    `**Auto Action:** ${timeoutApplied ? '12h timeout applied' : 'None'}`
                )
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            const okAsset = buildAssetAttachment('ok');
            if (okAsset?.url) successEmbed.setImage(okAsset.url);

            await interaction.editReply({ embeds: [successEmbed], files: okAsset?.attachment ? [okAsset.attachment] : [] });
        } catch (error) {
            console.error(error);
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Error issuing warning.');
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            await interaction.editReply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [] });
        }
    },
};
