const fs = require('fs');
const path = require('path');

async function loadCommands(client) {
    const { Collection } = require('discord.js');
    if (!client.commands) client.commands = new Collection();
    let commandsArray = [];
    const folders = fs.readdirSync(path.join(__dirname, '../commands'));
    for (const folder of folders) {
        const files = fs
            .readdirSync(path.join(__dirname, `../commands/${folder}`))
            .filter((file) => file.endsWith('.js'))
            .filter((file) => !file.includes('-old') && !file.includes('-new'));
        for (const file of files) {
            const command = require(`../commands/${folder}/${file}`);
            if (command.data) {
                client.commands.set(command.data.name, command);
                commandsArray.push(command.data.toJSON());
            }
        }
    }

    commandsArray = Array.from(
        commandsArray.reduce((map, cmd) => map.set(cmd.name, cmd), new Map()).values()
    );

    const registerGuildCommandsSafely = async (guild) => {
        try {
            await guild.commands.set(commandsArray);
            console.log(`✅ Slash Commands Registered to Guild ${guild.name} (Instant)`);
            return;
        } catch (error) {
            // If Discord rejects the bulk payload, find the offending command.
            if (error?.code === 50035) {
                console.error('❌ Bulk guild command registration failed (50035). Locating invalid command...');
                try {
                    await guild.commands.set([]);
                } catch (_) {
                    // ignore
                }

                for (const cmd of commandsArray) {
                    try {
                        await guild.commands.create(cmd);
                    } catch (e) {
                        console.error('❌ Invalid slash command payload detected.');
                        console.error('❌ Command name:', cmd?.name);
                        console.error('❌ Command JSON:', JSON.stringify(cmd));
                        console.error('❌ Discord error:', e);
                        throw e;
                    }
                }
            }
            throw error;
        }
    };

    client.on('ready', async () => {
        try {
            // Only the main bot should register slash commands.
            // Clones may not have config/application initialized the same way and can crash here.
            if (!client?.config) {
                return;
            }

            // Allow overriding guildId from environment (e.g. Hugging Face secrets)
            const envGuildId = process.env.GUILD_ID;
            const guildId = envGuildId || client.config.guildId;

            if (guildId) {
                // INSTANT UPDATE (Guild specific if found), with global fallback
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    // 1. Register commands to the GUILD (Instant)
                    await registerGuildCommandsSafely(guild);

                    // 2. WIPE Global Commands to prevent duplicates
                    await client.application.commands.set([]);
                    console.log('🗑️ Global commands wiped (to prevent duplicates)');
                } else {
                    console.warn(`⚠️ Guild ID ${guildId} provided but not found in cache. Falling back to global registration.`);
                    await client.application.commands.set(commandsArray);
                    console.log('✅ Slash Commands Registered Globally (Fallback - may take up to 1 hour)');
                }
            } else {
                // SLOW UPDATE (Global - up to 1 hour)
                await client.application.commands.set(commandsArray);
                console.log('✅ Slash Commands Registered Globally (May take 1 hour to appear)');
            }
        } catch (error) {
            console.error('❌ Error registering slash commands:', error);
        }
    });

    console.log('✅ Commands Loaded');
}

module.exports = { loadCommands };
