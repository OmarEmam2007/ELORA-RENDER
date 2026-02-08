const profanityList = require('../profanityList');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini for context checks if available
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' }) : null;

/**
 * Normalizes text for better detection (Arabic/English)
 */
function normalizeText(text) {
    if (!text) return '';

    // 1. Convert to lowercase
    let normalized = text.toLowerCase();

    // 2. Remove Zalgo and weird characters (keep basic punctuation and spaces)
    normalized = normalized.replace(/[^\w\s\u0621-\u064A]/gi, '');

    // 3. Normalize Arabic characters (Alef, Yeh, etc.)
    normalized = normalized
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ىي]/g, 'ي')
        .replace(/[ةه]/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي');

    // 4. Reduce repeated characters (e.g., "shiiiiit" -> "shiit", "ااااحا" -> "ااحا")
    // Keep 2 to distinguish some legitimate words
    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

    return normalized;
}

/**
 * Calculates Levenshtein Distance between two strings
 */
function levenshteinDistance(s1, s2) {
    if (s1.length < s2.length) return levenshteinDistance(s2, s1);
    if (s2.length === 0) return s1.length;

    let previousRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
    for (let i = 0; i < s1.length; i++) {
        let currentRow = [i + 1];
        for (let j = 0; j < s2.length; j++) {
            const insertions = previousRow[j + 1] + 1;
            const deletions = currentRow[j] + 1;
            const substitutions = previousRow[j] + (s1[i] !== s2[j] ? 1 : 0);
            currentRow.push(Math.min(insertions, deletions, substitutions));
        }
        previousRow = currentRow;
    }
    return previousRow[s2.length];
}

/**
 * Check if a word is fuzzy matched against the blacklist
 */
function getFuzzyMatch(word, blacklist) {
    for (const bad of blacklist) {
        if (bad.length < 3) continue; // Skip too short words for fuzzy
        const distance = levenshteinDistance(word, bad);
        const threshold = Math.floor(bad.length * 0.3); // 30% tolerance
        if (distance <= threshold) return { matched: bad, confidence: 100 - (distance * 10) };
    }
    return null;
}

/**
 * High-level AI context check
 */
async function aiContextCheck(text, detectedWords) {
    if (!model) return { isViolation: true, confidence: 80 }; // Fallback

    try {
        const prompt = `
        You are an advanced AI moderator for a Discord server.
        Analyze the following message for actual harmful intent, severe profanity, or insults.
        Message: "${text}"
        Suspected words: ${detectedWords.join(', ')}

        Determine if this is:
        1. A direct insult or harmful swearing.
        2. A reference/educational use (e.g., "don't say the word X").
        3. A false positive.

        Output EXACTLY in this JSON format:
        {
            "isViolation": boolean,
            "confidence": number (0-100),
            "severity": "Mild" | "Severe" | "Extreme",
            "reason": "String explaining why"
        }
        `;

        const result = await model.generateContent(prompt);
        const jsonString = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('AI Context Check Error:', e);
        return { isViolation: true, confidence: 70, severity: 'Mild', reason: 'Error in AI check' };
    }
}

async function analyzeMessage(messageContent) {
    const rawContent = messageContent;
    const cleanContent = normalizeText(rawContent);
    const words = cleanContent.split(/\s+/);

    let matches = [];
    let severityScore = 0;

    for (const word of words) {
        // 1. Direct Match
        if (profanityList.includes(word)) {
            matches.push(word);
            severityScore += 10;
        } else {
            // 2. Fuzzy Match
            const fuzzy = getFuzzyMatch(word, profanityList);
            if (fuzzy) {
                matches.push(word);
                severityScore += 8;
            }
        }
    }

    if (matches.length === 0) return { isViolation: false };

    // 3. Context Check (If matches found)
    // If severity is low or matches were fuzzy, ask Gemini if it's actually bad
    if (severityScore < 30) {
        const aiResult = await aiContextCheck(rawContent, matches);
        return {
            isViolation: aiResult.isViolation,
            matches: matches,
            confidence: aiResult.confidence,
            severity: aiResult.severity,
            reason: aiResult.reason
        };
    }

    return {
        isViolation: true,
        matches: matches,
        confidence: 95,
        severity: severityScore > 50 ? 'Extreme' : 'Severe',
        reason: 'Direct word match'
    };
}

module.exports = { analyzeMessage, normalizeText, levenshteinDistance };
