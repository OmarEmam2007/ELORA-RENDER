const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    balance: { type: Number, default: 0 }, // Legacy field, keeping for compatibility
    wallet: { type: Number, default: 0 }, // Cash on hand
    bank: { type: Number, default: 0 }, // Stored money
    dailyLastUsed: { type: Date, default: null },
    lastMessageTimestamp: { type: Number, default: 0 }, // For XP cooldown
    lastCommandTimestamp: { type: Number, default: 0 }, // For command cooldown
    lastWorkTimestamp: { type: Number, default: 0 }, // For work cooldown
    inventory: { type: Array, default: [] }, // Array of items
    jailed: { type: Boolean, default: false },
    jailReleaseTime: { type: Date, default: null }
});

userSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
