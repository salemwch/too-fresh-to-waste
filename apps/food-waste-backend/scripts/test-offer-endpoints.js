/**
 * Test script to compare responses from featured offers vs getAllOffers
 * Run with: node scripts/test-offer-endpoints.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1/offers';

async function testEndpoints() {
  console.log('========================================');
  console.log('🧪 TESTING OFFER ENDPOINTS');
  console.log('========================================\n');

  try {
    // Test 1: Featured Offers (Urgent Deals)
    console.log('1️⃣ Testing /offers/featured...');
    const featuredResponse = await axios.get(`${BASE_URL}/featured?limit=2`);
    const featuredOffer = featuredResponse.data.data[0];

    console.log('✅ Featured Offers Response:');
    console.log('   - Total offers:', featuredResponse.data.data.length);
    if (featuredOffer) {
      console.log('   - First offer ID:', featuredOffer.id);
      console.log('   - Establishment name:', featuredOffer.establishment?.name);
      console.log('   - Establishment profileImage:', featuredOffer.establishment?.profileImage || 'MISSING');
      console.log('   - Pickup time slots:', featuredOffer.pickupTimeSlots?.length || 0);
      if (featuredOffer.pickupTimeSlots?.[0]) {
        console.log('     First slot:', featuredOffer.pickupTimeSlots[0]);
      }
    }
    console.log();

    // Test 2: getAllOffers with minDiscount (Hottest Deals)
    console.log('2️⃣ Testing /offers?minDiscount=70...');
    const hottestResponse = await axios.get(`${BASE_URL}?minDiscount=70&limit=2`);
    const hottestOffer = hottestResponse.data.data[0];

    console.log('✅ Hottest Deals Response:');
    console.log('   - Total offers:', hottestResponse.data.data.length);
    if (hottestOffer) {
      console.log('   - First offer ID:', hottestOffer.id);
      console.log('   - Establishment name:', hottestOffer.establishment?.name);
      console.log('   - Establishment profileImage:', hottestOffer.establishment?.profileImage || 'MISSING');
      console.log('   - Pickup time slots:', hottestOffer.pickupTimeSlots?.length || 0);
      if (hottestOffer.pickupTimeSlots?.[0]) {
        console.log('     First slot:', hottestOffer.pickupTimeSlots[0]);
      }
    }
    console.log();

    // Compare
    console.log('========================================');
    console.log('📊 COMPARISON');
    console.log('========================================');
    if (featuredOffer && hottestOffer) {
      console.log('Featured has name:', !!featuredOffer.establishment?.name);
      console.log('Hottest has name:', !!hottestOffer.establishment?.name);
      console.log('Featured has profileImage:', !!featuredOffer.establishment?.profileImage);
      console.log('Hottest has profileImage:', !!hottestOffer.establishment?.profileImage);
      console.log('Featured has pickup slots:', featuredOffer.pickupTimeSlots?.length || 0);
      console.log('Hottest has pickup slots:', hottestOffer.pickupTimeSlots?.length || 0);
    }
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testEndpoints();
