const fs = require('fs');
const path = require('path');

async function loadEvents(client) {
    const folders = fs.readdirSync(path.join(__dirname, '../events'));
    for (const folder of folders) {
        const files = fs.readdirSync(path.join(__dirname, `../events/${folder}`)).filter((file) => file.endsWith('.js'));
        for (const file of files) {
            const event = require(`../events/${folder}/${file}`);
            if (event.rest) {
                if (event.once)
                    client.rest.once(event.name, (...args) => event.execute(...args));
                else
                    client.rest.on(event.name, (...args) => event.execute(...args));
            } else {
                if (event.once)
                    client.once(event.name, (...args) => event.execute(...args));
                else
                    client.on(event.name, (...args) => event.execute(...args));
            }
        }
    }
    console.log('✅ Events Loaded');
}

module.exports = { loadEvents };
