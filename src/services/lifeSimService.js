const Family = require('../models/Family');
const Property = require('../models/Property');
const Vehicle = require('../models/Vehicle');
const Relationship = require('../models/Relationship');
const User = require('../models/User');

// Configuration (will be loaded from config.json)
const CONFIG = {
    roles: {
        DYNASTY_HEAD: '1467897663914770695',
        DYNASTY_MEMBER: '1467898476124831888',
        ECONOMIC_PARTNER: '1467898781948186832',
        HIGH_NET_WORTH: '1467898876726874207',
        TAX_DELINQUENT: '1467899085859192887',
        CITY_COUNCIL: '1467899201818988544'
    },
    channels: {
        CITY_HALL: '1467899763700793506',
        JOB_CENTER: '1467899826720079912',
        PROPERTY_MARKET: '1467899930843545918',
        VEHICLE_MARKET: '1467900087102345226',
        DYNASTY_HUB: '1467900586308669571',
        DYNASTY_ADS: '1467900703463702765',
        TRADE_DISTRICT: '1467900883206541364',
        LIFE_SIM_COMMANDS: '1467900960461426832',
        LIFE_SIM_LOGS: '1467901255568588974',
        LIFE_SIM_CONFIG: '1467901328377512189'
    },
    emojis: {
        BANK: '<:elora_bank:1467905514779316305>',
        HOUSE: '<:elora_house:1467905493547880663>'
    },
    prices: {
        FAMILY_CREATE: 50000,
        PARTNERSHIP_PROPOSAL: 100000,
        HIGH_NET_WORTH_THRESHOLD: 500000
    },
    properties: [
        { id: 'PROP-001', type: 'loft', name: 'Modern Loft', price: 50000, passiveIncome: 2000, taxRate: 3 },
        { id: 'PROP-002', type: 'house', name: 'Suburban House', price: 150000, passiveIncome: 5000, taxRate: 4 },
        { id: 'PROP-003', type: 'villa', name: 'Luxury Villa', price: 500000, passiveIncome: 20000, taxRate: 5 },
        { id: 'PROP-004', type: 'mansion', name: 'Grand Mansion', price: 1500000, passiveIncome: 60000, taxRate: 6 },
        { id: 'PROP-005', type: 'estate', name: 'Royal Estate', price: 5000000, passiveIncome: 250000, taxRate: 7 }
    ],
    vehicles: [
        { id: 'VEH-001', type: 'car', name: 'Economy Car', price: 30000, cooldownReduction: 10, taxRate: 2 },
        { id: 'VEH-002', type: 'sportscar', name: 'Sports Car', price: 200000, cooldownReduction: 20, taxRate: 3 },
        { id: 'VEH-003', type: 'luxury', name: 'Luxury Vehicle', price: 800000, cooldownReduction: 25, taxRate: 4 },
        { id: 'VEH-004', type: 'jet', name: 'Private Jet', price: 5000000, cooldownReduction: 30, taxRate: 5 }
    ],
    jobs: [
        { tier: 1, name: 'Intern', basePay: 500, requiredLevel: 1 },
        { tier: 2, name: 'Junior Developer', basePay: 1500, requiredLevel: 3 },
        { tier: 3, name: 'Mid-Level Developer', basePay: 4000, requiredLevel: 5 },
        { tier: 4, name: 'Senior Developer', basePay: 10000, requiredLevel: 8 },
        { tier: 5, name: 'Tech Lead', basePay: 25000, requiredLevel: 12 },
        { tier: 6, name: 'CTO', basePay: 60000, requiredLevel: 15 }
    ]
};

class LifeSimService {
    constructor(client) {
        this.client = client;
    }

