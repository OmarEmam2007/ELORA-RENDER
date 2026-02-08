const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');

module.exports = {
    name: 'daily',
    async execute(message, client, args) {
        let userProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!userProfile) userProfile = new User({ userId: message.author.id, guildId: message.guild.id });

        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000; // 24 hours

        if (userProfile.dailyLastUsed && now - userProfile.dailyLastUsed < cooldown) {
            const timeLeft = cooldown - (now - userProfile.dailyLastUsed);
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription(`⏳ You have already claimed your daily reward. Come back in **${hours}h ${minutes}m**.`)] });
        }

        const reward = Math.floor(Math.random() * 500) + 500; // 500-1000 coins
        userProfile.wallet = (userProfile.wallet || 0) + reward;
        userProfile.dailyLastUsed = new Date(now);
        await userProfile.save();

        const embed = new EmbedBuilder()
            .setColor(THEME.COLORS.SUCCESS)
            .setDescription(`💰 You claimed your daily reward of **${reward.toLocaleString()}** coins!`)
            .setFooter(THEME.FOOTER)
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};
