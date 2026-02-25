const {
    AuditLogEvent,
    getConfig,
    isWhitelistedMember,
    fetchRecentAuditExecutor,
    timeoutMember
} = require('../../services/guildSecurityService');

async function sendSecurityLog(guild, config, payload) {
    try {
        if (!config?.securityLogChannelId) return;
        const ch = await guild.channels.fetch(config.securityLogChannelId).catch(() => null);
        if (!ch) return;
        await ch.send(payload).catch(() => { });
    } catch (_) { }
}

function serializeRole(role) {
    return {
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions?.bitfield?.toString?.() || '0'
    };
}

async function restoreDeletedRole(guild, snapshot) {
    const created = await guild.roles.create({
        name: snapshot.name,
        color: snapshot.color,
        hoist: snapshot.hoist,
        mentionable: snapshot.mentionable,
        permissions: BigInt(snapshot.permissions || '0')
    });
    return created;
}

module.exports = {
    name: 'roleDelete',
    async execute(role) {
        try {
            const guild = role.guild;
            if (!guild) return;

            const config = await getConfig(guild.id);
            if (!config?.antiNukeEnabled) return;

            const snapshot = serializeRole(role);

            const audit = await fetchRecentAuditExecutor({ guild, event: AuditLogEvent.RoleDelete, targetId: role.id });
            const executorId = audit?.executorId;
            if (!executorId) return;

            const executorMember = await guild.members.fetch(executorId).catch(() => null);
            if (isWhitelistedMember(executorMember, config)) return;

            let restored = null;
            try {
                restored = await restoreDeletedRole(guild, snapshot);
            } catch (_) {
                restored = null;
            }

            const hours = Number(config.punishmentTimeoutHours || 12);
            const punished = await timeoutMember(executorMember, hours, 'Anti-nuke: unauthorized role deletion');

            await sendSecurityLog(guild, config, {
                content: `🚨 **Anti-Nuke:** Role deleted: **${role.name}** (\`${role.id}\`)
Executor: <@${executorId}> (\`${executorId}\`)
Action: ${punished ? `Timeout ${hours}h applied` : 'Unable to apply timeout'}
Restore: ${restored ? `Restored as **${restored.name}**` : 'Restore failed'}`
            });
        } catch (e) {
            console.error('roleDelete anti-nuke error:', e);
        }
    }
};
