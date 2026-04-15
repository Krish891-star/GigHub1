const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gighub';

    const options = {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };

    // Only use TLS for Atlas (mongodb+srv) connections
    if (uri.startsWith('mongodb+srv://')) {
      options.tls = true;
    }

    await mongoose.connect(uri, options);
    console.log('✅ MongoDB connected — DB:', mongoose.connection.name);
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('⚠️  Running with in-memory storage (data resets on restart)');
    return false;
  }
};

module.exports = connectDB;
