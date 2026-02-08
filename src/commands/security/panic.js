const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panic')
        .setDescription('🚨 EMERGENCY: Strips Administrator from ALL roles (Owner only).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {
        // Double check it's the owner or trusted ID (Config based check recommend in real prod, here relying on check)
        if (interaction.user.id !== client.config.ownerId) {
            return interaction.reply({ content: '❌ Only the Bot Owner can use this command!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const dangerousPermissions = [
            PermissionFlagsBits.Administrator,
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.KickMembers
        ];

        let modifiedRoles = [];
        let failedRoles = [];

        const roles = interaction.guild.roles.cache;

        for (const [id, role] of roles) {
            // Skip managed roles (bot roles) and @everyone if possible, though checking perms is better
            if (role.managed || role.name === '@everyone') continue;

            const hasDangerous = dangerousPermissions.some(perm => role.permissions.has(perm));

            if (hasDangerous) {
                try {
                    // Create a new permissions bitfield without dangerous perms
                    // We remove ALL dangerous perms
                    const newPerms = role.permissions.remove(dangerousPermissions);
                    await role.setPermissions(newPerms, '🚨 PANIC MODE ACTIVATED');
                    modifiedRoles.push(role.name);
                } catch (e) {
                    console.error(`Failed to strip role ${role.name}:`, e);
                    failedRoles.push(role.name);
                }
            }
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: '🚨 PANIC MODE ACTIVATED' })
            .setDescription(
                `Stripped dangerous permissions from **${modifiedRoles.length}** roles.\n\n` +
                `**Secured Roles:** ${modifiedRoles.join(', ') || 'None'}\n` +
                `**Failed (Check hierarchy):** ${failedRoles.join(', ') || 'None'}`
            )
            .setColor(client.config.colors.error)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
