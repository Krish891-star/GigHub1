const Post = require('../models/Post');
const User = require('../models/User');
const Bookmark = require('../models/Bookmark');

let useMongoDB = true;

exports.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

// Get user analytics
exports.getUserAnalytics = async (req, res) => {
  try {
    if (useMongoDB) {
      const userId = req.user.id;

      // Get user's posts
      const userPosts = await Post.find({ userId });
      const totalPosts = userPosts.length;

      // Calculate total engagement
      let totalLikes = 0;
      let totalComments = 0;
      userPosts.forEach(post => {
        totalLikes += post.likes ? post.likes.length : 0;
        totalComments += post.comments ? post.comments.length : 0;
      });

      // Get bookmarks count
      const totalBookmarks = await Bookmark.countDocuments({ userId });

      // Get user details
      const user = await User.findById(userId);

      // Get top performing post
      let topPost = null;
      if (userPosts.length > 0) {
        topPost = userPosts.reduce((prev, current) => {
          const prevScore = (prev.likes?.length || 0) + (prev.comments?.length || 0);
          const currentScore = (current.likes?.length || 0) + (current.comments?.length || 0);
          return prevScore > currentScore ? prev : current;
        });
      }

      // Posts by category
      const postsByCategory = {};
      userPosts.forEach(post => {
        postsByCategory[post.category] = (postsByCategory[post.category] || 0) + 1;
      });

      res.json({
        analytics: {
          totalPosts,
          totalLikes,
          totalComments,
          totalBookmarks,
          followers: user.followers ? user.followers.length : 0,
          following: user.following ? user.following.length : 0,
          topPost: topPost ? {
            id: topPost._id,
            title: topPost.title,
            likes: topPost.likes?.length || 0,
            comments: topPost.comments?.length || 0
          } : null,
          postsByCategory,
          engagementRate: totalPosts > 0 ? ((totalLikes + totalComments) / totalPosts).toFixed(2) : 0
        }
      });
    } else {
      res.status(501).json({ error: 'Analytics require MongoDB' });
    }
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get platform-wide analytics (for admins)
exports.getPlatformAnalytics = async (req, res) => {
  try {
    if (useMongoDB) {
      const totalUsers = await User.countDocuments();
      const totalCreators = await User.countDocuments({ role: 'creator' });
      const totalPosts = await Post.countDocuments();
      
      // Posts by status
      const postsByStatus = await Post.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Posts by category
      const postsByCategory = await Post.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);

      // Total engagement
      const allPosts = await Post.find({});
      let totalLikes = 0;
      let totalComments = 0;
      allPosts.forEach(post => {
        totalLikes += post.likes ? post.likes.length : 0;
        totalComments += post.comments ? post.comments.length : 0;
      });

      res.json({
        analytics: {
          totalUsers,
          totalCreators,
          totalPosts,
          totalLikes,
          totalComments,
          postsByStatus: postsByStatus.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          postsByCategory: postsByCategory.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          averageEngagementPerPost: totalPosts > 0 ? ((totalLikes + totalComments) / totalPosts).toFixed(2) : 0
        }
      });
    } else {
      res.status(501).json({ error: 'Analytics require MongoDB' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
