const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const THEME = require('../../utils/theme');
const { parseAmount } = require('../../utils/amountParser');

const GAMBLING_HALL_ID = '1467465229675003925';
const CASINO_LOGS_ID = '1467466000214655150';
const HIGH_ROLLER_ROLE = '1467468390171021394';

// Store active games: userId -> gameState
const activeGames = new Map();

function getCardValue(card) {
    if (card === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card)) return 10;
    return parseInt(card);
}

function calculateHand(hand) {
    let total = 0;
    let aces = 0;
    
    for (const card of hand) {
        if (card === 'A') {
            aces++;
            total += 11;
        } else if (['J', 'Q', 'K'].includes(card)) {
            total += 10;
        } else {
            total += parseInt(card);
        }
    }
    
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    
    return total;
}

function getCardDisplay(card) {
    // Beautiful card display
    return `\`${card}\``;
}

function formatHand(hand, hideFirst = false) {
    if (hideFirst && hand.length > 0) {
        const visible = hand.slice(1).map(getCardDisplay).join(' ');
        return `🂠 **?** ${visible}`;
    }
    const cards = hand.map(getCardDisplay).join(' ');
    return cards;
}

function createDeck() {
    const deck = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    return shuffle([...deck, ...deck, ...deck, ...deck]);
}

