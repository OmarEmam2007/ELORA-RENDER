const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');
const { parseAmount } = require('../../utils/amountParser');

const GAMBLING_HALL_ID = '1467465229675003925';
const CASINO_LOGS_ID = '1467466000214655150';
const HIGH_ROLLER_ROLE = '1467468390171021394';

module.exports = {
    name: 'coinflip',
    aliases: ['cf', 'flip'],
    async execute(message, client, args) {
        // Channel restriction
        if (message.channel.id !== GAMBLING_HALL_ID) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`❌ This command can only be used in <#${GAMBLING_HALL_ID}>`)] });
        }

        const amount = parseAmount(args[0]);
        const choice = args[1]?.toLowerCase();

        if (!amount || amount === 'all' || amount <= 0) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please specify a valid bet amount (supports k notation: 3k = 3000). Usage: `elora coinflip [amount] [heads/tails]`')] });
        }

        if (!choice || !['heads', 'tails', 'h', 't'].includes(choice)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ Please choose heads or tails. Usage: `elora coinflip [amount] [heads/tails]`')] });
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

        // Flip the coin
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const playerChoice = choice === 'h' ? 'heads' : choice === 't' ? 'tails' : choice;
        const win = result === playerChoice;

        const winnings = win ? Math.floor(amount * 2) : 0;
        if (win) {
            userProfile.wallet = (userProfile.wallet || 0) + winnings;
        }

        await userProfile.save();

        const embed = new EmbedBuilder()
            .setColor(win ? THEME.COLORS.SUCCESS : THEME.COLORS.ERROR)
            .setAuthor({ 
                name: `${win ? '🎉 WIN!' : '💸 LOSS'}`, 
                iconURL: message.author.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(
                `**Result:** ${result === 'heads' ? '🪙 Heads' : '🪙 Tails'}\n` +
                `**Your Choice:** ${playerChoice}\n\n` +
                `${win ? `💰 You won **${winnings.toLocaleString()}** coins!` : 'Better luck next time!'}`
            )
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Log to casino logs
        const logChannel = message.guild.channels.cache.get(CASINO_LOGS_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.ACCENT)
                .setDescription(`🪙 **Coinflip** | ${message.author} | Bet: ${amount.toLocaleString()} | ${win ? `Won: ${winnings.toLocaleString()}` : 'Lost'}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
};
