const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play or queue a song')
        .addStringOption(option =>
            option.setName('song')
                .setDescription('YouTube URL or search query')
                .setRequired(true)
        ),
    async execute(interaction, client) {
        const query = interaction.options.getString('song');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        }

        if (voiceChannel.type === ChannelType.GuildStageVoice) {
            return interaction.reply({ content: '❌ Stage channels are not supported. Use a normal voice channel.', ephemeral: true });
        }

        const guildId = interaction.guild.id;

        let chosenBot = null;

        // 1) If a bot is already in this voice channel, use it
        for (const bot of client.clones || [client]) {
            const g = bot.guilds.cache.get(guildId);
            if (!g) continue;
            if (g.members.me?.voice?.channelId === voiceChannel.id) {
                chosenBot = bot;
                break;
            }
        }

        // 2) Otherwise find a free bot in this guild
        if (!chosenBot) {
            for (const bot of client.clones || [client]) {
                const g = bot.guilds.cache.get(guildId);
                if (!g) continue;
                if (!g.members.me?.voice?.channelId) {
                    chosenBot = bot;
                    break;
                }
            }
        }

        if (!chosenBot || !chosenBot.music) {
            return interaction.reply({ content: '❌ No available music bot right now.', ephemeral: true });
        }

        await interaction.deferReply();
        try {
            const track = await chosenBot.music.enqueueByIds({
                guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
                userId: interaction.user.id,
                query,
            });
            await interaction.editReply(`✅ Added: **${track.title}** (${chosenBot.user.username})`);
        } catch (e) {
            await interaction.editReply(`❌ Error: ${e.message || e}`);
        }
    },
};
