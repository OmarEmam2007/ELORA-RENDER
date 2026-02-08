const { EmbedBuilder } = require('discord.js');
const LifeSimService = require('../../services/lifeSimService');
const THEME = require('../../utils/theme');
const User = require('../../models/User');

module.exports = {
    name: 'buy',
    aliases: ['purchase'],
    async execute(message, client, args) {
        const service = new LifeSimService(client);

        const type = args[0]?.toLowerCase();
        const itemId = args[1]?.toUpperCase();
        const guildId = message.guild.id;
        const userId = message.author.id;

        try {
            if (type === 'property') {
                if (!itemId) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Please specify a property ID (e.g., `elora buy property PROP-001`)')]
                    });
                }

                const property = await service.purchaseProperty(guildId, userId, itemId, false);
                const config = service.getConfig();

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setAuthor({
                        name: '✅ Purchase Successful',
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**Property:** ${property.name}\n` +
                        `**Cost:** ${property.purchasePrice.toLocaleString()} coins\n` +
                        `**Passive Income:** +${property.passiveIncome.toLocaleString()}/day\n` +
                        `**Tax Rate:** ${property.taxRate}%\n\n` +
                        `**Your Wallet:** ${(await User.findOne({ userId, guildId })).wallet.toLocaleString()} coins`
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                // Announce in city-hall
                const cityHall = message.guild.channels.cache.get(config.channels.CITY_HALL);
                if (cityHall) {
                    const announcement = new EmbedBuilder()
                        .setColor(THEME.COLORS.ACCENT)
                        .setAuthor({ name: '🏛️ City Announcement' })
                        .setDescription(
                            `**${message.author}** acquired **${property.name}**\n` +
                            `Purchase price: **${property.purchasePrice.toLocaleString()}** coins`
                        )
                        .setTimestamp();
                    await cityHall.send({ embeds: [announcement] });
                }

            } else if (type === 'vehicle') {
                if (!itemId) {
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(THEME.COLORS.ERROR)
                            .setDescription('❌ Please specify a vehicle ID (e.g., `elora buy vehicle VEH-001`)')]
                    });
                }

                const vehicle = await service.purchaseVehicle(guildId, userId, itemId, false);
                const config = service.getConfig();

                const embed = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setAuthor({
                        name: '✅ Purchase Successful',
                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setDescription(
                        `**Vehicle:** ${vehicle.name}\n` +
                        `**Cost:** ${vehicle.purchasePrice.toLocaleString()} coins\n` +
                        `**Cooldown Reduction:** -${vehicle.workCooldownReduction}%\n` +
                        `**Tax Rate:** ${vehicle.taxRate}%\n\n` +
                        `**Your Wallet:** ${(await User.findOne({ userId, guildId })).wallet.toLocaleString()} coins`
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                // Announce in city-hall
                const cityHall = message.guild.channels.cache.get(config.channels.CITY_HALL);
                if (cityHall) {
                    const announcement = new EmbedBuilder()
                        .setColor(THEME.COLORS.ACCENT)
                        .setAuthor({ name: '🏛️ City Announcement' })
                        .setDescription(
                            `**${message.author}** acquired **${vehicle.name}**\n` +
                            `Purchase price: **${vehicle.purchasePrice.toLocaleString()}** coins`
                        )
                        .setTimestamp();
                    await cityHall.send({ embeds: [announcement] });
                }

            } else {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(THEME.COLORS.WARNING)
                        .setDescription(
                            '**Buy Commands:**\n\n' +
                            '`elora buy property <ID>` - Purchase a property\n' +
                            '`elora buy vehicle <ID>` - Purchase a vehicle\n\n' +
                            'Use `elora shop life` to see available items'
                        )]
                });
            }

        } catch (error) {
            console.error('Buy command error:', error);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`❌ ${error.message}`)]
            });
        }
    }
};
