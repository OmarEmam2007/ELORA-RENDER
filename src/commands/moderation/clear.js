const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const THEME = require('../../utils/theme');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Vaporizes messages from existence.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option => option.setName('target').setDescription('Only delete from this user (optional)')),

    async execute(interaction, client, args) {
        // --- 1. Hybrid Input ---
        const isSlash = interaction.isChatInputCommand?.();
        const user = isSlash ? interaction.user : interaction.author;

        let amount, targetUser;

        if (isSlash) {
            amount = interaction.options.getInteger('amount');
            targetUser = interaction.options.getUser('target');
        } else {
            // Prefix: !clear [Amount] [Optional: @User]
            amount = parseInt(args[0]);
            if (isNaN(amount) || amount < 1 || amount > 100) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`${THEME.ICONS.CROSS} **Usage:** \`!clear [1-100]\``)]
                });
            }
        }

        // --- 2. Pseudo-Animation (Vaporize) ---
        // For clear, we want it snappy but fancy.
        const initEmbed = new EmbedBuilder()
            .setColor(THEME.COLORS.ACCENT)
            .setDescription('💥 **Preparing Vaporization Beam...**');

        let msg;
        if (isSlash) {
            await interaction.reply({ embeds: [initEmbed], ephemeral: true }); // Ephemeral so we don't delete our own log immediately
            msg = interaction;
        } else {
            msg = await interaction.reply({ embeds: [initEmbed] });
        }

        await new Promise(r => setTimeout(r, 1000)); // Charge laser

        // --- 3. Execute ---
        try {
            const channel = interaction.channel;
            const messages = await channel.messages.fetch({ limit: amount });

            let toDelete = messages;
            if (targetUser) {
                toDelete = messages.filter(m => m.author.id === targetUser.id);
            }

            // Delete
            await channel.bulkDelete(toDelete, true);

            const successEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.SUCCESS)
                .setDescription(`💥 **Vaporized ${toDelete.size} messages**`)
                .setTimestamp();

            if (isSlash) {
                await interaction.editReply({ embeds: [successEmbed] });
            } else {
                // If prefix, rewrite the loading message to success, then delete it after 3s
                await msg.edit({ embeds: [successEmbed] });
                setTimeout(() => msg.delete().catch(() => { }), 3000);
            }

        } catch (error) {
            console.error(error);
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ **Error:** Messages too old or missing.');
            if (isSlash) await interaction.editReply({ embeds: [err] });
            else await msg.edit({ embeds: [err] });
        }
    },
};
