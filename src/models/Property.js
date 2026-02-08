const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
    propertyId: { type: String, required: true, unique: true }, // e.g., "PROP-001"
    guildId: { type: String, required: true },
    type: { 
        type: String, 
        required: true,
        enum: ['loft', 'house', 'villa', 'mansion', 'estate']
    },
    name: { type: String, required: true }, // Display name
    ownerId: { type: String, default: null }, // User ID or null if owned by family
    familyId: { type: String, default: null }, // Family ID if owned by dynasty
    purchasePrice: { type: Number, required: true },
    currentValue: { type: Number, required: true }, // Can appreciate/depreciate
    passiveIncome: { type: Number, required: true }, // Daily income
    taxRate: { type: Number, required: true }, // Percentage (e.g., 5 = 5%)
    purchasedAt: { type: Date, default: Date.now },
    lastTaxPaid: { type: Date, default: Date.now }
});

propertySchema.index({ guildId: 1, ownerId: 1 });
propertySchema.index({ guildId: 1, familyId: 1 });
propertySchema.index({ propertyId: 1 }, { unique: true });

module.exports = mongoose.model('Property', propertySchema);
