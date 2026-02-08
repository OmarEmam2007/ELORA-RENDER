const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Blacklist = require('../../models/Blacklist');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Manage the global blacklist.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a user to the global blacklist')
                .addUserOption(opt => opt.setName('user').setDescription('The user to blacklist').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for blacklisting')))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a user from the global blacklist')
                .addUserOption(opt => opt.setName('user').setDescription('The user to remove').setRequired(true))),
    async execute(interaction, client) {
        // Only owner can manage global blacklist for now, or trusted admins.
        if (interaction.user.id !== client.config.ownerId) {
            return interaction.reply({ content: '❌ Only the Bot Owner can manage the global blacklist.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        try {
            if (subcommand === 'add') {
                const existing = await Blacklist.findOne({ userId: user.id });
                if (existing) {
                    return interaction.reply({ content: `⚠️ ${user.tag} is already blacklisted.`, ephemeral: true });
                }

                await Blacklist.create({ userId: user.id, reason, addedBy: interaction.user.id });
                await interaction.reply({ content: `✅ **${user.tag}** has been added to the global blacklist.`, ephemeral: true });
            } else if (subcommand === 'remove') {
                const deleted = await Blacklist.findOneAndDelete({ userId: user.id });
                if (!deleted) {
                    return interaction.reply({ content: `⚠️ ${user.tag} is not in the blacklist.`, ephemeral: true });
                }
                await interaction.reply({ content: `✅ **${user.tag}** has been removed from the global blacklist.`, ephemeral: true });
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Database error occurred.', ephemeral: true });
        }
    },
};
