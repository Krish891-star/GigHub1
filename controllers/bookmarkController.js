const Bookmark = require('../models/Bookmark');
const Post = require('../models/Post');

let useMongoDB = true;

exports.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

// Toggle bookmark
exports.toggleBookmark = async (req, res) => {
  try {
    const { postId } = req.params;

    if (useMongoDB) {
      // Check if post exists
      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Check if already bookmarked
      const existingBookmark = await Bookmark.findOne({
        userId: req.user.id,
        postId
      });

      if (existingBookmark) {
        // Remove bookmark
        await Bookmark.deleteOne({ _id: existingBookmark._id });
        res.json({ success: true, bookmarked: false, message: 'Bookmark removed' });
      } else {
        // Add bookmark
        const bookmark = new Bookmark({
          userId: req.user.id,
          postId,
          postTitle: post.title,
          postImage: post.images && post.images.length > 0 ? post.images[0] : '',
          postCategory: post.category,
          postBudget: post.budget
        });
        await bookmark.save();
        res.json({ success: true, bookmarked: true, message: 'Post bookmarked' });
      }
    } else {
      res.status(501).json({ error: 'Bookmarks require MongoDB' });
    }
  } catch (err) {
    console.error('Toggle bookmark error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get user's bookmarks
exports.getBookmarks = async (req, res) => {
  try {
    if (useMongoDB) {
      const { page = 1, limit = 20 } = req.query;

      const bookmarks = await Bookmark.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Bookmark.countDocuments({ userId: req.user.id });

      res.json({ 
        bookmarks,
        pagination: { 
          page: page * 1, 
          limit: limit * 1,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } else {
      res.status(501).json({ error: 'Bookmarks require MongoDB' });
    }
  } catch (err) {
    console.error('Get bookmarks error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Check if post is bookmarked
exports.checkBookmarkStatus = async (req, res) => {
  try {
    const { postId } = req.params;

    if (useMongoDB) {
      const bookmark = await Bookmark.findOne({
        userId: req.user.id,
        postId
      });

      res.json({ bookmarked: !!bookmark });
    } else {
      res.json({ bookmarked: false });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Remove bookmark
exports.removeBookmark = async (req, res) => {
  try {
    const { postId } = req.params;

    if (useMongoDB) {
      const result = await Bookmark.deleteOne({
        userId: req.user.id,
        postId
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Bookmark not found' });
      }

      res.json({ success: true, message: 'Bookmark removed' });
    } else {
      res.status(501).json({ error: 'Bookmarks require MongoDB' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
