const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-intro')
        .setDescription('Sends the Aesthetic Intro Panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {

        await interaction.deferReply({ ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('🍷 WHO ARE YOU?')
            .setDescription(
                `**drop ur intro below.**\ndon't be a ghost. let us know the vibe.\n\n` +
                `**📋 THE TEMPLATE**\n(copy & paste this)\n\n` +
                `name:\nage:\nsign:\nmbti:\nstatus:\ncurrent obsession:\nanthem (song):`
            )
            .setImage('https://media.discordapp.net/attachments/placeholder/intro-banner.png') // Optional placeholder
            .setColor(client.config.colors.primary)
            .setTimestamp();

        // Send to channel
        await interaction.channel.send({ embeds: [embed] });
        await interaction.editReply({ content: '✅ Intro panel deployed.' });
    },
};
