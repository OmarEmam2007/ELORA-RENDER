const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const ModSettings = require('../../models/ModSettings');
const ModLog = require('../../models/ModLog');
const { recordDismissal } = require('../../utils/moderation/patternLearner');
const { generateDashboard } = require('../../utils/moderation/modDashboard');

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
