const { EmbedBuilder } = require('discord.js');
const LifeSimService = require('../../services/lifeSimService');
const THEME = require('../../utils/theme');
const Family = require('../../models/Family');
const FamilyInvite = require('../../models/FamilyInvite');
const User = require('../../models/User');

module.exports = {
    name: 'family',
    aliases: ['dynasty', 'fam'],
    async execute(message, client, args) {
        // Initialize service with client
        const service = new LifeSimService(client);

        const subcommand = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const userId = message.author.id;

        try {
            if (subcommand === 'create') {
                const name = args.slice(1).join(' ');
                if (!name || name.length < 3) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Please provide a family name (minimum 3 characters)')]
                    });
                }

                const family = await service.createFamily(guildId, userId, name);

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setAuthor({
                        name: `🌙 Dynasty Created: ${family.name}`,
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**Head:** ${message.author}\n` +
                        `**Bank:** ${family.bank.toLocaleString()} coins\n` +
                        `**Members:** 1 (You)\n\n` +
                        `*Your dynasty has been established. Invite members with \`elora family invite <@user>\`*`
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                // Announce in city-hall
                const cityHall = message.guild.channels.cache.get(service.getConfig().channels.CITY_HALL);
                if (cityHall) {
                    const announcement = new EmbedBuilder()
                        .setColor(THEME.COLORS.ACCENT)
                        .setAuthor({ name: '🏛️ City Announcement' })
                        .setDescription(
                            `**A new dynasty has entered the city!**\n\n` +
                            `**${family.name}** has been established by ${message.author}\n` +
                            `Starting capital: **${family.bank.toLocaleString()}** coins`
                        )
                        .setTimestamp();
                    await cityHall.send({ embeds: [announcement] });
                }

            } else if (subcommand === 'invite') {
                const target = message.mentions.users.first();
                if (!target) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Please mention a user to invite')]
                    });
                }

                const family = await Family.findOne({
                    guildId,
                    $or: [{ headId: userId }, { members: userId }]
                });

                if (!family) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ You are not in a family')]
                    });
                }

                const result = await service.inviteToFamily(guildId, family._id, userId, target.id);

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setAuthor({
                        name: `✅ Invitation Sent`,
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**${target}** has been invited to **${result.family.name}**\n\n` +
                        `They need to accept using:\n` +
                        `\`elora family accept ${result.invite._id}\`\n\n` +
                        `*Invite expires in 7 days*`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                // DM the target
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(THEME.COLORS.ACCENT)
                        .setAuthor({ name: '🌙 Dynasty Invitation' })
                        .setDescription(
                            `**${message.author}** has invited you to join **${result.family.name}**!\n\n` +
                            `**To accept:**\n` +
                            `\`elora family accept ${result.invite._id}\`\n\n` +
                            `**To reject:**\n` +
                            `\`elora family reject ${result.invite._id}\`\n\n` +
                            `*Invite expires in 7 days*`
                        )
                        .setTimestamp();
                    await target.send({ embeds: [dmEmbed] });
                } catch (e) {
                    // DMs disabled
                }

            } else if (subcommand === 'accept') {
                const inviteId = args[1];
                if (!inviteId) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Please provide an invite ID\nUse `elora family invites` to see your pending invites')]
                    });
                }

                const family = await service.acceptFamilyInvite(guildId, inviteId, userId);

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setAuthor({
                        name: `✅ Joined Dynasty`,
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `You have joined **${family.name}**!\n\n` +
                        `You now have access to the dynasty bank and assets.`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else if (subcommand === 'reject') {
                const inviteId = args[1];
                if (!inviteId) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Please provide an invite ID')]
                    });
                }

                await service.rejectFamilyInvite(guildId, inviteId, userId);

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.WARNING)
                    .setAuthor({
                        name: `❌ Invitation Rejected`,
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription('You have rejected the dynasty invitation.')
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else if (subcommand === 'kick' || subcommand === 'remove') {
                const target = message.mentions.users.first();
                if (!target) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Please mention a user to kick')]
                    });
                }

                const family = await Family.findOne({
                    guildId,
                    headId: userId
                });

                if (!family) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ You are not the head of a family')]
                    });
                }

                const updatedFamily = await service.kickFromFamily(guildId, family._id, userId, target.id);

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.WARNING)
                    .setAuthor({
                        name: `👢 Member Removed`,
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**${target}** has been removed from **${updatedFamily.name}**\n\n` +
                        `They no longer have access to the dynasty.`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else if (subcommand === 'invites') {
                const invites = await FamilyInvite.find({
                    guildId,
                    inviteeId: userId,
                    status: 'pending'
                }).populate('familyId');

                if (invites.length === 0) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.WARNING)
                            .setDescription('❌ You have no pending invitations')]
                    });
                }

                const invitesList = [];
                for (const invite of invites) {
                    const family = await Family.findById(invite.familyId);
                    const inviter = await message.client.users.fetch(invite.inviterId).catch(() => null);
                    if (family) {
                        invitesList.push(
                            `**${family.name}**\n` +
                            `Invited by: ${inviter?.username || 'Unknown'}\n` +
                            `ID: \`${invite._id}\`\n` +
                            `Expires: <t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>`
                        );
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setAuthor({
                        name: '📨 Pending Invitations',
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        invitesList.join('\n\n') +
                        `\n\n**To accept:** \`elora family accept <ID>\`\n` +
                        `**To reject:** \`elora family reject <ID>\``
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else if (subcommand === 'bank') {
                const action = args[1]?.toLowerCase();
                const amount = args[2];

                if (!action || !['dep', 'with', 'deposit', 'withdraw'].includes(action)) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Usage: `elora family bank dep <amount>` or `elora family bank with <amount>`')]
                    });
                }

                const family = await Family.findOne({
                    guildId,
                    $or: [{ headId: userId }, { members: userId }]
                });

                if (!family) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ You are not in a family')]
                    });
                }

                const user = await User.findOne({ userId, guildId });
                if (!user) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ User profile not found')]
                    });
                }

                const { parseAmount } = require('../../utils/amountParser');
                const parsedAmount = parseAmount(amount);
                if (!parsedAmount || parsedAmount === 'all' || parsedAmount <= 0) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Invalid amount')]
                    });
                }

                const isDeposit = action === 'dep' || action === 'deposit';

                if (isDeposit) {
                    if ((user.wallet || 0) < parsedAmount) {
                        return message.reply({
                            embeds: [new EmbedBuilder()
                                .setColor(THEME.COLORS.ERROR)
                                .setDescription('❌ Insufficient funds')]
                        });
                    }
                    user.wallet = (user.wallet || 0) - parsedAmount;
                    family.bank = (family.bank || 0) + parsedAmount;
                } else {
                    if (family.bank < parsedAmount) {
                        return message.reply({
                            embeds: [new EmbedBuilder()
                                .setColor(THEME.COLORS.ERROR)
                                .setDescription('❌ Family bank insufficient')]
                        });
                    }
                    if (family.headId !== userId) {
                        return message.reply({
                            embeds: [new EmbedBuilder()
                                .setColor(THEME.COLORS.ERROR)
                                .setDescription('❌ Only the dynasty head can withdraw')]
                        });
                    }
                    family.bank = (family.bank || 0) - parsedAmount;
                    user.wallet = (user.wallet || 0) + parsedAmount;
                }

                await user.save();
                await family.save();

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setAuthor({
                        name: `${isDeposit ? '💰 Deposited' : '💸 Withdrew'} to ${family.name}`,
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `${isDeposit ? 'Deposited' : 'Withdrew'} **${parsedAmount.toLocaleString()}** coins\n\n` +
                        `**Your Wallet:** ${user.wallet.toLocaleString()} coins\n` +
                        `**Family Bank:** ${family.bank.toLocaleString()} coins`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else if (subcommand === 'info') {
                const family = await Family.findOne({
                    guildId,
                    $or: [{ headId: userId }, { members: userId }]
                });

                if (!family) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ You are not in a family')]
                    });
                }

                // Get head and members
                const head = await message.client.users.fetch(family.headId).catch(() => null);
                const members = [];
                for (const memberId of family.members) {
                    const member = await message.client.users.fetch(memberId).catch(() => null);
                    if (member) members.push(member);
                }

                // Get assets
                const properties = await require('../../models/Property').find({ guildId, familyId: family._id.toString() });
                const vehicles = await require('../../models/Vehicle').find({ guildId, familyId: family._id.toString() });

                const totalPropertyValue = properties.reduce((sum, p) => sum + (p.currentValue || p.purchasePrice), 0);
                const totalVehicleValue = vehicles.reduce((sum, v) => sum + (v.currentValue || v.purchasePrice), 0);
                const totalPassiveIncome = properties.reduce((sum, p) => sum + (p.passiveIncome || 0), 0);

                const riskLevel = family.taxDelinquent ? 'HIGH' : 
                    (family.bank < 10000 ? 'MEDIUM' : 'LOW');

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setAuthor({
                        name: `🌙 Dynasty: ${family.name}`,
                        iconURL: head?.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**Head:** ${head?.username || 'Unknown'}\n` +
                        `**Members:** ${members.length + 1}\n\n` +
                        `**💰 Treasury:** ${family.bank.toLocaleString()} coins\n` +
                        `**🏠 Properties:** ${properties.length} (${totalPropertyValue.toLocaleString()} coins)\n` +
                        `**🚗 Vehicles:** ${vehicles.length} (${totalVehicleValue.toLocaleString()} coins)\n` +
                        `**📈 Passive Income:** ${totalPassiveIncome.toLocaleString()} coins/day\n\n` +
                        `**⚠️ Risk Level:** ${riskLevel}`
                    )
                    .addFields({
                        name: 'Members',
                        value: members.length > 0 
                            ? members.map(m => m.username).join(', ')
                            : 'None',
                        inline: false
                    })
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(THEME.COLORS.WARNING)
                        .setDescription(
                            '**Family Commands:**\n\n' +
                            '`elora family create <name>` - Create a dynasty (50k)\n' +
                            '`elora family invite <@user>` - Send invitation\n' +
                            '`elora family accept <ID>` - Accept invitation\n' +
                            '`elora family reject <ID>` - Reject invitation\n' +
                            '`elora family invites` - View pending invitations\n' +
                            '`elora family kick <@user>` - Remove member (head only)\n' +
                            '`elora family bank dep <amount>` - Deposit to treasury\n' +
                            '`elora family bank with <amount>` - Withdraw from treasury\n' +
                            '`elora family info` - View dynasty dashboard'
                        )]
                });
            }

        } catch (error) {
            console.error('Family command error:', error);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`❌ ${error.message}`)]
            });
        }
    }
};
