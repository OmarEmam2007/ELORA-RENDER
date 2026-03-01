async function unfurlSocialLink(content) {
    const text = String(content || '');

    const extractFirstUrl = (regex) => {
        const match = text.match(regex);
        if (!match || !match[0]) return null;
        return String(match[0])
            .replace(/[\s<>"'`]+$/g, '')
            .replace(/[),.!?]+$/g, '')
            .split('#')[0];
    };

    // Instagram -> ddinstagram
    const instaUrl = extractFirstUrl(/https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[A-Za-z0-9_-]+(?:\?[^\s]*)?/i);
    if (instaUrl) return instaUrl.replace(/instagram\.com/i, 'ddinstagram.com');

    // TikTok -> vxtiktok
    const tiktokUrl = extractFirstUrl(/https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/(?:@[^\s\/]+\/video\/\d+|t\/[A-Za-z0-9]+|[A-Za-z0-9_-]+)(?:\?[^\s]*)?/i);
    if (tiktokUrl) return tiktokUrl.replace(/tiktok\.com/i, 'vxtiktok.com');

    return null;
}

module.exports = { unfurlSocialLink };
