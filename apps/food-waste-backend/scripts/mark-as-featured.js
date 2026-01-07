/**
 * Mark offer as featured
 * Run with: node scripts/mark-as-featured.js
 */

const { MongoClient, ObjectId } = require('mongodb');

const OFFER_ID = '69507a5fc209cc6502ff92f0';
const DATABASE_URL = 'mongodb+srv://foodwaste_user:a3yoNUPRgksQvUnZ@cluster0.61uimdv.mongodb.net/foodwaste?retryWrites=true&w=majority&appName=Cluster0&compressors=none';

async function markAsFeatured() {
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
    console.log(`   Featured: ${offer.isFeatured || false}\n`);

    if (offer.isFeatured) {
      console.log('✅ Offer is already featured!');
      return;
    }

    console.log('🔄 Marking offer as featured...');

    const result = await offersCollection.updateOne(
      { _id: new ObjectId(OFFER_ID) },
      {
        $set: {
          isFeatured: true,
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Offer marked as featured successfully!');
      console.log('\n⭐ This offer will now appear in featured offers carousel!');
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

markAsFeatured().catch(console.error);
