const { EmbedBuilder } = require('discord.js');
const LifeSimService = require('../../services/lifeSimService');
const THEME = require('../../utils/theme');
const Property = require('../../models/Property');
const Vehicle = require('../../models/Vehicle');
const User = require('../../models/User');

module.exports = {
    name: 'shop',
    aliases: ['market', 'store'],
    async execute(message, client, args) {
        const service = new LifeSimService(client);

        const subcommand = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const userId = message.author.id;

        try {
            if (subcommand === 'life') {
                const properties = service.getProperties();
                const vehicles = service.getVehicles();
                const config = service.getConfig();

                // Properties Panel
                const propertiesList = properties.map(p => {
                    const emoji = config.emojis.HOUSE || '🏠';
                    return `**${p.id}** ${emoji} ${p.name} — **${p.price.toLocaleString()}** coins\n` +
                        `   +${p.passiveIncome.toLocaleString()}/day • ${p.taxRate}% tax`;
                }).join('\n\n');

                const propertiesEmbed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setAuthor({ name: '🏛️ Property Market' })
                    .setDescription(
                        `**Available Properties:**\n\n${propertiesList}\n\n` +
                        `Use \`elora buy property <ID>\` to purchase`
                    )
                    .setTimestamp();

                // Vehicles Panel
                const vehiclesList = vehicles.map(v => {
                    return `**${v.id}** 🚗 ${v.name} — **${v.price.toLocaleString()}** coins\n` +
                        `   -${v.cooldownReduction}% work cooldown • ${v.taxRate}% tax`;
                }).join('\n\n');

                const vehiclesEmbed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setAuthor({ name: '🚗 Vehicle Market' })
                    .setDescription(
                        `**Available Vehicles:**\n\n${vehiclesList}\n\n` +
                        `Use \`elora buy vehicle <ID>\` to purchase`
                    )
                    .setTimestamp();

                await message.reply({ embeds: [propertiesEmbed, vehiclesEmbed] });

            } else {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(THEME.COLORS.WARNING)
                        .setDescription('Use `elora shop life` to view the life sim market')]
                });
            }

        } catch (error) {
            console.error('Shop command error:', error);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(THEME.COLORS.ERROR)
                    .setDescription(`❌ ${error.message}`)]
            });
        }
    }
};

