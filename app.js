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
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
  credentials: true
}));

// Prevent XSS attacks
app.use(xss());

// Sanitize data (prevent NoSQL injection)
app.use((req, res, next) => {
  if (req.body) {
    req.body = mongoSanitize(req.body);
  }
  if (req.params) {
    req.params = mongoSanitize(req.params);
  }
  if (req.query) {
    req.query = mongoSanitize(req.query);
  }
  next();
});

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// Regular middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
app.use(session({
  secret: 'gighub-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Create uploads directory if not exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
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
  }
});

// ==========================================
// MONGODB CONNECTION
// ==========================================
let useMongoDB = true;

connectDB()
  .then(connected => {
    useMongoDB = connected;
    // Update all controllers with MongoDB status
    authController.setMongoDBStatus(useMongoDB);
    postController.setMongoDBStatus(useMongoDB);
    statusShortsController.setMongoDBStatus(useMongoDB);
    creatorController.setMongoDBStatus(useMongoDB);
    followController.setMongoDBStatus(useMongoDB);
    notificationController.setMongoDBStatus(useMongoDB);
    bookmarkController.setMongoDBStatus(useMongoDB);
    searchController.setMongoDBStatus(true); // Search works with both
    analyticsController.setMongoDBStatus(useMongoDB);
    userController.setMongoDBStatus(useMongoDB);
  })
  .catch(err => {
    useMongoDB = false;
    authController.setMongoDBStatus(false);
    postController.setMongoDBStatus(false);
    statusShortsController.setMongoDBStatus(false);
    creatorController.setMongoDBStatus(false);
    followController.setMongoDBStatus(false);
    notificationController.setMongoDBStatus(false);
    bookmarkController.setMongoDBStatus(false);
    userController.setMongoDBStatus(false);
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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

mongoose.connection.on('error', () => {
  console.log('⚠️  Switching to in-memory storage');
  useMongoDB = false;
  authController.setMongoDBStatus(false);
  postController.setMongoDBStatus(false);
  statusShortsController.setMongoDBStatus(false);
  creatorController.setMongoDBStatus(false);
  followController.setMongoDBStatus(false);
  notificationController.setMongoDBStatus(false);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected, using in-memory storage');
  useMongoDB = false;
  authController.setMongoDBStatus(false);
  postController.setMongoDBStatus(false);
  statusShortsController.setMongoDBStatus(false);
  creatorController.setMongoDBStatus(false);
  followController.setMongoDBStatus(false);
  notificationController.setMongoDBStatus(false);
});

// ==========================================
// SECURITY: Disable dangerous HTTP methods
// ==========================================
app.disable('x-powered-by'); // Remove X-Powered-By header

// ==========================================
// SECURITY MONITORING
// ==========================================
// Log suspicious activities
app.use((req, res, next) => {
  // Log unusual user agents
  const userAgent = req.headers['user-agent'] || '';
  if (userAgent.includes('sqlmap') || userAgent.includes('nikto')) {
    console.warn(`🚨 Suspicious activity detected from IP: ${req.ip}`);
  }
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 GigHub Platform is running!`);
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🔐 Login page: http://localhost:${PORT}/login`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`\n💡 Use MongoDB for production, in-memory works for testing\n`);
});
