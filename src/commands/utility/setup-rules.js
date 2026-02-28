const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-rules')
        .setDescription('Sends the Modern Rules Panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {

        await interaction.deferReply({ ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('📜 قوانين السيرفر الجديدة')
            .setDescription(
                `**اقرأ كويس.** وجودك هنا معناه إنك موافق على القوانين دي. مفيش هزار.\n\n` +
                `**1) مفيش شتايم نهائيًا**\n` +
                `أي شتيمة = الرسالة هتتمسح + هتاخد warn.\n` +
                `لو وصلت **5 warns** = **timeout ساعة**.\n` +
                `لو كررتها بعد كده = **BAN**.\n\n` +
                `**2) احترام الناس إجباري**\n` +
                `قلة الأدب، التقليل، التنمر، أو كلام كراهية = عقوبة مباشرة.\n\n` +
                `**3) ممنوع السبام والفlood**\n` +
                `متكرر/إزعاج/منشنات كتير = حذف + ميوت/تايم آوت حسب الحالة.\n\n` +
                `**4) ممنوع إعلانات أو دعوات لسيرفرات**\n` +
                `أي لينك دعوة/ترويج من غير إذن = حذف + عقوبة.\n\n` +
                `**5) خصوصية الناس خط أحمر**\n` +
                `Doxing أو نشر معلومات شخصية = **BAN فوري**.\n\n` +
                `--------------------------------\n\n` +
                `**ENGLISH (READ CAREFULLY):**\n` +
                `By staying here, you accept these rules. No excuses.\n\n` +
                `**1) ZERO profanity**\n` +
                `Any profanity = message deleted + a warning.\n` +
                `At **5 warnings** = **1-hour timeout**.\n` +
                `Repeat after that = **BAN**.\n\n` +
                `**2) Respect is mandatory**\n` +
                `Harassment, hate speech, or toxic behavior = immediate punishment.\n\n` +
                `**3) No spam / flooding**\n` +
                `Spam, excessive mentions, or disruption = deletion + timeout.\n\n` +
                `**4) No ads / server invites**\n` +
                `Unapproved promotion or invite links = removal + punishment.\n\n` +
                `**5) Privacy is non‑negotiable**\n` +
                `Doxing / leaking personal info = **instant ban**.`
            )
            .setImage('https://media.discordapp.net/attachments/placeholder/rules-banner.png') // Optional placeholder, user can swap
            .setColor(client.config.colors.primary)
            .setTimestamp();

        // Send to channel
        await interaction.channel.send({ embeds: [embed] });
        await interaction.editReply({ content: '✅ Rules panel deployed!' });
    },
};
