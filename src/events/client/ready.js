module.exports = {
    name: 'clientReady',
    once: true,
    execute(client) {
        console.log(`🤖 Logged in as ${client.user.tag}`);

        if (!client.config.ownerId) {
            console.warn('⚠️ WARNING: Owner ID is not set in config.json! /panic and /blacklist will NOT work.');
        } else {
            console.log(`👑 Owner ID detected: ${client.config.ownerId}`);
        }

        const { ActivityType } = require('discord.js');

        const updateStatus = () => {
            // Calculate dynamic values
            const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            const serverNames = client.guilds.cache.map(g => g.name).join(', ') || 'Unknown Server';

            const activities = [
                { name: `Protecting ${serverNames}`, type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' },
                { name: 'Security: 100% Active', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' },
                { name: '/help for commands', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' },
                { name: `Monitoring ${userCount} Members`, type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }
            ];

            const randomIndex = Math.floor(Math.random() * activities.length);
            const activity = activities[randomIndex];

            client.user.setActivity(activity.name, { type: activity.type, url: activity.url });
        };

        // Initial set
        updateStatus();

        // Rotate every 30 seconds
        setInterval(updateStatus, 30 * 1000);
    },
};
