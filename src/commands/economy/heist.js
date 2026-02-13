const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const Vault = require('../../models/Vault');
const HeistAttempt = require('../../models/HeistAttempt');
const THEME = require('../../utils/theme');
const { generateHeistRiddle } = require('../../nexus/gemini');

// In-memory state: channelId -> heistState
const activeHeists = new Map();

const BASE_VAULT_AMOUNT = 250000;
const HEIST_DURATION_MS = 2 * 60 * 1000; // 2 minutes

function getJailedRoleId() {
    return process.env.JAILED_ROLE_ID || 'JAILED_ROLE_ID_HERE';
}

function getHeistMasterRoleId() {
    return process.env.HEIST_MASTER_ROLE_ID || 'HEIST_MASTER_ROLE_ID_HERE';
}

function formatCrewList(guild, participantIds) {
    if (!participantIds || participantIds.size === 0) return '*No operatives linked yet.*';
    const mentions = Array.from(participantIds).map(id => {
        const member = guild.members.cache.get(id);
        return member ? `• ${member}` : `• <@${id}>`;
    });
    return mentions.join('\n');
}

function buildLoadingAnsiBlock() {
    return '```ansi\n' +
        '\u001b[1;36m[ NEXUS://SOVEREIGN_HEIST ]\u001b[0m\n' +
        '\u001b[0;37m> Handshake accepted...\n' +
        '> Decrypting Vault...\n' +
        '> Bypassing Firewall...\n' +
        '> Spoofing biometrics...\n' +
        '> Awaiting riddle from Sovereign Intelligence...\n' +
        '\u001b[0m```';
}

function buildStatusAnsiBlock(statusLines) {
    const header = '\u001b[1;36m[ NEXUS://HEIST_STATUS ]\u001b[0m';
    const body = statusLines.map(line => `\u001b[0;37m> ${line}`).join('\n');
    return '```ansi\n' + header + '\n' + body + '\n\u001b[0m```';
}

