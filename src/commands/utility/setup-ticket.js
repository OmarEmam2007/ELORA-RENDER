const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('Creates a ticket panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => option.setName('channel').setDescription('Channel to send panel').setRequired(true)),
    async execute(interaction, client) {
        const channel = interaction.options.getChannel('channel');

        const embed = new EmbedBuilder()
            .setTitle('📩 SUPPORT')
            .setDescription(
                `**How can we help you?**\n\n` +
                `Create a ticket below to contact our staff team privately.`
            )
            .setColor(client.config.colors.primary)
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Create Ticket')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📩')
            );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Ticket panel sent to ${channel}`, ephemeral: true });
    },
};