    // ========== ROLE MANAGEMENT ==========
    async assignRole(guild, userId, roleId, roleName = null) {
        try {
            const member = await guild.members.fetch(userId);
            const role = guild.roles.cache.get(roleId);
            if (role && !member.roles.cache.has(roleId)) {
                await member.roles.add(role);
                
                // Send notification to user
                const user = await this.client.users.fetch(userId).catch(() => null);
                if (user) {
                    const roleDisplayName = roleName || role.name;
                    const { EmbedBuilder } = require('discord.js');
                    const THEME = require('../utils/theme');
                    
                    const notificationEmbed = new EmbedBuilder()
                        .setColor(THEME.COLORS.SUCCESS)
                        .setAuthor({ name: '✅ Role Assigned' })
                        .setDescription(
                            `You have been assigned the **${roleDisplayName}** role!\n\n` +
                            `*This role grants you special privileges in the ELORA Life Sim.*`
                        )
                        .setTimestamp();
                    
                    try {
                        await user.send({ embeds: [notificationEmbed] });
                    } catch (e) {
                        // DMs disabled, that's okay
                    }
                }
                
                return true;
            }
        } catch (error) {
            console.error(`Error assigning role ${roleId} to ${userId}:`, error);
        }
        return false;
    }

    async removeRole(guild, userId, roleId, roleName = null) {
        try {
            const member = await guild.members.fetch(userId);
            const role = guild.roles.cache.get(roleId);
            if (role && member.roles.cache.has(roleId)) {
                await member.roles.remove(role);
                
                // Send notification to user
                const user = await this.client.users.fetch(userId).catch(() => null);
                if (user) {
                    const roleDisplayName = roleName || role.name;
                    const { EmbedBuilder } = require('discord.js');
                    const THEME = require('../utils/theme');
                    
                    const notificationEmbed = new EmbedBuilder()
                        .setColor(THEME.COLORS.WARNING)
                        .setAuthor({ name: '⚠️ Role Removed' })
                        .setDescription(
                            `The **${roleDisplayName}** role has been removed from you.\n\n` +
                            `*Your privileges have been updated.*`
                        )
                        .setTimestamp();
                    
                    try {
                        await user.send({ embeds: [notificationEmbed] });
                    } catch (e) {
                        // DMs disabled, that's okay
                    }
                }
                
                return true;
            }
        } catch (error) {
            console.error(`Error removing role ${roleId} from ${userId}:`, error);
        }
        return false;
    }

    async updateHighNetWorthRole(guild, userId) {
        const user = await User.findOne({ userId, guildId: guild.id });
        if (!user) return;

        const netWorth = await this.calculateNetWorth(guild.id, userId);
        const threshold = CONFIG.prices.HIGH_NET_WORTH_THRESHOLD;

        if (netWorth >= threshold) {
            await this.assignRole(guild, userId, CONFIG.roles.HIGH_NET_WORTH, 'High Net Worth');
        } else {
            await this.removeRole(guild, userId, CONFIG.roles.HIGH_NET_WORTH);
        }
    }

    // ========== NET WORTH CALCULATION ==========
    async calculateNetWorth(guildId, userId) {
        const user = await User.findOne({ userId, guildId });
        if (!user) return 0;

        const wallet = user.wallet || 0;
        const bank = user.bank || 0;

        // Get owned properties
        const properties = await Property.find({ guildId, ownerId: userId });
        const propertyValue = properties.reduce((sum, p) => sum + (p.currentValue || p.purchasePrice), 0);

        // Get owned vehicles
        const vehicles = await Vehicle.find({ guildId, ownerId: userId });
        const vehicleValue = vehicles.reduce((sum, v) => sum + (v.currentValue || v.purchasePrice), 0);

        // Check if in a family (add family bank share)
        const family = await Family.findOne({ guildId, $or: [{ headId: userId }, { members: userId }] });
        let familyShare = 0;
        if (family && family.members.length > 0) {
            familyShare = Math.floor(family.bank / (family.members.length + 1)); // +1 for head
        }

        return wallet + bank + propertyValue + vehicleValue + familyShare;
    }

