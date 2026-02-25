const {
    AuditLogEvent,
    getConfig,
    isWhitelistedMember,
    fetchRecentAuditExecutor,
    timeoutMember,
    hasDangerousAdminPermissions
} = require('../../services/guildSecurityService');

async function sendSecurityLog(guild, config, payload) {
    try {
        if (!config?.securityLogChannelId) return;
        const ch = await guild.channels.fetch(config.securityLogChannelId).catch(() => null);
        if (!ch) return;
        await ch.send(payload).catch(() => { });
    } catch (_) { }
}

module.exports = {
    name: 'roleUpdate',
    async execute(oldRole, newRole) {
        try {
            const guild = newRole.guild;
            if (!guild) return;

            const config = await getConfig(guild.id);
            if (!config?.antiNukeEnabled) return;

            // If the update introduces dangerous perms, we treat it as escalation.
            const oldDanger = hasDangerousAdminPermissions(oldRole);
            const newDanger = hasDangerousAdminPermissions(newRole);
            if (!newDanger || (oldDanger && newDanger)) return;

            const audit = await fetchRecentAuditExecutor({ guild, event: AuditLogEvent.RoleUpdate, targetId: newRole.id });
            const executorId = audit?.executorId;
            if (!executorId) return;

            const executorMember = await guild.members.fetch(executorId).catch(() => null);
            if (isWhitelistedMember(executorMember, config)) return;

            // Revert permissions to oldRole
            await newRole.setPermissions(oldRole.permissions, 'Anti-nuke: prevented permission escalation').catch(() => { });

            const hours = Number(config.punishmentTimeoutHours || 12);
            const punished = await timeoutMember(executorMember, hours, 'Anti-nuke: unauthorized permission escalation');

            await sendSecurityLog(guild, config, {
                content: `🚨 **Anti-Nuke:** Dangerous permissions escalation blocked on role **${newRole.name}** (\`${newRole.id}\`)
Executor: <@${executorId}> (\`${executorId}\`)
Action: ${punished ? `Timeout ${hours}h applied` : 'Unable to apply timeout'}
Revert: Permissions restored to previous state.`
            });
        } catch (e) {
            console.error('roleUpdate anti-nuke error:', e);
        }
    }
};
