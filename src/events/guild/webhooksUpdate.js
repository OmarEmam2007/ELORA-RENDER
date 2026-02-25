const { AuditLogEvent } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { getGuildLogChannel } = require('../../utils/getGuildLogChannel');

module.exports = {
    name: 'webhooksUpdate',
    async execute(channel, client) {
        try {
            const fetchedWebhooks = await channel.fetchWebhooks();

            // Fetch audit logs to see who created the webhook
            const auditLogs = await channel.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.WebhookCreate,
            });
            const entry = auditLogs.entries.first();

            // Logic: If the webhook creator is NOT a bot/admin/trusted, delete it.
            // For this 'Elite' bot, we can enforce that webhooks must be created by the Bot Itself or the Owner.
            // Note: This is aggressive.

            fetchedWebhooks.forEach(async (webhook) => {
                // If we want to strictly allow only THIS bot to create webhooks (e.g. for logging):
                // if (webhook.owner.id !== client.user.id) ...

                // OR check against a safe list. For now, let's just log and alert.
                // Feature request: "automatically delete any that it didn't create itself"

                const isTrusted = webhook.owner.id === client.user.id || webhook.owner.id === client.config.ownerId;

                if (!isTrusted) {
                    // Double check if audit log matches (recent creation)
                    if (entry && entry.target.id === webhook.id && entry.executor.id !== client.config.ownerId && entry.executor.id !== client.user.id) {
                        console.log(`🚨 Unauthorized Webhook Detected: ${webhook.name} in ${channel.name} by ${entry.executor.tag}`);
                        await webhook.delete('Security: Unauthorized Webhook detected.');

                        const logChannel = await getGuildLogChannel(channel.guild, client);
                        if (logChannel) {
                            const embed = new EmbedBuilder()
                                .setTitle('🪝 Webhook Removed')
                                .setDescription('An unauthorized webhook was detected and removed.')
                                .addFields(
                                    { name: 'Channel', value: `${channel}`, inline: true },
                                    { name: 'Webhook', value: `${webhook.name} (\`${webhook.id}\`)`, inline: true },
                                    { name: 'Executor', value: `${entry.executor.tag} (\`${entry.executor.id}\`)`, inline: true }
                                )
                                .setColor(client?.config?.colors?.warning || '#FEE75C')
                                .setTimestamp();
                            await logChannel.send({ embeds: [embed] }).catch(() => { });
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Error in webhook protection:', error);
        }
    },
};