function buildLobbyEmbed(message, heistState) {
    const crewList = formatCrewList(message.guild, heistState.participants);

    return new EmbedBuilder()
        .setColor(THEME.COLORS.ACCENT)
        .setAuthor({
            name: 'Sovereign Heist • Vault Link Online',
            iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setDescription(
            `${buildStatusAnsiBlock([
                'Neural channels synced.',
                'Assemble your crew and crack the riddle.',
                'Leader starts the breach when ready.'
            ])}\n` +
            `**Leader:** ${message.author}\n` +
            `**Vault Simulation:** \`${BASE_VAULT_AMOUNT.toLocaleString()} coins\`\n\n` +
            `Use the buttons below to **join** or **leave** the crew. When you are ready, the leader starts the breach.\n\n` +
            `If the team solves the riddle within **2 minutes**, the vault pays out.`
        )
        .addFields([
            {
                name: '<a:heist_terminal:1471800964288610340> Linked Operatives',
                value: crewList,
                inline: false
            }
        ])
        .setFooter(THEME.FOOTER)
        .setTimestamp();
}

function buildChallengeEmbed(message, heistState) {
    const crewList = formatCrewList(message.guild, heistState.participants);
    const { challenge, solution_keywords: solutionKeywords } = heistState.riddlePayload || {};

    return new EmbedBuilder()
        .setColor(THEME.COLORS.PRIMARY)
        .setAuthor({
            name: 'Vault Decryption Challenge',
            iconURL: THEME.ICONS.MOON_FULL
        })
        .setDescription(
            `${buildStatusAnsiBlock([
                'Cipher stream locked.',
                'Type freely in this channel.',
                'If any crew message contains a hidden keyword, the vault unlocks.',
                'Time limit: 2 minutes.'
            ])}\n` +
            `**Riddle:**\n${challenge || 'The Nexus stares back in static silence...'}\n\n` +
            `Keep your language **English**, **cyberpunk**, and chaotic. The Nexus is listening for specific words.\n` +
            `*(Hint: think like a hacker-priest of neon and moonlight.)*`
        )
        .addFields([
            {
                name: '<a:heist_terminal:1471800964288610340> Linked Operatives',
                value: crewList,
                inline: false
            },
            {
                name: '<a:alarm:1471800896865439806> Window',
                value: '2 minutes from the moment this challenge was posted.',
                inline: true
            },
            {
                name: '<a:alarm:1471800896865439806> Simulated Vault',
                value: `\`${BASE_VAULT_AMOUNT.toLocaleString()} coins\``,
                inline: true
            }
        ])
        .setFooter(THEME.FOOTER)
        .setTimestamp();
}

function buildFinalEmbed(heistState, outcome) {
    const { guild, leaderId, participants, riddlePayload } = heistState;
    const leader = guild.members.cache.get(leaderId);
    const crewList = formatCrewList(guild, participants);

    if (outcome === 'success') {
        const successStory = riddlePayload?.success_story || 'The vault surrenders in a storm of neon and static.';
        return new EmbedBuilder()
            .setColor(THEME.COLORS.SUCCESS)
            .setAuthor({
                name: 'Heist Complete • Vault Breached',
                iconURL: THEME.ICONS.MOON_CRESCENT
            })
            .setDescription(
                `${buildStatusAnsiBlock([
                    'Vault signature cracked.',
                    'Credits rerouted to crew wallets.',
                    'Citywide alarms masked by synthetic moonlight.'
                ])}\n` +
                `**Crew Leader:** ${leader || `<@${leaderId}>`}\n` +
                `**Operatives:**\n${crewList}\n\n` +
                `**Nexus Chronicle:**\n${successStory}`
            )
            .setFooter(THEME.FOOTER)
            .setTimestamp();
    }

    const failureMockery = riddlePayload?.failure_mockery || 'The vault watches you fumble, unimpressed.';

    return new EmbedBuilder()
        .setColor(THEME.COLORS.ERROR)
        .setAuthor({
            name: 'Heist Failed • Vault Intact',
            iconURL: THEME.ICONS.MOON_CRESCENT
        })
        .setDescription(
            `${buildStatusAnsiBlock([
                'Cipher remains unbroken.',
                'Security daemons mark the crew as compromised.',
                'Access to economy systems temporarily revoked.'
            ])}\n` +
            `**Crew Leader:** ${leader || `<@${leaderId}>`}\n` +
            `**Operatives:**\n${crewList}\n\n` +
            `**Nexus Mockery:**\n${failureMockery}`
        )
        .setFooter(THEME.FOOTER)
        .setTimestamp();
}

function buildLobbyButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('heist_join')
            .setLabel('Join Crew')
            .setEmoji('<a:alarm:1471800896865439806>')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('heist_leave')
            .setLabel('Leave')
            .setEmoji('<a:alarm:1471800896865439806>')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId('heist_start')
            .setLabel('Start Breach')
            .setEmoji('<a:heist_terminal:1471800964288610340>')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );
}

function buildDisabledButtons() {
    return buildLobbyButtons(true);
}

async function ensureVault(guildId) {
    let vault = await Vault.findOne({ guildId });
    if (!vault) {
        vault = new Vault({
            guildId,
            baseAmount: BASE_VAULT_AMOUNT
        });
        await vault.save();
    }
    return vault;
}

function computeRewardDistribution(participantIds, totalAmount) {
    const participants = Array.from(participantIds);
    const n = participants.length;
    if (n === 0) return { perUser: new Map(), totalUsed: 0 };

    const leaderBonusFactor = 0.25; // Leader gets +25% over base share
    const baseShare = Math.floor(totalAmount / (n + leaderBonusFactor));

    const perUser = new Map();
    let totalUsed = 0;

    participants.forEach((id, index) => {
        if (index === 0) {
            const leaderShare = Math.floor(baseShare * (1 + leaderBonusFactor));
            perUser.set(id, leaderShare);
            totalUsed += leaderShare;
        } else {
            perUser.set(id, baseShare);
            totalUsed += baseShare;
        }
    });

    return { perUser, totalUsed };
}

