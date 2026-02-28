const axios = require('axios');

async function unfurlSocialLink(content) {
    // 1. Instagram / Reels -> ddinstagram
    const instaRegex = /(https?:\/\/(www\.)?instagram\.com\/(reels?|p|tv)\/[a-zA-Z0-9_-]+)/gi;
    const instaMatch = content.match(instaRegex);
    if (instaMatch) {
        return instaMatch[0].replace(/instagram\.com/i, 'ddinstagram.com');
    }

    // 2. TikTok -> vxtiktok or similar
    const tiktokRegex = /(https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/[a-zA-Z0-9_-]+)/gi;
    const tiktokMatch = content.match(tiktokRegex);
    if (tiktokMatch) {
        return tiktokMatch[0].replace(/tiktok\.com/i, 'vxtiktok.com');
    }

    return null;
}

module.exports = { unfurlSocialLink };
