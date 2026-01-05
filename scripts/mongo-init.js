// ============================================
// MongoDB Initialization Script
// ============================================
//
// This script runs during MongoDB container initialization
// Creates the application database and user with proper permissions
// ============================================

db = db.getSiblingDB('foodwaste');

// Create application user
db.createUser({
  user: 'foodwaste_user',
  pwd: 'foodwaste_password',
  roles: [
    {
      role: 'readWrite',
      db: 'foodwaste',
    },
    {
      role: 'dbAdmin',
      db: 'foodwaste',
    },
  ],
});

// Create collections
db.createCollection('users');
db.createCollection('establishments');
db.createCollection('offers');
db.createCollection('orders');
db.createCollection('reviews');

// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ phoneNumber: 1 }, { unique: true, sparse: true });
db.users.createIndex({ 'location.coordinates': '2dsphere' });

db.establishments.createIndex({ ownerId: 1 });
db.establishments.createIndex({ 'location.coordinates': '2dsphere' });
db.establishments.createIndex({ isActive: 1 });

db.offers.createIndex({ establishmentId: 1 });
db.offers.createIndex({ status: 1 });
db.offers.createIndex({ expiresAt: 1 });

db.orders.createIndex({ userId: 1 });
db.orders.createIndex({ establishmentId: 1 });
db.orders.createIndex({ status: 1 });
db.orders.createIndex({ createdAt: -1 });

db.reviews.createIndex({ establishmentId: 1 });
db.reviews.createIndex({ userId: 1 });
db.reviews.createIndex({ orderId: 1 }, { unique: true });

print('MongoDB initialization completed successfully');
