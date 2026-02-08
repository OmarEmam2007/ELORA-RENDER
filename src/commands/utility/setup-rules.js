const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-rules')
        .setDescription('Sends the Modern Rules Panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {

        await interaction.deferReply({ ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('📜 ESTATE RULES')
            .setDescription(
                `**Welcome to the Estate.**\nBy residing here, you agree to the following laws.\n\n` +
                `**⚖️ 1. Respect & Civility**\n` +
                `Treat all members and staff with absolute respect.\n` +
                `Harassment, hate speech, or toxicity will not be tolerated.\n\n` +
                `**🛡️ 2. No NSFW or Gore**\n` +
                `This is a safe sanctuary.\n` +
                `Explicit, gore, or shocking content is strictly prohibited.\n\n` +
                `**📢 3. No Advertising**\n` +
                `Do not promote other servers or services without permission.\n` +
                `DM advertising is strictly forbidden.\n\n` +
                `**🔒 4. Privacy & Data**\n` +
                `Do not share personal information of others (Doxing).\n` +
                `Respect the privacy of the Estate.\n\n` +
                `**🎭 5. No Spam or Flooding**\n` +
                `Keep the chat clean.\n` +
                `Do not disrupt the flow of conversation.`
            )
            .setImage('https://media.discordapp.net/attachments/placeholder/rules-banner.png') // Optional placeholder, user can swap
            .setColor(client.config.colors.primary)
            .setTimestamp();

        // Send to channel
        await interaction.channel.send({ embeds: [embed] });
        await interaction.editReply({ content: '✅ Rules panel deployed!' });
    },
};
