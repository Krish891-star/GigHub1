const User = require('../models/User');
const authController = require('./authController');
const notificationController = require('./notificationController');

let useMongoDB = true;

exports.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

// Follow/Unfollow a user
exports.followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = useMongoDB ? req.user.id.toString() : req.user.id;

    if (currentUserId.toString() === userId.toString()) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    let userToFollow;
    let currentUser;

    if (useMongoDB) {
      userToFollow = await User.findById(userId);
      currentUser = await User.findById(currentUserId);

      if (!userToFollow || !currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const alreadyFollowing = currentUser.following.includes(userId);

      if (alreadyFollowing) {
        // Unfollow
        currentUser.following.pull(userId);
        userToFollow.followers.pull(currentUserId);
      } else {
        // Follow
        currentUser.following.push(userId);
        userToFollow.followers.push(currentUserId);
        
        // Create notification for follow
        await notificationController.createNotification(
          userId,
          currentUserId,
          currentUser.name,
          'follow',
          null,
          `${currentUser.name} started following you`
        );
      }

      await currentUser.save();
      await userToFollow.save();

      res.json({
        success: true,
        following: !alreadyFollowing,
        followers: userToFollow.followers.length,
        followingCount: currentUser.following.length
      });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      userToFollow = inMemoryDB.users.find(u => u.id.toString() === userId.toString());
      currentUser = inMemoryDB.users.find(u => u.id.toString() === currentUserId.toString());

      if (!userToFollow || !currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!currentUser.following) currentUser.following = [];
      if (!userToFollow.followers) userToFollow.followers = [];

      const alreadyFollowing = currentUser.following.includes(userId);

      if (alreadyFollowing) {
        currentUser.following = currentUser.following.filter(id => id.toString() !== userId.toString());
        userToFollow.followers = userToFollow.followers.filter(id => id.toString() !== currentUserId.toString());
      } else {
        currentUser.following.push(userId);
        userToFollow.followers.push(currentUserId);
      }

      res.json({
        success: true,
        following: !alreadyFollowing,
        followers: userToFollow.followers.length,
        followingCount: currentUser.following.length
      });
    }
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get user's followers
exports.getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;

    let user;
    if (useMongoDB) {
      user = await User.findById(userId).populate('followers', 'name phone profileImage');
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      user = inMemoryDB.users.find(u => u.id.toString() === userId.toString());
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ followers: user.followers || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get user's following
exports.getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;

    let user;
    if (useMongoDB) {
      user = await User.findById(userId).populate('following', 'name phone profileImage');
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      user = inMemoryDB.users.find(u => u.id.toString() === userId.toString());
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ following: user.following || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Check if following
exports.checkFollowStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = useMongoDB ? req.user.id.toString() : req.user.id;

    let currentUser;
    if (useMongoDB) {
      currentUser = await User.findById(currentUserId);
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      currentUser = inMemoryDB.users.find(u => u.id.toString() === currentUserId.toString());
    }

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isFollowing = currentUser.following && currentUser.following.some(id => id.toString() === userId.toString());

    res.json({ following: isFollowing });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
