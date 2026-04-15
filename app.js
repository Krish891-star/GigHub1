require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('mongo-sanitize');
const compression = require('compression');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const statusShortsRoutes = require('./routes/statusShorts');
const creatorRoutes = require('./routes/creators');
const followRoutes = require('./routes/follow');
const notificationRoutes = require('./routes/notifications');
const bookmarkRoutes = require('./routes/bookmarks');
const searchRoutes = require('./routes/search');
const analyticsRoutes = require('./routes/analytics');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

// Import middleware
const { apiLimiter, authLimiter, uploadLimiter } = require('./middleware/rateLimiter');

// Import controllers to set MongoDB status
const authController = require('./controllers/authController');
const postController = require('./controllers/postController');
const statusShortsController = require('./controllers/statusShortsController');
const creatorController = require('./controllers/creatorController');
const followController = require('./controllers/followController');
const notificationController = require('./controllers/notificationController');
const bookmarkController = require('./controllers/bookmarkController');
const searchController = require('./controllers/searchController');
const analyticsController = require('./controllers/analyticsController');
const userController = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Set security headers with relaxed CSP for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

// Enable CORS with options
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Prevent XSS attacks — exclude auth routes so passwords with special chars aren't mangled
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth/')) return next();
  xss()(req, res, next);
});

// Sanitize data (prevent NoSQL injection) — preserve password field
app.use((req, res, next) => {
  if (req.body) {
    const savedPassword = req.body.password;
    req.body = mongoSanitize(req.body);
    if (savedPassword !== undefined) req.body.password = savedPassword;
  }
  if (req.params) req.params = mongoSanitize(req.params);
  if (req.query) req.query = mongoSanitize(req.query);
  next();
});

// Gzip compression for all responses
app.use(compression({ level: 6, threshold: 1024 }));

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// Regular middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.match(/\.(png|jpg|jpeg|gif|ico|webp|svg)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'gighub-session-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

// Create uploads directory if not exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads', { recursive: true });
  console.log('📁 Created uploads directory');
}
if (process.env.NODE_ENV === 'production') {
  console.log('⚠️  Note: Render free tier has ephemeral storage — uploads reset on restart. Use cloud storage (S3/Cloudinary) for persistent files.');
}

// Secure Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate secure filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'));
  }
});

// File filter for security
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, MP4, and WebM are allowed.'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 5 // Max 5 files
  },
  // Optimize for faster uploads
  preservePath: false
});

// ==========================================
// MONGODB CONNECTION
// ==========================================
let useMongoDB = false; // start false, set true only after confirmed connection
let mongoInitialized = false; // guard against premature disconnect events

const setAllMongoStatus = (status) => {
  useMongoDB = status;
  authController.setMongoDBStatus(status);
  postController.setMongoDBStatus(status);
  statusShortsController.setMongoDBStatus(status);
  creatorController.setMongoDBStatus(status);
  followController.setMongoDBStatus(status);
  notificationController.setMongoDBStatus(status);
  bookmarkController.setMongoDBStatus(status);
  searchController.setMongoDBStatus(true);
  analyticsController.setMongoDBStatus(status);
  userController.setMongoDBStatus(status);
};

connectDB()
  .then(connected => {
    mongoInitialized = true;
    setAllMongoStatus(connected);
    if (connected) console.log('✅ App running with MongoDB');
  })
  .catch(() => {
    mongoInitialized = true;
    setAllMongoStatus(false);
  });

// In-memory fallback storage
const inMemoryDB = {
  users: [],
  posts: [],
  statusShorts: [],
  nextUserId: 1,
  nextPostId: 1,
  nextStatusShortsId: 1
};

// Make inMemoryDB available to authController
authController.setInMemoryDB(inMemoryDB);

// ==========================================
// ROUTES
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/status-shorts', statusShortsRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    dbName: mongoose.connection.name || 'none',
    mode: useMongoDB ? 'mongodb' : 'in-memory'
  });
});

