const { EmbedBuilder } = require('discord.js');
const LifeSimService = require('../../services/lifeSimService');
const THEME = require('../../utils/theme');
const Property = require('../../models/Property');
const Vehicle = require('../../models/Vehicle');
const User = require('../../models/User');

module.exports = {
    name: 'assets',
    aliases: ['portfolio', 'properties'],
    async execute(message, client, args) {
        const service = new LifeSimService(client);

        const guildId = message.guild.id;
        const userId = message.author.id;

        try {
            const properties = await Property.find({ guildId, ownerId: userId });
            const vehicles = await Vehicle.find({ guildId, ownerId: userId });

            const totalPropertyValue = properties.reduce((sum, p) => sum + (p.currentValue || p.purchasePrice), 0);
            const totalVehicleValue = vehicles.reduce((sum, v) => sum + (v.currentValue || v.purchasePrice), 0);
            const totalPassiveIncome = properties.reduce((sum, p) => sum + (p.passiveIncome || 0), 0);

            const user = await User.findOne({ userId, guildId });
            const netWorth = await service.calculateNetWorth(guildId, userId);

            const propertiesList = properties.length > 0
                ? properties.map(p => `**${p.name}** — ${(p.currentValue || p.purchasePrice).toLocaleString()} coins (+${p.passiveIncome.toLocaleString()}/day)`).join('\n')
                : 'None';

            const vehiclesList = vehicles.length > 0
                ? vehicles.map(v => `**${v.name}** — ${(v.currentValue || v.purchasePrice).toLocaleString()} coins (-${v.workCooldownReduction}% cooldown)`).join('\n')
                : 'None';

            const embed = new EmbedBuilder()
                .setColor(THEME.COLORS.ACCENT)
                .setAuthor({
                    name: `${message.author.username}'s Portfolio`,
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                })
                .setDescription(
                    `**💰 Net Worth:** ${netWorth.toLocaleString()} coins\n` +
                    `**💵 Wallet:** ${(user?.wallet || 0).toLocaleString()} coins\n` +
                    `**🏦 Bank:** ${(user?.bank || 0).toLocaleString()} coins\n\n` +
                    `**📈 Total Passive Income:** ${totalPassiveIncome.toLocaleString()} coins/day`
                )
                .addFields(
                    {
                        name: '🏠 Properties',
                        value: propertiesList || 'None',
                        inline: false
                    },
                    {
                        name: '🚗 Vehicles',
                        value: vehiclesList || 'None',
                        inline: false
                    }
                )
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Assets command error:', error);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`❌ ${error.message}`)]
            });
        }
    }
};
