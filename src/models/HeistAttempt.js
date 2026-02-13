const mongoose = require('mongoose');

const heistAttemptSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },

    leaderId: { type: String, required: true },
    participantIds: [{ type: String, required: true }],

    status: {
        type: String,
        enum: ['success', 'failed', 'timeout', 'cancelled'],
        required: true
    },

    // Total coins distributed from the simulated vault for this attempt.
    rewardTotal: { type: Number, default: 0 },

    // Map of userId -> coins rewarded.
    rewards: {
        type: Map,
        of: Number,
        default: {}
    },

    // AI riddle + narrative
    riddleChallenge: { type: String },
    solutionKeywords: [{ type: String }],
    successStory: { type: String },
    failureMockery: { type: String },
    matchedKeyword: { type: String, default: null },
    failureReason: { type: String, default: null },

    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null }
}, {
    timestamps: true
});

heistAttemptSchema.index({ guildId: 1, startedAt: -1 });

module.exports = mongoose.model('HeistAttempt', heistAttemptSchema);

