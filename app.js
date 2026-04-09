const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gighub-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ==========================================
// MONGODB CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gighub';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.log('⚠️  MongoDB not available, using in-memory storage');
    console.log('Install MongoDB or use MongoDB Atlas for production');
  });

// ==========================================
// MONGODB MODELS
// ==========================================
const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  email: { type: String, sparse: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['user', 'creator'], required: true },
  // Creator specific fields
  skills: [String],
  bio: String,
  portfolioLinks: [String],
  profileImage: String,
  whatsapp: String,
  // Stats
  completedProjects: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userPhone: String,
  userWhatsapp: String,
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['poster', 'banner', 'wedding-card', 'website', 'seo', 'logo', 'video', 'other'],
    required: true 
  },
  budget: { type: String, required: true },
  images: [String],
  status: { type: String, enum: ['open', 'in-progress', 'completed', 'closed'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Status & Shorts Schema
const statusShortsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userAvatar: String,
  type: { type: String, enum: ['status', 'shorts'], required: true },
  caption: String,
  mediaUrl: { type: String, required: true },
  mediaType: { type: String, enum: ['video', 'image'], required: true },
  likes: [{ type: String }],
  comments: [{
    userId: String,
    userName: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  views: [{ type: String }],
  viewCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Auto-delete status after 24 hours
statusShortsSchema.index({ createdAt: 1 });
setInterval(async () => {
  try {
    if (useMongoDB) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await StatusShorts.deleteMany({
        type: 'status',
        createdAt: { $lt: twentyFourHoursAgo }
      });
    } else {
      // In-memory cleanup
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      inMemoryDB.statusShorts = inMemoryDB.statusShorts.filter(s => {
        if (s.type === 'status' && new Date(s.createdAt) < twentyFourHoursAgo) {
          return false;
        }
        return true;
      });
    }
  } catch (err) {
    console.error('Status cleanup error:', err);
  }
}, 60 * 60 * 1000); // Check every hour

const StatusShorts = mongoose.model('StatusShorts', statusShortsSchema);

// In-memory fallback storage
const inMemoryDB = {
  users: [],
  posts: [],
  statusShorts: [],
  nextUserId: 1,
  nextPostId: 1,
  nextStatusShortsId: 1
};

let useMongoDB = true;

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.session.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

const checkRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

// ==========================================
// AUTH ROUTES
// ==========================================

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { phone, email, password, name, role } = req.body;

    if (!phone || !password || !name || !role) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    if (useMongoDB) {
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        phone,
        email,
        password: hashedPassword,
        name,
        role
      });

      await user.save();

      const token = jwt.sign(
        { id: user._id, phone: user.phone, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'Signup successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role
        }
      });
    } else {
      // In-memory fallback
      const existingUser = inMemoryDB.users.find(u => u.phone === phone);
      if (existingUser) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: inMemoryDB.nextUserId++,
        phone,
        email,
        password: hashedPassword,
        name,
        role,
        skills: [],
        bio: '',
        portfolioLinks: [],
        whatsapp: '',
        completedProjects: 0,
        rating: 0,
        createdAt: new Date()
      };

      inMemoryDB.users.push(user);

      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'Signup successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role
        }
      });
    }
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    let user;
    if (useMongoDB) {
      user = await User.findOne({ phone });
    } else {
      user = inMemoryDB.users.find(u => u.phone === phone);
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id || user.id, phone: user.phone, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    req.session.token = token;

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    let user;
    if (useMongoDB) {
      user = await User.findById(req.user.id).select('-password');
    } else {
      user = inMemoryDB.users.find(u => u.id === req.user.id);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        user = userWithoutPassword;
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    
    if (useMongoDB) {
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password');
      
      res.json({ message: 'Profile updated', user });
    } else {
      const userIndex = inMemoryDB.users.findIndex(u => u.id === req.user.id);
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      inMemoryDB.users[userIndex] = { ...inMemoryDB.users[userIndex], ...updates };
      res.json({ message: 'Profile updated', user: inMemoryDB.users[userIndex] });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// POST ROUTES (Client Requirements)
// ==========================================

// Create a new post
app.post('/api/posts', authenticateToken, checkRole('user'), upload.array('images', 5), async (req, res) => {
  try {
    const { title, description, category, budget, whatsapp } = req.body;

    if (!title || !description || !category || !budget) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const imagePaths = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    let user;
    if (useMongoDB) {
      user = await User.findById(req.user.id);
    } else {
      user = inMemoryDB.users.find(u => u.id === req.user.id);
    }

    if (useMongoDB) {
      const post = new Post({
        userId: req.user.id,
        userName: user.name,
        userPhone: user.phone,
        userWhatsapp: whatsapp || user.whatsapp,
        title,
        description,
        category,
        budget,
        images: imagePaths
      });

      await post.save();
      res.status(201).json({ message: 'Post created successfully', post });
    } else {
      const post = {
        id: inMemoryDB.nextPostId++,
        userId: req.user.id,
        userName: user.name,
        userPhone: user.phone,
        userWhatsapp: whatsapp || user.whatsapp,
        title,
        description,
        category,
        budget,
        images: imagePaths,
        status: 'open',
        createdAt: new Date()
      };

      inMemoryDB.posts.push(post);
      res.status(201).json({ message: 'Post created successfully', post });
    }
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all posts (for creators)
app.get('/api/posts', async (req, res) => {
  try {
    const { category, status } = req.query;
    let filter = {};
    
    if (category) filter.category = category;
    if (status) filter.status = status;

    let posts;
    if (useMongoDB) {
      posts = await Post.find(filter).sort({ createdAt: -1 }).populate('userId', 'name phone');
    } else {
      posts = inMemoryDB.posts.filter(post => {
        if (category && post.category !== category) return false;
        if (status && post.status !== status) return false;
        return true;
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's own posts
app.get('/api/posts/my', authenticateToken, checkRole('user'), async (req, res) => {
  try {
    let posts;
    if (useMongoDB) {
      posts = await Post.find({ userId: req.user.id }).sort({ createdAt: -1 });
    } else {
      posts = inMemoryDB.posts
        .filter(post => post.userId === req.user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single post
app.get('/api/posts/:id', async (req, res) => {
  try {
    let post;
    if (useMongoDB) {
      post = await Post.findById(req.params.id).populate('userId', 'name phone');
    } else {
      post = inMemoryDB.posts.find(p => p.id === parseInt(req.params.id));
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update post status
app.put('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (useMongoDB) {
      const post = await Post.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.id },
        { $set: { status } },
        { new: true }
      );

      if (!post) {
        return res.status(404).json({ error: 'Post not found or unauthorized' });
      }

      res.json({ message: 'Post updated', post });
    } else {
      const postIndex = inMemoryDB.posts.findIndex(
        p => p.id === parseInt(req.params.id) && p.userId === req.user.id
      );

      if (postIndex === -1) {
        return res.status(404).json({ error: 'Post not found or unauthorized' });
      }

      inMemoryDB.posts[postIndex].status = status;
      res.json({ message: 'Post updated', post: inMemoryDB.posts[postIndex] });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete post
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    if (useMongoDB) {
      const post = await Post.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
      
      if (!post) {
        return res.status(404).json({ error: 'Post not found or unauthorized' });
      }
    } else {
      const postIndex = inMemoryDB.posts.findIndex(
        p => p.id === parseInt(req.params.id) && p.userId === req.user.id
      );

      if (postIndex === -1) {
        return res.status(404).json({ error: 'Post not found or unauthorized' });
      }

      inMemoryDB.posts.splice(postIndex, 1);
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// CREATOR ROUTES
// ==========================================

// Get all creators
app.get('/api/creators', async (req, res) => {
  try {
    let creators;
    if (useMongoDB) {
      creators = await User.find({ role: 'creator' }).select('-password');
    } else {
      creators = inMemoryDB.users
        .filter(u => u.role === 'creator')
        .map(({ password, ...user }) => user);
    }

    res.json({ creators });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get creator profile
app.get('/api/creators/:id', async (req, res) => {
  try {
    let creator;
    if (useMongoDB) {
      creator = await User.findById(req.params.id).select('-password');
    } else {
      creator = inMemoryDB.users.find(u => u.id === parseInt(req.params.id));
      if (creator) {
        const { password, ...creatorWithoutPassword } = creator;
        creator = creatorWithoutPassword;
      }
    }

    if (!creator || creator.role !== 'creator') {
      return res.status(404).json({ error: 'Creator not found' });
    }

    res.json({ creator });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// STATUS & SHORTS ROUTES
// ==========================================

// Upload Status or Shorts
app.post('/api/status-shorts/upload', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    const { caption, type } = req.body;

    if (!type || !['status', 'shorts'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "status" or "shorts"' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Media file is required' });
    }

    const mediaUrl = `/uploads/${req.file.filename}`;
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    let user;
    if (useMongoDB) {
      user = await User.findById(req.user.id);
    } else {
      user = inMemoryDB.users.find(u => u.id === req.user.id);
    }

    if (useMongoDB) {
      const statusShort = new StatusShorts({
        userId: req.user.id,
        userName: user.name,
        userAvatar: user.profileImage || '',
        type,
        caption,
        mediaUrl,
        mediaType
      });

      await statusShort.save();
      res.status(201).json({ success: true, post: statusShort });
    } else {
      const statusShort = {
        id: inMemoryDB.nextStatusShortsId++,
        userId: req.user.id,
        userName: user.name,
        userAvatar: '',
        type,
        caption,
        mediaUrl,
        mediaType,
        likes: [],
        comments: [],
        views: [],
        viewCount: 0,
        isDeleted: false,
        createdAt: new Date()
      };

      inMemoryDB.statusShorts.push(statusShort);
      res.status(201).json({ success: true, post: statusShort });
    }
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Server error during upload' });
  }
});

// Get Feed (Status & Shorts)
app.get('/api/status-shorts/feed', async (req, res) => {
  try {
    const { page = 1, limit = 20, tab = 'latest', type } = req.query;
    
    let filter = { isDeleted: false };
    if (type) filter.type = type;
    
    if (tab === 'popular') {
      filter.viewCount = { $gte: 10 };
    }

    let posts;
    if (useMongoDB) {
      posts = await StatusShorts.find(filter)
        .sort(tab === 'popular' ? { viewCount: -1, createdAt: -1 } : { createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
    } else {
      posts = inMemoryDB.statusShorts.filter(post => {
        if (filter.isDeleted !== undefined && post.isDeleted !== filter.isDeleted) return false;
        if (filter.type && post.type !== filter.type) return false;
        if (filter.viewCount && post.viewCount < filter.viewCount.$gte) return false;
        return true;
      }).sort((a, b) => {
        if (tab === 'popular') {
          return b.viewCount - a.viewCount || new Date(b.createdAt) - new Date(a.createdAt);
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      }).slice((page - 1) * limit, page * limit);
    }

    res.json({ posts, pagination: { page: page * 1, limit: limit * 1 } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get User's Status & Shorts
app.get('/api/status-shorts/my', authenticateToken, async (req, res) => {
  try {
    let posts;
    if (useMongoDB) {
      posts = await StatusShorts.find({ userId: req.user.id, isDeleted: false })
        .sort({ createdAt: -1 });
    } else {
      posts = inMemoryDB.statusShorts
        .filter(p => p.userId === req.user.id && !p.isDeleted)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Like/Unlike Status & Shorts
app.post('/api/status-shorts/:id/like', authenticateToken, async (req, res) => {
  try {
    let post;
    if (useMongoDB) {
      post = await StatusShorts.findById(req.params.id);
    } else {
      post = inMemoryDB.statusShorts.find(p => p.id === parseInt(req.params.id));
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = req.user.id.toString();
    const alreadyLiked = post.likes.includes(userId);

    if (useMongoDB) {
      if (alreadyLiked) {
        post.likes.pull(userId);
      } else {
        post.likes.push(userId);
      }
      await post.save();
    } else {
      if (alreadyLiked) {
        post.likes = post.likes.filter(id => id !== userId);
      } else {
        post.likes.push(userId);
      }
    }

    res.json({ 
      success: true, 
      likes: post.likes.length, 
      liked: !alreadyLiked 
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Comment on Status & Shorts
app.post('/api/status-shorts/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    let post;
    if (useMongoDB) {
      post = await StatusShorts.findById(req.params.id);
    } else {
      post = inMemoryDB.statusShorts.find(p => p.id === parseInt(req.params.id));
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = {
      userId: req.user.id.toString(),
      userName: req.user.name,
      text,
      timestamp: new Date()
    };

    if (useMongoDB) {
      post.comments.push(comment);
      await post.save();
    } else {
      post.comments.push(comment);
    }

    res.json({ success: true, comments: post.comments });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Track View
app.post('/api/status-shorts/:id/view', authenticateToken, async (req, res) => {
  try {
    let post;
    if (useMongoDB) {
      post = await StatusShorts.findById(req.params.id);
    } else {
      post = inMemoryDB.statusShorts.find(p => p.id === parseInt(req.params.id));
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = req.user.id.toString();
    if (!post.views.includes(userId)) {
      if (useMongoDB) {
        post.views.push(userId);
        post.viewCount += 1;
        await post.save();
      } else {
        post.views.push(userId);
        post.viewCount += 1;
      }
    }

    res.json({ success: true, viewCount: post.viewCount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete Status & Shorts
app.delete('/api/status-shorts/:id', authenticateToken, async (req, res) => {
  try {
    if (useMongoDB) {
      const post = await StatusShorts.findOne({ 
        _id: req.params.id, 
        userId: req.user.id 
      });
      
      if (!post) {
        return res.status(404).json({ error: 'Post not found or unauthorized' });
      }

      post.isDeleted = true;
      await post.save();
    } else {
      const postIndex = inMemoryDB.statusShorts.findIndex(
        p => p.id === parseInt(req.params.id) && p.userId === req.user.id
      );

      if (postIndex === -1) {
        return res.status(404).json({ error: 'Post not found or unauthorized' });
      }

      inMemoryDB.statusShorts[postIndex].isDeleted = true;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// DASHBOARD ROUTES
// ==========================================

// Get dashboard stats
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    let stats = {};

    if (useMongoDB) {
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

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'public', 'login.html'));
});

// ==========================================
// ERROR HANDLING & MONGODB FALLBACK
// ==========================================
mongoose.connection.on('error', () => {
  console.log('⚠️  Switching to in-memory storage');
  useMongoDB = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected, using in-memory storage');
  useMongoDB = false;
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 GigHub Platform is running!`);
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🔐 Login page: http://localhost:${PORT}/login`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`\n💡 Use MongoDB for production, in-memory works for testing\n`);
});
