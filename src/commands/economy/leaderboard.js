const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Shows the top users.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Leaderboard type')
                .setRequired(true)
                .addChoices(
                    { name: 'Levels (XP)', value: 'xp' },
                    { name: 'Economy (Balance)', value: 'balance' }
                )),
    async execute(interaction, client) {
        const type = interaction.options.getString('type');
        const sortKey = type === 'xp' ? 'xp' : 'balance';

        const topUsers = await User.find({ guildId: interaction.guild.id })
            .sort({ [sortKey]: -1 })
            .limit(10);

        if (!topUsers.length) {
            return interaction.reply({ content: 'No users found yet!', ephemeral: true });
        }

        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        
        const embed = new EmbedBuilder()
            .setTitle(`${type === 'xp' ? '⭐' : '💰'} ${type === 'xp' ? 'Level Leaderboard' : 'Rich List'}`)
            .setColor(type === 'xp' ? '#FFD700' : '#00FF9D')
            .setTimestamp();

        let description = '';
        for (let i = 0; i < topUsers.length; i++) {
            const userProfile = topUsers[i];
            const user = await client.users.fetch(userProfile.userId).catch(() => null);
            const username = user ? user.username : 'Unknown User';
            const medal = medals[i] || `${i + 1}.`;
            const value = type === 'xp' 
                ? `Level ${userProfile.level} • ${userProfile.xp.toLocaleString()} XP` 
                : `${userProfile.balance.toLocaleString()} coins`;

            description += `${medal} **${username}**\n${value}\n\n`;
        }

        embed.setDescription(description);

        await interaction.reply({ embeds: [embed] });
    },
};
