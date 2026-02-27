const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildBackup = require('../../models/GuildBackup');
const { createBackup, restoreFromBackup } = require('../../services/guildBackupService');
const { buildAssetAttachment } = require('../../utils/responseAssets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Create or restore a server structure backup (roles/channels/perms).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a new backup snapshot (MongoDB).')
                .addStringOption(o => o.setName('note').setDescription('Optional note for this backup').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List recent backups for this server.'))
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Show details about a backup id (safe / no changes).')
                .addStringOption(o => o.setName('id').setDescription('Backup document id').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('restore')
                .setDescription('RESTORE (wipe + rebuild) from a backup id. DANGEROUS!')
                .addStringOption(o => o.setName('id').setDescription('Backup document id').setRequired(true))
                .addStringOption(o => o.setName('confirm').setDescription('Type RESTORE to confirm').setRequired(true))),

    async execute(interaction, client) {
        if (!interaction.guild) {
            const badAsset = buildAssetAttachment('wrong');
            return interaction.reply({ content: '❌ This command can only be used in a server.', files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
        }

        // Owner gate (extra safety)
        if (interaction.user.id !== client.config.ownerId) {
            const secAsset = buildAssetAttachment('security');
            return interaction.reply({ content: '❌ Only the Bot Owner can use this command.', files: secAsset?.attachment ? [secAsset.attachment] : [], ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            await interaction.deferReply({ ephemeral: true });
            const note = interaction.options.getString('note') || null;

            const loadingAsset = buildAssetAttachment('loading');
            if (loadingAsset?.attachment) {
                await interaction.editReply({ content: '⏳ Creating backup...', files: [loadingAsset.attachment] }).catch(() => { });
            }

            try {
                const doc = await createBackup({
                    guild: interaction.guild,
                    createdBy: interaction.user.id,
                    note
                });

                const okAsset = buildAssetAttachment('security');

                return interaction.editReply({
                    content: `✅ Backup created.\nID: ${doc.id}\nCreatedAt: ${doc.createdAt.toISOString()}`,
                    files: okAsset?.attachment ? [okAsset.attachment] : []
                });
            } catch (e) {
                console.error('[Backup] create error:', e);
                const badAsset = buildAssetAttachment('wrong');
                return interaction.editReply({ content: '❌ Failed to create backup (check bot permissions and logs).', files: badAsset?.attachment ? [badAsset.attachment] : [] });
            }
        }

        if (sub === 'list') {
            await interaction.deferReply({ ephemeral: true });
            const docs = await GuildBackup.find({ guildId: interaction.guild.id })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean()
                .catch(() => []);

            if (!docs.length) {
                const infoAsset = buildAssetAttachment('info');
                return interaction.editReply({ content: 'No backups found for this server.', files: infoAsset?.attachment ? [infoAsset.attachment] : [] });
            }

            const lines = docs.map(d => {
                const note = d.note ? ` — ${d.note}` : '';
                return `- ${d._id} — ${new Date(d.createdAt).toISOString()}${note}`;
            });

            return interaction.editReply({ content: `Recent backups:\n${lines.join('\n')}` });
        }

        if (sub === 'info') {
            await interaction.deferReply({ ephemeral: true });
            const id = interaction.options.getString('id');

            const doc = await GuildBackup.findOne({ _id: id, guildId: interaction.guild.id }).lean().catch(() => null);
            if (!doc) {
                const badAsset = buildAssetAttachment('wrong');
                return interaction.editReply({ content: '❌ Backup not found for this server.', files: badAsset?.attachment ? [badAsset.attachment] : [] });
            }

            const rolesCount = Array.isArray(doc.snapshot?.roles) ? doc.snapshot.roles.length : 0;
            const channelsCount = Array.isArray(doc.snapshot?.channels) ? doc.snapshot.channels.length : 0;
            const note = doc.note ? `\nNote: ${doc.note}` : '';

            return interaction.editReply({
                content:
                    `Backup info:\n` +
                    `ID: ${doc._id}\n` +
                    `CreatedAt: ${new Date(doc.createdAt).toISOString()}\n` +
                    `Roles: ${rolesCount}\n` +
                    `Channels: ${channelsCount}` +
                    note
            });
        }

        if (sub === 'restore') {
            const id = interaction.options.getString('id');
            const confirm = interaction.options.getString('confirm');

            if (confirm !== 'RESTORE') {
                const cdAsset = buildAssetAttachment('cooldown');
                return interaction.reply({ content: '❌ Confirmation failed. Type RESTORE exactly.', files: cdAsset?.attachment ? [cdAsset.attachment] : [], ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const doc = await GuildBackup.findOne({ _id: id, guildId: interaction.guild.id }).catch(() => null);
                if (!doc) {
                    const badAsset = buildAssetAttachment('wrong');
                    return interaction.editReply({ content: '❌ Backup not found for this server.', files: badAsset?.attachment ? [badAsset.attachment] : [] });
                }

                await restoreFromBackup({ guild: interaction.guild, backupDoc: doc });

                const okAsset = buildAssetAttachment('unlock');

                return interaction.editReply({ content: '✅ Restore completed (best-effort). Check roles/channels/permissions.', files: okAsset?.attachment ? [okAsset.attachment] : [] });
            } catch (e) {
                console.error('[Backup] restore error:', e);
                const badAsset = buildAssetAttachment('wrong');
                return interaction.editReply({ content: '❌ Restore failed (best-effort). Check bot permissions/hierarchy and logs.', files: badAsset?.attachment ? [badAsset.attachment] : [] });
            }
        }

        return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
};