    // ========== FAMILY/DYNASTY LOGIC ==========
    async createFamily(guildId, headId, name) {
        const existing = await Family.findOne({ guildId, $or: [{ name }, { headId }] });
        if (existing) {
            throw new Error(existing.name === name ? 'Family name already exists' : 'You already own a family');
        }

        const user = await User.findOne({ userId: headId, guildId });
        if (!user || (user.wallet || 0) < CONFIG.prices.FAMILY_CREATE) {
            throw new Error('Insufficient funds to create a family (50k required)');
        }

        user.wallet = (user.wallet || 0) - CONFIG.prices.FAMILY_CREATE;
        await user.save();

        const family = new Family({
            name,
            guildId,
            headId,
            members: [],
            bank: 0
        });
        await family.save();

        // Assign role
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
            await this.assignRole(guild, headId, CONFIG.roles.DYNASTY_HEAD, 'Dynasty Head');
        }

        return family;
    }

    async inviteToFamily(guildId, familyId, inviterId, inviteeId) {
        const FamilyInvite = require('../models/FamilyInvite');
        const family = await Family.findOne({ guildId, _id: familyId });
        if (!family) throw new Error('Family not found');
        if (family.headId !== inviterId && !family.members.includes(inviterId)) {
            throw new Error('Only family members can invite');
        }
        if (family.members.includes(inviteeId) || family.headId === inviteeId) {
            throw new Error('User is already in this family');
        }

        // Check for existing pending invite
        const existingInvite = await FamilyInvite.findOne({
            guildId,
            familyId: familyId.toString(),
            inviteeId,
            status: 'pending'
        });
        if (existingInvite) {
            throw new Error('Invite already sent to this user');
        }

        // Create pending invite
        const invite = new FamilyInvite({
            guildId,
            familyId: familyId.toString(),
            inviterId,
            inviteeId,
            status: 'pending'
        });
        await invite.save();

        return { family, invite };
    }

    async acceptFamilyInvite(guildId, inviteId, acceptorId) {
        const FamilyInvite = require('../models/FamilyInvite');
        const invite = await FamilyInvite.findOne({ _id: inviteId, guildId, inviteeId: acceptorId, status: 'pending' });
        if (!invite) throw new Error('Invite not found or already processed');

        const family = await Family.findById(invite.familyId);
        if (!family) throw new Error('Family not found');
        if (family.members.includes(acceptorId) || family.headId === acceptorId) {
            throw new Error('You are already in this family');
        }

        family.members.push(acceptorId);
        await family.save();

        invite.status = 'accepted';
        await invite.save();

        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
            await this.assignRole(guild, acceptorId, CONFIG.roles.DYNASTY_MEMBER, 'Dynasty Member');
        }

        return family;
    }

    async rejectFamilyInvite(guildId, inviteId, rejectorId) {
        const FamilyInvite = require('../models/FamilyInvite');
        const invite = await FamilyInvite.findOne({ _id: inviteId, guildId, inviteeId: rejectorId, status: 'pending' });
        if (!invite) throw new Error('Invite not found or already processed');

        invite.status = 'rejected';
        await invite.save();

        return invite;
    }

    async kickFromFamily(guildId, familyId, headId, targetId) {
        const family = await Family.findOne({ guildId, _id: familyId });
        if (!family) throw new Error('Family not found');
        if (family.headId !== headId) {
            throw new Error('Only the dynasty head can kick members');
        }
        if (family.headId === targetId) {
            throw new Error('Cannot kick yourself (you are the head)');
        }
        if (!family.members.includes(targetId)) {
            throw new Error('User is not a member of this family');
        }

        family.members = family.members.filter(id => id !== targetId);
        await family.save();

        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
            await this.removeRole(guild, targetId, CONFIG.roles.DYNASTY_MEMBER);
        }

        return family;
    }

    // ========== ASSET PURCHASE LOGIC ==========
    async purchaseProperty(guildId, userId, propertyId, useFamilyBank = false) {
        const propertyTemplate = CONFIG.properties.find(p => p.id === propertyId);
        if (!propertyTemplate) throw new Error('Property not found');

        const existing = await Property.findOne({ propertyId, guildId });
        if (existing && existing.ownerId) throw new Error('Property already owned');

        let user = await User.findOne({ userId, guildId });
        if (!user) {
            user = new User({ userId, guildId });
            await user.save();
        }

        let family = null;
        if (useFamilyBank) {
            family = await Family.findOne({ guildId, $or: [{ headId: userId }, { members: userId }] });
            if (!family) throw new Error('You are not in a family');
            if (family.bank < propertyTemplate.price) throw new Error('Family bank insufficient');
            family.bank -= propertyTemplate.price;
            await family.save();
        } else {
            if ((user.wallet || 0) < propertyTemplate.price) throw new Error('Insufficient funds');
            user.wallet = (user.wallet || 0) - propertyTemplate.price;
            await user.save();
        }

        const property = new Property({
            propertyId,
            guildId,
            type: propertyTemplate.type,
            name: propertyTemplate.name,
            ownerId: useFamilyBank ? null : userId,
            familyId: useFamilyBank ? family._id.toString() : null,
            purchasePrice: propertyTemplate.price,
            currentValue: propertyTemplate.price,
            passiveIncome: propertyTemplate.passiveIncome,
            taxRate: propertyTemplate.taxRate
        });
        await property.save();

        // Update family stats if applicable
        if (family) {
            family.totalAssetsValue = (family.totalAssetsValue || 0) + propertyTemplate.price;
            family.passiveIncome = (family.passiveIncome || 0) + propertyTemplate.passiveIncome;
            await family.save();
        }

        // Update high net worth role
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
            await this.updateHighNetWorthRole(guild, userId);
        }

        return property;
    }

    async purchaseVehicle(guildId, userId, vehicleId, useFamilyBank = false) {
        const vehicleTemplate = CONFIG.vehicles.find(v => v.id === vehicleId);
        if (!vehicleTemplate) throw new Error('Vehicle not found');

        const existing = await Vehicle.findOne({ vehicleId, guildId });
        if (existing && existing.ownerId) throw new Error('Vehicle already owned');

        let user = await User.findOne({ userId, guildId });
        if (!user) {
            user = new User({ userId, guildId });
            await user.save();
        }

        let family = null;
        if (useFamilyBank) {
            family = await Family.findOne({ guildId, $or: [{ headId: userId }, { members: userId }] });
            if (!family) throw new Error('You are not in a family');
            if (family.bank < vehicleTemplate.price) throw new Error('Family bank insufficient');
            family.bank -= vehicleTemplate.price;
            await family.save();
        } else {
            if ((user.wallet || 0) < vehicleTemplate.price) throw new Error('Insufficient funds');
            user.wallet = (user.wallet || 0) - vehicleTemplate.price;
            await user.save();
        }

        const vehicle = new Vehicle({
            vehicleId,
            guildId,
            type: vehicleTemplate.type,
            name: vehicleTemplate.name,
            ownerId: useFamilyBank ? null : userId,
            familyId: useFamilyBank ? family._id.toString() : null,
            purchasePrice: vehicleTemplate.price,
            currentValue: vehicleTemplate.price,
            workCooldownReduction: vehicleTemplate.cooldownReduction,
            taxRate: vehicleTemplate.taxRate
        });
        await vehicle.save();

        return vehicle;
    }

    // ========== PARTNERSHIP LOGIC ==========
    async proposePartnership(guildId, proposerId, targetId) {
        if (proposerId === targetId) throw new Error('Cannot partner with yourself');

        const existing = await Relationship.findOne({
            guildId,
            $or: [
                { partner1Id: proposerId, partner2Id: targetId },
                { partner1Id: targetId, partner2Id: proposerId }
            ],
            status: { $in: ['pending', 'active'] }
        });
        if (existing) throw new Error('Partnership already exists or pending');

        const proposer = await User.findOne({ userId: proposerId, guildId });
        if (!proposer || (proposer.wallet || 0) < CONFIG.prices.PARTNERSHIP_PROPOSAL) {
            throw new Error('Insufficient funds (100k required)');
        }

        proposer.wallet = (proposer.wallet || 0) - CONFIG.prices.PARTNERSHIP_PROPOSAL;
        await proposer.save();

        const relationship = new Relationship({
            guildId,
            partner1Id: proposerId,
            partner2Id: targetId,
            status: 'pending',
            proposalCost: CONFIG.prices.PARTNERSHIP_PROPOSAL,
            ringPurchased: true
        });
        await relationship.save();

        return relationship;
    }

    async acceptPartnership(guildId, relationshipId, acceptorId) {
        const relationship = await Relationship.findOne({ _id: relationshipId, guildId });
        if (!relationship) throw new Error('Partnership not found');
        if (relationship.partner2Id !== acceptorId) throw new Error('You are not the target of this proposal');
        if (relationship.status !== 'pending') throw new Error('Partnership already processed');

        relationship.status = 'active';
        await relationship.save();

        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
            await this.assignRole(guild, relationship.partner1Id, CONFIG.roles.ECONOMIC_PARTNER, 'Economic Partner');
            await this.assignRole(guild, relationship.partner2Id, CONFIG.roles.ECONOMIC_PARTNER, 'Economic Partner');
        }

        return relationship;
    }

    // ========== WORK INCOME CALCULATION ==========
    async calculateWorkIncome(guildId, userId) {
        const user = await User.findOne({ userId, guildId });
        if (!user) return { basePay: 0, bonuses: [], finalPay: 0 };

        // Get job tier based on level
        const job = CONFIG.jobs.find(j => j.requiredLevel <= user.level) || CONFIG.jobs[0];
        let basePay = job.basePay;

        // Check for partnership bonus
        const partnership = await Relationship.findOne({
            guildId,
            $or: [{ partner1Id: userId }, { partner2Id: userId }],
            status: 'active'
        });
        let partnershipBonus = 0;
        if (partnership) {
            partnershipBonus = Math.floor(basePay * (partnership.workIncomeBonus / 100));
        }

        // Check for vehicle cooldown reduction (doesn't affect pay, but affects cooldown)
        const vehicles = await Vehicle.find({ guildId, ownerId: userId });
        const maxCooldownReduction = vehicles.length > 0 
            ? Math.max(...vehicles.map(v => v.workCooldownReduction))
            : 0;

        const finalPay = basePay + partnershipBonus;

        return {
            basePay,
            bonuses: partnershipBonus > 0 ? [`+${partnershipBonus} (Partnership: +${partnership.workIncomeBonus}%)`] : [],
            finalPay,
            cooldownReduction: maxCooldownReduction,
            jobName: job.name,
            jobTier: job.tier
        };
    }

    // ========== DAILY CYCLE (24h automation) ==========
    async runDailyCycle(guildId) {
        const results = {
            passiveIncomePaid: 0,
            taxesCollected: 0,
            repossessions: [],
            errors: []
        };

        try {
            // 1. Pay passive income from properties
            const properties = await Property.find({ guildId, ownerId: { $ne: null } });
            for (const property of properties) {
                try {
                    const user = await User.findOne({ userId: property.ownerId, guildId });
                    if (user) {
                        const income = property.passiveIncome || 0;
                        user.wallet = (user.wallet || 0) + income;
                        await user.save();
                        results.passiveIncomePaid += income;
                    }
                } catch (error) {
                    results.errors.push(`Property ${property.propertyId}: ${error.message}`);
                }
            }

            // 2. Pay passive income from family properties
            const familyProperties = await Property.find({ guildId, familyId: { $ne: null } });
            for (const property of familyProperties) {
                try {
                    const family = await Family.findById(property.familyId);
                    if (family) {
                        const income = property.passiveIncome || 0;
                        family.bank = (family.bank || 0) + income;
                        await family.save();
                        results.passiveIncomePaid += income;
                    }
                } catch (error) {
                    results.errors.push(`Family Property ${property.propertyId}: ${error.message}`);
                }
            }

            // 3. Collect taxes and handle repossessions
            const allProperties = await Property.find({ guildId });
            for (const property of allProperties) {
                try {
                    const taxAmount = Math.floor((property.currentValue || property.purchasePrice) * (property.taxRate / 100));
                    
                    if (property.ownerId) {
                        const user = await User.findOne({ userId: property.ownerId, guildId });
                        if (user && (user.wallet || 0) >= taxAmount) {
                            user.wallet = (user.wallet || 0) - taxAmount;
                            await user.save();
                            results.taxesCollected += taxAmount;
                            property.lastTaxPaid = new Date();
                            await property.save();
                        } else {
                            // Repossess
                            await Property.deleteOne({ _id: property._id });
                            results.repossessions.push({
                                type: 'property',
                                id: property.propertyId,
                                ownerId: property.ownerId,
                                reason: 'Failed to pay tax'
                            });
                            
                            // Assign tax delinquent role
                            const guild = this.client.guilds.cache.get(guildId);
                            if (guild && property.ownerId) {
                                await this.assignRole(guild, property.ownerId, CONFIG.roles.TAX_DELINQUENT, 'Tax Delinquent');
                            }
                        }
                    } else if (property.familyId) {
                        const family = await Family.findById(property.familyId);
                        if (family && family.bank >= taxAmount) {
                            family.bank -= taxAmount;
                            await family.save();
                            results.taxesCollected += taxAmount;
                            property.lastTaxPaid = new Date();
                            await property.save();
                        } else {
                            // Repossess
                            await Property.deleteOne({ _id: property._id });
                            results.repossessions.push({
                                type: 'property',
                                id: property.propertyId,
                                familyId: property.familyId,
                                reason: 'Failed to pay tax'
                            });
                            
                            if (family) {
                                family.taxDelinquent = true;
                                await family.save();
                                
                                // Assign tax delinquent to all family members
                                const guild = this.client.guilds.cache.get(guildId);
                                if (guild) {
                                    await this.assignRole(guild, family.headId, CONFIG.roles.TAX_DELINQUENT, 'Tax Delinquent');
                                    for (const memberId of family.members) {
                                        await this.assignRole(guild, memberId, CONFIG.roles.TAX_DELINQUENT, 'Tax Delinquent');
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    results.errors.push(`Tax collection ${property.propertyId}: ${error.message}`);
                }
            }

            // 4. Vehicle taxes (similar logic)
            const vehicles = await Vehicle.find({ guildId });
            for (const vehicle of vehicles) {
                try {
                    const taxAmount = Math.floor((vehicle.currentValue || vehicle.purchasePrice) * (vehicle.taxRate / 100));
                    
                    if (vehicle.ownerId) {
                        const user = await User.findOne({ userId: vehicle.ownerId, guildId });
                        if (user && (user.wallet || 0) >= taxAmount) {
                            user.wallet = (user.wallet || 0) - taxAmount;
                            await user.save();
                            results.taxesCollected += taxAmount;
                            vehicle.lastTaxPaid = new Date();
                            await vehicle.save();
                        } else {
                            await Vehicle.deleteOne({ _id: vehicle._id });
                            results.repossessions.push({
                                type: 'vehicle',
                                id: vehicle.vehicleId,
                                ownerId: vehicle.ownerId,
                                reason: 'Failed to pay tax'
                            });
                        }
                    }
                } catch (error) {
                    results.errors.push(`Vehicle tax ${vehicle.vehicleId}: ${error.message}`);
                }
            }

        } catch (error) {
            results.errors.push(`Daily cycle error: ${error.message}`);
        }

        return results;
    }

    // ========== GETTERS ==========
    getConfig() {
        return CONFIG;
    }

    getProperties() {
        return CONFIG.properties;
    }

    getVehicles() {
        return CONFIG.vehicles;
    }

    getJobs() {
        return CONFIG.jobs;
    }
}

module.exports = LifeSimService;
