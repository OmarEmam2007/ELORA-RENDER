const fs = require('fs');
const path = require('path');

async function loadPrefixCommands(client) {
    client.prefixCommands = new Map();
    
// 1. دي بتخلي البوت يشوف كل الفولدرات (admin, moderation, utility, etc..) لوحده
    const commandsDir = path.join(__dirname, '../commands');
    const commandFolders = fs.readdirSync(commandsDir).filter(f => 
        fs.statSync(path.join(commandsDir, f)).isDirectory()
    );
    
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsDir, folder);
        
        // 2. دي بتخليه يقرأ أي ملف .js من غير شروط رخمة
        const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        
        for (const file of files) {
            try {
                const command = require(`../commands/${folder}/${file}`);
                if (command.name) {
                    client.prefixCommands.set(command.name.toLowerCase(), command);
                    
                    // Register aliases
                    if (command.aliases && Array.isArray(command.aliases)) {
                        for (const alias of command.aliases) {
                            client.prefixCommands.set(alias.toLowerCase(), command);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error loading prefix command ${file}:`, error);
            }
        }
    }
    
    
    // Also load prefix-specific files
    const prefixFiles = [
        path.join(__dirname, '../commands/economy/daily-prefix.js'),
        path.join(__dirname, '../commands/economy/leaderboard-prefix.js')
    ];
    
    for (const filePath of prefixFiles) {
        try {
            if (fs.existsSync(filePath)) {
                const command = require(filePath);
                if (command.name) {
                    client.prefixCommands.set(command.name.toLowerCase(), command);
                    if (command.aliases && Array.isArray(command.aliases)) {
                        for (const alias of command.aliases) {
                            client.prefixCommands.set(alias.toLowerCase(), command);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error loading prefix command ${filePath}:`, error);
        }
    }
    
    console.log(`✅ Loaded ${client.prefixCommands.size} prefix commands`);
}

async function handlePrefixCommand(message, client) {
    if (!message || !client || !message.content) return;
    const text = String(message.content || '').trim();
    if (!text) return;

    // Main prefix style: "elora <command> ..."
    const eloraPrefix = /^elora\s+/i;
    const legacyPrefix = client?.config?.prefix ? String(client.config.prefix) : null;
    const bangPrefix = '!';

    let args = null;
    if (eloraPrefix.test(text)) {
        args = text.replace(eloraPrefix, '').trim().split(/\s+/).filter(Boolean);
    } else if (legacyPrefix && text.startsWith(legacyPrefix)) {
        args = text.slice(legacyPrefix.length).trim().split(/\s+/).filter(Boolean);
    } else if (text.startsWith(bangPrefix)) {
        args = text.slice(bangPrefix.length).trim().split(/\s+/).filter(Boolean);
    } else {
        return;
    }

    const commandName = String(args.shift() || '').toLowerCase();
    if (!commandName) return;

    const cmd = client.prefixCommands?.get(commandName);
    if (!cmd || typeof cmd.execute !== 'function') return;

    try {
        await cmd.execute(message, client, args);
    } catch (e) {
        console.error(`[PREFIX] Failed executing ${commandName}:`, e);
    }
}

module.exports = { loadPrefixCommands, handlePrefixCommand };
