const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');
const { parseAmount } = require('../../utils/amountParser');

const GAMBLING_HALL_ID = '1467465229675003925';
const CASINO_LOGS_ID = '1467466000214655150';
const HIGH_ROLLER_ROLE = '1467468390171021394';

module.exports = {
    name: 'crash',
    async execute(message, client, args) {
        // Channel restriction
        if (message.channel.id !== GAMBLING_HALL_ID) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`❌ This command can only be used in <#${GAMBLING_HALL_ID}>`)] });
        }

        const amount = parseAmount(args[0]);
        if (!amount || amount === 'all' || amount <= 0) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please specify a valid bet amount (supports k notation: 3k = 3000).')] });
        }

        // Check for High Roller role (2x max bet)
        const hasHighRoller = message.member.roles.cache.has(HIGH_ROLLER_ROLE);
        const maxBet = hasHighRoller ? 100000 : 50000;

        if (amount > maxBet) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`❌ Maximum bet is **${maxBet.toLocaleString()}** coins${hasHighRoller ? ' (High Roller: 2x limit)' : ''}.`)] });
        }

        let userProfile = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
        if (!userProfile) {
            userProfile = new User({ userId: message.author.id, guildId: message.guild.id });
        }

        if ((userProfile.wallet || 0) < amount) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You don\'t have enough coins.')] });
        }

        userProfile.wallet = (userProfile.wallet || 0) - amount;

        // Generate crash multiplier (can crash anywhere from 1.00x to 10.00x)
        // Higher chance of crashing early, lower chance of going high
        const random = Math.random();
        let crashPoint;
        
        if (random < 0.3) {
            // 30% chance: Crash very early (1.00x - 2.00x)
            crashPoint = 1.0 + Math.random();
        } else if (random < 0.6) {
            // 30% chance: Crash early (2.00x - 3.50x)
            crashPoint = 2.0 + Math.random() * 1.5;
        } else if (random < 0.85) {
            // 25% chance: Crash mid (3.50x - 5.00x)
            crashPoint = 3.5 + Math.random() * 1.5;
        } else if (random < 0.95) {
            // 10% chance: Crash high (5.00x - 7.00x)
            crashPoint = 5.0 + Math.random() * 2.0;
        } else {
            // 5% chance: Go very high (7.00x - 10.00x)
            crashPoint = 7.0 + Math.random() * 3.0;
        }
        
        crashPoint = parseFloat(crashPoint.toFixed(2));
        
        // Player cash out decision (simulated - in real crash games, player decides when to cash out)
        // 50% chance player cashes out before crash, 50% chance they don't
        const playerCashesOut = Math.random() < 0.5;
        
        let win = false;
        let multiplier = crashPoint;
        
        if (playerCashesOut) {
            // Player cashed out before crash
            // Cash out at random point between 1.00x and crashPoint (but not at crashPoint)
            const cashOutMultiplier = 1.0 + Math.random() * (crashPoint - 1.0) * 0.95; // 95% of way to crash
            multiplier = parseFloat(cashOutMultiplier.toFixed(2));
            win = true;
        } else {
            // Player didn't cash out in time - crashed!
            win = false;
        }

        const winnings = win ? Math.floor(amount * multiplier) : 0;
        if (win) {
            userProfile.wallet = (userProfile.wallet || 0) + winnings;
        }

        await userProfile.save();

        const embed = new EmbedBuilder()
            .setColor(win ? THEME.COLORS.SUCCESS : THEME.COLORS.ERROR)
            .setAuthor({ 
                name: `🚀 Crash Game`, 
                iconURL: message.author.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(
                `**Multiplier:** ${multiplier.toFixed(2)}x\n\n` +
                `${win ? `✅ Cashed out! You won **${winnings.toLocaleString()}** coins!` : `💥 Crashed! You lost your bet.`}`
            )
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Log to casino logs
        const logChannel = message.guild.channels.cache.get(CASINO_LOGS_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.ACCENT)
                .setDescription(`🚀 **Crash** | ${message.author} | Bet: ${amount.toLocaleString()} | Multiplier: ${multiplier.toFixed(2)}x | ${win ? `Won: ${winnings.toLocaleString()}` : 'Lost'}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
};