// One-time owner account setup — call GET /api/setup-owner to create/reset owner account
app.get('/api/setup-owner', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const User = require('./models/User');
    const OWNER_PHONE = process.env.OWNER_PHONE || '8410104406';
    const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'anushka@1406';
    const hashedPw = await bcrypt.hash(OWNER_PASSWORD, 10);

    const existing = await User.findOne({ phone: OWNER_PHONE });
    if (existing) {
      await User.updateOne(
        { phone: OWNER_PHONE },
        { $set: { password: hashedPw, isOwner: true, role: 'owner', name: 'Krish Kumar', email: 'krish141213@gmail.com' } }
      );
      return res.json({ success: true, message: 'Owner account updated. You can now login.' });
    }
    const user = new User({
      phone: OWNER_PHONE, email: 'krish141213@gmail.com',
      password: hashedPw, name: 'Krish Kumar',
      role: 'owner', isOwner: true, profileCompleted: true
    });
    await user.save();
    res.json({ success: true, message: 'Owner account created. You can now login.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DASHBOARD ROUTES
// ==========================================
const { authenticateToken } = require('./middleware/auth');

app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    let stats = {};

    if (useMongoDB) {
      const Post = require('./models/Post');
      const User = require('./models/User');
      
      if (req.user.role === 'user') {
        const myPosts = await Post.countDocuments({ userId: req.user.id });
        const openPosts = await Post.countDocuments({ userId: req.user.id, status: 'open' });
        const completedPosts = await Post.countDocuments({ userId: req.user.id, status: 'completed' });
        
        stats = { myPosts, openPosts, completedPosts };
      } else {
        const totalPosts = await Post.countDocuments();
        const openPosts = await Post.countDocuments({ status: 'open' });
        const totalCreators = await User.countDocuments({ role: 'creator' });
        
        stats = { totalPosts, openPosts, totalCreators };
      }
    } else {
      if (req.user.role === 'user') {
        const myPosts = inMemoryDB.posts.filter(p => p.userId === req.user.id).length;
        const openPosts = inMemoryDB.posts.filter(p => p.userId === req.user.id && p.status === 'open').length;
        const completedPosts = inMemoryDB.posts.filter(p => p.userId === req.user.id && p.status === 'completed').length;
        
        stats = { myPosts, openPosts, completedPosts };
      } else {
        const totalPosts = inMemoryDB.posts.length;
        const openPosts = inMemoryDB.posts.filter(p => p.status === 'open').length;
        const totalCreators = inMemoryDB.users.filter(u => u.role === 'creator').length;
        
        stats = { totalPosts, openPosts, totalCreators };
      }
    }

    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// SERVE FRONTEND
// ==========================================
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/owner', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'owner.html'));
});

// Serve manifest.json with correct content type
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// Serve favicon.ico with correct content type
app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/x-icon');
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// Serve service worker with correct content type
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('/diagnostic', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'diagnostic.html'));
});

app.get('/simple-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simple-test.html'));
});

app.get('/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/complete-profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'complete-profile.html'));
});

app.get('/profile/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// ==========================================
// ERROR HANDLING & MONGODB FALLBACK
// ==========================================
const mongoose = require('mongoose');

// Error handling middleware for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 100MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum 5 files allowed.' });
    }
    return res.status(400).json({ error: error.message });
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({ error: error.message });
  }
  
  next(error);
});

// General error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;
  
  res.status(error.status || 500).json({ 
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

mongoose.connection.on('error', (err) => {
  if (mongoInitialized && useMongoDB) {
    console.log('⚠️  MongoDB error, switching to in-memory storage');
    setAllMongoStatus(false);
  }
});

mongoose.connection.on('disconnected', () => {
  // Only react after initial connection is established, and not during reconnect attempts
  if (mongoInitialized && useMongoDB && mongoose.connection.readyState !== 2) {
    console.log('⚠️  MongoDB disconnected, switching to in-memory storage');
    setAllMongoStatus(false);
  }
});

// ==========================================
// SECURITY: Disable dangerous HTTP methods
// ==========================================
app.disable('x-powered-by'); // Remove X-Powered-By header

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 GigHub Platform is running!`);
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🔐 Login page: http://localhost:${PORT}/login`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`\n💡 Use MongoDB for production, in-memory works for testing\n`);
});
