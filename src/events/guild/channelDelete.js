const { ChannelType } = require('discord.js');
const {
    AuditLogEvent,
    getConfig,
    isWhitelistedMember,
    fetchRecentAuditExecutor,
    timeoutMember
} = require('../../services/guildSecurityService');

async function sendSecurityLog(guild, config, payload) {
    try {
        const logChannelId = config?.securityLogChannelId;
        if (!logChannelId) return;
        const ch = await guild.channels.fetch(logChannelId).catch(() => null);
        if (!ch || ch.type !== ChannelType.GuildText) return;
        await ch.send(payload).catch(() => { });
    } catch (_) { }
}

function serializeChannel(channel) {
    return {
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId,
        position: channel.rawPosition,
        nsfw: 'nsfw' in channel ? Boolean(channel.nsfw) : false,
        rateLimitPerUser: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : null,
        topic: 'topic' in channel ? channel.topic : null,
        bitrate: 'bitrate' in channel ? channel.bitrate : null,
        userLimit: 'userLimit' in channel ? channel.userLimit : null,
        rtcRegion: 'rtcRegion' in channel ? channel.rtcRegion : null,
        permissionOverwrites: channel.permissionOverwrites?.cache?.map(ow => ({
            id: ow.id,
            type: ow.type,
            allow: ow.allow?.bitfield?.toString?.() ?? '0',
            deny: ow.deny?.bitfield?.toString?.() ?? '0'
        })) ?? []
    };
}

async function restoreDeletedChannel(guild, snapshot) {
    const overwrites = (snapshot.permissionOverwrites || []).map(ow => ({
        id: ow.id,
        type: ow.type,
        allow: BigInt(ow.allow || '0'),
        deny: BigInt(ow.deny || '0')
    }));

    const created = await guild.channels.create({
        name: snapshot.name,
        type: snapshot.type,
        parent: snapshot.parentId || null,
        position: snapshot.position,
        topic: snapshot.topic ?? undefined,
        nsfw: snapshot.nsfw ?? undefined,
        rateLimitPerUser: snapshot.rateLimitPerUser ?? undefined,
        bitrate: snapshot.bitrate ?? undefined,
        userLimit: snapshot.userLimit ?? undefined,
        rtcRegion: snapshot.rtcRegion ?? undefined,
        permissionOverwrites: overwrites
    });

    return created;
}

module.exports = {
    name: 'channelDelete',
    async execute(channel) {
        try {
            const guild = channel.guild;
            if (!guild) return;

            const config = await getConfig(guild.id);
            if (!config?.antiNukeEnabled) return;

            // Ignore protected channels list? If a channel is protected, we still restore it.
            const snapshot = serializeChannel(channel);

            const audit = await fetchRecentAuditExecutor({ guild, event: AuditLogEvent.ChannelDelete, targetId: channel.id });
            const executorId = audit?.executorId;
            if (!executorId) return;

            const executorMember = await guild.members.fetch(executorId).catch(() => null);
            if (isWhitelistedMember(executorMember, config)) return;

            // Best-effort restore
            let restored = null;
            try {
                restored = await restoreDeletedChannel(guild, snapshot);
            } catch (e) {
                restored = null;
            }

            // Punish
            const hours = Number(config.punishmentTimeoutHours || 12);
            const punished = await timeoutMember(executorMember, hours, 'Anti-nuke: unauthorized channel deletion');

            await sendSecurityLog(guild, config, {
                content: `🚨 **Anti-Nuke:** Channel deleted: **${channel.name}** (\`${channel.id}\`)
Executor: <@${executorId}> (\`${executorId}\`)
Action: ${punished ? `Timeout ${hours}h applied` : 'Unable to apply timeout'}
Restore: ${restored ? `Restored as ${restored}` : 'Restore failed'}`
            });
        } catch (e) {
            console.error('channelDelete anti-nuke error:', e);
        }
    }
};
