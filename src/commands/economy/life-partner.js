const { EmbedBuilder } = require('discord.js');
const LifeSimService = require('../../services/lifeSimService');
const THEME = require('../../utils/theme');
const Relationship = require('../../models/Relationship');

module.exports = {
    name: 'partner',
    aliases: ['marry', 'alliance'],
    async execute(message, client, args) {
        const service = new LifeSimService(client);

        const subcommand = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const userId = message.author.id;

        try {
            if (subcommand === 'propose') {
                const target = message.mentions.users.first();
                if (!target) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Please mention a user to propose to')]
                    });
                }

                const relationship = await service.proposePartnership(guildId, userId, target.id);
                const config = service.getConfig();

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setAuthor({
                        name: '💍 Economic Proposal Sent',
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**Proposer:** ${message.author}\n` +
                        `**Target:** ${target}\n` +
                        `**Cost:** ${config.prices.PARTNERSHIP_PROPOSAL.toLocaleString()} coins\n\n` +
                        `*Waiting for ${target.username} to accept...*`
                    )
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                // Try to DM the target
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(THEME.COLORS.ACCENT)
                        .setAuthor({ name: '💍 Economic Partnership Proposal' })
                        .setDescription(
                            `**${message.author}** has proposed an economic partnership to you!\n\n` +
                            `**Benefits:**\n` +
                            `• +10% work income bonus\n` +
                            `• -15% tax reduction\n\n` +
                            `*Use \`elora partner accept ${relationship._id}\` to accept*`
                        )
                        .setTimestamp();
                    await target.send({ embeds: [dmEmbed] });
                } catch (e) {
                    // DMs disabled, that's okay
                }

                // Announce in city-hall
                const cityHall = message.guild.channels.cache.get(config.channels.CITY_HALL);
                if (cityHall) {
                    const announcement = new EmbedBuilder()
                        .setColor(THEME.COLORS.ACCENT)
                        .setAuthor({ name: '🏛️ City Announcement' })
                        .setDescription(
                            `**${message.author}** has proposed an economic partnership to **${target}**\n` +
                            `Partnership cost: **${config.prices.PARTNERSHIP_PROPOSAL.toLocaleString()}** coins`
                        )
                        .setTimestamp();
                    await cityHall.send({ embeds: [announcement] });
                }

            } else if (subcommand === 'accept') {
                const relationshipId = args[1];
                if (!relationshipId) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Please provide a relationship ID')]
                    });
                }

                const relationship = await service.acceptPartnership(guildId, relationshipId, userId);
                const proposer = await message.client.users.fetch(relationship.partner1Id).catch(() => null);
                const config = service.getConfig();

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setAuthor({
                        name: '💍 Partnership Active',
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**Partners:** ${proposer?.username || 'Unknown'} & ${message.author.username}\n\n` +
                        `**Active Buffs:**\n` +
                        `• +${relationship.workIncomeBonus}% work income\n` +
                        `• -${relationship.taxReduction}% tax reduction\n\n` +
                        `*Partnership is now active!*`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                // Announce in city-hall
                const cityHall = message.guild.channels.cache.get(config.channels.CITY_HALL);
                if (cityHall) {
                    const announcement = new EmbedBuilder()
                        .setColor(THEME.COLORS.SUCCESS)
                        .setAuthor({ name: '🏛️ City Announcement' })
                        .setDescription(
                            `**${proposer?.username || 'Unknown'}** and **${message.author.username}** have formed an economic partnership!`
                        )
                        .setTimestamp();
                    await cityHall.send({ embeds: [announcement] });
                }

            } else if (subcommand === 'status') {
                const relationship = await Relationship.findOne({
                    guildId,
                    $or: [{ partner1Id: userId }, { partner2Id: userId }],
                    status: 'active'
                });

                if (!relationship) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.WARNING)
                            .setDescription('❌ You are not in an active partnership')]
                    });
                }

                const partner1 = await message.client.users.fetch(relationship.partner1Id).catch(() => null);
                const partner2 = await message.client.users.fetch(relationship.partner2Id).catch(() => null);

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setAuthor({
                        name: '💍 Partnership Status',
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**Partners:** ${partner1?.username || 'Unknown'} & ${partner2?.username || 'Unknown'}\n\n` +
                        `**Active Buffs:**\n` +
                        `• +${relationship.workIncomeBonus}% work income bonus\n` +
                        `• -${relationship.taxReduction}% tax reduction\n\n` +
                        `**Formed:** <t:${Math.floor(relationship.createdAt.getTime() / 1000)}:R>`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else if (subcommand === 'proposals' || subcommand === 'invites') {
                const proposals = await Relationship.find({
                    guildId,
                    partner2Id: userId,
                    status: 'pending'
                });

                if (proposals.length === 0) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.WARNING)
                            .setDescription('❌ You have no pending partnership proposals')]
                    });
                }

                const proposalsList = [];
                for (const proposal of proposals) {
                    const proposer = await message.client.users.fetch(proposal.partner1Id).catch(() => null);
                    proposalsList.push(
                        `**${proposer?.username || 'Unknown'}**\n` +
                        `ID: \`${proposal._id}\`\n` +
                        `Cost: ${proposal.proposalCost.toLocaleString()} coins`
                    );
                }

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setAuthor({
                        name: '💍 Pending Proposals',
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        proposalsList.join('\n\n') +
                        `\n\n**To accept:** \`elora partner accept <ID>\`\n` +
                        `**To reject:** Just ignore (expires automatically)`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else if (subcommand === 'dissolve') {
                const relationship = await Relationship.findOne({
                    guildId,
                    $or: [{ partner1Id: userId }, { partner2Id: userId }],
                    status: 'active'
                });

                if (!relationship) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ You are not in an active partnership')]
                    });
                }

                const partner1 = await message.client.users.fetch(relationship.partner1Id).catch(() => null);
                const partner2 = await message.client.users.fetch(relationship.partner2Id).catch(() => null);

                relationship.status = 'dissolved';
                relationship.dissolvedAt = new Date();
                await relationship.save();

                // Remove roles
                const guild = message.guild;
                await service.removeRole(guild, relationship.partner1Id, service.getConfig().roles.ECONOMIC_PARTNER);
                await service.removeRole(guild, relationship.partner2Id, service.getConfig().roles.ECONOMIC_PARTNER);

                const penalty = Math.floor(relationship.proposalCost * 0.5); // 50% penalty

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.WARNING)
                    .setAuthor({ name: '💔 Partnership Dissolved' })
                    .setDescription(
                        `**Partnership ended** between ${partner1?.username || 'Unknown'} & ${partner2?.username || 'Unknown'}\n\n` +
                        `**Penalty:** ${penalty.toLocaleString()} coins (50% of proposal cost)\n` +
                        `*All partnership buffs have been removed.*`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(THEME.COLORS.WARNING)
                        .setDescription(
                            '**Partnership Commands:**\n\n' +
                            '`elora partner propose <@user>` - Send proposal (100k)\n' +
                            '`elora partner accept <ID>` - Accept proposal\n' +
                            '`elora partner proposals` - View pending proposals\n' +
                            '`elora partner status` - View active partnership\n' +
                            '`elora partner dissolve` - End partnership'
                        )]
                });
            }

        } catch (error) {
            console.error('Partner command error:', error);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`❌ ${error.message}`)]
            });
        }
    }
};
