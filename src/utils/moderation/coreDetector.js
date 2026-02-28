const profanityList = require('../profanityList');
let GoogleGenerativeAI = null;
try {
    ({ GoogleGenerativeAI } = require('@google/generative-ai'));
} catch (e) {
    GoogleGenerativeAI = null;
}

// Initialize Gemini for context checks if available
const genAI = (process.env.GEMINI_API_KEY && GoogleGenerativeAI) ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' }) : null;

/**
 * Normalizes text for better detection (Arabic/English)
 */
function normalizeText(text) {
    if (!text) return '';

    // 1) Convert to lowercase
    let normalized = String(text).toLowerCase();

    // 2) Normalize common "Franco-Arabic" numerals
    // Keep both original and converted forms later via detectProfanitySmart; here we convert into letters.
    normalized = normalized
        .replace(/2/g, 'ء')
        .replace(/3/g, 'ع')
        .replace(/4/g, 'ش')
        .replace(/5/g, 'خ')
        .replace(/6/g, 'ط')
        .replace(/7/g, 'ح')
        .replace(/8/g, 'ق')
        .replace(/9/g, 'ص');

    // 3) Normalize Arabic characters (Alef, Yeh, etc.)
    normalized = normalized
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ى]/g, 'ي')
        .replace(/[ة]/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي');

    // 4) Remove diacritics / tatweel
    normalized = normalized
        .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
        .replace(/ـ/g, '');

    // 5) Reduce repeated characters (keep 2) - ONLY for English to avoid breaking Arabic
    normalized = normalized.replace(/([a-z])\1{2,}/g, '$1$1');

    // 6) Keep letters/numbers/spaces; convert other chars to spaces (so boundaries still work)
    normalized = normalized.replace(/[^a-z0-9\s\u0621-\u064Aء]/gi, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
}

function normalizeTextKeepDigits(text) {
    if (!text) return '';
    let normalized = String(text).toLowerCase();

    // Arabic normalization
    normalized = normalized
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ى]/g, 'ي')
        .replace(/[ة]/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي');

    normalized = normalized
        .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
        .replace(/ـ/g, '');

    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');
    normalized = normalized.replace(/[^a-z0-9\s\u0621-\u064Aء]/gi, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
}

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenize(text) {
    const clean = normalizeText(text);
    if (!clean) return [];
    return clean.split(/\s+/).filter(Boolean);
}

function buildWordRegex(term) {
    // Avoid substring false positives via boundaries.
    const t = normalizeText(term);
    const parts = t.split(/\s+/).filter(Boolean).map(escapeRegex);
    if (!parts.length) return null;

    // allow variable spacing between words
    let body = parts.join('\\s+');

    // English morphology (safe): allow plural/possessive suffix for single-word alphabetic terms.
    // Examples: nigger -> niggers, nigger's
    if (parts.length === 1) {
        const rawPart = parts[0];
        const norm = normalizeText(term);
        const isAsciiAlpha = /^[a-z]+$/.test(norm);
        if (isAsciiAlpha && norm.length >= 4) {
            body = `${rawPart}(?:s|es|\\'s)?`;
        }
    }

    return new RegExp(`(?:^|\\s)(${body})(?=$|\\s)`, 'i');
}

function detectProfanitySmart(content, { extraTerms = [], whitelist = [] } = {}) {
    const raw = String(content || '');
    const normalized = normalizeText(raw);
    const normalizedDigits = normalizeTextKeepDigits(raw);
    if (!normalized && !normalizedDigits) return { isViolation: false, matches: [] };

    const list = [...new Set([...(Array.isArray(profanityList) ? profanityList : []), ...(Array.isArray(extraTerms) ? extraTerms : [])])];

    const wl = new Set((Array.isArray(whitelist) ? whitelist : [])
        .map(t => normalizeText(t))
        .filter(Boolean));

    const matches = [];
    for (const term of list) {
        if (!term || typeof term !== 'string') continue;
        if (wl.size) {
            const tNorm = normalizeText(term);
            if (tNorm && wl.has(tNorm)) continue;
        }
        const rx = buildWordRegex(term);
        if (!rx) continue;
        const hit = rx.exec(normalized) || rx.exec(normalizedDigits);
        if (hit?.[1]) matches.push(term);
    }

    if (!matches.length) return { isViolation: false, matches: [] };
    return { isViolation: true, matches: [...new Set(matches)] };
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

module.exports = { analyzeMessage, normalizeText, levenshteinDistance, detectProfanitySmart, tokenize };
