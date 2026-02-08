const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    partner1Id: { type: String, required: true },
    partner2Id: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'active', 'dissolved'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
    dissolvedAt: { type: Date, default: null },
    // Economic buffs
    workIncomeBonus: { type: Number, default: 10 }, // Percentage bonus
    taxReduction: { type: Number, default: 15 }, // Percentage reduction
    proposalCost: { type: Number, default: 100000 }, // Cost to propose
    ringPurchased: { type: Boolean, default: false }
});

relationshipSchema.index({ guildId: 1, partner1Id: 1, partner2Id: 1 }, { unique: true });
relationshipSchema.index({ guildId: 1, partner1Id: 1 });
relationshipSchema.index({ guildId: 1, partner2Id: 1 });

module.exports = mongoose.model('Relationship', relationshipSchema);
