const Notification = require('../models/Notification');
const User = require('../models/User');
const authController = require('./authController');

let useMongoDB = true;

exports.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

// Create notification
exports.createNotification = async (recipientId, senderId, senderName, type, postId, message) => {
  try {
    if (useMongoDB) {
      const notification = new Notification({
        recipientId,
        senderId,
        senderName,
        type,
        postId,
        message
      });
      await notification.save();
    }
    // For in-memory, we skip notifications to keep it simple
  } catch (err) {
    console.error('Notification creation error:', err);
  }
};

// Get user notifications
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    if (useMongoDB) {
      let filter = { recipientId: req.user.id };
      if (unreadOnly === 'true') filter.isRead = false;

      const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('senderId', 'name profileImage')
        .populate('postId', 'title images');

      const unreadCount = await Notification.countDocuments({ 
        recipientId: req.user.id, 
        isRead: false 
      });

      res.json({ 
        notifications, 
        unreadCount,
        pagination: { page: page * 1, limit: limit * 1 }
      });
    } else {
      res.json({ notifications: [], unreadCount: 0 });
    }
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    if (useMongoDB) {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipientId: req.user.id },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ success: true, notification });
    } else {
      res.json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    if (useMongoDB) {
      await Notification.updateMany(
        { recipientId: req.user.id, isRead: false },
        { isRead: true }
      );

      res.json({ success: true });
    } else {
      res.json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    if (useMongoDB) {
      const notification = await Notification.findOneAndDelete({
        _id: req.params.id,
        recipientId: req.user.id
      });

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ success: true });
    } else {
      res.json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    if (useMongoDB) {
      const count = await Notification.countDocuments({
        recipientId: req.user.id,
        isRead: false
      });

      res.json({ count });
    } else {
      res.json({ count: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
