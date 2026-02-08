const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { generateLore } = require('../../nexus/gemini');
const path = require('path');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            console.log(`👤 New Hero Detected: ${member.user.tag}`);

            // 1. Get the Welcome Channel by ID
            const channel = member.guild.channels.cache.get('1461484367728869397');
            if (!channel) return console.log('⚠️ Welcome channel not found.');

            // 2. Send a placeholder or "Analyzing..." message?
            const analyzingMsg = await channel.send(`*⚡ The Nexus is analyzing the digital signature of ${member}...*`);

            // 3. Generate Lore via Gemini
            const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 512 });
            const loreData = await generateLore(member.user.username, avatarUrl);

            // 4. Load the Local Background Art
            const welcomeFile = new AttachmentBuilder(path.join(__dirname, '../../assets/welcome-bg.jpg'));

            // 5. Construct the Legendary Embed
            const embed = new EmbedBuilder()
                .setTitle(`👁️ ${loreData.title} Has Awakened`)
                .setDescription(`**Member:** ${member}\n\n"${loreData.lore}"`)
                .setThumbnail(avatarUrl) // Added member profile picture
                .setImage('attachment://welcome-bg.jpg')
                .setColor(member.displayHexColor !== '#000000' ? member.displayHexColor : '#00ffd5')
                .setFooter({ text: 'Sovereign Nexus • Sentient Entry System' })
                .setTimestamp();

            // 6. Delete "Analyzing" and send the Result
            await analyzingMsg.delete().catch(() => { });
            await channel.send({ content: `Welcome to the Realm, ${member}.`, embeds: [embed], files: [welcomeFile] });

            // 7. Send Onboarding Panel
            const onboardingEmbed = new EmbedBuilder()
                .setTitle('🌟 Complete Your Profile')
                .setDescription('Before you explore the Nexus, tell us about yourself:')
                .addFields(
                    { name: '👤 Pronouns', value: 'Select your pronouns below', inline: false },
                    { name: '🎂 Age Range', value: 'Select your age range below', inline: false }
                )
                .setColor('#00ffd5')
                .setFooter({ text: 'Click the buttons to get started!' });

            const pronounRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('pronoun_she').setLabel('She/Her').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('pronoun_he').setLabel('He/Him').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('pronoun_they').setLabel('They/Them').setStyle(ButtonStyle.Primary)
                );

            const ageRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('age_13-17').setLabel('13-17').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('age_18-24').setLabel('18-24').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('age_25+').setLabel('25+').setStyle(ButtonStyle.Secondary)
                );

            await channel.send({ embeds: [onboardingEmbed], components: [pronounRow, ageRow] });

            // 8. Assign Nickname? (Requires permissions, risky if owner)
            // if (member.manageable) {
            //    member.setNickname(loreData.title).catch(e => console.log('Cannot set nick'));
            // }

        } catch (error) {
            console.error('❌ Sentient Entry Error:', error);
        }
    },
};
