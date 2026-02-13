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

/**
 * Generates a Cyberpunk/Mystic riddle for the Sovereign Heist system.
 * The model MUST return strict JSON with the following fields:
 * - challenge: string
 * - solution_keywords: string[]
 * - success_story: string
 * - failure_mockery: string
 *
 * @returns {Promise<{challenge: string, solution_keywords: string[], success_story: string, failure_mockery: string}>}
 */
async function generateHeistRiddle() {
    try {
        const prompt = `
You are the Sovereign Nexus, an ancient cybernetic oracle that guards a digital moon-vault.
Generate a short, intense Cyberpunk/Mystic riddle that a heist crew must solve in a Discord text channel.

Requirements:
- Style: neon cyberpunk, mystical, slightly unhinged.
- The riddle must be 2–4 sentences, English only.
- The solution is NOT a single word, but a *set* of 3–6 simple English keywords
  (examples: ["moon", "signal", "mirror"] or ["vault", "blood", "code"]). Avoid punctuation inside keywords.
- Players will type freely in chat: if **any** message contains **any** of the keywords, they win.

Return ONLY valid JSON in this exact format (no markdown, no commentary):
{
  "challenge": "the riddle text here",
  "solution_keywords": ["word1", "word2"],
  "success_story": "a short cinematic narration (2–4 sentences) describing how the crew successfully breaches the vault in a neon cyberpunk city.",
  "failure_mockery": "a short, spicy but safe-for-work mockery (1–3 sentences) roasting the crew for failing the heist."
}
`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Clean possible markdown code fences just in case
        const jsonString = text
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();

        const parsed = JSON.parse(jsonString);

        // Normalize keywords to an array of lowercase strings
        if (!Array.isArray(parsed.solution_keywords)) {
            parsed.solution_keywords = [];
        } else {
            parsed.solution_keywords = parsed.solution_keywords
                .map(k => String(k || '').toLowerCase().trim())
                .filter(k => k.length > 0);
        }

        return parsed;
    } catch (error) {
        console.error('❌ Nexus Brain Error (Heist Riddle):', error);
        return {
            challenge: 'The vault hums in silence. Three lights, one shadow, and a name never spoken. What binds a city of glass, blood, and broken code?',
            solution_keywords: ['glass', 'blood', 'code'],
            success_story: 'With synchronized breaths and feral focus, the crew threads through laser grids and ghost firewalls. The vault door exhales a final metallic sigh as moonlight floods the chamber, reflecting off mountains of stolen currency. For a heartbeat, the city itself seems to pause and watch them ascend.',
            failure_mockery: 'The vault remains untouched, amused by the crew’s clumsy attempts. Somewhere in the dark, the Sovereign Nexus quietly adds their names to a very long list of almost-legends.'
        };
    }
}

module.exports = { generateLore, generateChronicle, generateHeistRiddle };