function shuffle(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function createGameEmbed(gameState, userId, author) {
    const { playerHand, dealerHand, amount, status, playerTotal, dealerTotal, result, winnings } = gameState;
    const isPlaying = status === 'playing';
    const isEnded = status === 'ended';
    
    let embed = new EmbedBuilder()
        .setAuthor({ 
            name: `🃏 Blackjack Game`, 
            iconURL: author.displayAvatarURL({ dynamic: true }) 
        })
        .setColor(isEnded ? 
            (result === 'BLACKJACK!' || result === 'WIN' || result === 'DEALER BUST' ? THEME.COLORS.SUCCESS : 
             result === 'PUSH' ? THEME.COLORS.WARNING : THEME.COLORS.ERROR) : 
            THEME.COLORS.ACCENT)
        .setThumbnail(author.displayAvatarURL({ dynamic: true }));

    if (isPlaying) {
        embed.setDescription(
            `**💰 Bet:** \`${amount.toLocaleString()}\` coins\n\n` +
            `**👤 Your Hand:**\n${formatHand(playerHand)}\n` +
            `**Total:** \`${playerTotal}\`\n\n` +
            `**🃏 Dealer Hand:**\n${formatHand(dealerHand, true)}\n` +
            `**Total:** \`?\`\n\n` +
            `*Choose your action below...*`
        );
    } else {
        const resultEmoji = result === 'BLACKJACK!' ? '🎉' : result.includes('WIN') ? '✅' : result === 'PUSH' ? '🤝' : '❌';
        embed.setDescription(
            `**💰 Bet:** \`${amount.toLocaleString()}\` coins\n\n` +
            `**👤 Your Hand:**\n${formatHand(playerHand)}\n` +
            `**Total:** \`${playerTotal}\`\n\n` +
            `**🃏 Dealer Hand:**\n${formatHand(dealerHand)}\n` +
            `**Total:** \`${dealerTotal}\`\n\n` +
            `**${resultEmoji} Result:** \`${result}\`\n` +
            `${winnings > 0 ? `💰 **Won:** \`${winnings.toLocaleString()}\` coins` : '💸 **Lost your bet**'}`
        );
    }

    embed.setFooter({ text: THEME.FOOTER.text, iconURL: THEME.FOOTER.iconURL })
         .setTimestamp();

    return embed;
}

function createButtons(gameState) {
    const { status } = gameState;
    const isPlaying = status === 'playing';
    
    if (!isPlaying) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('bj_disabled')
                .setLabel('Game Ended')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );
    }

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('bj_hit')
            .setLabel('Hit')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('bj_stand')
            .setLabel('Stand')
            .setEmoji('✋')
            .setStyle(ButtonStyle.Danger)
    );
}

async function endGame(gameState, userId, guildId, author) {
    const { playerHand, dealerHand, amount, deck } = gameState;
    
    // Dealer draws until 17+
    let dealerTotal = calculateHand(dealerHand);
    while (dealerTotal < 17) {
        dealerHand.push(deck.pop());
        dealerTotal = calculateHand(dealerHand);
    }
    
    const playerTotal = calculateHand(playerHand);
    
    let result = '';
    let winnings = 0;

    // Check for blackjack (21 with 2 cards)
    if (playerTotal === 21 && playerHand.length === 2 && dealerTotal !== 21) {
        result = 'BLACKJACK!';
        winnings = Math.floor(amount * 2.5);
    } else if (playerTotal > 21) {
        result = 'BUST';
        winnings = 0;
    } else if (dealerTotal > 21) {
        result = 'DEALER BUST';
        winnings = Math.floor(amount * 2);
    } else if (playerTotal > dealerTotal) {
        result = 'WIN';
        winnings = Math.floor(amount * 2);
    } else if (playerTotal < dealerTotal) {
        result = 'LOSE';
        winnings = 0;
    } else {
        result = 'PUSH';
        winnings = amount; // Return bet
    }

    gameState.status = 'ended';
    gameState.result = result;
    gameState.winnings = winnings;
    gameState.playerTotal = playerTotal;
    gameState.dealerTotal = dealerTotal;

    // Update user wallet (bet was already deducted, so we only add winnings)
    const userProfile = await User.findOne({ userId, guildId });
    if (userProfile) {
        if (winnings > 0) {
            userProfile.wallet = (userProfile.wallet || 0) + winnings;
            await userProfile.save();
        }
        // If winnings is 0, bet is already lost (deducted at start)
    }

    // Log to casino logs
    const guild = author.client?.guilds?.cache?.get(guildId);
    if (guild) {
        const logChannel = guild.channels.cache.get(CASINO_LOGS_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.ACCENT)
                .setDescription(`🃏 **Blackjack** | ${author} | Bet: ${amount.toLocaleString()} | ${winnings > 0 ? `Won: ${winnings.toLocaleString()}` : 'Lost'}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }

    return gameState;
}

module.exports = {
    name: 'blackjack',
    aliases: ['bj', '21'],
    activeGames, // Export for button handler
    
    async execute(message, client, args) {
        // Channel restriction
        if (message.channel.id !== GAMBLING_HALL_ID) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`❌ This command can only be used in <#${GAMBLING_HALL_ID}>`)] });
        }

        const userId = message.author.id;
        
        // Check if user has an active game
        if (activeGames.has(userId)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription('❌ You already have an active game! Please finish it first.')] });
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

        let userProfile = await User.findOne({ userId, guildId: message.guild.id });
        if (!userProfile) {
            userProfile = new User({ userId, guildId: message.guild.id });
        }

        if ((userProfile.wallet || 0) < amount) {
            return message.reply({ embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ You don\'t have enough coins.')] });
        }

        // Deduct bet
        userProfile.wallet = (userProfile.wallet || 0) - amount;
        await userProfile.save();

        // Deal initial cards
        const deck = createDeck();
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];

        const playerTotal = calculateHand(playerHand);
        const dealerTotal = calculateHand(dealerHand);

        // Check for instant blackjack
        if (playerTotal === 21 && dealerTotal === 21) {
            // Both have blackjack - push
            userProfile.wallet = (userProfile.wallet || 0) + amount;
            await userProfile.save();
            
            const embed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING)
                .setAuthor({ 
                    name: `🃏 Blackjack - PUSH`, 
                    iconURL: message.author.displayAvatarURL({ dynamic: true }) 
                })
                .setDescription(
                    `**💰 Bet:** ${amount.toLocaleString()} coins\n\n` +
                    `**👤 Your Hand:**\n${formatHand(playerHand)}\n` +
                    `**Total: ${playerTotal}**\n\n` +
                    `**🃏 Dealer Hand:**\n${formatHand(dealerHand)}\n` +
                    `**Total: ${dealerTotal}**\n\n` +
                    `**🤝 Result: PUSH (Both Blackjack!)**\n` +
                    `💰 **Bet returned: ${amount.toLocaleString()} coins**`
                )
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: THEME.FOOTER.text, iconURL: THEME.FOOTER.iconURL })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }

        if (playerTotal === 21) {
            // Player blackjack - instant win
            const winnings = Math.floor(amount * 2.5);
            userProfile.wallet = (userProfile.wallet || 0) + winnings;
            await userProfile.save();
            
            const embed = new EmbedBuilder()
                .setColor(THEME.COLORS.SUCCESS)
                .setAuthor({ 
                    name: `🃏 Blackjack - BLACKJACK!`, 
                    iconURL: message.author.displayAvatarURL({ dynamic: true }) 
                })
                .setDescription(
                    `**💰 Bet:** ${amount.toLocaleString()} coins\n\n` +
                    `**👤 Your Hand:**\n${formatHand(playerHand)}\n` +
                    `**Total: ${playerTotal}**\n\n` +
                    `**🃏 Dealer Hand:**\n${formatHand(dealerHand)}\n` +
                    `**Total: ${dealerTotal}**\n\n` +
                    `**🎉 Result: BLACKJACK!**\n` +
                    `💰 **Won: ${winnings.toLocaleString()} coins**`
                )
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: THEME.FOOTER.text, iconURL: THEME.FOOTER.iconURL })
                .setTimestamp();
            
            // Log to casino logs
            const logChannel = message.guild.channels.cache.get(CASINO_LOGS_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(THEME.COLORS.ACCENT)
                    .setDescription(`🃏 **Blackjack** | ${message.author} | Bet: ${amount.toLocaleString()} | Won: ${winnings.toLocaleString()}`)
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
            
            return message.reply({ embeds: [embed] });
        }

        // Create game state
        const gameState = {
            playerHand,
            dealerHand,
            deck,
            amount,
            status: 'playing',
            playerTotal,
            dealerTotal: calculateHand([dealerHand[0]]), // Only show first card value
            result: '',
            winnings: 0,
            messageId: null,
            guildId: message.guild.id,
            author: message.author
        };

        activeGames.set(userId, gameState);

        const embed = createGameEmbed(gameState, userId, message.author);
        const buttons = createButtons(gameState);

        const sentMessage = await message.reply({ embeds: [embed], components: [buttons] });
        gameState.messageId = sentMessage.id;

        // Auto-cleanup after 5 minutes
        setTimeout(() => {
            if (activeGames.has(userId) && activeGames.get(userId).status === 'playing') {
                activeGames.delete(userId);
            }
        }, 5 * 60 * 1000);
    },

    async handleButton(interaction) {
        const userId = interaction.user.id;
        const gameState = activeGames.get(userId);

        if (!gameState) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ No active game found. Start a new game with `!blackjack <amount>`.')], 
                ephemeral: true 
            });
        }

        if (gameState.status !== 'playing') {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription('❌ This game has already ended.')], 
                ephemeral: true 
            });
        }

        const action = interaction.customId.split('_')[1]; // 'hit' or 'stand'

        if (action === 'hit') {
            // Player hits - add a card
            gameState.playerHand.push(gameState.deck.pop());
            gameState.playerTotal = calculateHand(gameState.playerHand);

            // Check if player busts
            if (gameState.playerTotal > 21) {
                await endGame(gameState, userId, gameState.guildId, interaction.user);
                activeGames.delete(userId);
                
                const embed = createGameEmbed(gameState, userId, interaction.user);
                const buttons = createButtons(gameState);
                
                return interaction.update({ embeds: [embed], components: [buttons] });
            }

            // Update embed
            const embed = createGameEmbed(gameState, userId, interaction.user);
            const buttons = createButtons(gameState);
            
            return interaction.update({ embeds: [embed], components: [buttons] });

        } else if (action === 'stand') {
            // Player stands - dealer plays
            await endGame(gameState, userId, gameState.guildId, interaction.user);
            activeGames.delete(userId);
            
            const embed = createGameEmbed(gameState, userId, interaction.user);
            const buttons = createButtons(gameState);
            
            return interaction.update({ embeds: [embed], components: [buttons] });
        }
    }
};
