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

    // 1.5) Collapse elongated letters early (helps Franco like a7aaaaaaaa)
    normalized = normalized.replace(/([a-z])\1{1,}/g, '$1');
    normalized = normalized.replace(/([\u0621-\u064Aء])\1{1,}/g, '$1');

    // 2) Normalize common "Franco-Arabic" numerals
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

    // 5) Reduce repeated characters to handle elongations
    // - Latin: collapse repeats to 1 ("fuuuuuck" -> "fuck")
    // - Arabic: collapse repeats to 1 ("منيووووك" -> "منيوك")
    normalized = normalized.replace(/([a-z])\1{1,}/g, '$1');
    normalized = normalized.replace(/([\u0621-\u064Aء])\1{1,}/g, '$1');

    // 6) Keep letters/numbers/spaces; convert other chars to spaces (so boundaries still work)
    normalized = normalized.replace(/[^a-z0-9\s\u0621-\u064Aء]/gi, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
}

// Global whitelist for common false positives
const GLOBAL_WHITELIST = new Set([
    'warning', 'warnings', 'restart', 'restarts', 'message', 'messages', 'class', 'classes',
    'assessment', 'assessments', 'assume', 'assumed', 'assuming', 'pass', 'passed', 'passing',
    'grass', 'glass', 'mass', 'brass', 'compass', 'bass', 'embassy', 'classic', 'classical',
    'associate', 'association', 'asset', 'assets', 'assignment', 'assign', 'assigned',
    'hoeing', 'shoe', 'shoes', 'backhoe', 'titans', 'titanic', 'title', 'titled', 'titles',
    'shitting', 'shifting', 'shirt', 'shirts', 'short', 'shorts', 'shot', 'shots', 'shoot',
    'sheet', 'sheets', 'shell', 'shells', 'shelf', 'shelves', 'shall', 'shape', 'shapes',
    'share', 'shared', 'sharing', 'sharp', 'sharply', 'shake', 'shaken', 'shaking',
    'احلام', 'احلامي', 'احلامك', 'احلامنا', 'احلامكم', 'احلامهم',
    'احسن', 'احسنت', 'احسنتم', 'احسنا', 'احسنوا', 'احسني',
    'احساس', 'احاسيس', 'احساسي', 'احساسك', 'احساسنا', 'احساسكم', 'احساسهم',
    'احمر', 'حمراء', 'حمرة', 'حمار'
]);

function normalizeTextKeepDigits(text) {
    if (!text) return '';
    let normalized = String(text).toLowerCase();
    normalized = normalized
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ى]/g, 'ي')
        .replace(/[ة]/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي');
    normalized = normalized
        .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
        .replace(/ـ/g, '');

    // Handle elongations (same as normalizeText)
    normalized = normalized.replace(/([a-z])\1{1,}/g, '$1');
    normalized = normalized.replace(/([\u0621-\u064Aء])\1{1,}/g, '$1');
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
    const t = normalizeText(term);
    const parts = t.split(/\s+/).filter(Boolean).map(escapeRegex);
    if (!parts.length) return null;

    let body = parts.join('\\s+');

    if (parts.length === 1) {
        const rawPart = parts[0];
        const norm = normalizeText(term);
        const isAsciiAlpha = /^[a-z]+$/.test(norm);
        
        if (isAsciiAlpha) {
            if (norm.length <= 3) {
                body = `\\b${rawPart}\\b`;
            } else {
                const flexibleBody = rawPart.split('').map(char => `${char}+`).join('');
                body = `\\b${flexibleBody}(?:s|es|\\'s)?\\b`;
            }
        } else {
            body = `(?:^|\\s)(${rawPart})(?=$|\\s)`;
        }
    } else {
        body = `(?:^|\\s)(${body})(?=$|\\s)`;
    }

    return new RegExp(body, 'i');
}

function detectProfanitySmart(content, { extraTerms = [], whitelist = [] } = {}) {
    const raw = String(content || '');
    const normalized = normalizeText(raw);
    const normalizedDigits = normalizeTextKeepDigits(raw);
    if (!normalized && !normalizedDigits) return { isViolation: false, matches: [] };

    const list = [...new Set([...(Array.isArray(profanityList) ? profanityList : []), ...(Array.isArray(extraTerms) ? extraTerms : [])])];
    const wl = new Set((Array.isArray(whitelist) ? whitelist : []).map(t => normalizeText(t)).filter(Boolean));

    const matches = [];
    for (const term of list) {
        if (!term || typeof term !== 'string') continue;
        const tNorm = normalizeText(term);
        if (tNorm && (wl.has(tNorm) || GLOBAL_WHITELIST.has(tNorm))) continue;

        const rx = buildWordRegex(term);
        if (!rx) continue;

        const hit = rx.exec(normalized) || rx.exec(normalizedDigits);
        if (hit) {
            const matchedString = (hit[1] || hit[0]).trim();
            const matchedNorm = normalizeText(matchedString);
            if (GLOBAL_WHITELIST.has(matchedNorm)) continue;
            matches.push(term);
        }
    }

    if (!matches.length) return { isViolation: false, matches: [] };
    return { isViolation: true, matches: [...new Set(matches)] };
}

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

function getFuzzyMatch(word, blacklist) {
    for (const bad of blacklist) {
        if (bad.length < 3) continue;
        const distance = levenshteinDistance(word, bad);
        const threshold = Math.floor(bad.length * 0.3);
        if (distance <= threshold) return { matched: bad, confidence: 100 - (distance * 10) };
    }
    return null;
}

async function aiContextCheck(text, detectedWords) {
    if (!model) return { isViolation: true, confidence: 80 };
    try {
        const prompt = `Analyze: "${text}" | Suspected: ${detectedWords.join(', ')} | Output JSON: {isViolation: boolean, confidence: number, severity: string, reason: string}`;
        const result = await model.generateContent(prompt);
        const jsonString = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (e) {
        return { isViolation: true, confidence: 70, severity: 'Mild', reason: 'Error' };
    }
}

async function analyzeMessage(messageContent) {
    const rawContent = messageContent;
    const cleanContent = normalizeText(rawContent);
    const words = cleanContent.split(/\s+/);
    let matches = [];
    let severityScore = 0;
    for (const word of words) {
        if (profanityList.includes(word)) {
            matches.push(word);
            severityScore += 10;
        } else {
            const fuzzy = getFuzzyMatch(word, profanityList);
            if (fuzzy) {
                matches.push(word);
                severityScore += 8;
            }
        }
    }
    if (matches.length === 0) return { isViolation: false };
    if (severityScore < 30) {
        const aiResult = await aiContextCheck(rawContent, matches);
        return { isViolation: aiResult.isViolation, matches: matches, confidence: aiResult.confidence, severity: aiResult.severity, reason: aiResult.reason };
    }
    return { isViolation: true, matches: matches, confidence: 95, severity: severityScore > 50 ? 'Extreme' : 'Severe', reason: 'Direct word match' };
}

module.exports = { analyzeMessage, normalizeText, levenshteinDistance, detectProfanitySmart, tokenize };
