/**
 * Diagnostic Script: Check Featured Offers Status
 *
 * This script diagnoses why no featured offers are being returned.
 * It checks:
 * 1. Total active offers in database
 * 2. Offers eligible for auto-featuring
 * 3. Currently featured offers (manual + auto)
 * 4. Configuration settings
 *
 * Usage:
 *   node scripts/diagnose-featured-offers.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Configuration constants (matching featuring.config.ts)
const MIN_EXISTENCE_HOURS = parseFloat(process.env.AUTO_FEATURE_MIN_EXISTENCE_HOURS || '0.5');
const URGENCY_THRESHOLD_HOURS = parseFloat(process.env.AUTO_FEATURE_URGENCY_HOURS || '3');
const AUTO_FEATURE_ENABLED = process.env.AUTO_FEATURE_ENABLED !== 'false';

console.log('🔍 Featured Offers Diagnostic Tool\n');
console.log('Configuration:');
console.log(`  AUTO_FEATURE_ENABLED: ${AUTO_FEATURE_ENABLED}`);
console.log(`  MIN_EXISTENCE_HOURS: ${MIN_EXISTENCE_HOURS} hours`);
console.log(`  URGENCY_THRESHOLD_HOURS: ${URGENCY_THRESHOLD_HOURS} hours\n`);

async function diagnose() {
    try {
        // Connect to MongoDB
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error('DATABASE_URL not set in environment');
        }

        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(dbUrl);
        console.log('✅ Connected to MongoDB\n');

        // Get Offer model
        const Offer = mongoose.connection.collection('offers');

        const now = new Date();
        const minExistenceMs = MIN_EXISTENCE_HOURS * 60 * 60 * 1000;
        const urgencyThresholdMs = URGENCY_THRESHOLD_HOURS * 60 * 60 * 1000;

        const existenceCutoff = new Date(now.getTime() - minExistenceMs);
        const urgencyCutoff = new Date(now.getTime() + urgencyThresholdMs);

        console.log('⏰ Time Context:');
        console.log(`  Current Time: ${now.toISOString()}`);
        console.log(`  Existence Cutoff: ${existenceCutoff.toISOString()} (created before this)`);
        console.log(`  Urgency Cutoff: ${urgencyCutoff.toISOString()} (expires before this)\n`);

        // 1. Check total active offers
        const totalActive = await Offer.countDocuments({
            status: 'active',
            isActive: true,
            isDeleted: { $ne: true }
        });
        console.log(`📊 Total Active Offers: ${totalActive}`);

        if (totalActive === 0) {
            console.log('❌ No active offers found. Please create some offers first.');
            return;
        }

        // 2. Check currently featured offers
        const featuredManual = await Offer.countDocuments({
            isFeaturedManual: true,
            isDeleted: { $ne: true }
        });
        const featuredAuto = await Offer.countDocuments({
            isFeaturedAuto: true,
            isDeleted: { $ne: true }
        });
        const totalFeatured = await Offer.countDocuments({
            $or: [
                { isFeaturedManual: true },
                { isFeaturedAuto: true }
            ],
            isDeleted: { $ne: true }
        });

        console.log(`\n⭐ Currently Featured:`);
        console.log(`  Manual: ${featuredManual}`);
        console.log(`  Auto: ${featuredAuto}`);
        console.log(`  Total: ${totalFeatured}`);

        // 3. Check eligible for auto-featuring
        const eligible = await Offer.find({
            status: 'active',
            isActive: true,
            isDeleted: { $ne: true },
            createdAt: { $lte: existenceCutoff },
            availableFrom: { $lte: now },
            availableUntil: {
                $gte: now,
                $lte: urgencyCutoff
            },
            isFeaturedAuto: false
        }).toArray();

        console.log(`\n✅ Eligible for Auto-Featuring: ${eligible.length}`);

        if (eligible.length > 0) {
            console.log('\nDetails of eligible offers:');
            eligible.forEach((offer, i) => {
                const existedHours = ((now - new Date(offer.createdAt)) / (1000 * 60 * 60)).toFixed(2);
                const remainingHours = ((new Date(offer.availableUntil) - now) / (1000 * 60 * 60)).toFixed(2);
                const availableQty = offer.totalQuantity - offer.soldQuantity - offer.reservedQuantity;

                console.log(`  ${i + 1}. ${offer.title}`);
                console.log(`     ID: ${offer._id}`);
                console.log(`     Existed: ${existedHours}h (needs >= ${MIN_EXISTENCE_HOURS}h)`);
                console.log(`     Remaining: ${remainingHours}h (needs <= ${URGENCY_THRESHOLD_HOURS}h)`);
                console.log(`     Available Qty: ${availableQty} / ${offer.totalQuantity}`);
                console.log(`     Created: ${new Date(offer.createdAt).toISOString()}`);
                console.log(`     Expires: ${new Date(offer.availableUntil).toISOString()}`);
            });
        }

        // 4. Check offers that ALMOST meet criteria
        const almostEligible = await Offer.find({
            status: 'active',
            isActive: true,
            isDeleted: { $ne: true },
            availableFrom: { $lte: now },
            availableUntil: { $gte: now },
            isFeaturedAuto: false
        }).toArray();

        console.log(`\n⚠️  Active offers not meeting criteria: ${almostEligible.length}`);

        if (almostEligible.length > 0 && eligible.length === 0) {
            console.log('\nAnalyzing why they don\'t qualify:');
            almostEligible.slice(0, 5).forEach((offer, i) => {
                const existedHours = ((now - new Date(offer.createdAt)) / (1000 * 60 * 60)).toFixed(2);
                const remainingHours = ((new Date(offer.availableUntil) - now) / (1000 * 60 * 60)).toFixed(2);

                console.log(`  ${i + 1}. ${offer.title}`);
                console.log(`     Existed: ${existedHours}h ${existedHours < MIN_EXISTENCE_HOURS ? '❌ Too new!' : '✅'}`);
                console.log(`     Remaining: ${remainingHours}h ${remainingHours > URGENCY_THRESHOLD_HOURS ? '❌ Too much time!' : '✅'}`);
                console.log(`     Expires: ${new Date(offer.availableUntil).toISOString()}`);
            });
        }

        // 5. Recommendations
        console.log('\n📋 Recommendations:');
        if (totalFeatured === 0 && eligible.length === 0) {
            console.log('  1. No offers meet auto-featuring criteria');
            console.log('  2. Options:');
            console.log('     a) Wait for existing offers to approach expiry');
            console.log('     b) Create new offers with shorter availability windows');
            console.log(`     c) Adjust thresholds: MIN_EXISTENCE_HOURS=${MIN_EXISTENCE_HOURS}h, URGENCY_THRESHOLD_HOURS=${URGENCY_THRESHOLD_HOURS}h`);
            console.log('     d) Manually feature offers via admin endpoint: PATCH /api/v1/offers/:id/feature');
        } else if (eligible.length > 0 && featuredAuto === 0) {
            console.log(`  ✅ ${eligible.length} offers are eligible but not yet featured`);
            console.log('  💡 Trigger auto-featuring manually:');
            console.log('     curl -X POST http://localhost:3000/api/v1/offers/admin/trigger-auto-featuring \\');
            console.log('          -H "Authorization: Bearer YOUR_ADMIN_TOKEN"');
        } else {
            console.log('  ✅ Featured offers system is working correctly!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run diagnostic
diagnose();
