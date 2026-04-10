const StatusShorts = require('../models/StatusShorts');
const User = require('../models/User');
const authController = require('./authController');
const notificationController = require('./notificationController');

let useMongoDB = true;

exports.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

// Auto-delete status after 24 hours
setInterval(async () => {
  try {
    if (useMongoDB) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await StatusShorts.deleteMany({
        type: 'status',
        createdAt: { $lt: twentyFourHoursAgo }
      });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
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

exports.upload = async (req, res) => {
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
      const inMemoryDB = authController.getInMemoryDB();
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
      const inMemoryDB = authController.getInMemoryDB();
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
};

// Upload story (status type only, auto-deletes after 24h)
exports.uploadStory = async (req, res) => {
  try {
    const { caption } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Media file is required for stories' });
    }

    const mediaUrl = `/uploads/${req.file.filename}`;
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    let user;
    if (useMongoDB) {
      user = await User.findById(req.user.id);
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      user = inMemoryDB.users.find(u => u.id === req.user.id);
    }

    if (useMongoDB) {
      const story = new StatusShorts({
        userId: req.user.id,
        userName: user.name,
        userAvatar: user.profileImage || '',
        type: 'status',
        caption,
        mediaUrl,
        mediaType,
        expiresAt
      });

      await story.save();
      res.status(201).json({ success: true, story });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      const story = {
        id: inMemoryDB.nextStatusShortsId++,
        userId: req.user.id,
        userName: user.name,
        userAvatar: '',
        type: 'status',
        caption,
        mediaUrl,
        mediaType,
        likes: [],
        comments: [],
        views: [],
        viewCount: 0,
        isDeleted: false,
        expiresAt,
        createdAt: new Date()
      };

      inMemoryDB.statusShorts.push(story);
      res.status(201).json({ success: true, story });
    }
  } catch (err) {
    console.error('Story upload error:', err);
    res.status(500).json({ error: 'Server error during story upload' });
  }
};

// Get active stories (only status type, less than 24h old)
exports.getStories = async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    let stories;
    if (useMongoDB) {
      // Group stories by userId and get latest from each user
      stories = await StatusShorts.aggregate([
        {
          $match: {
            type: 'status',
            createdAt: { $gte: twentyFourHoursAgo },
            isDeleted: false
          }
        },
        { $sort: { userId: 1, createdAt: -1 } },
        {
          $group: {
            _id: '$userId',
            userName: { $first: '$userName' },
            userAvatar: { $first: '$userAvatar' },
            stories: { $push: '$$ROOT' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      const activeStories = inMemoryDB.statusShorts.filter(s => {
        return s.type === 'status' && 
               new Date(s.createdAt) >= twentyFourHoursAgo && 
               !s.isDeleted;
      });

      // Group by userId
      const groupedStories = {};
      activeStories.forEach(story => {
        if (!groupedStories[story.userId]) {
          groupedStories[story.userId] = {
            userId: story.userId,
            userName: story.userName,
            userAvatar: story.userAvatar,
            stories: []
          };
        }
        groupedStories[story.userId].stories.push(story);
      });

      stories = Object.values(groupedStories);
    }

    res.json({ stories });
  } catch (err) {
    console.error('Get stories error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFeed = async (req, res) => {
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
      const inMemoryDB = authController.getInMemoryDB();
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
};

exports.getMyPosts = async (req, res) => {
  try {
    let posts;
    if (useMongoDB) {
      posts = await StatusShorts.find({ userId: req.user.id, isDeleted: false })
        .sort({ createdAt: -1 });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      posts = inMemoryDB.statusShorts
        .filter(p => p.userId === req.user.id && !p.isDeleted)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.like = async (req, res) => {
  try {
    let post;
    if (useMongoDB) {
      post = await StatusShorts.findById(req.params.id);
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      post = inMemoryDB.statusShorts.find(p => p.id === parseInt(req.params.id));
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = useMongoDB ? req.user.id.toString() : req.user.id;
    const alreadyLiked = post.likes.includes(userId);

    if (useMongoDB) {
      if (alreadyLiked) {
        post.likes.pull(userId);
      } else {
        post.likes.push(userId);
      }
      await post.save();
      
      // Create notification for like
      if (!alreadyLiked && post.userId.toString() !== req.user.id.toString()) {
        const postOwner = await User.findById(post.userId);
        if (postOwner) {
          await notificationController.createNotification(
            post.userId,
            req.user.id,
            req.user.name,
            'like',
            post._id,
            `${req.user.name} liked your ${post.type}`
          );
        }
      }
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
};

exports.comment = async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    let post;
    let userName;
    if (useMongoDB) {
      post = await StatusShorts.findById(req.params.id);
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      post = inMemoryDB.statusShorts.find(p => p.id === parseInt(req.params.id));
      const user = inMemoryDB.users.find(u => u.id === req.user.id);
      userName = user ? user.name : req.user.name;
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = {
      userId: useMongoDB ? req.user.id.toString() : req.user.id,
      userName: useMongoDB ? req.user.name : userName,
      text,
      timestamp: new Date()
    };

    if (useMongoDB) {
      post.comments.push(comment);
      await post.save();
      
      // Create notification for comment
      if (post.userId.toString() !== req.user.id.toString()) {
        const postOwner = await User.findById(post.userId);
        if (postOwner) {
          await notificationController.createNotification(
            post.userId,
            req.user.id,
            req.user.name,
            'comment',
            post._id,
            `${req.user.name} commented on your ${post.type}`
          );
        }
      }
    } else {
      post.comments.push(comment);
    }

    res.json({ success: true, comments: post.comments });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.trackView = async (req, res) => {
  try {
    let post;
    if (useMongoDB) {
      post = await StatusShorts.findById(req.params.id);
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      post = inMemoryDB.statusShorts.find(p => p.id === parseInt(req.params.id));
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = useMongoDB ? req.user.id.toString() : req.user.id;
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
};

exports.deletePost = async (req, res) => {
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
      const inMemoryDB = authController.getInMemoryDB();
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
};

