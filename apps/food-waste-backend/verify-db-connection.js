const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load .env file manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;

        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    }
}

async function verifyConnection() {
    try {
        const dbUrl = process.env.DATABASE_URL;

        if (!dbUrl) {
            console.error('❌ ERROR: DATABASE_URL is not set in environment variables');
            process.exit(1);
        }

        // Mask credentials for logging
        const maskedUrl = dbUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
        console.log('\n📡 Attempting to connect to MongoDB...');
        console.log('🔗 Connection string:', maskedUrl);
        console.log('');

        // Connect to MongoDB
        await mongoose.connect(dbUrl);

        console.log('✅ Successfully connected to MongoDB!');
        console.log('');

        // Get database name
        const dbName = mongoose.connection.db.databaseName;
        console.log('📊 Database Name:', dbName);
        console.log('');

        // Get connection details
        const adminDb = mongoose.connection.db.admin();
        const serverStatus = await adminDb.serverStatus();

        console.log('🖥️  Server Info:');
        console.log('   - Host:', serverStatus.host);
        console.log('   - Version:', serverStatus.version);
        console.log('   - Uptime:', Math.floor(serverStatus.uptime / 60), 'minutes');
        console.log('');

        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📁 Collections in database "' + dbName + '":');

        if (collections.length === 0) {
            console.log('   ⚠️  No collections found (database is empty)');
        } else {
            for (const collection of collections) {
                const count = await mongoose.connection.db.collection(collection.name).countDocuments();
                console.log('   - ' + collection.name + ' (' + count + ' documents)');
            }
        }
        console.log('');

        // Check for users specifically
        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
        const userCount = await User.countDocuments();
        const verifiedUsers = await User.countDocuments({ isEmailVerified: true });

        console.log('👥 User Statistics:');
        console.log('   - Total users:', userCount);
        console.log('   - Verified users:', verifiedUsers);
        console.log('   - Unverified users:', userCount - verifiedUsers);
        console.log('');

        // Check for the specific emails mentioned
        const testEmails = [
            'salemwachwacha@outlook.fr',
            'vehibor519@mucate.com',
            'vehibor519@mucate546353.com'
        ];

        console.log('🔍 Checking for specific emails:');
        for (const email of testEmails) {
            const user = await User.findOne({
                email: { $regex: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
            }).lean();

            if (user) {
                console.log('   ✅ Found: ' + email + ' (verified: ' + user.isEmailVerified + ')');
            } else {
                console.log('   ❌ Not found: ' + email);
            }
        }
        console.log('');

        // Determine if this is local or Atlas
        const isAtlas = dbUrl.includes('mongodb+srv://') || dbUrl.includes('mongodb.net');
        const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

        console.log('🌍 Connection Type:');
        if (isAtlas) {
            console.log('   ✅ Connected to MongoDB Atlas (Cloud)');
        } else if (isLocal) {
            console.log('   ⚠️  Connected to Local MongoDB');
        } else {
            console.log('   ❓ Connected to: ' + maskedUrl);
        }
        console.log('');

        console.log('✅ Database verification complete!');
        console.log('');

        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');

    } catch (error) {
        console.error('\n❌ Connection failed!');
        console.error('Error:', error.message);
        console.error('');

        if (error.message.includes('ECONNREFUSED')) {
            console.error('💡 Tip: Local MongoDB is not running. Start it with:');
            console.error('   - Windows: Run "mongod" in a terminal');
            console.error('   - macOS/Linux: sudo systemctl start mongod');
        } else if (error.message.includes('authentication failed')) {
            console.error('💡 Tip: Check your MongoDB credentials in .env file');
        } else if (error.message.includes('ENOTFOUND')) {
            console.error('💡 Tip: Check your internet connection and MongoDB Atlas URL');
        }

        process.exit(1);
    }
}

verifyConnection();
