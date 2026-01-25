/**
 * Check all active offers to understand the current state
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Simple .env parser
const envPath = path.join(__dirname, '..', '.env');
let MONGODB_URI = 'mongodb://localhost:27017/food-waste';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/(?:MONGODB_URI|DATABASE_URL)=(.+)/);
    if (match) MONGODB_URI = match[1].trim();
}

const OfferSchema = new mongoose.Schema({}, { strict: false, collection: 'offers' });
const Offer = mongoose.model('Offer', OfferSchema);

async function checkOffers() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const now = new Date();
        console.log('Current time:', now.toISOString());
        console.log('='.repeat(80), '\n');

        // Check the specific time range the user mentioned
        const userMentionedFrom = new Date('2026-01-24T23:24:00.000Z');
        const userMentionedUntil = new Date('2026-01-25T10:24:00.000Z');

        console.log('Checking for offers with the time range user mentioned:');
        console.log(`availableFrom: ${userMentionedFrom.toISOString()}`);
        console.log(`availableUntil: ${userMentionedUntil.toISOString()}`);
        console.log('');

        const matchingOffers = await Offer.find({
            availableFrom: userMentionedFrom,
            availableUntil: userMentionedUntil
        })
        .select('title status isActive availableFrom availableUntil isFeaturedManual isFeaturedAuto originalPrice discountedPrice')
        .lean();

        console.log(`Found ${matchingOffers.length} offers with this exact time range:\n`);

        matchingOffers.forEach((offer, index) => {
            const hoursRemaining = (new Date(offer.availableUntil) - now) / (1000 * 60 * 60);
            console.log(`${index + 1}. ${offer.title}`);
            console.log(`   Status: ${offer.status}, isActive: ${offer.isActive}`);
            console.log(`   ⏱️  Hours Remaining: ${hoursRemaining.toFixed(2)} hours`);
            console.log(`   🏷️  isFeaturedManual: ${offer.isFeaturedManual || false}`);
            console.log(`   🤖 isFeaturedAuto: ${offer.isFeaturedAuto || false}`);
            console.log('');
        });

        // Get all active offers
        console.log('='.repeat(80));
        console.log('ALL ACTIVE OFFERS:');
        console.log('='.repeat(80), '\n');

        const allActiveOffers = await Offer.find({
            status: 'active',
            isActive: true,
            availableFrom: { $lte: now },
            availableUntil: { $gte: now }
        })
        .select('title availableFrom availableUntil isFeaturedManual isFeaturedAuto')
        .sort({ availableUntil: 1 })
        .limit(20)
        .lean();

        console.log(`Found ${allActiveOffers.length} active offers:\n`);

        allActiveOffers.forEach((offer, index) => {
            const hoursRemaining = (new Date(offer.availableUntil) - now) / (1000 * 60 * 60);
            console.log(`${index + 1}. ${offer.title}`);
            console.log(`   ⏱️  Hours Remaining: ${hoursRemaining.toFixed(2)} hours`);
            console.log(`   🏷️  isFeaturedManual: ${offer.isFeaturedManual || false}`);
            console.log(`   🤖 isFeaturedAuto: ${offer.isFeaturedAuto || false}`);

            if (offer.isFeaturedManual || offer.isFeaturedAuto) {
                console.log(`   ⭐ This offer IS in the "Urgent Deals" section`);
            }
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

checkOffers();
