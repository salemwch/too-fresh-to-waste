/**
 * Quick script to check if offer exists and what data it has
 * Run with: node scripts/check-offer.js
 */

const { MongoClient } = require('mongodb');

const OFFER_ID = '69507a5fc209cc6502ff92f0';

// MongoDB Atlas connection string - from your .env file
const DATABASE_URL = 'mongodb+srv://foodwaste_user:a3yoNUPRgksQvUnZ@cluster0.61uimdv.mongodb.net/foodwaste?retryWrites=true&w=majority&appName=Cluster0&compressors=none';

async function checkOffer() {
  const client = new MongoClient(DATABASE_URL);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    const offersCollection = db.collection('offers');

    console.log(`🔍 Looking for offer with ID: ${OFFER_ID}\n`);

    const offer = await offersCollection.findOne({ _id: OFFER_ID });

    if (!offer) {
      console.log('❌ Offer NOT found in database!');
      console.log('\n💡 Try creating an offer first or check if the ID is correct.');
      return;
    }

    console.log('✅ Offer found!\n');
    console.log('📋 Offer Details:');
    console.log('─'.repeat(60));
    console.log(`ID: ${offer._id}`);
    console.log(`Title: ${offer.title || 'N/A'}`);
    console.log(`Type: ${offer.type || 'N/A'}`);
    console.log(`Status: ${offer.status || 'N/A'}`);
    console.log('\n💰 Pricing:');
    if (offer.pricing) {
      console.log(`  Original Price: ${offer.pricing.originalPrice || 'N/A'} ${offer.pricing.currency || 'N/A'}`);
      console.log(`  Discounted Price: ${offer.pricing.discountedPrice || 'N/A'} ${offer.pricing.currency || 'N/A'}`);
      console.log(`  Discount: ${offer.pricing.discountPercentage || 'N/A'}%`);
    } else {
      console.log('  ⚠️  NO PRICING DATA - This is the problem!');
    }

    console.log('\n📦 Quantity:');
    console.log(`  Total: ${offer.totalQuantity || 'N/A'}`);
    console.log(`  Reserved: ${offer.reservedQuantity || 0}`);
    console.log(`  Sold: ${offer.soldQuantity || 0}`);
    console.log(`  Available: ${(offer.totalQuantity || 0) - (offer.reservedQuantity || 0) - (offer.soldQuantity || 0)}`);

    console.log('\n📅 Availability:');
    console.log(`  From: ${offer.availableFrom || 'N/A'}`);
    console.log(`  Until: ${offer.availableUntil || 'N/A'}`);

    console.log('\n🖼️  Images:');
    console.log(`  Count: ${offer.images?.length || 0}`);
    if (offer.images?.length > 0) {
      offer.images.forEach((img, i) => console.log(`  ${i + 1}. ${img}`));
    }

    console.log('\n🏢 Related IDs:');
    console.log(`  Establishment ID: ${offer.establishmentId || 'N/A'}`);
    console.log(`  Merchant ID: ${offer.merchantId || 'N/A'}`);

    console.log('\n📄 Full Offer Object (first 500 chars):');
    console.log(JSON.stringify(offer, null, 2).substring(0, 500) + '...');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkOffer().catch(console.error);
