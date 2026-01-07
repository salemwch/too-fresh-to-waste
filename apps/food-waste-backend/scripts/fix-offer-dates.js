/**
 * Fix offer availability dates to make it active
 * Run with: node scripts/fix-offer-dates.js
 */

const { MongoClient, ObjectId } = require('mongodb');

const OFFER_ID = '69507a5fc209cc6502ff92f0';
const DATABASE_URL = 'mongodb+srv://foodwaste_user:a3yoNUPRgksQvUnZ@cluster0.61uimdv.mongodb.net/foodwaste?retryWrites=true&w=majority&appName=Cluster0&compressors=none';

async function fixOfferDates() {
  const client = new MongoClient(DATABASE_URL);

  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected\n');

    const db = client.db();
    const offersCollection = db.collection('offers');

    console.log(`🔍 Looking for offer: ${OFFER_ID}\n`);

    const offer = await offersCollection.findOne({ _id: new ObjectId(OFFER_ID) });

    if (!offer) {
      console.log('❌ Offer not found!');
      return;
    }

    console.log(`📋 Current offer: "${offer.title}"`);
    console.log(`   Status: ${offer.status}`);
    console.log(`   Available from: ${offer.availableFrom}`);
    console.log(`   Available until: ${offer.availableUntil}`);
    console.log(`   Is Active: ${offer.isActive}`);
    console.log(`   Is Featured: ${offer.isFeatured}\n`);

    // Set dates for the next 7 days
    const now = new Date();
    const availableFrom = new Date(now);
    availableFrom.setHours(now.getHours() - 1); // Started 1 hour ago

    const availableUntil = new Date(now);
    availableUntil.setDate(now.getDate() + 7); // Available for next 7 days

    console.log('🔄 Updating offer to be active with new dates...');
    console.log(`   New available from: ${availableFrom}`);
    console.log(`   New available until: ${availableUntil}\n`);

    const result = await offersCollection.updateOne(
      { _id: new ObjectId(OFFER_ID) },
      {
        $set: {
          status: 'active',
          isActive: true,
          isFeatured: true,
          availableFrom: availableFrom,
          availableUntil: availableUntil,
          publishedAt: now,
          updatedAt: now,
          expiredAt: null
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Offer updated successfully!');
      console.log('\n🎉 Offer is now:');
      console.log('   ✓ Active');
      console.log('   ✓ Featured');
      console.log('   ✓ Available for the next 7 days');
      console.log(`\n📱 You can now see this offer in the featured carousel!`);
      console.log(`   Offer ID: ${OFFER_ID}`);
    } else {
      console.log('⚠️  Offer was not updated');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixOfferDates().catch(console.error);
