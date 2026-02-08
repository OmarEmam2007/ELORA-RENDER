const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    vehicleId: { type: String, required: true, unique: true }, // e.g., "VEH-001"
    guildId: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['car', 'sportscar', 'luxury', 'jet']
    },
    name: { type: String, required: true }, // Display name
    ownerId: { type: String, default: null }, // User ID or null if owned by family
    familyId: { type: String, default: null }, // Family ID if owned by dynasty
    purchasePrice: { type: Number, required: true },
    currentValue: { type: Number, required: true },
    workCooldownReduction: { type: Number, required: true }, // Percentage reduction (e.g., 15 = 15%)
    taxRate: { type: Number, required: true }, // Percentage
    purchasedAt: { type: Date, default: Date.now },
    lastTaxPaid: { type: Date, default: Date.now }
});

vehicleSchema.index({ guildId: 1, ownerId: 1 });
vehicleSchema.index({ guildId: 1, familyId: 1 });
vehicleSchema.index({ vehicleId: 1 }, { unique: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