async function rewardCrew(heistState, matchedKeyword) {
    const { guild, leaderId, participants, riddlePayload, channelId } = heistState;
    const guildId = guild.id;

    const vault = await ensureVault(guildId);
    const vaultAmount = vault.baseAmount || BASE_VAULT_AMOUNT;

    const { perUser, totalUsed } = computeRewardDistribution(participants, vaultAmount);

    const rewardsObject = {};

    for (const [userId, amount] of perUser.entries()) {
        let userProfile = await User.findOne({ userId, guildId });
        if (!userProfile) {
            userProfile = new User({ userId, guildId });
        }
        userProfile.wallet = (userProfile.wallet || 0) + amount;
        await userProfile.save();
        rewardsObject[userId] = amount;
    }

    const attempt = new HeistAttempt({
        guildId,
        channelId,
        leaderId,
        participantIds: Array.from(participants),
        status: 'success',
        rewardTotal: totalUsed,
        rewards: rewardsObject,
        riddleChallenge: riddlePayload?.challenge || null,
        solutionKeywords: riddlePayload?.solution_keywords || [],
        successStory: riddlePayload?.success_story || null,
        failureMockery: riddlePayload?.failure_mockery || null,
        matchedKeyword: matchedKeyword || null,
        startedAt: heistState.startedAt || new Date(),
        endedAt: new Date()
    });

    await attempt.save();

    // Give Heist Master role to the leader (instant reward)
    const heistMasterRoleId = getHeistMasterRoleId();
    if (heistMasterRoleId && heistMasterRoleId !== 'HEIST_MASTER_ROLE_ID_HERE') {
        try {
            const leaderMember = guild.members.cache.get(leaderId) || await guild.members.fetch(leaderId);
            if (leaderMember && !leaderMember.roles.cache.has(heistMasterRoleId)) {
                await leaderMember.roles.add(heistMasterRoleId).catch(() => { });
            }
        } catch {
            // ignore role errors
        }
    }

    return { rewardsObject, totalUsed };
}

async function punishCrew(heistState, failureReason) {
    const { guild, leaderId, participants, riddlePayload, channelId } = heistState;
    const guildId = guild.id;

    const rewardsObject = {};

    const attempt = new HeistAttempt({
        guildId,
        channelId,
        leaderId,
        participantIds: Array.from(participants),
        status: failureReason === 'timeout' ? 'timeout' : 'failed',
        rewardTotal: 0,
        rewards: rewardsObject,
        riddleChallenge: riddlePayload?.challenge || null,
        solutionKeywords: riddlePayload?.solution_keywords || [],
        successStory: riddlePayload?.success_story || null,
        failureMockery: riddlePayload?.failure_mockery || null,
        matchedKeyword: null,
        failureReason: failureReason || null,
        startedAt: heistState.startedAt || new Date(),
        endedAt: new Date()
    });

    await attempt.save();

    const jailedRoleId = getJailedRoleId();
    const jailDurationMs = 15 * 60 * 1000; // 15 minutes

    for (const userId of participants) {
        try {
            let userProfile = await User.findOne({ userId, guildId });
            if (!userProfile) {
                userProfile = new User({ userId, guildId });
            }

            userProfile.jailed = true;
            userProfile.jailReleaseTime = new Date(Date.now() + jailDurationMs);
            await userProfile.save();

            if (jailedRoleId && jailedRoleId !== 'JAILED_ROLE_ID_HERE') {
                const member = guild.members.cache.get(userId) || await guild.members.fetch(userId);
                if (member && !member.roles.cache.has(jailedRoleId)) {
                    await member.roles.add(jailedRoleId).catch(() => { });
                }
            }
        } catch {
            // ignore for individual users
        }
    }
}

