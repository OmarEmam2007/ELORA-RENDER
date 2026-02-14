const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { generateLore } = require('../../nexus/gemini');
const path = require('path');
const InviteStats = require('../../models/InviteStats');
const THEME = require('../../utils/theme');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            console.log(`👤 New Hero Detected: ${member.user.tag}`);

            // --- 🎫 Invite Tracking & Rewards (Cumulative) ---
            // Best-effort: never block onboarding if invite tracking fails.
            try {
                const guild = member.guild;
                const guildId = guild.id;

                const roleTiers = [
                    { invites: 5, roleId: '1472157647804432528' },
                    { invites: 10, roleId: '1472158092035751988' },
                    { invites: 25, roleId: '1472158530256502848' },
                    { invites: 50, roleId: '1472163006740959395' },
                    { invites: 100, roleId: '1472160112205365278' }
                ];

                if (!client.inviteCache) client.inviteCache = new Map();
                const oldInvites = client.inviteCache.get(guildId) || new Map();

                let newInvites;
                try {
                    newInvites = await guild.invites.fetch();
                } catch (e) {
                    newInvites = null;
                }

                if (newInvites) {
                    // Find the invite code that increased
                    let usedInvite = null;
                    for (const inv of newInvites.values()) {
                        const prev = oldInvites.get(inv.code) || 0;
                        const now = inv.uses || 0;
                        if (now > prev) {
                            usedInvite = inv;
                            break;
                        }
                    }

                    // Update cache
                    const inviteMap = new Map();
                    for (const inv of newInvites.values()) inviteMap.set(inv.code, inv.uses || 0);
                    client.inviteCache.set(guildId, inviteMap);

                    if (usedInvite?.inviter?.id) {
                        const inviterId = usedInvite.inviter.id;

                        // Fake protection: accounts under 24h old count as 0 invites
                        const accountAgeMs = Date.now() - member.user.createdTimestamp;
                        const isFake = accountAgeMs < 24 * 60 * 60 * 1000;

                        const inviterStats = await InviteStats.findOneAndUpdate(
                            { guildId, userId: inviterId },
                            {
                                $setOnInsert: { guildId, userId: inviterId },
                                $push: {
                                    invitedUsers: {
                                        userId: member.id,
                                        joinedAt: new Date(),
                                        isFake,
                                        left: false
                                    }
                                }
                            },
                            { upsert: true, new: true }
                        );

                        if (isFake) {
                            inviterStats.fakeInvites = (inviterStats.fakeInvites || 0) + 1;
                        } else {
                            inviterStats.regularInvites = (inviterStats.regularInvites || 0) + 1;
                            inviterStats.inviteCount = (inviterStats.inviteCount || 0) + 1;
                        }

                        await inviterStats.save().catch(() => { });

                        // Apply cumulative roles
                        const inviterMember = await guild.members.fetch(inviterId).catch(() => null);
                        if (inviterMember) {
                            const total = inviterStats.inviteCount || 0;
                            const rolesToAdd = roleTiers.filter(t => total >= t.invites).map(t => t.roleId);

                            for (const roleId of rolesToAdd) {
                                if (!inviterMember.roles.cache.has(roleId)) {
                                    await inviterMember.roles.add(roleId, 'Invite rewards: cumulative tier reached').catch(() => { });
                                }
                            }
                        }
                    }
                }
            } catch (inviteErr) {
                console.error('Invite tracking error:', inviteErr);
            }

            // 1. Get the Welcome Channel by ID
            const channel = member.guild.channels.cache.get('1461484367728869397');
            if (!channel) return console.log('⚠️ Welcome channel not found.');

            // 2. Send a placeholder or "Analyzing..." message?
            const analyzingMsg = await channel.send(`*⚡ The Nexus is analyzing the digital signature of ${member}...*`);

            // 3. Generate Lore via Gemini
            const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 512 });
            const loreData = await generateLore(member.user.username, avatarUrl);

            // 4. Load the Local Background Art
            const welcomeFile = new AttachmentBuilder(path.join(__dirname, '../../assets/welcome-bg.jpg'));

            // 5. Construct the Legendary Embed
            const embed = new EmbedBuilder()
                .setTitle(`👁️ ${loreData.title} Has Awakened`)
                .setDescription(`**Member:** ${member}\n\n"${loreData.lore}"`)
                .setThumbnail(avatarUrl) // Added member profile picture
                .setImage('attachment://welcome-bg.jpg')
                .setColor(member.displayHexColor !== '#000000' ? member.displayHexColor : '#00ffd5')
                .setFooter({ text: 'Sovereign Nexus • Sentient Entry System' })
                .setTimestamp();

            // 6. Delete "Analyzing" and send the Result
            await analyzingMsg.delete().catch(() => { });
            await channel.send({ content: `Welcome to the Realm, ${member}.`, embeds: [embed], files: [welcomeFile] });

            // 7. Send Onboarding Panel
            const onboardingEmbed = new EmbedBuilder()
                .setTitle('🌟 Complete Your Profile')
                .setDescription('Before you explore the Nexus, tell us about yourself:')
                .addFields(
                    { name: '👤 Pronouns', value: 'Select your pronouns below', inline: false },
                    { name: '🎂 Age Range', value: 'Select your age range below', inline: false }
                )
                .setColor('#00ffd5')
                .setFooter({ text: 'Click the buttons to get started!' });

            const pronounRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('pronoun_she').setLabel('She/Her').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('pronoun_he').setLabel('He/Him').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('pronoun_they').setLabel('They/Them').setStyle(ButtonStyle.Primary)
                );

            const ageRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('age_13-17').setLabel('13-17').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('age_18-24').setLabel('18-24').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('age_25+').setLabel('25+').setStyle(ButtonStyle.Secondary)
                );

            await channel.send({ embeds: [onboardingEmbed], components: [pronounRow, ageRow] });

            // 8. Assign Nickname? (Requires permissions, risky if owner)
            // if (member.manageable) {
            //    member.setNickname(loreData.title).catch(e => console.log('Cannot set nick'));
            // }

        } catch (error) {
            console.error('❌ Sentient Entry Error:', error);
        }
    },
};
