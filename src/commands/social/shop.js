const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');

const SHOP_ITEMS = [
    { id: 'lucky_charm', name: '🍀 Lucky Charm', price: 5000, description: 'Increases gambling win rate by 5%' },
    { id: 'safe_vault', name: '🔒 Safe Vault', price: 10000, description: 'Protects 50% of wallet from robberies' },
    { id: 'double_daily', name: '💰 Double Daily', price: 15000, description: 'Doubles daily reward for 7 days' },
    { id: 'xp_boost', name: '⚡ XP Boost', price: 8000, description: '2x XP gain for 24 hours' }
];

module.exports = {
    name: 'shop',
    aliases: ['store', 'market'],
    async execute(message, client, args) {
        // Check if it's the life sim shop command
        if (args[0]?.toLowerCase() === 'life') {
            // Handle life sim shop directly here
            try {
                const LifeSimService = require('../../services/lifeSimService');
                const service = new LifeSimService(client);
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

                return await message.reply({ embeds: [propertiesEmbed, vehiclesEmbed] });
            } catch (error) {
                console.error('Life shop error:', error);
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(THEME.COLORS.ERROR)
                        .setDescription(`❌ ${error.message}`)]
                });
            }
        }

        if (args[0]) {
            // Buying an item
            const itemId = args[0].toLowerCase();
            const item = SHOP_ITEMS.find(i => i.id === itemId);

            if (!item) {
                return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Item not found. Use `elora shop` to see available items, or `elora shop life` for the life sim market.')] });
            }

            let userProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
            if (!userProfile) {
                userProfile = new User({ userId: message.author.id, guildId: message.guild.id });
            }

            const totalMoney = (userProfile.wallet || 0) + (userProfile.bank || 0);
            if (totalMoney < item.price) {
                return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`❌ You need \`${item.price.toLocaleString()}\` coins to buy this item.`)] });
            }

            // Check if already owned
            if (userProfile.inventory && userProfile.inventory.includes(item.id)) {
                return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription(`❌ You already own this item.`)] });
            }

            // Deduct money
            if ((userProfile.wallet || 0) >= item.price) {
                userProfile.wallet = (userProfile.wallet || 0) - item.price;
            } else {
                const remaining = item.price - (userProfile.wallet || 0);
                userProfile.wallet = 0;
                userProfile.bank = (userProfile.bank || 0) - remaining;
            }

            // Add to inventory
            if (!userProfile.inventory) userProfile.inventory = [];
            userProfile.inventory.push(item.id);
            await userProfile.save();

            const embed = new EmbedBuilder()
                .setColor(THEME.COLORS.SUCCESS)
                .setTitle('✅ Purchase Successful!')
                .setDescription(`You bought **${item.name}** for \`${item.price.toLocaleString()}\` coins!\n\n${item.description}`)
                .setFooter(THEME.FOOTER)
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } else {
            // Show shop
            const embed = new EmbedBuilder()
                .setColor(THEME.COLORS.ACCENT)
                .setTitle('🛒 Shop')
                .setDescription(
                    '**Item Shop:**\n' +
                    'Use `elora shop [item_id]` to buy an item.\n\n' + 
                    SHOP_ITEMS.map(item => `**${item.name}** - \`${item.price.toLocaleString()}\` coins\n\`${item.id}\` - ${item.description}`).join('\n\n') +
                    '\n\n**Life Sim Market:**\n' +
                    'Use `elora shop life` to view properties and vehicles.'
                )
                .setFooter(THEME.FOOTER)
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        }
    }
};
