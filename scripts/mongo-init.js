// ============================================
// MongoDB Initialization Script
// ============================================
//
// This script runs during MongoDB container initialization
// Creates the application database and user with proper permissions
//
// Credentials come from the environment, never from source. The container
// receives MONGO_APP_USERNAME / MONGO_APP_PASSWORD from docker-compose, which
// reads them from the repo-root .env (see .env.example). A missing value is a
// hard failure: inventing a default here is how `foodwaste_user` /
// `foodwaste_password` ended up committed, and a weak default that works is
// far more dangerous than a startup error that does not.
// ============================================

const appUsername = process.env.MONGO_APP_USERNAME;
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!appUsername || !appPassword) {
  throw new Error(
    'mongo-init: MONGO_APP_USERNAME and MONGO_APP_PASSWORD must both be set. ' +
      'Copy .env.example to .env at the repository root and fill them in. ' +
      'Refusing to create a database user with a default password.',
  );
}

db = db.getSiblingDB('foodwaste');

// Create application user
db.createUser({
  user: appUsername,
  pwd: appPassword,
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
