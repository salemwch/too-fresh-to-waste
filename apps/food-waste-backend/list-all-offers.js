const mongoose = require('mongoose');
const fs = require('fs');

async function checkOffers() {
  try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
    const dbUrl = dbUrlMatch[1].trim();

    await mongoose.connect(dbUrl);
    const db = mongoose.connection.db;

    const allOffers = await db.collection('offers').find({}).toArray();
    console.log(`\n📊 Total offers: ${allOffers.length}\n`);

    // Group by title and pricing
    const grouped = {};
    allOffers.forEach(offer => {
      const key = `${offer.title} | ${offer.pricing.originalPrice}→${offer.pricing.discountedPrice} TND`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(offer);
    });

    console.log('📋 Offers grouped by title and pricing:\n');
    Object.entries(grouped).forEach(([key, offers]) => {
      console.log(`  "${key}"`);
      console.log(`    Count: ${offers.length}`);
      console.log(`    IDs: ${offers.map(o => o._id.toString().slice(-6)).join(', ')}`);
      console.log(`    Available quantities: ${offers.map(o => o.totalQuantity - o.soldQuantity - o.reservedQuantity).join(', ')}`);
      console.log(`    Establishments: ${offers.map(o => o.establishmentId?.toString().slice(-6) || 'N/A').join(', ')}`);
      console.log();
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkOffers();
