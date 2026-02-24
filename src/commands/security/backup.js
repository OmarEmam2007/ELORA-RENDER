const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildBackup = require('../../models/GuildBackup');
const { createBackup, restoreFromBackup } = require('../../services/guildBackupService');

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
            sub.setName('restore')
                .setDescription('RESTORE (wipe + rebuild) from a backup id. DANGEROUS!')
                .addStringOption(o => o.setName('id').setDescription('Backup document id').setRequired(true))
                .addStringOption(o => o.setName('confirm').setDescription('Type RESTORE to confirm').setRequired(true))),

    async execute(interaction, client) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
        }

        // Owner gate (extra safety)
        if (interaction.user.id !== client.config.ownerId) {
            return interaction.reply({ content: '❌ Only the Bot Owner can use this command.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            await interaction.deferReply({ ephemeral: true });
            const note = interaction.options.getString('note') || null;

            try {
                const doc = await createBackup({
                    guild: interaction.guild,
                    createdBy: interaction.user.id,
                    note
                });

                return interaction.editReply({
                    content: `✅ Backup created.\nID: ${doc.id}\nCreatedAt: ${doc.createdAt.toISOString()}`
                });
            } catch (e) {
                console.error('[Backup] create error:', e);
                return interaction.editReply({ content: '❌ Failed to create backup (check bot permissions and logs).' });
            }
        }

        if (sub === 'list') {
            await interaction.deferReply({ ephemeral: true });
            const docs = await GuildBackup.find({ guildId: interaction.guild.id })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean()
                .catch(() => []);

            if (!docs.length) return interaction.editReply({ content: 'No backups found for this server.' });

            const lines = docs.map(d => {
                const note = d.note ? ` — ${d.note}` : '';
                return `- ${d._id} — ${new Date(d.createdAt).toISOString()}${note}`;
            });

            return interaction.editReply({ content: `Recent backups:\n${lines.join('\n')}` });
        }

        if (sub === 'restore') {
            const id = interaction.options.getString('id');
            const confirm = interaction.options.getString('confirm');

            if (confirm !== 'RESTORE') {
                return interaction.reply({ content: '❌ Confirmation failed. Type RESTORE exactly.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const doc = await GuildBackup.findOne({ _id: id, guildId: interaction.guild.id }).catch(() => null);
                if (!doc) return interaction.editReply({ content: '❌ Backup not found for this server.' });

                await restoreFromBackup({ guild: interaction.guild, backupDoc: doc });

                return interaction.editReply({ content: '✅ Restore completed (best-effort). Check roles/channels/permissions.' });
            } catch (e) {
                console.error('[Backup] restore error:', e);
                return interaction.editReply({ content: '❌ Restore failed (best-effort). Check bot permissions/hierarchy and logs.' });
            }
        }

        return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
};
