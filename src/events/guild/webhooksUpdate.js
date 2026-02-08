const { AuditLogEvent } = require('discord.js');

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

                        // Notify owner/log channel could be added here
                    }
                }
            });

        } catch (error) {
            console.error('Error in webhook protection:', error);
        }
    },
};
