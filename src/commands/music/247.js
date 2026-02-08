const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Summons a bot to your voice channel (Supports Multi-Bot).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        }

        await interaction.deferReply();

        const guildId = interaction.guild.id;

        let chosenBot = null;
        for (const bot of client.clones || [client]) {
            const g = bot.guilds.cache.get(guildId);
            if (!g) continue;
            if (g.members.me?.voice?.channelId === voiceChannel.id) {
                chosenBot = bot;
                break;
            }
        }

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
            return interaction.editReply('❌ No available music bot right now.');
        }

        try {
            await chosenBot.music.connectByIds({
                guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
            });
            await interaction.editReply(`🌕 **24/7 Mode Active** in ${voiceChannel}. (${chosenBot.user.username})`);
        } catch (e) {
            await interaction.editReply({ content: `❌ Error: ${e.message || e}` });
        }
    },
};
