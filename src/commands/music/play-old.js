const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song (Auto-selects available bot).')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('The URL or name of the song')
                .setRequired(true)
        ),
    async execute(interaction, client) {
        const string = interaction.options.getString('song');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        }

        await interaction.deferReply();

        // LOGIC: Find which bot should play.
        // 1. Is a bot ALREADY in this channel? Use it.
        // 2. If not, find a free bot.

        let chosenBot = null;
        let alreadyJoined = false;

        // Check for existing bot in channel
        for (const bot of client.clones) {
            const guild = bot.guilds.cache.get(interaction.guild.id);
            if (!guild) continue;

            if (guild.members.me.voice.channelId === voiceChannel.id) {
                chosenBot = bot;
                alreadyJoined = true;
                break;
            }
        }

        // If no bot is here, find a free one
        if (!chosenBot) {
            console.log('Searching for a free bot clone...');
            for (const bot of client.clones) {
                const guild = bot.guilds.cache.get(interaction.guild.id);
                if (!guild) {
                    console.log(`Bot ${bot.user?.username || 'unknown'} not in this guild.`);
                    continue;
                }

                if (!guild.members.me.voice.channelId) {
                    chosenBot = bot;
                    console.log(`Found free bot: ${bot.user.username}`);
                    break;
                }
            }
        }

        if (!chosenBot) {
            return interaction.editReply('❌ All bots are currently busy in other channels.');
        }

        console.log(`Using bot: ${chosenBot.user.username} to play in ${voiceChannel.name}`);

        try {
            const botVoiceChannel = await chosenBot.channels.fetch(voiceChannel.id);
            console.log(`Fetched channel ${botVoiceChannel.name} for bot ${chosenBot.user.username}`);

            await chosenBot.distube.play(botVoiceChannel, string, {
                member: interaction.member,
                textChannel: interaction.channel,
                interaction: interaction
            });

            console.log('Distube play call initiated.');

            if (!alreadyJoined) {
                await interaction.editReply(`✅ **${chosenBot.user.username}** is joining...`);
            } else {
                // If already there, just delete "thinking"
                await interaction.deleteReply().catch(() => { });
            }
        } catch (e) {
            console.error('Play command error:', e);
            await interaction.editReply({ content: `❌ Error: ${e.message || e}` });
        }
    },
};
