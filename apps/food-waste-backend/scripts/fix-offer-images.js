/**
 * Fix Offer Image URLs Script
 *
 * This script fixes two types of image URL issues:
 * 1. Replaces localhost URLs with 10.0.2.2 (for Android emulator)
 * 2. Replaces fake example.com URLs with real uploaded images
 *
 * Usage:
 *   node scripts/fix-offer-images.js
 *
 * Environment Required:
 *   DATABASE_URL - MongoDB connection string (from .env)
 *   BACKEND_URL - Current backend URL (from .env)
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function fixOfferImages() {
  try {
    // Read environment variables from .env
    const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
    const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
    const backendUrlMatch = envContent.match(/^BACKEND_URL=(.+)$/m);

    const dbUrl = dbUrlMatch ? dbUrlMatch[1].trim() : null;
    const backendUrl = backendUrlMatch ? backendUrlMatch[1].trim() : 'http://10.0.2.2:3000';

    if (!dbUrl) {
      console.error('❌ Error: DATABASE_URL not found in .env file');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(70));
    console.log('🔧 Fix Offer Image URLs Script');
    console.log('='.repeat(70));
    console.log(`📡 Connecting to database...`);
    console.log(`🌐 Backend URL: ${backendUrl}\n`);

    await mongoose.connect(dbUrl);
    const db = mongoose.connection.db;

    // ========================================================================
    // TASK 1: Fix localhost URLs → 10.0.2.2 (Android Emulator)
    // ========================================================================
    console.log('━'.repeat(70));
    console.log('📋 TASK 1: Fix localhost URLs → 10.0.2.2');
    console.log('━'.repeat(70));

    const offersWithLocalhost = await db.collection('offers').find({
      images: { $elemMatch: { $regex: 'http://localhost:3000' } }
    }).toArray();

    console.log(`🔍 Found ${offersWithLocalhost.length} offers with localhost URLs\n`);

    let localhostFixed = 0;
    if (offersWithLocalhost.length > 0) {
      for (const offer of offersWithLocalhost) {
        const oldImages = [...offer.images];
        const newImages = offer.images.map(url =>
          url.replace('http://localhost:3000', backendUrl)
        );

        await db.collection('offers').updateOne(
          { _id: offer._id },
          { $set: { images: newImages } }
        );

        console.log(`✅ ${offer.title || 'Untitled'}`);
        console.log(`   Before: ${oldImages[0]}`);
        console.log(`   After:  ${newImages[0]}\n`);
        localhostFixed++;
      }
    } else {
      console.log('✅ No localhost URLs found. All offers already use correct base URL.\n');
    }

    // ========================================================================
    // TASK 2: Fix fake example.com URLs → Real uploaded images
    // ========================================================================
    console.log('━'.repeat(70));
    console.log('📋 TASK 2: Fix fake example.com URLs → Real images');
    console.log('━'.repeat(70));

    const availableImages = [
      'social_1767953906903_8534e4fa.jpeg',
      'social_1767953944919_10bc87c4.jpeg',
      'social_1767954391439_53daefe5.jpeg',
      'social_1767954419395_9b62e7bd.jpeg',
      'social_1767954784979_fe62bf56.jpeg',
      'tunisie_1767965377936_6c9817a4.jpeg',
    ];

    const offersWithFakeUrls = await db.collection('offers').find({
      images: { $elemMatch: { $regex: 'example.com' } }
    }).toArray();

    console.log(`🔍 Found ${offersWithFakeUrls.length} offers with fake URLs\n`);

    let fakeUrlsFixed = 0;
    for (let i = 0; i < offersWithFakeUrls.length; i++) {
      const offer = offersWithFakeUrls[i];
      const newImage = availableImages[i % availableImages.length];
      const newImageUrl = `${backendUrl}/uploads/offers/${newImage}`;

      await db.collection('offers').updateOne(
        { _id: offer._id },
        { $set: { images: [newImageUrl] } }
      );

      console.log(`✅ ${offer.title || 'Untitled'}`);
      console.log(`   New image: ${newImage}\n`);
      fakeUrlsFixed++;
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('━'.repeat(70));
    console.log('📊 SUMMARY');
    console.log('━'.repeat(70));
    console.log(`✅ Localhost URLs fixed: ${localhostFixed}`);
    console.log(`✅ Fake URLs fixed: ${fakeUrlsFixed}`);
    console.log(`📈 Total offers updated: ${localhostFixed + fakeUrlsFixed}`);
    console.log('━'.repeat(70) + '\n');

    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
fixOfferImages();
