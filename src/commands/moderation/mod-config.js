const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const ModSettings = require('../../models/ModSettings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod-config')
        .setDescription('Configure Elora Smart Moderation settings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('logs')
                .setDescription('Set the moderation logs channel.')
                .addChannelOption(opt => opt.setName('channel').setDescription('The channel to send logs to').setRequired(true).addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Turn the filter on or off.')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Whether to enable the filter').setRequired(true))
        ),
    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'logs') {
            const channel = interaction.options.getChannel('channel');
            await ModSettings.findOneAndUpdate(
                { guildId: interaction.guildId },
                { logChannelId: channel.id },
                { upsert: true }
            );
            return interaction.reply({ content: `✅ Moderation logs will now be sent to ${channel}.`, ephemeral: true });
        }

        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled');
            await ModSettings.findOneAndUpdate(
                { guildId: interaction.guildId },
                { enabled: enabled },
                { upsert: true }
            );
            return interaction.reply({ content: `✅ Smart Moderation has been ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
        }
    },
};
