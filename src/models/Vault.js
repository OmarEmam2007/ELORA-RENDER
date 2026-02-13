const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },

    // Base simulated amount for the Sovereign Vault in this guild.
    baseAmount: { type: Number, default: 250000 },

    // Optional: track last time a heist touched this vault.
    lastHeistAt: { type: Date, default: null }
});

vaultSchema.index({ guildId: 1 }, { unique: true });

module.exports = mongoose.model('Vault', vaultSchema);

