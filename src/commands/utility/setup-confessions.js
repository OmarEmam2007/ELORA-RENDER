const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const THEME = require('../../utils/theme');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-confessions')
        .setDescription('Sends the confessions info panel to the channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.ACCENT)
            .setDescription(`💭 **confessions are anonymous**\n\nuse /confess to share your thoughts\nno one will know it's you\n\n*stay safe, be kind*`)
            .setTimestamp();

        // Send to channel
        await interaction.channel.send({ embeds: [embed] });
        await interaction.editReply({ content: '✅ Confessions panel deployed.' });
    },
};
