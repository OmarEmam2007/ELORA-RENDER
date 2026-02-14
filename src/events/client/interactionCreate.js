const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const ModSettings = require('../../models/ModSettings');
const ModLog = require('../../models/ModLog');
const { recordDismissal } = require('../../utils/moderation/patternLearner');
const { generateDashboard } = require('../../utils/moderation/modDashboard');
const CustomReply = require('../../models/CustomReply');
const THEME = require('../../utils/theme');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        const safeReply = async (payload) => {
            try {
                if (interaction.deferred || interaction.replied) return await interaction.followUp(payload);
                return await interaction.reply(payload);
            } catch (_) { }
        };

        const safeEdit = async (payload) => {
            try {
                if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
                return await interaction.reply(payload);
            } catch (_) { }
        };

        const safeUpdate = async (payload) => {
            try {
                return await interaction.update(payload);
            } catch (_) {
                return safeReply(payload);
            }
        };

        try {
        if (interaction.isButton()) {
            // --- 🧠 CUSTOM REPLIES DASHBOARD (Owner Only) ---
            if (interaction.customId === 'cr_add') {
                const OWNER_ROLE_ID = '1461766723274412126';
                const hasOwnerRole = interaction.member?.roles?.cache?.has(OWNER_ROLE_ID);
                const isOwnerId = client?.config?.ownerId && interaction.user.id === client.config.ownerId;
                if (!hasOwnerRole && !isOwnerId) return safeReply({ content: '❌ Owner only.', ephemeral: true });

                const modal = new ModalBuilder()
                    .setCustomId('cr_modal_add')
                    .setTitle('Add Custom Reply');

                const triggerInput = new TextInputBuilder()
                    .setCustomId('cr_trigger')
                    .setLabel('Trigger sentence (what user types)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(300);

                const replyInput = new TextInputBuilder()
                    .setCustomId('cr_reply')
                    .setLabel('Bot reply')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(1000);

                const matchInput = new TextInputBuilder()
                    .setCustomId('cr_match')
                    .setLabel("Match type: exact or startsWith (default exact)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(20);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(triggerInput),
                    new ActionRowBuilder().addComponents(replyInput),
                    new ActionRowBuilder().addComponents(matchInput)
                );

                return interaction.showModal(modal);
            }

            if (interaction.customId === 'cr_list') {
                const OWNER_ROLE_ID = '1461766723274412126';
                const hasOwnerRole = interaction.member?.roles?.cache?.has(OWNER_ROLE_ID);
                const isOwnerId = client?.config?.ownerId && interaction.user.id === client.config.ownerId;
                if (!hasOwnerRole && !isOwnerId) return safeReply({ content: '❌ Owner only.', ephemeral: true });

                const docs = await CustomReply.find({ guildId: interaction.guildId, enabled: true })
                    .sort({ createdAt: -1 })
                    .limit(20)
                    .catch(() => []);

                const desc = docs.length
                    ? docs.map((d, i) => `**${i + 1}.** \`${d.trigger}\`  →  ${d.matchType === 'startsWith' ? '`startsWith`' : '`exact`'}`).join('\n')
                    : 'No custom replies yet.';

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setTitle('🧠 Custom Replies (Top 20)')
                    .setDescription(desc)
                    .setFooter(THEME.FOOTER);

                return safeReply({ embeds: [embed], ephemeral: true });
            }

            // --- Onboarding Buttons ---
            if (interaction.customId.startsWith('pronoun_') || interaction.customId.startsWith('age_')) {
                try {
                    const roleIdMap = {
                        'pronoun_she': '1462785536275251334',
                        'pronoun_he': '1462786232223273125',
                        'pronoun_they': '1462787724296585266',
                        'age_13-17': '1462789490589438066',
                        'age_18-24': '1462789685586956309',
                        'age_25+': '1462789797637787763'
                    };

                    const roleId = roleIdMap[interaction.customId];
                    const role = interaction.guild.roles.cache.get(roleId);

                    if (!role) return safeReply({ content: `❌ Role not found.`, ephemeral: true });

                    if (interaction.customId.startsWith('pronoun_')) {
                        const pronounRoleIds = ['1462785536275251334', '1462786232223273125', '1462787724296585266'];
                        for (const pRoleId of pronounRoleIds) {
                            if (interaction.member.roles.cache.has(pRoleId)) await interaction.member.roles.remove(pRoleId);
                        }
                    }

                    if (interaction.customId.startsWith('age_')) {
                        const ageRoleIds = ['1462789490589438066', '1462789685586956309', '1462789797637787763'];
                        for (const aRoleId of ageRoleIds) {
                            if (interaction.member.roles.cache.has(aRoleId)) await interaction.member.roles.remove(aRoleId);
                        }
                    }

                    await interaction.member.roles.add(role);
                    return safeReply({ content: `✅ You've been assigned the **${role.name}** role!`, ephemeral: true });

                } catch (error) {
                    console.error('Onboarding Error:', error);
                    return safeReply({ content: '❌ An error occurred.', ephemeral: true });
                }
            }

            // --- Revive Role Toggle Button ---
            if (interaction.customId === 'revive_toggle') {
                const roleId = '1468624747150577765'; // Revive Ping Role ID
                const role = interaction.guild.roles.cache.get(roleId);

                if (!role) {
                    return safeReply({
                        content: '❌ Role not found. تأكد إن رول الـ Revive موجود وبنفس الـ ID.',
                        ephemeral: true
                    });
                }

                try {
                    if (interaction.member.roles.cache.has(roleId)) {
                        await interaction.member.roles.remove(roleId);
                        return safeReply({
                            content: `🔕 تم إزالة دور **${role.name}** منك.`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.member.roles.add(roleId);
                        return safeReply({
                            content: `🔔 تم إعطاؤك دور **${role.name}** لاستقبال تنبيهات الـ Revive.`,
                            ephemeral: true
                        });
                    }
                } catch (e) {
                    console.error('Revive toggle error:', e);
                    return safeReply({
                        content: '❌ مش قادر أعدّل أدوارك. تأكد إن رتبة البوت فوق رتبة رول الـ Revive.',
                        ephemeral: true
                    });
                }
            }

            // --- Music Control Buttons (MusicService) ---
            if (['music_toggle', 'music_stop', 'music_skip', 'music_loop', 'music_queue', 'music_vol_down', 'music_vol_up'].includes(interaction.customId)) {
                if (!client.music) return safeReply({ content: '❌ Music system not initialized.', ephemeral: true });
                return client.music.handleButton(interaction);
            }

            // --- Blackjack Game Buttons ---
            if (interaction.customId.startsWith('bj_')) {
                const blackjackCommand = require('../../commands/gambling/blackjack');
                if (blackjackCommand.handleButton) {
                    return blackjackCommand.handleButton(interaction);
                }
            }

            // --- Sovereign Heist Buttons ---
            if (interaction.customId.startsWith('heist_')) {
                const heistCommand = require('../../commands/economy/heist');
                if (heistCommand.handleButton) {
                    return heistCommand.handleButton(interaction);
                }
            }

            // --- Verification Button ---
            if (interaction.customId === 'verify_astray') {
                const roleId = client.config.astrayRoleId;
                const role = interaction.guild.roles.cache.get(roleId);
                if (!role) return safeReply({ content: '❌ Role not found.', ephemeral: true });
                if (interaction.member.roles.cache.has(roleId)) return safeReply({ content: 'ℹ️ Already verified.', ephemeral: true });
                try {
                    await interaction.member.roles.add(role);
                    return safeReply({ content: '🗝️ **Access Granted.**', ephemeral: true });
                } catch (error) {
                    return safeReply({ content: '❌ Hierarchy error.', ephemeral: true });
                }
            }

            // --- Ticket Buttons ---
            if (interaction.customId === 'create_ticket') {
                await interaction.deferReply({ ephemeral: true }).catch(() => { });
                const existing = interaction.guild.channels.cache.find(c => c.topic === interaction.user.id);
                if (existing) return safeEdit({ content: `❌ Already open: ${existing}` });

                try {
                    const channel = await interaction.guild.channels.create({
                        name: `ticket-${interaction.user.username}`,
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: client.config.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ],
                        topic: interaction.user.id
                    });

                    const embed = new EmbedBuilder().setTitle('📩 Ticket Opened').setDescription('Staff have been notified.').setColor('#5865F2');
                    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger));
                    await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
                    return safeEdit({ content: `✅ Ticket: ${channel}` });
                } catch (e) { return safeEdit({ content: '❌ Creation failed.' }); }
            }

            if (interaction.customId === 'close_ticket') {
                await safeReply({ content: '🔒 Closing...' });
                return setTimeout(() => interaction.channel.delete().catch(() => { }), 5000);
            }

            // --- 🛡️ SMART MODERATION BUTTONS ---
            if (interaction.customId.startsWith('mod_') || interaction.customId.startsWith('dash_')) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return safeReply({ content: '❌ No permission.', ephemeral: true });
                const parts = interaction.customId.split('_');
                const action = parts[1];

                try {
                    if (interaction.customId.startsWith('mod_')) {
                        const userId = parts[2];
                        const caseId = parts[3];
                        if (action === 'dismiss') {
                            const modCase = await ModLog.findOne({ guildId: interaction.guildId, caseId });
                            if (modCase && modCase.content) {
                                for (const word of modCase.content.split(/\s+/)) await recordDismissal(interaction.guildId, word);
                                modCase.status = 'Dismissed';
                                await modCase.save();
                            }
                            const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#2F3136').setFooter({ text: `Case #${caseId} | DISMISSED BY ${interaction.user.username}` });
                            return safeUpdate({ embeds: [embed], components: [] });
                        }
                        const target = await interaction.guild.members.fetch(userId).catch(() => null);
                        if (!target) return safeReply({ content: '❌ User left.', ephemeral: true });
                        switch (action) {
                            case 'warn': await target.send('⚠️ Warning: Severe profanity detected.').catch(() => { }); break;
                            case 'timeout': if (target.moderatable) await target.timeout(10 * 60 * 1000); break;
                            case 'ban': if (target.bannable) await target.ban({ reason: 'Smart Mod' }); break;
                        }
                        return safeReply({ content: `✅ Action: ${action} applied.`, ephemeral: true });
                    }

                    if (interaction.customId.startsWith('dash_')) {
                        let settings = await ModSettings.findOne({ guildId: interaction.guildId }) || new ModSettings({ guildId: interaction.guildId });
                        switch (action) {
                            case 'toggle':
                                if (parts[2] === 'filter') settings.enabled = !settings.enabled;
                                if (parts[2] === 'learning') settings.learningMode = !settings.learningMode;
                                break;
                            case 'sensitivity':
                                if (parts[2] === 'up') settings.sensitivity = Math.min(5, settings.sensitivity + 1);
                                if (parts[2] === 'down') settings.sensitivity = Math.max(1, settings.sensitivity - 1);
                                break;
                        }
                        await settings.save();
                        return safeUpdate(await generateDashboard(interaction.guildId));
                    }
                } catch (e) { return safeReply({ content: `❌ ${e.message}`, ephemeral: true }); }
            }
        }

        // --- 🧠 CUSTOM REPLIES MODAL SUBMIT ---
        if (interaction.isModalSubmit() && interaction.customId === 'cr_modal_add') {
            const OWNER_ROLE_ID = '1461766723274412126';
            const hasOwnerRole = interaction.member?.roles?.cache?.has(OWNER_ROLE_ID);
            const isOwnerId = client?.config?.ownerId && interaction.user.id === client.config.ownerId;
            if (!hasOwnerRole && !isOwnerId) return safeReply({ content: '❌ Owner only.', ephemeral: true });

            const trigger = interaction.fields.getTextInputValue('cr_trigger')?.trim();
            const reply = interaction.fields.getTextInputValue('cr_reply')?.trim();
            const matchRaw = interaction.fields.getTextInputValue('cr_match')?.trim()?.toLowerCase();

            if (!trigger || !reply) return safeReply({ content: '❌ Missing trigger or reply.', ephemeral: true });

            const matchType = matchRaw === 'startswith' || matchRaw === 'start' || matchRaw === 'sw' ? 'startsWith' : 'exact';

            try {
                await CustomReply.findOneAndUpdate(
                    { guildId: interaction.guildId, trigger },
                    {
                        $set: { reply, matchType, enabled: true, createdBy: interaction.user.id },
                        $setOnInsert: { guildId: interaction.guildId, trigger }
                    },
                    { upsert: true, new: true }
                );

                const ok = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setDescription(`✅ Saved custom reply for trigger: \`${trigger}\``)
                    .setFooter(THEME.FOOTER);

                return safeReply({ embeds: [ok], ephemeral: true });
            } catch (e) {
                return safeReply({ content: `❌ Failed to save: ${e.message || e}`, ephemeral: true });
            }
        }

        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(error);
            await safeReply({ content: 'Error executing command!', ephemeral: true });
        }
        }
        catch (e) {
            console.error('interactionCreate handler error:', e);
        }
    }
};