async function resolveHeistSuccess(heistState, message, matchedKeyword) {
    if (heistState.resolved) return;
    heistState.resolved = true;

    if (heistState.timeoutHandle) {
        clearTimeout(heistState.timeoutHandle);
        heistState.timeoutHandle = null;
    }

    const { channel, controllerMessageId } = heistState;

    const { rewardsObject, totalUsed } = await rewardCrew(heistState, matchedKeyword);

    const finalEmbed = buildFinalEmbed(heistState, 'success');

    try {
        const controllerMessage = await channel.messages.fetch(controllerMessageId).catch(() => null);
        if (controllerMessage) {
            await controllerMessage.edit({
                embeds: [finalEmbed],
                components: [buildDisabledButtons()]
            });
        } else {
            await channel.send({ embeds: [finalEmbed] });
        }
    } catch {
        await channel.send({ embeds: [finalEmbed] });
    }

    // Also send a compact reward summary
    try {
        const lines = Object.entries(rewardsObject).map(([userId, amount]) => `• <@${userId}> — \`${amount.toLocaleString()}\` coins`);
        if (lines.length > 0) {
            await channel.send({
                content: `💳 **Vault Payouts (${totalUsed.toLocaleString()} coins)**\n${lines.join('\n')}`
            });
        }
    } catch {
        // ignore
    }

    activeHeists.delete(channel.id);
}

async function resolveHeistFailure(heistState, failureReason) {
    if (heistState.resolved) return;
    heistState.resolved = true;

    if (heistState.timeoutHandle) {
        clearTimeout(heistState.timeoutHandle);
        heistState.timeoutHandle = null;
    }

    const { channel, controllerMessageId } = heistState;

    await punishCrew(heistState, failureReason || 'failed');

    const finalEmbed = buildFinalEmbed(heistState, 'failed');

    try {
        const controllerMessage = await channel.messages.fetch(controllerMessageId).catch(() => null);
        if (controllerMessage) {
            await controllerMessage.edit({
                embeds: [finalEmbed],
                components: [buildDisabledButtons()]
            });
        } else {
            await channel.send({ embeds: [finalEmbed] });
        }
    } catch {
        await channel.send({ embeds: [finalEmbed] });
    }

    activeHeists.delete(channel.id);
}

