const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const THEME = require('../../utils/theme');
const { buildAssetAttachment } = require('../../utils/responseAssets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kicks a user from the server with Lunar authority.')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option => option.setName('target').setDescription('The user to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the kick')),

    async execute(interaction, client, args) {
        // --- 1. Hybrid Input Handling ---
        const isSlash = interaction.isChatInputCommand?.();
        const user = isSlash ? interaction.user : interaction.author;

        // Signature check: handle both (interaction, client, args) and (message, args, client)
        let mainMsg = interaction;
        let bot = client;
        let commandArgs = args;

        if (interaction.isChatInputCommand === undefined && client instanceof Array) {
            mainMsg = interaction;
            commandArgs = client;
            bot = args;
        }

        let targetUser, reason;

        if (isSlash) {
            targetUser = interaction.options.getUser('target');
            reason = interaction.options.getString('reason') || 'Minor Infraction';
        } else {
            // Prefix: !kick @User [Reason]
            const targetId = commandArgs[0]?.replace(/[<@!>]/g, '');
            if (!targetId) {
                const guide = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription(`${THEME.ICONS.CROSS} **Usage:** \`!kick @User [Reason]\``);
                return mainMsg.reply({ embeds: [guide] });
            }

            try {
                targetUser = await bot.users.fetch(targetId);
            } catch (e) {
                return mainMsg.reply({ content: `${THEME.ICONS.CROSS} **Target Lost:** User not found.`, ephemeral: true });
            }

            reason = commandArgs.slice(1).join(' ') || 'Minor Infraction';
        }

        const member = await mainMsg.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            const err = new EmbedBuilder().setColor(THEME.COLORS.ERROR).setDescription('❌ User is not in this server.');
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            return mainMsg.reply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
        }

        const SPECIAL_EXECUTOR_ID = '1380794290350981130';
        const SPECIAL_TARGET_ID = '1258440001616744542';
        if (user?.id === SPECIAL_EXECUTOR_ID && targetUser?.id === SPECIAL_TARGET_ID) {
            return interaction.reply({ content: "AhMeD_kErA has complete control now, i can't kick him." });
        }

        if (!member.kickable) {
            const err = new EmbedBuilder()
                .setColor(THEME.COLORS.ERROR)
                .setDescription(`🚫 **Privilege Error:** Cannot kick **${targetUser.tag}** (Higher Rank).`);
            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) err.setImage(badAsset.url);
            return interaction.reply({ embeds: [err], files: badAsset?.attachment ? [badAsset.attachment] : [], ephemeral: true });
        }

        // --- 2. Pseudo-Animation ---
        const frames = [
            '⚠️ Initiating Removal Protocol...',
            '📉 Decreasing Social Credit...',
            '👢 Calibrating Boot...',
            '💨 Execute.'
        ];

        let responseMsg;
        const initialEmbed = new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription(`${frames[0]}`);

        const loadingAsset = buildAssetAttachment('loading');
        if (loadingAsset?.url) initialEmbed.setImage(loadingAsset.url);

        if (isSlash) {
            await mainMsg.reply({ embeds: [initialEmbed], files: loadingAsset?.attachment ? [loadingAsset.attachment] : [] });
            responseMsg = mainMsg;
        } else {
            responseMsg = await mainMsg.reply({ embeds: [initialEmbed], files: loadingAsset?.attachment ? [loadingAsset.attachment] : [] });
        }

        // Play Animation
        for (let i = 1; i < frames.length; i++) {
            await new Promise(r => setTimeout(r, 700));
            const step = new EmbedBuilder().setColor(THEME.COLORS.WARNING).setDescription(`${frames[i]}`);
            if (loadingAsset?.url) step.setImage(loadingAsset.url);
            if (isSlash) await mainMsg.editReply({ embeds: [step] });
            else await responseMsg.edit({ embeds: [step] });
        }

        // --- 3. Execution ---
        try {
            await targetUser.send(`👢 **Kicked from ${mainMsg.guild.name}**\nReason: ${reason}`).catch(() => { });

            await member.kick(reason);

            const successEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.WARNING) // Yellow/Gold for Kicks
                .setAuthor({ 
                    name: '👢 KICK EXECUTED', 
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }) 
                })
                .setDescription(
                    `**Target:** ${targetUser.tag}\n` +
                    `**Reason:** ${reason}\n` +
                    `**Moderator:** ${user}`
                )
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            const okAsset = buildAssetAttachment('ok');
            if (okAsset?.url) successEmbed.setImage(okAsset.url);

            if (isSlash) await mainMsg.editReply({ embeds: [successEmbed], files: okAsset?.attachment ? [okAsset.attachment] : [] });
            else await responseMsg.edit({ embeds: [successEmbed], files: okAsset?.attachment ? [okAsset.attachment] : [] });

        } catch (error) {
            console.error(error);
            const errEmbed = new EmbedBuilder()
                .setColor(THEME.COLORS.ERROR)
                .setDescription('❌ **Error:** Kick sequence failed.');

            const badAsset = buildAssetAttachment('wrong');
            if (badAsset?.url) errEmbed.setImage(badAsset.url);

            if (isSlash) await mainMsg.editReply({ embeds: [errEmbed], files: badAsset?.attachment ? [badAsset.attachment] : [] });
            else await responseMsg.edit({ embeds: [errEmbed], files: badAsset?.attachment ? [badAsset.attachment] : [] });
        }
    },
};
