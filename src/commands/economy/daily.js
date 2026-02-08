const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward.'),
    async execute(interaction, client) {
        let userProfile = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        if (!userProfile) userProfile = new User({ userId: interaction.user.id, guildId: interaction.guild.id });

        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000; // 24 hours

        if (userProfile.dailyLastUsed && now - userProfile.dailyLastUsed < cooldown) {
            const timeLeft = cooldown - (now - userProfile.dailyLastUsed);
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            
            const cooldownEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING)
                .setDescription(`⏳ **Already claimed!**\n\nCome back in **${hours}h ${minutes}m** for your next reward`)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
            
            return interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
        }

        const reward = 100;
        userProfile.balance += reward;
        userProfile.dailyLastUsed = now;
        await userProfile.save();

        const successEmbed = new EmbedBuilder()
            .setColor(THEME.COLORS.SUCCESS)
            .setAuthor({ 
                name: 'Daily Reward Claimed!', 
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(`💰 **+${reward.toLocaleString()} coins**\n\nYour balance is now **${userProfile.balance.toLocaleString()} coins**`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        await interaction.reply({ embeds: [successEmbed] });
    },
};
