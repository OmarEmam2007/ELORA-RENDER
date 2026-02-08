const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your current balance.')
        .addUserOption(option => option.setName('target').setDescription('The user to check')),
    async execute(interaction, client) {
        const target = interaction.options.getUser('target') || interaction.user;

        const userProfile = await User.findOne({ userId: target.id, guildId: interaction.guild.id });
        const balance = userProfile ? userProfile.balance : 0;
        const level = userProfile ? userProfile.level : 1;
        const wallet = userProfile?.wallet || 0;
        const bank = userProfile?.bank || 0;

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.ACCENT)
            .setAuthor({ 
                name: `${target.username}'s Wallet`, 
                iconURL: target.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(
                `💵 **Balance:** ${balance.toLocaleString()} coins\n` +
                `💳 **Wallet:** ${wallet.toLocaleString()} coins\n` +
                `🏦 **Bank:** ${bank.toLocaleString()} coins\n` +
                `⭐ **Level:** ${level}`
            )
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
