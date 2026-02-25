const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require('discord.js');

const GuildSecurityConfig = require('../../models/GuildSecurityConfig');
const THEME = require('../../utils/theme');

function normalizeId(raw) {
    return String(raw || '').replace(/[<@!@&>#]/g, '').trim();
}

async function getOrCreate(guildId) {
    return await GuildSecurityConfig.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        { upsert: true, new: true }
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('security')
        .setDescription('Configure Elora security / anti-nuke protection.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('logs')
                .setDescription('Set the security log channel.')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel to send security alerts to')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText))
        )
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable/disable anti-nuke guards.')
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Whether anti-nuke is enabled')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('whitelist-add')
                .setDescription('Add a user or role to the security whitelist.')
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('What to whitelist')
                        .setRequired(true)
                        .addChoices(
                            { name: 'User', value: 'user' },
                            { name: 'Role', value: 'role' }
                        ))
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('User ID / mention OR Role ID / mention')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('whitelist-remove')
                .setDescription('Remove a user or role from the security whitelist.')
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('What to remove')
                        .setRequired(true)
                        .addChoices(
                            { name: 'User', value: 'user' },
                            { name: 'Role', value: 'role' }
                        ))
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('User ID / mention OR Role ID / mention')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('whitelist-list')
                .setDescription('Show the current whitelist (users + roles).')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (!interaction.guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });

        if (sub === 'logs') {
            const channel = interaction.options.getChannel('channel');
            await GuildSecurityConfig.findOneAndUpdate(
                { guildId },
                { $set: { securityLogChannelId: channel.id }, $setOnInsert: { guildId } },
                { upsert: true, new: true }
            );
            return interaction.reply({ content: `✅ Security logs will be sent to ${channel}.`, ephemeral: true });
        }

        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled');
            await GuildSecurityConfig.findOneAndUpdate(
                { guildId },
                { $set: { antiNukeEnabled: enabled }, $setOnInsert: { guildId } },
                { upsert: true, new: true }
            );
            return interaction.reply({ content: `✅ Anti-nuke is now ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
        }

        if (sub === 'whitelist-add' || sub === 'whitelist-remove') {
            const type = interaction.options.getString('type');
            const id = normalizeId(interaction.options.getString('id'));
            if (!id) return interaction.reply({ content: '❌ Invalid ID.', ephemeral: true });

            const cfg = await getOrCreate(guildId);

            if (type === 'user') {
                const arr = cfg.whitelistUsers || [];
                cfg.whitelistUsers = sub === 'whitelist-add'
                    ? Array.from(new Set([...arr, id]))
                    : arr.filter(x => x !== id);
            }

            if (type === 'role') {
                const arr = cfg.whitelistRoles || [];
                cfg.whitelistRoles = sub === 'whitelist-add'
                    ? Array.from(new Set([...arr, id]))
                    : arr.filter(x => x !== id);
            }

            await cfg.save();
            return interaction.reply({ content: `✅ Whitelist updated.`, ephemeral: true });
        }

        if (sub === 'whitelist-list') {
            const cfg = await getOrCreate(guildId);
            const users = (cfg.whitelistUsers || []).map(id => `<@${id}> (\`${id}\`)`).join('\n') || 'None';
            const roles = (cfg.whitelistRoles || []).map(id => `<@&${id}> (\`${id}\`)`).join('\n') || 'None';

            const embed = new EmbedBuilder()
                .setColor(THEME.COLORS.ACCENT)
                .setTitle('🛡️ Security Whitelist')
                .addFields(
                    { name: 'Users', value: users, inline: false },
                    { name: 'Roles', value: roles, inline: false }
                )
                .setFooter(THEME.FOOTER);

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
