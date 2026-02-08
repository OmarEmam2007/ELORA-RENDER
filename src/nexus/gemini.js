const { GoogleGenerativeAI } = require('@google/generative-ai');

// Use the API Key from env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

/**
 * Generates a Mythical Title and Backstory for a user based on their profile.
 * @param {string} username - The user's name.
 * @param {string} avatarUrl - The user's avatar URL.
 * @returns {Promise<{title: string, lore: string, visualPrompt: string}>}
 */
async function generateLore(username, avatarUrl) {
    try {
        const prompt = `
        You are the "Sovereign Nexus", a sentient digital entity.
        A new soul named "${username}" has entered your realm.
        
        Analyze their vibe based on their name and the fact they just joined.
        (If you could see their avatar, you would, but for now assume a "Cyberpunk/Mystic" vibe).

        1. Give them a "God-Tier" Title (e.g., "The Crimson Maestro", "Void Walker", "Data Weaver").
        2. Write a 2-sentence "Mythical Lore" about why they have arrived.
        3. Create a short, comma-separated visual prompt for an image generator (e.g., "cyberpunk character, red eyes, glowing rune, futuristic city background").

        Output EXACTLY in this JSON format:
        {
            "title": "The Title",
            "lore": "The lore text.",
            "visualPrompt": "visual prompt here"
        }
        `;

        // If we had image input enabled/supported easily via URL fetch in this snippet, we'd add it.
        // For now, text-based vibe check is faster and error-proof for v1.

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Clean markdown code blocks if present
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);

    } catch (error) {
        console.error('❌ Nexus Brain Error (Lore):', error);
        return {
            title: "The Unknown Traveler",
            lore: "A mysterious figure whose records are encrypted beyond recognization.",
            visualPrompt: "mysterious hooded cyberpunk figure, glitch art, dark background"
        };
    }
}

/**
 * Summarizes a list of messages into a "Game of Thrones" style chronicle.
 * @param {string[]} messages - Array of message texts with author names.
 * @returns {Promise<string>}
 */
async function generateChronicle(messages) {
    try {
        const history = messages.join('\n');
        const prompt = `
        You are the Chronicler of the Sovereign Nexus.
        Here is the recent chatter in the realm:
        ${history}

        Summarize this into a "Prophetic Chronicle" (max 100 words).
        Make it sound epic, legendary, and slightly unhinged.
        Mention specific users as "Heroes" or "Villains".
        `;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('❌ Nexus Brain Error (Chronicle):', error);
        return "The mists of time obscure the recent events...";
    }
}

module.exports = { generateLore, generateChronicle };
