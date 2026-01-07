/**
 * Create a test offer for mobile app testing
 * Run with: node scripts/create-test-offer.js
 */

const { MongoClient, ObjectId } = require('mongodb');

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/food-waste-db';
const OFFER_ID = '69507a5fc209cc6502ff92f0'; // Your specific ID

async function createTestOffer() {
  const client = new MongoClient(DATABASE_URL);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    const offersCollection = db.collection('offers');

    // Check if offer already exists
    const existing = await offersCollection.findOne({ _id: OFFER_ID });
    if (existing) {
      console.log('ℹ️  Offer already exists with this ID. Deleting first...');
      await offersCollection.deleteOne({ _id: OFFER_ID });
    }

    // Create dummy establishment and merchant IDs (you can replace with real ones)
    const testEstablishmentId = new ObjectId();
    const testMerchantId = new ObjectId();

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const testOffer = {
      _id: OFFER_ID,
      title: 'Fresh Bakery Surprise Bag',
      description: 'Delicious pastries and bread from today\'s batch. Perfect for breakfast or snacks! Contains a variety of baked goods including croissants, baguettes, and sweet pastries.',
      establishmentId: testEstablishmentId,
      merchantId: testMerchantId,
      type: 'surprise_bag',
      status: 'active',
      pricing: {
        originalPrice: 15.00,
        discountedPrice: 5.99,
        discountPercentage: 60,
        currency: 'EUR'
      },
      totalQuantity: 10,
      reservedQuantity: 2,
      soldQuantity: 3,
      images: [
        'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
        'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
        'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=800'
      ],
      categories: ['Bakery', 'Breakfast', 'Pastries'],
      tags: ['fresh', 'daily', 'surprise-bag', 'bakery'],
      nutritionalInfo: {
        calories: 450,
        protein: 12,
        carbs: 65,
        fat: 18,
        allergens: ['Gluten', 'Eggs', 'Milk'],
        dietaryInfo: ['vegetarian']
      },
      availableFrom: tomorrow,
      availableUntil: nextWeek,
      pickupTimeSlots: [
        {
          startTime: '17:00',
          endTime: '18:00',
          maxOrders: 5,
          currentOrders: 2
        },
        {
          startTime: '18:00',
          endTime: '19:00',
          maxOrders: 5,
          currentOrders: 1
        }
      ],
      estimatedWeight: '1.5 kg',
      viewCount: 42,
      favoriteCount: 8,
      isActive: true,
      isFeatured: true,
      isRecurring: false,
      specialInstructions: 'Please bring your own bag. Pickup at the back entrance.',
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    };

    console.log('✨ Creating test offer...\n');
    const result = await offersCollection.insertOne(testOffer);

    console.log('✅ Test offer created successfully!\n');
    console.log('📋 Offer Details:');
    console.log('─'.repeat(60));
    console.log(`ID: ${OFFER_ID}`);
    console.log(`Title: ${testOffer.title}`);
    console.log(`Type: ${testOffer.type}`);
    console.log(`Status: ${testOffer.status}`);
    console.log(`\nPricing:`);
    console.log(`  Original: €${testOffer.pricing.originalPrice}`);
    console.log(`  Discounted: €${testOffer.pricing.discountedPrice}`);
    console.log(`  Discount: ${testOffer.pricing.discountPercentage}%`);
    console.log(`\nQuantity:`);
    console.log(`  Total: ${testOffer.totalQuantity}`);
    console.log(`  Available: ${testOffer.totalQuantity - testOffer.reservedQuantity - testOffer.soldQuantity}`);
    console.log(`\nImages: ${testOffer.images.length}`);
    console.log(`Categories: ${testOffer.categories.join(', ')}`);
    console.log(`Tags: ${testOffer.tags.join(', ')}`);
    console.log(`\n🎉 You can now test this offer in your mobile app!`);
    console.log(`📱 Use offer ID: ${OFFER_ID}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

createTestOffer().catch(console.error);
