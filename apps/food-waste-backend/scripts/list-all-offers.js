/**
 * List all offers in the database
 * Run with: node scripts/list-all-offers.js
 */

const { MongoClient } = require('mongodb');

// MongoDB Atlas connection string
const DATABASE_URL = 'mongodb+srv://foodwaste_user:a3yoNUPRgksQvUnZ@cluster0.61uimdv.mongodb.net/foodwaste?retryWrites=true&w=majority&appName=Cluster0&compressors=none';

async function listAllOffers() {
  const client = new MongoClient(DATABASE_URL);

  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    const offersCollection = db.collection('offers');

    console.log('📊 Counting offers...');
    const count = await offersCollection.countDocuments();
    console.log(`Total offers in database: ${count}\n`);

    if (count === 0) {
      console.log('❌ No offers found in database!');
      console.log('\n💡 You need to create an offer first.');
      console.log('   Options:');
      console.log('   1. Use the backend API: POST /api/v1/offers');
      console.log('   2. Run: node scripts/create-test-offer.js');
      console.log('   3. Add manually via MongoDB Atlas UI');
      return;
    }

    console.log('📋 All Offers:');
    console.log('═'.repeat(80));

    const offers = await offersCollection.find({}).limit(20).toArray();

    offers.forEach((offer, index) => {
      console.log(`\n${index + 1}. ${offer.title || 'Untitled'}`);
      console.log(`   ID: ${offer._id}`);
      console.log(`   Type: ${offer.type || 'N/A'}`);
      console.log(`   Status: ${offer.status || 'N/A'}`);

      if (offer.pricing) {
        console.log(`   Price: ${offer.pricing.discountedPrice || 'N/A'} ${offer.pricing.currency || 'EUR'} (was ${offer.pricing.originalPrice || 'N/A'})`);
        console.log(`   Discount: ${offer.pricing.discountPercentage || 0}%`);
      } else {
        console.log(`   ⚠️  NO PRICING DATA`);
      }

      console.log(`   Quantity: ${offer.totalQuantity || 0} total, ${(offer.totalQuantity || 0) - (offer.reservedQuantity || 0) - (offer.soldQuantity || 0)} available`);
      console.log(`   Created: ${offer.createdAt || 'N/A'}`);
    });

    console.log('\n═'.repeat(80));
    console.log(`\n📝 Showing ${Math.min(count, 20)} of ${count} total offers`);

    if (count > 0) {
      console.log(`\n💡 To use an offer in your mobile app, copy one of the IDs above`);
      console.log(`   and use it in the HomeScreen test button.`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

listAllOffers().catch(console.error);
