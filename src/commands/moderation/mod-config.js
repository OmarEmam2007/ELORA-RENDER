const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const ModSettings = require('../../models/ModSettings');
const User = require('../../models/User');

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
        )
        .addSubcommand(sub =>
            sub.setName('whitelist-add')
                .setDescription('Add a safe word/phrase that should never be flagged by anti-swearing.')
                .addStringOption(opt =>
                    opt.setName('term')
                        .setDescription('Word or short phrase to whitelist')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('whitelist-remove')
                .setDescription('Remove a safe word/phrase from the anti-swearing whitelist.')
                .addStringOption(opt =>
                    opt.setName('term')
                        .setDescription('Word or short phrase to remove')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('whitelist-list')
                .setDescription('List all currently whitelisted safe words/phrases for anti-swearing.')
        )
        .addSubcommand(sub =>
            sub.setName('reset-warnings')
                .setDescription('Reset a user\'s anti-swearing warning count in this server.')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to reset')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('threshold-set')
                .setDescription('Set how many warnings lead to a 1-hour timeout (anti-swearing).')
                .addIntegerOption(opt =>
                    opt.setName('count')
                        .setDescription('Warnings required before timeout (2-20)')
                        .setMinValue(2)
                        .setMaxValue(20)
                        .setRequired(true)
                )
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

        if (sub === 'whitelist-add') {
            const raw = interaction.options.getString('term');
            const term = String(raw || '').trim();
            if (!term) return interaction.reply({ content: '❌ Please provide a valid term.', ephemeral: true });
            if (term.length > 64) return interaction.reply({ content: '❌ Term is too long (max 64 characters).', ephemeral: true });

            const settings = await ModSettings.findOne({ guildId: interaction.guildId }).catch(() => null);
            const current = Array.isArray(settings?.antiSwearWhitelist) ? settings.antiSwearWhitelist : [];
            const exists = current.some(t => String(t).toLowerCase() === term.toLowerCase());
            if (exists) {
                return interaction.reply({ content: `ℹ️ "${term}" is already whitelisted.`, ephemeral: true });
            }

            await ModSettings.findOneAndUpdate(
                { guildId: interaction.guildId },
                { $addToSet: { antiSwearWhitelist: term } },
                { upsert: true }
            );

            return interaction.reply({ content: `✅ Added "${term}" to the anti-swearing whitelist.`, ephemeral: true });
        }

        if (sub === 'whitelist-remove') {
            const raw = interaction.options.getString('term');
            const term = String(raw || '').trim();
            if (!term) return interaction.reply({ content: '❌ Please provide a valid term.', ephemeral: true });

            await ModSettings.findOneAndUpdate(
                { guildId: interaction.guildId },
                { $pull: { antiSwearWhitelist: term } },
                { upsert: true }
            );

            return interaction.reply({ content: `✅ Removed "${term}" from the anti-swearing whitelist.`, ephemeral: true });
        }

        if (sub === 'whitelist-list') {
            const settings = await ModSettings.findOne({ guildId: interaction.guildId }).lean().catch(() => null);
            const list = Array.isArray(settings?.antiSwearWhitelist) ? settings.antiSwearWhitelist : [];
            if (!list.length) {
                return interaction.reply({ content: 'ℹ️ No whitelisted terms set for this server.', ephemeral: true });
            }
            const shown = list.slice(0, 50).map((t, i) => `${i + 1}. ${t}`).join('\n');
            const extra = list.length > 50 ? `\n\n…and ${list.length - 50} more.` : '';
            return interaction.reply({ content: `Anti-swearing whitelist (${list.length}):\n${shown}${extra}`, ephemeral: true });
        }

        if (sub === 'reset-warnings') {
            const user = interaction.options.getUser('user');
            if (!user) return interaction.reply({ content: '❌ Please select a user.', ephemeral: true });

            await User.findOneAndUpdate(
                { guildId: interaction.guildId, userId: user.id },
                { antiSwearWarningsCount: 0, antiSwearLastAt: new Date() },
                { upsert: true }
            ).catch(() => { });

            return interaction.reply({ content: `✅ Reset anti-swearing warnings for ${user.tag}.`, ephemeral: true });
        }

        if (sub === 'threshold-set') {
            const count = interaction.options.getInteger('count');
            await ModSettings.findOneAndUpdate(
                { guildId: interaction.guildId },
                { antiSwearThreshold: count },
                { upsert: true }
            );
            return interaction.reply({ content: `✅ Anti-swearing timeout threshold set to ${count} warnings.`, ephemeral: true });
        }
    },
};
