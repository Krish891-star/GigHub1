const Post = require('../models/Post');
const User = require('../models/User');
const authController = require('./authController');
const notificationController = require('./notificationController');

let useMongoDB = true;

exports.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

exports.createPost = async (req, res) => {
  try {
    console.log('=== CREATE POST REQUEST ===');
    console.log('Body:', req.body);
    console.log('Files:', req.files ? req.files.length : 0);
    console.log('User:', req.user);
    
    const { title, description, category, budget, whatsapp, postType, caption } = req.body;

    // Determine post type (default to 'post')
    const type = postType || 'post';
    console.log('Post type:', type);
    
    // For traditional posts, require all fields
    if (type === 'post') {
      if (!title || !description || !category || !budget) {
        return res.status(400).json({ error: 'All fields are required for posts' });
      }
    }

    // Separate image and video files
    const imagePaths = [];
    let videoPath = '';
    let mediaType = 'image';

    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        console.log('Processing file:', file.originalname, file.mimetype);
        if (file.mimetype.startsWith('video/')) {
          videoPath = `/uploads/${file.filename}`;
          mediaType = 'video';
        } else {
          imagePaths.push(`/uploads/${file.filename}`);
        }
      });
    }

    console.log('Image paths:', imagePaths);
    console.log('Video path:', videoPath);
    console.log('Media type:', mediaType);

    // For reels/shorts/video, require media
    if (type !== 'post' && !videoPath && imagePaths.length === 0) {
      return res.status(400).json({ error: 'Media file is required for reels/shorts/videos' });
    }

    let user;
    let inMemoryDB = null;
    
    if (useMongoDB) {
      user = await User.findById(req.user.id);
    } else {
      inMemoryDB = authController.getInMemoryDB();
      user = inMemoryDB.users.find(u => u.id === req.user.id);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User found:', user.name);

    if (useMongoDB) {
      const postData = {
        userId: req.user.id,
        userName: user.name,
        userPhone: user.phone,
        userWhatsapp: whatsapp || user.whatsapp,
        userAvatar: user.profileImage || '',
        postType: type,
        mediaType,
        videoUrl: videoPath,
        images: imagePaths,
        caption: caption || description || '',
      };

      // Add traditional post fields if it's a regular post
      if (type === 'post') {
        postData.title = title;
        postData.description = description;
        postData.category = category;
        postData.budget = budget;
      } else {
        // For reels/shorts/videos, use caption as title
        postData.title = caption || `${type} by ${user.name}`;
        postData.description = caption || '';
      }

      console.log('Creating post with data:', postData);
      const post = new Post(postData);
      await post.save();
      console.log('Post created successfully:', post._id);
      res.status(201).json({ message: 'Post created successfully', post });
    } else {
      const post = {
        id: inMemoryDB.nextPostId++,
        userId: req.user.id,
        userName: user.name,
        userPhone: user.phone,
        userWhatsapp: whatsapp || user.whatsapp,
        userAvatar: '',
        postType: type,
        mediaType,
        videoUrl: videoPath,
        title: type === 'post' ? title : (caption || `${type} by ${user.name}`),
        description: type === 'post' ? description : (caption || ''),
        category: category || 'other',
        budget: budget || '',
        caption: caption || description || '',
        images: imagePaths,
        likes: [],
        comments: [],
        status: 'open',
        createdAt: new Date()
      };

      inMemoryDB.posts.push(post);
      console.log('Post created in memory:', post.id);
      res.status(201).json({ message: 'Post created successfully', post });
    }
  } catch (err) {
    console.error('Create post error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const { category, status } = req.query;
    let filter = {};
    
    if (category) filter.category = category;
    if (status) filter.status = status;

    let posts;
    if (useMongoDB) {
      posts = await Post.find(filter).sort({ createdAt: -1 }).populate('userId', 'name phone');
    } else {
      const inMemoryDB = authController.getInMemoryDB();
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
};

exports.getMyPosts = async (req, res) => {
  try {
    let posts;
    if (useMongoDB) {
      posts = await Post.find({ userId: req.user.id }).sort({ createdAt: -1 });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      posts = inMemoryDB.posts
        .filter(post => post.userId === req.user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getPost = async (req, res) => {
  try {
    let post;
    if (useMongoDB) {
      post = await Post.findById(req.params.id).populate('userId', 'name phone');
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      post = inMemoryDB.posts.find(p => p.id === parseInt(req.params.id));
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updatePost = async (req, res) => {
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
      const inMemoryDB = authController.getInMemoryDB();
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
};

exports.deletePost = async (req, res) => {
  try {
    if (useMongoDB) {
      const post = await Post.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
      
      if (!post) {
        return res.status(404).json({ error: 'Post not found or unauthorized' });
      }
    } else {
      const inMemoryDB = authController.getInMemoryDB();
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
};

exports.likePost = async (req, res) => {
  try {
    let post;
    if (useMongoDB) {
      post = await Post.findById(req.params.id);
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      post = inMemoryDB.posts.find(p => p.id === parseInt(req.params.id));
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = useMongoDB ? req.user.id.toString() : req.user.id;
    const alreadyLiked = post.likes && post.likes.includes(userId);

    if (useMongoDB) {
      if (!post.likes) post.likes = [];
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
            `${req.user.name} liked your post "${post.title}"`
          );
        }
      }
    } else {
      if (!post.likes) post.likes = [];
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

exports.commentPost = async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    let post;
    let userName;
    if (useMongoDB) {
      post = await Post.findById(req.params.id);
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      post = inMemoryDB.posts.find(p => p.id === parseInt(req.params.id));
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
      if (!post.comments) post.comments = [];
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
            `${req.user.name} commented on your post "${post.title}"`
          );
        }
      }
    } else {
      if (!post.comments) post.comments = [];
      post.comments.push(comment);
    }

    res.json({ success: true, comments: post.comments });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