module.exports = {
    name: 'heist',
    aliases: ['vault', 'rob'],
    activeHeists,

    /**
     * Prefix usage: `elora heist`
     */
    async execute(message, client, args) {
        const channelId = message.channel.id;
        const guildId = message.guild.id;

        // Optional: restrict to a specific "heist control" channel via env
        const allowedChannelId = process.env.HEIST_CONTROL_CHANNEL_ID;
        if (allowedChannelId && allowedChannelId !== channelId) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(THEME.COLORS.ERROR)
                        .setDescription(`❌ This protocol can only run in <#${allowedChannelId}>.`)
                        .setFooter(THEME.FOOTER)
                ]
            });
        }

        if (activeHeists.has(channelId)) {
            const state = activeHeists.get(channelId);
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(THEME.COLORS.WARNING)
                        .setDescription(`⚠️ A heist is already active in this channel led by <@${state.leaderId}>.`)
                        .setFooter(THEME.FOOTER)
                ]
            });
        }

        const heistState = {
            guild: message.guild,
            channel: message.channel,
            channelId,
            leaderId: message.author.id,
            participants: new Set([message.author.id]),
            startedAt: null,
            expiresAt: null,
            riddlePayload: null,
            controllerMessageId: null,
            timeoutHandle: null,
            resolved: false
        };

        const embed = buildLobbyEmbed(message, heistState);
        const components = [buildLobbyButtons(false)];

        const sent = await message.reply({ embeds: [embed], components });
        heistState.controllerMessageId = sent.id;

        activeHeists.set(channelId, heistState);
    },

    /**
     * Button handler wired from interactionCreate.js
     */
    async handleButton(interaction) {
        const channelId = interaction.channel.id;
        const heistState = activeHeists.get(channelId);

        if (!heistState) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(THEME.COLORS.ERROR)
                        .setDescription('❌ No active heist in this channel. Start one with `elora heist`.')
                        .setFooter(THEME.FOOTER)
                ],
                ephemeral: true
            });
        }

        const userId = interaction.user.id;
        const customId = interaction.customId;

        if (customId === 'heist_join') {
            if (heistState.resolved || heistState.riddlePayload) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(THEME.COLORS.WARNING)
                            .setDescription('⚠️ You can only join during the assembly phase. This heist is already in motion.')
                            .setFooter(THEME.FOOTER)
                    ],
                    ephemeral: true
                });
            }

            heistState.participants.add(userId);

            const updatedEmbed = buildLobbyEmbed(interaction.message, heistState);
            const components = [buildLobbyButtons(false)];

            return interaction.update({ embeds: [updatedEmbed], components });
        }

        if (customId === 'heist_leave') {
            if (userId === heistState.leaderId) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ The leader cannot leave. Cancel the heist or let it resolve.')
                            .setFooter(THEME.FOOTER)
                    ],
                    ephemeral: true
                });
            }

            heistState.participants.delete(userId);

            const updatedEmbed = buildLobbyEmbed(interaction.message, heistState);
            const components = [buildLobbyButtons(false)];

            return interaction.update({ embeds: [updatedEmbed], components });
        }

        if (customId === 'heist_start') {
            if (userId !== heistState.leaderId) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Only the heist leader can start the breach.')
                            .setFooter(THEME.FOOTER)
                    ],
                    ephemeral: true
                });
            }

            if (heistState.riddlePayload) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(THEME.COLORS.WARNING)
                            .setDescription('⚠️ The breach is already live. Solve the riddle in chat!')
                            .setFooter(THEME.FOOTER)
                    ],
                    ephemeral: true
                });
            }

            // Show loading / decrypting animation while we wait for Gemini
            const loadingEmbed = EmbedBuilder.from(interaction.message.embeds[0] || new EmbedBuilder())
                .setColor(THEME.COLORS.ACCENT)
                .setDescription(buildLoadingAnsiBlock());

            await interaction.update({
                embeds: [loadingEmbed],
                components: [buildLobbyButtons(true)]
            });

            try {
                const riddlePayload = await generateHeistRiddle();
                heistState.riddlePayload = riddlePayload;
                heistState.startedAt = new Date();
                heistState.expiresAt = new Date(Date.now() + HEIST_DURATION_MS);

                // Start timeout
                heistState.timeoutHandle = setTimeout(() => {
                    resolveHeistFailure(heistState, 'timeout').catch(() => { });
                }, HEIST_DURATION_MS);

                const challengeEmbed = buildChallengeEmbed(interaction.message, heistState);

                await interaction.message.edit({
                    embeds: [challengeEmbed],
                    components: [buildLobbyButtons(true)]
                });
            } catch (error) {
                console.error('Heist riddle error:', error);
                heistState.riddlePayload = null;
                heistState.startedAt = null;
                heistState.expiresAt = null;

                await interaction.message.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setAuthor({ name: 'Heist Error • Nexus Unreachable' })
                            .setDescription('```ansi\n\u001b[1;31m[ NEXUS://LINK_FAILURE ]\u001b[0m\n\u001b[0;37m> The Sovereign Nexus did not answer in time.\n> Try again in a moment.\n\u001b[0m```')
                            .setFooter(THEME.FOOTER)
                    ],
                    components: [buildDisabledButtons()]
                });

                activeHeists.delete(channelId);
            }
        }
    },

    /**
     * Called from messageCreate.js to listen for solution keywords during active heists.
     */
    async handleMessage(message) {
        if (message.author.bot || !message.guild) return;

        const heistState = activeHeists.get(message.channel.id);
        if (!heistState || heistState.resolved || !heistState.riddlePayload) return;

        if (!heistState.participants.has(message.author.id)) return; // Only crew messages count

        const now = Date.now();
        if (heistState.expiresAt && now > heistState.expiresAt.getTime()) {
            // Let timeout handler clean it up
            return;
        }

        const content = (message.content || '').toLowerCase();
        if (!content || content.length < 1) return;

        const keywords = heistState.riddlePayload.solution_keywords || [];
        const matched = keywords.find(kw => kw && content.includes(kw.toLowerCase()));

        if (matched) {
            await resolveHeistSuccess(heistState, message, matched);
        }
    }
};

