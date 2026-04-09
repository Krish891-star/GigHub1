const Post = require('../models/Post');
const User = require('../models/User');
const authController = require('./authController');

let useMongoDB = true;

exports.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

// Advanced search for posts
exports.searchPosts = async (req, res) => {
  try {
    const { 
      query, 
      category, 
      minBudget, 
      maxBudget, 
      status,
      sortBy = 'createdAt',
      sortOrder = -1,
      page = 1,
      limit = 20
    } = req.query;

    if (useMongoDB) {
      let filter = {};

      // Text search
      if (query) {
        filter.$or = [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { userName: { $regex: query, $options: 'i' } }
        ];
      }

      // Category filter
      if (category) filter.category = category;

      // Status filter
      if (status) filter.status = status;

      // Budget filter
      if (minBudget || maxBudget) {
        filter.budget = {};
        if (minBudget) filter.budget.$gte = minBudget;
        if (maxBudget) filter.budget.$lte = maxBudget;
      }

      const sort = {};
      sort[sortBy] = parseInt(sortOrder);

      const posts = await Post.find(filter)
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Post.countDocuments(filter);

      res.json({
        posts,
        pagination: {
          page: page * 1,
          limit: limit * 1,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      let posts = inMemoryDB.posts;

      // Filter
      if (query) {
        const searchQuery = query.toLowerCase();
        posts = posts.filter(p => 
          p.title.toLowerCase().includes(searchQuery) ||
          p.description.toLowerCase().includes(searchQuery) ||
          p.userName.toLowerCase().includes(searchQuery)
        );
      }

      if (category) posts = posts.filter(p => p.category === category);
      if (status) posts = posts.filter(p => p.status === status);

      // Sort
      posts = posts.sort((a, b) => {
        if (sortBy === 'createdAt') {
          return sortOrder === 1 
            ? new Date(a.createdAt) - new Date(b.createdAt)
            : new Date(b.createdAt) - new Date(a.createdAt);
        }
        return 0;
      });

      // Pagination
      const start = (page - 1) * limit;
      const paginatedPosts = posts.slice(start, start + limit);

      res.json({
        posts: paginatedPosts,
        pagination: {
          page: page * 1,
          limit: limit * 1,
          total: posts.length,
          pages: Math.ceil(posts.length / limit)
        }
      });
    }
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Search creators
exports.searchCreators = async (req, res) => {
  try {
    const { query, skills, page = 1, limit = 20 } = req.query;

    if (useMongoDB) {
      let filter = { role: 'creator' };

      if (query) {
        filter.$or = [
          { name: { $regex: query, $options: 'i' } },
          { bio: { $regex: query, $options: 'i' } }
        ];
      }

      if (skills) {
        const skillArray = skills.split(',');
        filter.skills = { $in: skillArray.map(s => new RegExp(s, 'i')) };
      }

      const creators = await User.find(filter)
        .select('-password')
        .sort({ rating: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await User.countDocuments(filter);

      res.json({
        creators,
        pagination: {
          page: page * 1,
          limit: limit * 1,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      let creators = inMemoryDB.users.filter(u => u.role === 'creator');

      if (query) {
        const searchQuery = query.toLowerCase();
        creators = creators.filter(c => 
          c.name.toLowerCase().includes(searchQuery) ||
          (c.bio && c.bio.toLowerCase().includes(searchQuery))
        );
      }

      if (skills) {
        const skillArray = skills.split(',').map(s => s.toLowerCase());
        creators = creators.filter(c => 
          c.skills && c.skills.some(skill => 
            skillArray.some(s => skill.toLowerCase().includes(s))
          )
        );
      }

      const start = (page - 1) * limit;
      const paginatedCreators = creators.slice(start, start + limit);

      res.json({
        creators: paginatedCreators,
        pagination: {
          page: page * 1,
          limit: limit * 1,
          total: creators.length,
          pages: Math.ceil(creators.length / limit)
        }
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get trending posts (based on likes and comments)
exports.getTrendingPosts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    if (useMongoDB) {
      const posts = await Post.find({})
        .sort({ createdAt: -1 })
        .limit(50);

      // Calculate trending score
      const trendingPosts = posts.map(post => {
        const likes = post.likes ? post.likes.length : 0;
        const comments = post.comments ? post.comments.length : 0;
        const trendingScore = (likes * 2) + (comments * 3);
        return { ...post.toObject(), trendingScore };
      });

      // Sort by trending score
      trendingPosts.sort((a, b) => b.trendingScore - a.trendingScore);

      res.json({ 
        posts: trendingPosts.slice(0, limit)
      });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      const posts = inMemoryDB.posts;

      const trendingPosts = posts.map(post => {
        const likes = post.likes ? post.likes.length : 0;
        const comments = post.comments ? post.comments.length : 0;
        const trendingScore = (likes * 2) + (comments * 3);
        return { ...post, trendingScore };
      });

      trendingPosts.sort((a, b) => b.trendingScore - a.trendingScore);

      res.json({ 
        posts: trendingPosts.slice(0, limit)
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
