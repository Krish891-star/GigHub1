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
  });

// In-memory fallback storage with sample data
const inMemoryDB = {
  users: [
    {
      _id: 'creator1',
      name: 'Sarah Chen',
      email: 'sarah@example.com',
      password: '$2b$10$dummyhash1',
      phone: '+1-555-0101',
      role: 'creator',
      avatar: '👩‍🎨',
      bio: 'Award-winning UI/UX designer with 8+ years creating beautiful digital experiences for Fortune 500 companies',
      tagline: 'Crafting Digital Experiences That Inspire',
      skills: ['UI/UX Design', 'Figma', 'Adobe XD', 'Prototyping', 'User Research', 'Design Systems'],
      serviceCategories: ['Web Design', 'Mobile App Design', 'Brand Identity'],
      yearsOfExperience: 8,
      hourlyRate: '$85/hr',
      availability: 'available',
      languages: ['English', 'Mandarin', 'Spanish'],
      experience: [
        { title: 'Senior UI/UX Designer', company: 'Google', duration: '2020-2024', description: 'Led design for Google Pay' },
        { title: 'Product Designer', company: 'Airbnb', duration: '2017-2020', description: 'Redesigned booking experience' }
      ],
      education: [
        { degree: 'MFA in Interaction Design', institution: 'Stanford University', year: '2017' }
      ],
      certificates: [
        { name: 'Google UX Design Certificate', issuer: 'Google', year: '2019' }
      ],
      socialLinks: {
        instagram: 'https://instagram.com/sarahchen.design',
        linkedin: 'https://linkedin.com/in/sarahchen',
        behance: 'https://behance.net/sarahchen'
      },
      website: 'https://sarahchen.design',
      profileCompleted: true,
      followers: ['user1', 'user2'],
      following: ['creator2'],
      createdAt: new Date('2024-01-15')
    },
    {
      _id: 'creator2',
      name: 'Marcus Rivera',
      email: 'marcus@example.com',
      password: '$2b$10$dummyhash2',
      phone: '+1-555-0102',
      role: 'creator',
      avatar: '🎬',
      bio: 'Professional video editor & motion graphics artist. Worked with Netflix, YouTube creators, and major brands.',
      tagline: 'Bringing Stories to Life Through Motion',
      skills: ['Video Editing', 'After Effects', 'Premiere Pro', 'Motion Graphics', 'Color Grading', '3D Animation'],
      serviceCategories: ['Video Production', 'Animation', 'Post-Production'],
      yearsOfExperience: 6,
      hourlyRate: '$75/hr',
      availability: 'available',
      languages: ['English', 'Portuguese'],
      experience: [
        { title: 'Lead Video Editor', company: 'Netflix', duration: '2021-2024', description: 'Edited original series' },
        { title: 'Motion Designer', company: 'Freelance', duration: '2018-2021', description: 'Worked with 50+ creators' }
      ],
      education: [
        { degree: 'BA in Film Production', institution: 'USC School of Cinematic Arts', year: '2018' }
      ],
      certificates: [
        { name: 'Adobe Certified Expert', issuer: 'Adobe', year: '2020' }
      ],
      socialLinks: {
        instagram: 'https://instagram.com/marcus.motion',
        youtube: 'https://youtube.com/@marcusrivera',
        linkedin: 'https://linkedin.com/in/marcusrivera'
      },
      website: 'https://marcusrivera.video',
      profileCompleted: true,
      followers: ['user1'],
      following: ['creator1', 'creator3'],
      createdAt: new Date('2024-02-10')
    },
    {
      _id: 'creator3',
      name: 'Aisha Patel',
      email: 'aisha@example.com',
      password: '$2b$10$dummyhash3',
      phone: '+1-555-0103',
      role: 'creator',
      avatar: '💻',
      bio: 'Full-stack developer specializing in React, Node.js, and cloud architecture. 100+ successful projects delivered.',
      tagline: 'Building Scalable Web Solutions',
      skills: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'AWS', 'Docker', 'GraphQL'],
      serviceCategories: ['Web Development', 'API Development', 'Cloud Solutions'],
      yearsOfExperience: 5,
      hourlyRate: '$95/hr',
      availability: 'busy',
      languages: ['English', 'Hindi', 'Gujarati'],
      experience: [
        { title: 'Senior Full-Stack Developer', company: 'Amazon', duration: '2022-2024', description: 'AWS dashboard development' },
        { title: 'React Developer', company: 'Startup Inc', duration: '2019-2022', description: 'Built core product features' }
      ],
      education: [
        { degree: 'MS in Computer Science', institution: 'MIT', year: '2019' }
      ],
      certificates: [
        { name: 'AWS Solutions Architect', issuer: 'Amazon Web Services', year: '2021' },
        { name: 'Google Cloud Professional', issuer: 'Google Cloud', year: '2022' }
      ],
      socialLinks: {
        github: 'https://github.com/aishapatel',
        linkedin: 'https://linkedin.com/in/aishapatel',
        twitter: 'https://twitter.com/aisha_codes'
      },
      website: 'https://aishapatel.dev',
      profileCompleted: true,
      followers: ['user2', 'user3'],
      following: ['creator1'],
      createdAt: new Date('2024-01-20')
    },
    {
      _id: 'creator4',
      name: 'James Thompson',
      email: 'james@example.com',
      password: '$2b$10$dummyhash4',
      phone: '+1-555-0104',
      role: 'creator',
      avatar: '📸',
      bio: 'Professional photographer & retoucher. Specializing in product photography, portraits, and commercial shoots.',
      tagline: 'Capturing Moments, Creating Memories',
      skills: ['Photography', 'Lightroom', 'Photoshop', 'Studio Lighting', 'Product Photography', 'Portrait Photography'],
      serviceCategories: ['Photography', 'Photo Editing', 'Commercial Shoots'],
      yearsOfExperience: 10,
      hourlyRate: '$120/hr',
      availability: 'available',
      languages: ['English', 'French'],
      experience: [
        { title: 'Lead Photographer', company: 'National Geographic', duration: '2018-2024', description: 'Travel photography' },
        { title: 'Studio Photographer', company: 'Self-Employed', duration: '2014-2018', description: 'Portrait & product shoots' }
      ],
      education: [
        { degree: 'BFA in Photography', institution: 'Rhode Island School of Design', year: '2014' }
      ],
      certificates: [
        { name: 'Certified Professional Photographer', issuer: 'PPA', year: '2015' }
      ],
      socialLinks: {
        instagram: 'https://instagram.com/james.thompson.photo',
        website: 'https://jamesthompson.photo'
      },
      website: 'https://jamesthompson.photo',
      profileCompleted: true,
      followers: ['user1', 'user2', 'user3'],
      following: ['creator2'],
      createdAt: new Date('2024-03-05')
    },
    {
      _id: 'user1',
      name: 'Emily Watson',
      email: 'emily@example.com',
      password: '$2b$10$dummyhash5',
      phone: '+1-555-0201',
      role: 'user',
      avatar: '👤',
      bio: 'Startup founder looking for talented creators',
      createdAt: new Date('2024-02-01'),
      followers: [],
      following: ['creator1', 'creator2', 'creator4']
    },
    {
      _id: 'user2',
      name: 'David Kim',
      email: 'david@example.com',
      password: '$2b$10$dummyhash6',
      phone: '+1-555-0202',
      role: 'user',
      avatar: '👤',
      bio: 'Marketing manager seeking creative professionals',
      createdAt: new Date('2024-02-15'),
      followers: [],
      following: ['creator1', 'creator3', 'creator4']
    },
    {
      _id: 'user3',
      name: 'Lisa Anderson',
      email: 'lisa@example.com',
      password: '$2b$10$dummyhash7',
      phone: '+1-555-0203',
      role: 'user',
      avatar: '👤',
      bio: 'Content creator and influencer',
      createdAt: new Date('2024-03-01'),
      followers: [],
      following: ['creator2', 'creator3']
    }
  ],
  posts: [
    {
      _id: 'post1',
      userId: 'user1',
      userName: 'Emily Watson',
      userAvatar: '👤',
      title: 'Need a Modern Website Redesign for My Startup',
      description: 'Looking for a talented UI/UX designer to completely redesign our SaaS platform. We want a clean, modern look similar to Stripe or Linear. Must be mobile-responsive and accessible.',
      budget: '$2,500 - $4,000',
      category: 'web-design',
      status: 'open',
      tags: ['UI/UX', 'Web Design', 'SaaS', 'Modern'],
      likes: ['creator1', 'user2'],
      comments: [
        { userId: 'creator1', userName: 'Sarah Chen', userAvatar: '👩‍🎨', text: 'I specialize in SaaS design! Would love to discuss your vision. Check out my portfolio.', createdAt: new Date('2024-11-20') }
      ],
      views: 45,
      createdAt: new Date('2024-11-18')
    },
    {
      _id: 'post2',
      userId: 'user2',
      userName: 'David Kim',
      userAvatar: '👤',
      title: 'Professional Video Editor for YouTube Series',
      description: 'Need an experienced video editor for a 10-episode YouTube series. Each episode is 15-20 minutes. Looking for dynamic editing with motion graphics, transitions, and color grading.',
      budget: '$3,000 - $5,000',
      category: 'video-production',
      status: 'open',
      tags: ['Video Editing', 'YouTube', 'Motion Graphics'],
      likes: ['creator2', 'creator4', 'user1'],
      comments: [
        { userId: 'creator2', userName: 'Marcus Rivera', userAvatar: '🎬', text: 'Perfect match! I have extensive YouTube experience. Let me show you my recent work.', createdAt: new Date('2024-11-19') }
      ],
      views: 67,
      createdAt: new Date('2024-11-17')
    },
    {
      _id: 'post3',
      userId: 'user3',
      userName: 'Lisa Anderson',
      userAvatar: '👤',
      title: 'E-commerce Website Development - Shopify Plus',
      description: 'Building a premium fashion brand and need a Shopify Plus expert. Custom theme development, payment integration, inventory management, and mobile optimization required.',
      budget: '$4,000 - $6,000',
      category: 'web-development',
      status: 'open',
      tags: ['Shopify', 'E-commerce', 'Full-Stack'],
      likes: ['creator3'],
      comments: [],
      views: 38,
      createdAt: new Date('2024-11-16')
    },
    {
      _id: 'post4',
      userId: 'user1',
      userName: 'Emily Watson',
      userAvatar: '👤',
      title: 'Product Photography for New Tech Gadget Launch',
      description: 'Launching a new smart home device and need professional product photography. Need 30-40 high-quality images including lifestyle shots, white background, and detail close-ups.',
      budget: '$1,500 - $2,500',
      category: 'photography',
      status: 'open',
      tags: ['Product Photography', 'Commercial', 'Tech'],
      likes: ['creator4', 'creator1', 'user2'],
      comments: [
        { userId: 'creator4', userName: 'James Thompson', userAvatar: '📸', text: 'I specialize in tech product photography! Would love to collaborate on your launch.', createdAt: new Date('2024-11-15') }
      ],
      views: 52,
      createdAt: new Date('2024-11-14')
    }
  ],
  statusShorts: [
    {
      _id: 'status1',
      userId: 'creator1',
      userName: 'Sarah Chen',
      userAvatar: '👩‍🎨',
      type: 'image',
      caption: 'Just finished this UI concept for a fintech app 💜✨',
      mediaUrl: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400',
      likes: ['user1', 'user2', 'creator2'],
      views: 234,
      createdAt: new Date('2024-11-20')
    },
    {
      _id: 'status2',
      userId: 'creator2',
      userName: 'Marcus Rivera',
      userAvatar: '🎬',
      type: 'image',
      caption: 'Behind the scenes of my latest video project 🎥🔥',
      mediaUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400',
      likes: ['user1', 'creator1'],
      views: 189,
      createdAt: new Date('2024-11-19')
    },
    {
      _id: 'status3',
      userId: 'creator3',
      userName: 'Aisha Patel',
      userAvatar: '💻',
      type: 'image',
      caption: 'New React dashboard component library live! 🚀',
      mediaUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400',
      likes: ['user2', 'user3', 'creator1', 'creator4'],
      views: 312,
      createdAt: new Date('2024-11-18')
    },
    {
      _id: 'status4',
      userId: 'creator4',
      userName: 'James Thompson',
      userAvatar: '📸',
      type: 'image',
      caption: 'Golden hour magic 📷✨ #photography',
      mediaUrl: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400',
      likes: ['user1', 'user2', 'user3'],
      views: 276,
      createdAt: new Date('2024-11-17')
    }
  ],
  notifications: [],
  bookmarks: [],
  nextUserId: 8,
  nextPostId: 5,
  nextStatusShortsId: 5,
  nextNotificationId: 1,
  nextBookmarkId: 1
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
app.use('/api/users', followRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/user', userRoutes);

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

app.get('/diagnostic', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'diagnostic.html'));
});

app.get('/simple-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simple-test.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'public', 'login.html'));
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
