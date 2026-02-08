const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { generateDashboard } = require('../../utils/moderation/modDashboard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod-dashboard')
        .setDescription('Deploys the Elora Smart Moderation Dashboard.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const dashboard = await generateDashboard(interaction.guildId);

        await interaction.channel.send(dashboard);
        await interaction.editReply('✅ Smart Moderation Dashboard deployed to this channel.');
    },
};
