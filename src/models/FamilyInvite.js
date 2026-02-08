const mongoose = require('mongoose');

const familyInviteSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    familyId: { type: String, required: true }, // Family _id
    inviterId: { type: String, required: true }, // Who sent the invite
    inviteeId: { type: String, required: true }, // Who was invited
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'expired'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // 7 days
});

familyInviteSchema.index({ guildId: 1, inviteeId: 1, status: 1 });
familyInviteSchema.index({ familyId: 1, status: 1 });
familyInviteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // Auto-delete after 7 days

module.exports = mongoose.model('FamilyInvite', familyInviteSchema);
