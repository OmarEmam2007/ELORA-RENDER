const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');
const { parseAmount } = require('../../utils/amountParser');

const GAMBLING_HALL_ID = '1467465229675003925';
const JACKPOT_CHANNEL_ID = '1467465840558608385';
const CASINO_LOGS_ID = '1467466000214655150';
const HIGH_ROLLER_ROLE = '1467468390171021394';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🍉', '⭐', '💎', '7️⃣'];
const JACKPOT_SYMBOL = '💎';

module.exports = {
    name: 'slots',
    aliases: ['slot'],
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

        // Spin the slots
        const reel1 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const reel2 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const reel3 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

        userProfile.wallet = (userProfile.wallet || 0) - amount;

        let win = false;
        let multiplier = 0;
        let jackpot = false;

        // Check for jackpot (3 diamonds)
        if (reel1 === JACKPOT_SYMBOL && reel2 === JACKPOT_SYMBOL && reel3 === JACKPOT_SYMBOL) {
            jackpot = true;
            multiplier = 100;
            win = true;
        }
        // Check for 3 of a kind
        else if (reel1 === reel2 && reel2 === reel3) {
            multiplier = 10;
            win = true;
        }
        // Check for 2 of a kind
        else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
            multiplier = 2;
            win = true;
        }

        const winnings = win ? Math.floor(amount * multiplier) : 0;
        if (win) {
            userProfile.wallet = (userProfile.wallet || 0) + winnings;
        }

        await userProfile.save();

        // Create result embed
        const embed = new EmbedBuilder()
            .setColor(win ? THEME.COLORS.SUCCESS : THEME.COLORS.ERROR)
            .setAuthor({ 
                name: `${win ? '🎉 WIN!' : '💸 LOSS'}`, 
                iconURL: message.author.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(
                `**${reel1} | ${reel2} | ${reel3}**\n\n` +
                `${win ? `💰 You won **${winnings.toLocaleString()}** coins! (${multiplier}x)` : 'Better luck next time!'}`
            )
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Log to casino logs
        const logChannel = message.guild.channels.cache.get(CASINO_LOGS_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.ACCENT)
                .setDescription(`🎰 **Slots** | ${message.author} | Bet: ${amount.toLocaleString()} | ${win ? `Won: ${winnings.toLocaleString()}` : 'Lost'}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }

        // Jackpot announcement
        if (jackpot) {
            const jackpotChannel = message.guild.channels.cache.get(JACKPOT_CHANNEL_ID);
            if (jackpotChannel) {
                const jackpotEmbed = new EmbedBuilder()
                    .setColor(THEME.COLORS.SUCCESS)
                    .setAuthor({ 
                        name: '🎰 JACKPOT! 🎰', 
                        iconURL: message.author.displayAvatarURL({ dynamic: true }) 
                    })
                    .setDescription(
                        `**${message.author}** just hit the **JACKPOT**!\n\n` +
                        `💰 Won: **${winnings.toLocaleString()}** coins!\n` +
                        `🎯 Bet: **${amount.toLocaleString()}** coins`
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();
                await jackpotChannel.send({ embeds: [jackpotEmbed] }).catch(() => {});
            }
        }
    }
};
