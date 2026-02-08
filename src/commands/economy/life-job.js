const { EmbedBuilder } = require('discord.js');
const LifeSimService = require('../../services/lifeSimService');
const THEME = require('../../utils/theme');
const User = require('../../models/User');

module.exports = {
    name: 'job',
    aliases: ['work', 'career'],
    async execute(message, client, args) {
        const service = new LifeSimService(client);

        const subcommand = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const userId = message.author.id;

        try {
            if (subcommand === 'board') {
                const jobs = service.getJobs();
                const config = service.getConfig();

                const jobsList = jobs.map(job => {
                    return `**Tier ${job.tier}** 🧑‍💻 ${job.name}\n` +
                        `   Base Pay: **${job.basePay.toLocaleString()}** coins • Requires Level ${job.requiredLevel}`;
                }).join('\n\n');

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setAuthor({ name: '💼 Job Board' })
                    .setDescription(
                        `**Available Careers:**\n\n${jobsList}\n\n` +
                        `Use \`elora job work\` to earn income based on your level`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else if (subcommand === 'work') {
                let user = await User.findOne({ userId, guildId });
                if (!user) {
                    user = new User({ userId, guildId });
                    await user.save();
                }

                // Check cooldown (3 hours base, reduced by vehicle)
                const baseCooldown = 3 * 60 * 60 * 1000; // 3 hours
                const workData = await service.calculateWorkIncome(guildId, userId);
                const cooldownReduction = workData.cooldownReduction || 0;
                const actualCooldown = Math.floor(baseCooldown * (1 - cooldownReduction / 100));

                const now = Date.now();
                const lastWork = user.lastWorkTimestamp || 0;
                const timeSinceLastWork = now - lastWork;

                if (timeSinceLastWork < actualCooldown) {
                    const remaining = actualCooldown - timeSinceLastWork;
                    const hours = Math.floor(remaining / (1000 * 60 * 60));
                    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.WARNING)
                            .setDescription(
                                `⏳ **Cooldown Active**\n\n` +
                                `You can work again in **${hours}h ${minutes}m**\n` +
                                `${cooldownReduction > 0 ? `*Vehicle bonus: -${cooldownReduction}% cooldown*` : ''}`
                            )]
                    });
                }

                // Calculate income
                const incomeData = await service.calculateWorkIncome(guildId, userId);
                const finalPay = incomeData.finalPay;

                user.wallet = (user.wallet || 0) + finalPay;
                user.lastWorkTimestamp = now;
                await user.save();

                // Update high net worth role
                const guild = message.guild;
                await service.updateHighNetWorthRole(guild, userId);

                const bonusesText = incomeData.bonuses.length > 0
                    ? `\n**Buffs Applied:**\n${incomeData.bonuses.join('\n')}`
                    : '';

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setAuthor({
                        name: '💼 Work Complete',
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**Job:** ${incomeData.jobName} (Tier ${incomeData.jobTier})\n` +
                        `**Base Income:** ${incomeData.basePay.toLocaleString()} coins${bonusesText}\n\n` +
                        `**💰 Final Payout:** ${finalPay.toLocaleString()} coins\n` +
                        `**Your Wallet:** ${user.wallet.toLocaleString()} coins\n\n` +
                        `**Next Available:** <t:${Math.floor((now + actualCooldown) / 1000)}:R>`
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else if (subcommand === 'promotion') {
                let user = await User.findOne({ userId, guildId });
                if (!user) {
                    user = new User({ userId, guildId });
                    await user.save();
                }

                const jobs = service.getJobs();
                const currentJob = jobs.find(j => j.requiredLevel <= user.level) || jobs[0];
                const nextJob = jobs.find(j => j.requiredLevel > user.level);

                if (!nextJob) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.WARNING)
                            .setDescription('🎉 **You are already at the highest tier!**\n\nYou are a **CTO** - the pinnacle of your career.')]
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setAuthor({
                        name: '📈 Career Progression',
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**Current:** ${currentJob.name} (Tier ${currentJob.tier})\n` +
                        `**Base Pay:** ${currentJob.basePay.toLocaleString()} coins\n\n` +
                        `**Next:** ${nextJob.name} (Tier ${nextJob.tier})\n` +
                        `**Requires:** Level ${nextJob.requiredLevel}\n` +
                        `**New Base Pay:** ${nextJob.basePay.toLocaleString()} coins\n\n` +
                        `*Keep leveling up to unlock promotions!*`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

            } else {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(THEME.COLORS.WARNING)
                        .setDescription(
                            '**Job Commands:**\n\n' +
                            '`elora job board` - View available careers\n' +
                            '`elora job work` - Earn income (3h cooldown)\n' +
                            '`elora job promotion` - Check next career tier'
                        )]
                });
            }

        } catch (error) {
            console.error('Job command error:', error);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`❌ ${error.message}`)]
            });
        }
    }
};
