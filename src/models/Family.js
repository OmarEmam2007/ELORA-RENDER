const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    headId: { type: String, required: true }, // User ID of dynasty head
    members: [{ type: String }], // Array of user IDs
    bank: { type: Number, default: 0 }, // Dynasty treasury
    createdAt: { type: Date, default: Date.now },
    lastTaxPaid: { type: Date, default: Date.now },
    totalAssetsValue: { type: Number, default: 0 }, // Sum of all property/vehicle values
    passiveIncome: { type: Number, default: 0 }, // Total passive income per day
    taxDelinquent: { type: Boolean, default: false }
});

familySchema.index({ guildId: 1, name: 1 }, { unique: true });
familySchema.index({ guildId: 1, headId: 1 });
familySchema.index({ guildId: 1, 'members': 1 });

module.exports = mongoose.model('Family', familySchema);
