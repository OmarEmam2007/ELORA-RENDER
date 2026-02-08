const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const THEME = require('../../utils/theme');

const SMALL_CAPS_MAP = {
    'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ғ': 'f',
    'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l',
    'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ꞯ': 'q', 'ʀ': 'r',
    'ꜱ': 's', 's': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w',
    'x': 'x', 'ʏ': 'y', 'ᴢ': 'z'
};

function normalizeRoleQuery(input) {
    if (!input) return '';

    const lowered = String(input).toLowerCase().normalize('NFKD');
    const mapped = lowered.replace(/[\s\S]/g, (ch) => SMALL_CAPS_MAP[ch] || ch);

    return mapped
        .replace(/[\p{M}]/gu, '')
        .replace(/[^a-z0-9]/g, '');
}

function findRole(guild, roleQuery) {
    if (!guild) return null;

    const idMatch = String(roleQuery).match(/<@&(\d+)>/) || String(roleQuery).match(/\b(\d{15,25})\b/);
    if (idMatch) {
        const byId = guild.roles.cache.get(idMatch[1]);
        if (byId) return byId;
    }

    const qNorm = normalizeRoleQuery(roleQuery);
    if (!qNorm) return null;

    const roles = [...guild.roles.cache.values()].filter(r => r && r.name && r.name !== '@everyone');

    const exact = roles.find(r => normalizeRoleQuery(r.name) === qNorm);
    if (exact) return exact;

    const partial = roles.find(r => normalizeRoleQuery(r.name).includes(qNorm));
    if (partial) return partial;

    const rawLower = String(roleQuery).toLowerCase();
    const raw = roles.find(r => String(r.name).toLowerCase().includes(rawLower));
    if (raw) return raw;

    return null;
}

function epicEmbed({ title, color, description, fields, member, footerIconURL }) {
    const e = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: THEME.FOOTER.text, iconURL: footerIconURL || THEME.FOOTER.iconURL })
        .setTimestamp();

    if (member?.user?.displayAvatarURL) {
        e.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
    }

    if (fields?.length) e.addFields(fields);
    return e;
}

module.exports = {
    name: 'role',
    aliases: ['addrole', 'giverole'],
    async execute(message, client, args) {
        const noPermEmbed = epicEmbed({
            title: '🛡️ Sovereign Nexus • Access Denied',
            color: THEME.COLORS.ERROR,
            description: '❌ You do not have permission to assign roles.',
            member: message.member
        });

        if (!message.member?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply({ embeds: [noPermEmbed] });
        }

        const targetMember = message.mentions.members.first();
        if (!targetMember) {
            const embed = epicEmbed({
                title: '🛰️ Role Matrix • Missing Target',
                color: THEME.COLORS.WARNING,
                description: '⚠️ Mention a user first.\n\nExample: `elora role @user astray`',
                member: message.member
            });
            return message.reply({ embeds: [embed] });
        }

        const roleQuery = args.slice(1).join(' ').trim();
        if (!roleQuery) {
            const embed = epicEmbed({
                title: '🛰️ Role Matrix • Missing Role',
                color: THEME.COLORS.WARNING,
                description: '⚠️ Provide a role name (or role mention / role id).\n\nExample: `elora role @user astray`',
                member: message.member
            });
            return message.reply({ embeds: [embed] });
        }

        const role = findRole(message.guild, roleQuery);
        if (!role) {
            const embed = epicEmbed({
                title: '🌑 Lunar Index • Role Not Found',
                color: THEME.COLORS.ERROR,
                description: `❌ I couldn't locate a role matching: **${roleQuery}**\n\nTip: you can also use a role mention like <@&roleId>.`,
                member: message.member
            });
            return message.reply({ embeds: [embed] });
        }

        if (role.managed || role.name === '@everyone') {
            const embed = epicEmbed({
                title: '🛡️ Role Matrix • Protected Role',
                color: THEME.COLORS.ERROR,
                description: `❌ This role is protected and cannot be assigned: ${role}`,
                member: message.member
            });
            return message.reply({ embeds: [embed] });
        }

        const botMember = message.guild.members.me;
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            const embed = epicEmbed({
                title: '⚠️ Role Matrix • Bot Missing Permission',
                color: THEME.COLORS.ERROR,
                description: '❌ I need **Manage Roles** permission to do that.',
                member: message.member
            });
            return message.reply({ embeds: [embed] });
        }

        if (!role.editable || (botMember.roles.highest?.position ?? 0) <= role.position) {
            const embed = epicEmbed({
                title: '⛔ Hierarchy Lock',
                color: THEME.COLORS.ERROR,
                description: `❌ I can't assign ${role} بسبب ترتيب الرولات (hierarchy).\n\nارفع رول البوت فوق الرول ده.`,
                member: message.member
            });
            return message.reply({ embeds: [embed] });
        }

        if (targetMember.roles.cache.has(role.id)) {
            const embed = epicEmbed({
                title: '✅ Role Matrix • Already Synced',
                color: THEME.COLORS.WARNING,
                description: `ℹ️ ${targetMember} already has ${role}.`,
                fields: [
                    { name: 'Target', value: `${targetMember}`, inline: true },
                    { name: 'Role', value: `${role}`, inline: true },
                    { name: 'Executor', value: `${message.author}`, inline: true }
                ],
                member: targetMember
            });
            return message.reply({ embeds: [embed] });
        }

        try {
            await targetMember.roles.add(role, `Prefix role assignment by ${message.author.tag}`);

            const embed = epicEmbed({
                title: '🌙 Role Matrix • Synchronization Complete',
                color: THEME.COLORS.SUCCESS,
                description: '━━━━━━━━━━━━━━━━━━━━━━━━\n**Operation Result: SUCCESS**\n━━━━━━━━━━━━━━━━━━━━━━━━',
                fields: [
                    { name: 'Target', value: `${targetMember}`, inline: true },
                    { name: 'Injected Role', value: `${role}`, inline: true },
                    { name: 'Executor', value: `${message.author}`, inline: true },
                    { name: 'Query', value: `\`${roleQuery}\``, inline: false }
                ],
                member: targetMember
            });

            return message.reply({ embeds: [embed] });
} catch (e) {
            console.error('role command error:', e);
            const errorEmbed = epicEmbed({
                title: '💥 Role Matrix • Operation Failed',
                color: THEME.COLORS.ERROR,
                description: `❌ Failed to assign ${role} to ${targetMember}.\n\nReason: \`${e.message}\``,
                member: message.member
            });
            return message.reply({ embeds: [errorEmbed] });
        }
    }
};
