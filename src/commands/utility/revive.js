const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require('discord.js');
const THEME = require('../../utils/theme');
const ReviveSettings = require('../../models/Revive');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revive')
        .setDescription('Revive your server activity with a clean, controlled ping system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Configure the revive system (channel, role, cooldown).')
                .addChannelOption(opt =>
                    opt
                        .setName('channel')
                        .setDescription('Channel where revive pings will be sent.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addRoleOption(opt =>
                    opt
                        .setName('role')
                        .setDescription('Role to ping when reviving (e.g. @Revive Ping).')
                        .setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt
                        .setName('cooldown')
                        .setDescription('Cooldown between revive pings in minutes (default 30).')
                        .setMinValue(1)
                        .setMaxValue(1440)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('ping')
                .setDescription('Send a revive ping (respects cooldown).')
        ),

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const role = interaction.options.getRole('role');
            const cooldownInput = interaction.options.getInteger('cooldown');
            const cooldownMinutes = cooldownInput ?? 30;

            try {
                await ReviveSettings.findOneAndUpdate(
                    { guildId },
                    {
                        channelId: channel.id,
                        roleId: role.id,
                        cooldownMinutes
                    },
                    { upsert: true, new: true }
                );

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setTitle('✅ Revive System Configured')
                    .setDescription(
                        [
                            `**Channel:** ${channel}`,
                            `**Role to Ping:** ${role}`,
                            `**Cooldown:** \`${cooldownMinutes} minutes\``,
                            '',
                            'Make sure this role is **mentionable** and given to members who want revive pings.'
                        ].join('\n')
                    )
                    .setFooter(THEME.FOOTER);

                return interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('Revive Setup Error:', error);
                return interaction.reply({
                    content: '❌ حدث خطأ أثناء حفظ إعدادات الـ revive. حاول مرة أخرى لاحقًا.',
                    ephemeral: true
                });
            }
        }

        if (sub === 'ping') {
            let settings;
            try {
                settings = await ReviveSettings.findOne({ guildId });
            } catch (error) {
                console.error('Revive Fetch Error:', error);
                return interaction.reply({
                    content: '❌ لا أستطيع الوصول لقاعدة البيانات الآن. حاول لاحقًا.',
                    ephemeral: true
                });
            }

            if (!settings) {
                return interaction.reply({
                    content: '⚠️ نظام الـ revive غير مضبوط بعد. استخدم `/revive setup` أولاً (للمدراء فقط).',
                    ephemeral: true
                });
            }

            const now = Date.now();
            if (settings.lastReviveAt) {
                const last = new Date(settings.lastReviveAt).getTime();
                const diffMs = now - last;
                const cooldownMs = (settings.cooldownMinutes ?? 30) * 60 * 1000;

                if (diffMs < cooldownMs) {
                    const remainingMs = cooldownMs - diffMs;
                    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

                    const cooldownEmbed = new EmbedBuilder()
                        .setColor(THEME.COLORS.WARNING)
                        .setTitle('⏳ Cooldown Active')
                        .setDescription(
                            `لا يمكنك استخدام الـ revive الآن.\n` +
                            `يرجى الانتظار حوالي **${remainingMinutes} دقيقة** قبل المحاولة مرة أخرى.`
                        )
                        .setFooter(THEME.FOOTER);

                    return interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
                }
            }

            const channel = interaction.guild.channels.cache.get(settings.channelId);
            const role = interaction.guild.roles.cache.get(settings.roleId);

            if (!channel || !role) {
                return interaction.reply({
                    content: '⚠️ لا أستطيع العثور على الرول أو الروم المحدد. استخدم `/revive setup` لتحديث الإعدادات.',
                    ephemeral: true
                });
            }

            // Update last revive time
            settings.lastReviveAt = new Date(now);
            await settings.save().catch((err) => console.error('Revive Save Error:', err));

            const reviveEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.PRIMARY)
                .setTitle('🌑 Server Revive Ping')
                .setDescription(
                    [
                        `${role}`,
                        '',
                        'الديسكورد نايم شوية.. تعالوا نحييه شوية دردشة وفعاليات 👀',
                        '',
                        `**المسؤول:** ${interaction.user}`
                    ].join('\n')
                )
                .setFooter(THEME.FOOTER)
                .setTimestamp();

            try {
                await channel.send({ content: `${role}`, embeds: [reviveEmbed] });

                return interaction.reply({
                    content: `✅ تم إرسال **revive ping** في ${channel}.`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('Revive Send Error:', error);
                return interaction.reply({
                    content: '❌ لم أستطع إرسال رسالة الـ revive. تأكد من صلاحياتي في الروم.',
                    ephemeral: true
                });
            }
        }
    }
};

