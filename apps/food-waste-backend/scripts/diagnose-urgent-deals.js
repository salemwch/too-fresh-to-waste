/**
 * Diagnostic Script: Urgent Deals Issue
 *
 * Purpose: Verify why offers with ~11 hours remaining appear in "Urgent Deals"
 *
 * Expected findings:
 * 1. Offers in "featured" endpoint have isFeaturedManual=true OR isFeaturedAuto=true
 * 2. Offers with >3 hours remaining should only have isFeaturedManual=true
 * 3. Auto-featured offers should only have <=3 hours remaining
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Simple .env parser (avoid dotenv dependency)
const envPath = path.join(__dirname, '..', '.env');
let MONGODB_URI = 'mongodb://localhost:27017/food-waste';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/(?:MONGODB_URI|DATABASE_URL)=(.+)/);
    if (match) MONGODB_URI = match[1].trim();
}

const OfferSchema = new mongoose.Schema({}, { strict: false, collection: 'offers' });
const Offer = mongoose.model('Offer', OfferSchema);

async function diagnoseUrgentDeals() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const now = new Date();
        console.log('Current time:', now.toISOString());
        console.log('='.repeat(80), '\n');

        // Get all featured offers (what the mobile app receives)
        const featuredOffers = await Offer.find({
            status: 'active',
            isActive: true,
            availableFrom: { $lte: now },
            availableUntil: { $gte: now },
            $or: [
                { isFeaturedManual: true },
                { isFeaturedAuto: true }
            ]
        })
        .select('title availableFrom availableUntil isFeaturedManual isFeaturedAuto featuredAt originalPrice discountedPrice')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

        console.log(`📊 FEATURED OFFERS (what "Urgent Deals" section receives): ${featuredOffers.length}`);
        console.log('='.repeat(80), '\n');

        featuredOffers.forEach((offer, index) => {
            const hoursRemaining = (new Date(offer.availableUntil) - now) / (1000 * 60 * 60);
            const hoursExisted = (now - new Date(offer.availableFrom)) / (1000 * 60 * 60);

            console.log(`${index + 1}. ${offer.title}`);
            console.log(`   ID: ${offer._id}`);
            console.log(`   Available: ${offer.availableFrom} → ${offer.availableUntil}`);
            console.log(`   ⏱️  Hours Remaining: ${hoursRemaining.toFixed(2)} hours`);
            console.log(`   📅 Hours Existed: ${hoursExisted.toFixed(2)} hours`);
            console.log(`   🏷️  isFeaturedManual: ${offer.isFeaturedManual || false}`);
            console.log(`   🤖 isFeaturedAuto: ${offer.isFeaturedAuto || false}`);
            console.log(`   ⭐ Featured At: ${offer.featuredAt || 'N/A'}`);
            console.log(`   💰 Price: $${offer.originalPrice} → $${offer.discountedPrice}`);

            // Highlight the problem cases
            if (hoursRemaining > 3) {
                console.log(`   ⚠️  WARNING: This offer has ${hoursRemaining.toFixed(2)} hours remaining but appears in "Urgent Deals"`);
                if (offer.isFeaturedManual) {
                    console.log(`   🔍 ROOT CAUSE: Manually featured by admin (isFeaturedManual=true)`);
                }
                if (offer.isFeaturedAuto) {
                    console.log(`   🔍 POTENTIAL BUG: Auto-featured but has >3 hours remaining (check auto-featuring logic)`);
                }
            }

            console.log('');
        });

        // Now get what SHOULD be in "Urgent Deals" (< 1 hour remaining)
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const actualUrgentOffers = await Offer.find({
            status: 'active',
            isActive: true,
            availableFrom: { $lte: now },
            availableUntil: { $gte: now, $lte: oneHourFromNow }
        })
        .select('title availableFrom availableUntil isFeaturedManual isFeaturedAuto')
        .sort({ availableUntil: 1 })
        .limit(20)
        .lean();

        console.log('='.repeat(80));
        console.log(`🚨 ACTUAL URGENT OFFERS (< 1 hour remaining): ${actualUrgentOffers.length}`);
        console.log('='.repeat(80), '\n');

        actualUrgentOffers.forEach((offer, index) => {
            const hoursRemaining = (new Date(offer.availableUntil) - now) / (1000 * 60 * 60);
            console.log(`${index + 1}. ${offer.title}`);
            console.log(`   ⏱️  Hours Remaining: ${hoursRemaining.toFixed(2)} hours`);
            console.log(`   🏷️  isFeaturedManual: ${offer.isFeaturedManual || false}`);
            console.log(`   🤖 isFeaturedAuto: ${offer.isFeaturedAuto || false}`);
            console.log('');
        });

        // Statistics
        const manuallyFeatured = featuredOffers.filter(o => o.isFeaturedManual).length;
        const autoFeatured = featuredOffers.filter(o => o.isFeaturedAuto).length;
        const over3Hours = featuredOffers.filter(o => {
            const hoursRemaining = (new Date(o.availableUntil) - now) / (1000 * 60 * 60);
            return hoursRemaining > 3;
        }).length;
        const over1Hour = featuredOffers.filter(o => {
            const hoursRemaining = (new Date(o.availableUntil) - now) / (1000 * 60 * 60);
            return hoursRemaining > 1;
        }).length;

        console.log('='.repeat(80));
        console.log('📈 STATISTICS');
        console.log('='.repeat(80));
        console.log(`Total Featured Offers: ${featuredOffers.length}`);
        console.log(`├─ Manually Featured: ${manuallyFeatured}`);
        console.log(`├─ Auto Featured: ${autoFeatured}`);
        console.log(`├─ > 3 hours remaining: ${over3Hours} ⚠️  (Should not be auto-featured)`);
        console.log(`└─ > 1 hour remaining: ${over1Hour} 🚨 (Should NOT be in "Urgent Deals")`);
        console.log('');

        console.log('='.repeat(80));
        console.log('🔍 DIAGNOSIS COMPLETE');
        console.log('='.repeat(80));
        console.log('');
        console.log('ROOT CAUSE:');
        console.log('  The "Urgent Deals" section uses the /offers/featured endpoint which returns');
        console.log('  ALL featured offers (isFeaturedManual=true OR isFeaturedAuto=true).');
        console.log('');
        console.log('  Admins can manually feature ANY offer regardless of time remaining,');
        console.log('  so offers with 11+ hours remaining appear in "Urgent Deals".');
        console.log('');
        console.log('SOLUTION:');
        console.log('  Create a new /offers/urgent endpoint that filters by actual time remaining');
        console.log('  (< 1 hour) instead of relying on the featured flags.');
        console.log('');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run the diagnostic
diagnoseUrgentDeals();
