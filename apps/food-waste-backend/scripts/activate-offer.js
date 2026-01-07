/**
 * Activate the test offer (change status from draft to active)
 * Run with: node scripts/activate-offer.js
 */

const { MongoClient, ObjectId } = require('mongodb');

const OFFER_ID = '69507a5fc209cc6502ff92f0';
const DATABASE_URL = 'mongodb+srv://foodwaste_user:a3yoNUPRgksQvUnZ@cluster0.61uimdv.mongodb.net/foodwaste?retryWrites=true&w=majority&appName=Cluster0&compressors=none';

async function activateOffer() {
  const client = new MongoClient(DATABASE_URL);

  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected\n');

    const db = client.db();
    const offersCollection = db.collection('offers');

    console.log(`🔍 Looking for offer: ${OFFER_ID}\n`);

    // Try with string first, then ObjectId
    let offer = await offersCollection.findOne({ _id: OFFER_ID });

    if (!offer && ObjectId.isValid(OFFER_ID)) {
      console.log('Trying with ObjectId format...');
      offer = await offersCollection.findOne({ _id: new ObjectId(OFFER_ID) });
    }

    if (!offer) {
      console.log('❌ Offer not found!');
      return;
    }

    console.log(`📋 Current offer: "${offer.title}"`);
    console.log(`   Status: ${offer.status}\n`);

    if (offer.status === 'active') {
      console.log('✅ Offer is already active!');
      return;
    }

    console.log('🔄 Updating offer status to "active"...');

    const now = new Date();
    const result = await offersCollection.updateOne(
      { _id: new ObjectId(OFFER_ID) },  // Use ObjectId format
      {
        $set: {
          status: 'active',
          isActive: true,
          publishedAt: now,
          updatedAt: now
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Offer activated successfully!');
      console.log('\n📱 You can now view this offer in your mobile app!');
      console.log(`   Offer ID: ${OFFER_ID}`);
    } else {
      console.log('⚠️  Offer was not updated (maybe it was already active?)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

activateOffer().catch(console.error);
