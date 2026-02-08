const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-welcome')
        .setDescription('Sends the Modern Welcome + Verify Panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {

        // Load the local image
        const file = new AttachmentBuilder('./assets/moon.jpg');

        const embed = new EmbedBuilder()
            .setTitle('🌑 ELORA')
            .setDescription(
                `**❝ In the silence of the moon, we find our truth. ❞**\n\n` +
                `**Welcome to the Estate.**\n\n` +
                `To access the server and receive the **༄.° ᴀsᴛʀᴀʏ** role, please verify your identity by clicking the button below.`
            )
            .setImage('attachment://moon.jpg')
            .setColor(client.config.colors.primary)
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_astray')
                    .setLabel('Verify Identity')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🗝️')
            );

        // Send file + embed
        await interaction.channel.send({ files: [file], embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Modern Welcome panel deployed!', ephemeral: true });
    },
};
