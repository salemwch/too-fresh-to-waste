/**
 * Diagnostic Script: Hottest Deals Troubleshooting
 *
 * Checks why an 80% discount offer is not appearing in "Hottest Deals"
 *
 * Usage: node scripts/diagnose-hottest-deals.js
 */

const { MongoClient, ObjectId } = require('mongodb');

const OFFER_ID = '696e5eb281e3e14a846b60fd';
const ESTABLISHMENT_ID = '696277a0bc2ec114a9585c65';

// Test user coordinates (example - Tunis center)
const USER_COORDS = {
  latitude: 36.8065,
  longitude: 10.1815
};

// Get connection string from environment or use default
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/food-waste-db';

async function diagnose() {
  console.log('Connecting to:', DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
  const client = new MongoClient(DATABASE_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    const offersCollection = db.collection('offers');
    const establishmentsCollection = db.collection('establishments');

    // ========================================================================
    // 1. CHECK OFFER
    // ========================================================================
    console.log('🔍 STEP 1: Checking Offer\n');
    console.log('=' .repeat(70));

    const offer = await offersCollection.findOne(
      { _id: new ObjectId(OFFER_ID) },
      {
        projection: {
          title: 1,
          status: 1,
          isActive: 1,
          'pricing.discountPercentage': 1,
          'pricing.originalPrice': 1,
          'pricing.discountedPrice': 1,
          availableFrom: 1,
          availableUntil: 1,
          totalQuantity: 1,
          reservedQuantity: 1,
          soldQuantity: 1,
          establishmentId: 1,
          isDeleted: 1
        }
      }
    );

    if (!offer) {
      console.log('❌ Offer not found!');
      return;
    }

    const now = new Date();
    const availableQuantity = offer.totalQuantity - offer.reservedQuantity - offer.soldQuantity;

    console.log('Offer Details:');
    console.log(`  Title: ${offer.title}`);
    console.log(`  Status: ${offer.status}`);
    console.log(`  isActive: ${offer.isActive}`);
    console.log(`  Discount: ${offer.pricing.discountPercentage}%`);
    console.log(`  Price: ${offer.pricing.originalPrice} → ${offer.pricing.discountedPrice} TND`);
    console.log(`  Available Quantity: ${availableQuantity}`);
    console.log(`  isDeleted: ${offer.isDeleted}`);
    console.log(`\n  availableFrom: ${offer.availableFrom.toISOString()}`);
    console.log(`  availableUntil: ${offer.availableUntil.toISOString()}`);
    console.log(`  Current time:   ${now.toISOString()}`);
    console.log(`\n  Time window valid: ${offer.availableFrom <= now && offer.availableUntil >= now ? '✅' : '❌'}`);
    console.log(`  Minutes remaining: ${Math.round((offer.availableUntil - now) / 60000)}`);

    console.log('\n✅ Offer Filter Checks:');
    console.log(`  status === 'active': ${offer.status === 'active' ? '✅' : '❌'}`);
    console.log(`  isActive === true: ${offer.isActive === true ? '✅' : '❌'}`);
    console.log(`  discountPercentage >= 70: ${offer.pricing.discountPercentage >= 70 ? '✅' : '❌'}`);
    console.log(`  availableFrom <= now: ${offer.availableFrom <= now ? '✅' : '❌'}`);
    console.log(`  availableUntil >= now: ${offer.availableUntil >= now ? '✅' : '❌'}`);
    console.log(`  availableQuantity > 0: ${availableQuantity > 0 ? '✅' : '❌'}`);
    console.log(`  isDeleted !== true: ${offer.isDeleted !== true ? '✅' : '❌'}`);

    // ========================================================================
    // 2. CHECK ESTABLISHMENT
    // ========================================================================
    console.log('\n\n🔍 STEP 2: Checking Establishment\n');
    console.log('=' .repeat(70));

    const establishment = await establishmentsCollection.findOne(
      { _id: offer.establishmentId },
      {
        projection: {
          name: 1,
          'address.coordinates': 1,
          'address.city': 1,
          'address.street': 1,
          isActive: 1,
          isDeleted: 1
        }
      }
    );

    if (!establishment) {
      console.log('❌ Establishment not found!');
      return;
    }

    console.log('Establishment Details:');
    console.log(`  Name: ${establishment.name}`);
    console.log(`  City: ${establishment.address?.city || 'N/A'}`);
    console.log(`  Street: ${establishment.address?.street || 'N/A'}`);
    console.log(`  isActive: ${establishment.isActive}`);
    console.log(`  isDeleted: ${establishment.isDeleted}`);

    const hasCoordinates = establishment.address?.coordinates?.coordinates?.length === 2;
    console.log(`\n  Has coordinates: ${hasCoordinates ? '✅' : '❌'}`);

    if (hasCoordinates) {
      const [lng, lat] = establishment.address.coordinates.coordinates;
      console.log(`  Coordinates: [${lng}, ${lat}] (lng, lat)`);
      console.log(`  Type: ${establishment.address.coordinates.type}`);

      // Calculate distance from user
      const distance = calculateDistance(
        USER_COORDS.latitude,
        USER_COORDS.longitude,
        lat,
        lng
      );

      console.log(`\n🗺️  Distance from user (${USER_COORDS.latitude}, ${USER_COORDS.longitude}):`);
      console.log(`  Distance: ${distance.toFixed(0)} meters (${(distance / 1000).toFixed(2)} km)`);
      console.log(`  Within 5km range: ${distance <= 5000 ? '✅' : '❌'}`);

      if (distance > 5000) {
        console.log(`\n⚠️  WARNING: Establishment is ${(distance / 1000).toFixed(2)}km away!`);
        console.log('  This exceeds the default maxDistance of 5km.');
        console.log('  The offer will NOT appear when user location is enabled.');
      }
    } else {
      console.log('\n❌ CRITICAL: Establishment has no coordinates!');
      console.log('  The offer will NOT appear in geolocation-based queries.');
      console.log('  Set coordinates at: address.coordinates.coordinates = [longitude, latitude]');
    }

    // ========================================================================
    // 3. TEST QUERY WITHOUT GEOLOCATION
    // ========================================================================
    console.log('\n\n🔍 STEP 3: Testing MongoDB Query (NO geolocation)\n');
    console.log('=' .repeat(70));

    const queryNoGeo = {
      status: 'active',
      isActive: true,
      'pricing.discountPercentage': { $gte: 70 },
      availableFrom: { $lte: now },
      availableUntil: { $gte: now }
    };

    console.log('Query:', JSON.stringify(queryNoGeo, null, 2));

    const matchingOffers = await offersCollection.find(queryNoGeo).limit(10).toArray();
    console.log(`\n✅ Found ${matchingOffers.length} offers matching "Hottest Deals" filter`);

    const ourOfferInResults = matchingOffers.some(o => o._id.toString() === OFFER_ID);
    console.log(`Your offer (80% discount) in results: ${ourOfferInResults ? '✅ YES' : '❌ NO'}`);

    if (matchingOffers.length > 0) {
      console.log('\nTop 5 Results:');
      matchingOffers.slice(0, 5).forEach((o, i) => {
        console.log(`  ${i + 1}. ${o.title} - ${o.pricing.discountPercentage}% off`);
      });
    }

    // ========================================================================
    // 4. TEST QUERY WITH GEOLOCATION
    // ========================================================================
    if (hasCoordinates) {
      console.log('\n\n🔍 STEP 4: Testing MongoDB Query (WITH geolocation)\n');
      console.log('=' .repeat(70));

      console.log(`User location: [${USER_COORDS.longitude}, ${USER_COORDS.latitude}]`);
      console.log('Max distance: 5000m (5km)\n');

      const pipeline = [
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [USER_COORDS.longitude, USER_COORDS.latitude]
            },
            distanceField: 'distance',
            maxDistance: 5000,
            spherical: true,
            key: 'address.coordinates',
            query: {
              isActive: true,
              isDeleted: { $ne: true }
            }
          }
        },
        {
          $lookup: {
            from: 'offers',
            let: { establishmentId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$establishmentId', '$$establishmentId'] },
                  status: 'active',
                  isActive: true,
                  'pricing.discountPercentage': { $gte: 70 },
                  availableFrom: { $lte: now },
                  availableUntil: { $gte: now }
                }
              }
            ],
            as: 'offers'
          }
        },
        { $unwind: '$offers' },
        {
          $project: {
            'offers.title': 1,
            'offers.pricing': 1,
            distance: 1,
            name: 1
          }
        },
        { $limit: 10 }
      ];

      const geoResults = await establishmentsCollection.aggregate(pipeline).toArray();

      console.log(`✅ Found ${geoResults.length} offers within 5km with 70%+ discount`);

      const ourOfferInGeoResults = geoResults.some(
        r => r.offers._id.toString() === OFFER_ID
      );
      console.log(`Your offer in results: ${ourOfferInGeoResults ? '✅ YES' : '❌ NO'}`);

      if (geoResults.length > 0) {
        console.log('\nTop Results:');
        geoResults.forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.offers.title} - ${r.offers.pricing.discountPercentage}% off (${(r.distance / 1000).toFixed(2)}km away)`);
        });
      }
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('\n\n📊 DIAGNOSIS SUMMARY\n');
    console.log('=' .repeat(70));

    const offerValid = offer.status === 'active' &&
                       offer.isActive &&
                       offer.pricing.discountPercentage >= 70 &&
                       offer.availableFrom <= now &&
                       offer.availableUntil >= now &&
                       availableQuantity > 0;

    if (offerValid) {
      console.log('✅ Offer meets all "Hottest Deals" criteria');

      if (!hasCoordinates) {
        console.log('❌ ISSUE: Establishment has NO coordinates');
        console.log('   → Offer will NOT appear when user has location enabled');
        console.log('   → FIX: Add coordinates to establishment document');
      } else {
        const [lng, lat] = establishment.address.coordinates.coordinates;
        const distance = calculateDistance(
          USER_COORDS.latitude,
          USER_COORDS.longitude,
          lat,
          lng
        );

        if (distance > 5000) {
          console.log(`❌ ISSUE: Establishment is ${(distance / 1000).toFixed(2)}km away (exceeds 5km limit)`);
          console.log('   → Offer will NOT appear for this user location');
          console.log('   → User needs to be closer OR increase maxDistance');
        } else {
          console.log('✅ Establishment is within range');
          console.log('   → Offer SHOULD appear in "Hottest Deals"');
          console.log('   → Check frontend: is user location set correctly?');
          console.log('   → Check API response in network tab');
        }
      }
    } else {
      console.log('❌ Offer does NOT meet criteria:');
      if (offer.status !== 'active') console.log(`   → status: ${offer.status} (expected: active)`);
      if (!offer.isActive) console.log('   → isActive: false');
      if (offer.pricing.discountPercentage < 70) console.log(`   → discount: ${offer.pricing.discountPercentage}% (min: 70%)`);
      if (offer.availableFrom > now) console.log('   → Not yet available');
      if (offer.availableUntil < now) console.log('   → Expired');
      if (availableQuantity <= 0) console.log('   → Sold out');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Run diagnosis
diagnose().catch(console.error);
