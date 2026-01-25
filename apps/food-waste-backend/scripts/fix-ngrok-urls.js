/**
 * Fix Ngrok URLs in Database
 * Replaces all ngrok URLs with localhost URLs in offer images
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function fixNgrokUrls() {
  try {
    // Read DATABASE_URL from .env
    const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
    const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
    const dbUrl = dbUrlMatch ? dbUrlMatch[1].trim() : null;

    if (!dbUrl) {
      console.error('❌ DATABASE_URL not found in .env');
      process.exit(1);
    }

    console.log('📡 Connecting to database...');
    await mongoose.connect(dbUrl);
    const db = mongoose.connection.db;

    // Find all offers with ngrok URLs
    const offers = await db.collection('offers').find({
      images: { $regex: 'intermixedly-unwrought-genie.ngrok-free.dev' }
    }).toArray();

    console.log(`\n🔍 Found ${offers.length} offers with ngrok URLs\n`);

    if (offers.length === 0) {
      console.log('✅ No offers need updating');
      await mongoose.disconnect();
      return;
    }

    let updated = 0;
    for (const offer of offers) {
      // Replace ngrok URL with localhost
      const updatedImages = offer.images.map(url =>
        url.replace(
          'https://intermixedly-unwrought-genie.ngrok-free.dev',
          'http://localhost:3000'
        )
      );

      await db.collection('offers').updateOne(
        { _id: offer._id },
        { $set: { images: updatedImages } }
      );

      console.log(`  ✅ Updated offer: ${offer._id}`);
      console.log(`     Old: ${offer.images[0]}`);
      console.log(`     New: ${updatedImages[0]}\n`);
      updated++;
    }

    console.log(`✅ Successfully updated ${updated} offers`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixNgrokUrls();
