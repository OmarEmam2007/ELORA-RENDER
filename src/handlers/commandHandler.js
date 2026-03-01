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
            if (!client?.application) return;

            const guildId = process.env.GUILD_ID || client.config?.guildId;

            if (guildId) {
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    // 1. Register to GUILD (Instant for development/primary server)
                    await registerGuildCommandsSafely(guild);
                    console.log(`✅ Slash Commands Registered to Guild: ${guild.name}`);
                }
            }

            // 2. Always register GLOBALLY (Standard for production, takes ~1 hour to propagate)
            // We NO LONGER wipe global commands set([]).
            await client.application.commands.set(commandsArray);
            console.log('✅ Slash Commands Registered Globally');
            
        } catch (error) {
            console.error('❌ Error registering slash commands:', error);
        }
    });

    console.log('✅ Commands Loaded');
}

module.exports = { loadCommands };
