const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gighub';
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
    return true;
  } catch (err) {
    console.log('⚠️  MongoDB not available, using in-memory storage');
    console.log('Install MongoDB or use MongoDB Atlas for production');
    return false;
  }
};

module.exports = connectDB;
