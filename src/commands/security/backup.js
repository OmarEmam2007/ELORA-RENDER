const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildBackup = require('../../models/GuildBackup');
const { createBackup, restoreFromBackup } = require('../../services/guildBackupService');
const { buildAssetAttachment, makeError, makeInfo, makeLoading, makeSecurity, makeSuccess, toReplyPayload } = require('../../utils/responseAssets');

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
            const err = makeError({ title: 'Server Only', description: 'This command can only be used in a server.' });
            return interaction.reply(toReplyPayload(err, { ephemeral: true }));
        }

        // Owner gate (extra safety)
        if (interaction.user.id !== client.config.ownerId) {
            const sec = makeSecurity({ title: 'Owner Only', description: 'Only the Bot Owner can use this command.' });
            return interaction.reply(toReplyPayload(sec, { ephemeral: true }));
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            await interaction.deferReply({ ephemeral: true });
            const note = interaction.options.getString('note') || null;

            const loading = makeLoading({ title: 'Creating Backup', description: 'Saving roles, channels, and permissions...' });
            await interaction.editReply(toReplyPayload(loading, { ephemeral: true })).catch(() => { });

            try {
                const doc = await createBackup({
                    guild: interaction.guild,
                    createdBy: interaction.user.id,
                    note
                });

                const done = makeSecurity({
                    title: 'Backup Created',
                    description: `ID: \`${doc.id}\`\nCreated: <t:${Math.floor(new Date(doc.createdAt).getTime() / 1000)}:R>${note ? `\nNote: ${note}` : ''}`
                });
                return interaction.editReply(toReplyPayload(done, { ephemeral: true }));
            } catch (e) {
                console.error('[Backup] create error:', e);
                const err = makeError({ title: 'Backup Failed', description: 'Failed to create backup. Check bot permissions and logs.' });
                return interaction.editReply(toReplyPayload(err, { ephemeral: true }));
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
                const info = makeInfo({ title: 'No Backups', description: 'No backups found for this server yet.' });
                return interaction.editReply(toReplyPayload(info, { ephemeral: true }));
            }

            const lines = docs.map((d, idx) => {
                const ts = Math.floor(new Date(d.createdAt).getTime() / 1000);
                const note = d.note ? `\nNote: ${d.note}` : '';
                return `**${idx + 1}.** \`${d._id}\`\nCreated: <t:${ts}:R>${note}`;
            });

            const info = makeInfo({ title: 'Recent Backups', description: lines.join('\n\n') });
            return interaction.editReply(toReplyPayload(info, { ephemeral: true }));
        }

        if (sub === 'info') {
            await interaction.deferReply({ ephemeral: true });
            const id = interaction.options.getString('id');

            const doc = await GuildBackup.findOne({ _id: id, guildId: interaction.guild.id }).lean().catch(() => null);
            if (!doc) {
                const err = makeError({ title: 'Not Found', description: 'Backup not found for this server.' });
                return interaction.editReply(toReplyPayload(err, { ephemeral: true }));
            }

            const rolesCount = Array.isArray(doc.snapshot?.roles) ? doc.snapshot.roles.length : 0;
            const channelsCount = Array.isArray(doc.snapshot?.channels) ? doc.snapshot.channels.length : 0;
            const ts = Math.floor(new Date(doc.createdAt).getTime() / 1000);
            const desc = [
                `ID: \`${doc._id}\``,
                `Created: <t:${ts}:F>`,
                `Roles: **${rolesCount}**`,
                `Channels: **${channelsCount}**`,
                doc.note ? `Note: ${doc.note}` : null
            ].filter(Boolean).join('\n');

            const info = makeInfo({ title: 'Backup Info', description: desc });
            return interaction.editReply(toReplyPayload(info, { ephemeral: true }));
        }

        if (sub === 'restore') {
            const id = interaction.options.getString('id');
            const confirm = interaction.options.getString('confirm');

            if (confirm !== 'RESTORE') {
                const err = makeError({ title: 'Confirmation Failed', description: 'Type `RESTORE` exactly to confirm.' });
                // use cooldown thumbnail for a nicer look
                const cdAsset = buildAssetAttachment('cooldown');
                if (cdAsset?.url) err.embed.setThumbnail(cdAsset.url);
                const files = cdAsset?.attachment ? [...(err.files || []), cdAsset.attachment] : (err.files || []);
                return interaction.reply({ embeds: [err.embed], files, ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const doc = await GuildBackup.findOne({ _id: id, guildId: interaction.guild.id }).catch(() => null);
                if (!doc) {
                    const err = makeError({ title: 'Not Found', description: 'Backup not found for this server.' });
                    return interaction.editReply(toReplyPayload(err, { ephemeral: true }));
                }

                await restoreFromBackup({ guild: interaction.guild, backupDoc: doc });

                const done = makeSuccess({ title: 'Restore Completed', description: 'Restore completed (best-effort). Check roles, channels, and permissions.' , assetKey: 'unlock' });
                return interaction.editReply(toReplyPayload(done, { ephemeral: true }));
            } catch (e) {
                console.error('[Backup] restore error:', e);
                const err = makeError({ title: 'Restore Failed', description: 'Restore failed (best-effort). Check bot permissions/hierarchy and logs.' });
                return interaction.editReply(toReplyPayload(err, { ephemeral: true }));
            }
        }

        return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
};
