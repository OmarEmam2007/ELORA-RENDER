const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-security-verify')
        .setDescription('Sets up the verification gate.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to give after verification')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the verification panel to')
                .setRequired(true)),
    async execute(interaction, client) {
        const role = interaction.options.getRole('role');
        const channel = interaction.options.getChannel('channel');

        const embed = new EmbedBuilder()
            .setTitle('🔒 Server Verification')
            .setDescription('To access the server, please verify yourself by clicking the button below.')
            .setColor(client.config.colors.primary)
            .setFooter({ text: 'Security Gate' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`verify_${role.id}`)
                    .setLabel('Verify Access')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        await channel.send({ embeds: [embed], components: [row] });

        await interaction.reply({ content: `✅ Verification system setup in ${channel} with role ${role}.`, ephemeral: true });
    },
};
