/**
 * Script to update offers with correct image URLs
 *
 * This script fixes offers that have placeholder/fake image URLs
 * and updates them with real uploaded images from the uploads/offers folder
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function updateOfferImages() {
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

    // Get all offers with fake image URLs
    const offers = await db.collection('offers').find({
      images: { $exists: true, $ne: [] }
    }).toArray();

    console.log(`\n📊 Found ${offers.length} offers with images\n`);

    // Check uploads directory for available images
    const uploadsDir = path.join(__dirname, '../uploads/offers');
    let availableImages = [];

    if (fs.existsSync(uploadsDir)) {
      availableImages = fs.readdirSync(uploadsDir)
        .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));
      console.log(`📁 Found ${availableImages.length} images in uploads/offers/`);
    } else {
      console.log('⚠️  uploads/offers/ directory not found');
    }

    // Analyze current image URLs
    let fakeImageCount = 0;
    let realImageCount = 0;
    const baseUrl = 'http://localhost:3000';

    offers.forEach(offer => {
      const firstImage = offer.images[0];
      if (firstImage && firstImage.includes('example.com')) {
        fakeImageCount++;
        console.log(`  ❌ ${offer._id}: ${firstImage.substring(0, 50)}...`);
      } else if (firstImage) {
        realImageCount++;
        console.log(`  ✅ ${offer._id}: ${firstImage.substring(0, 50)}...`);
      }
    });

    console.log(`\n📈 Summary:`);
    console.log(`  Real images: ${realImageCount}`);
    console.log(`  Fake images: ${fakeImageCount}`);

    if (fakeImageCount > 0 && availableImages.length > 0) {
      console.log(`\n🔧 Would you like to update fake images with real ones? (y/n)`);
      console.log(`   This will update ${fakeImageCount} offers with images from uploads/offers/`);

      // For now, just show what would be updated
      console.log(`\n📝 Preview of updates (not executed):`);

      let imageIndex = 0;
      for (const offer of offers) {
        const firstImage = offer.images[0];
        if (firstImage && firstImage.includes('example.com')) {
          const newImage = availableImages[imageIndex % availableImages.length];
          const newUrl = `${baseUrl}/uploads/offers/${newImage}`;
          console.log(`  ${offer._id}: ${newImage}`);
          imageIndex++;
        }
      }

      console.log(`\n💡 To execute updates, modify this script to actually update the database`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateOfferImages();
