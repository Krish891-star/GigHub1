const User = require('../models/User');
const Post = require('../models/Post');
const StatusShorts = require('../models/StatusShorts');
const Notification = require('../models/Notification');
const Bookmark = require('../models/Bookmark');
const fs = require('fs');
const path = require('path');

const OWNER_PHONE = process.env.OWNER_PHONE || '8410104406';

// Middleware: only owner can access — checks JWT flag OR phone in DB
exports.requireOwner = async (req, res, next) => {
  try {
    if (!req.user) return res.status(403).json({ error: 'Access denied.' });
    // Fast path: JWT already has isOwner flag
    if (req.user.isOwner === true || req.user.role === 'owner') return next();
    // Fallback: check phone in DB (handles old tokens)
    if (req.user.phone === OWNER_PHONE) return next();
    // DB fallback for old tokens without phone in payload
    const user = await User.findById(req.user.id).select('phone isOwner role');
    if (user && (user.isOwner || user.phone === OWNER_PHONE || user.role === 'owner')) return next();
    return res.status(403).json({ error: 'Access denied. Owner only.' });
  } catch (err) {
    return res.status(403).json({ error: 'Access denied.' });
  }
};

// GET /api/admin/stats
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, totalPosts, totalShorts, totalCreators] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments(),
      StatusShorts.countDocuments({ isDeleted: false }),
      User.countDocuments({ role: 'creator' })
    ]);
    res.json({ stats: { totalUsers, totalPosts, totalShorts, totalCreators } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 30, search } = req.query;
    let filter = {};
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await User.countDocuments(filter);
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isOwner) return res.status(400).json({ error: 'Cannot delete owner account' });

    // Delete all their posts and media files
    const posts = await Post.find({ userId: req.params.id });
    for (const post of posts) {
      const files = [...(post.images || [])];
      if (post.videoUrl) files.push(post.videoUrl);
      files.forEach(f => { try { const fp = path.join(__dirname, '..', f); if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {} });
    }
    await Post.deleteMany({ userId: req.params.id });

    // Delete their shorts
    const shorts = await StatusShorts.find({ userId: req.params.id });
    for (const s of shorts) {
      if (s.mediaUrl) { try { const fp = path.join(__dirname, '..', s.mediaUrl); if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {} }
    }
    await StatusShorts.deleteMany({ userId: req.params.id });

    // Delete notifications, bookmarks
    await Notification.deleteMany({ $or: [{ recipientId: req.params.id }, { senderId: req.params.id }] });
    await Bookmark.deleteMany({ userId: req.params.id });

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User and all their content deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/admin/posts
exports.getAllPosts = async (req, res) => {
  try {
    const { page = 1, limit = 30, search } = req.query;
    let filter = {};
    if (search) filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { userName: { $regex: search, $options: 'i' } }
    ];
    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await Post.countDocuments(filter);
    res.json({ posts, total });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/admin/posts/:id
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const files = [...(post.images || [])];
    if (post.videoUrl) files.push(post.videoUrl);
    files.forEach(f => { try { const fp = path.join(__dirname, '..', f); if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {} });
    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/admin/shorts
exports.getAllShorts = async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const shorts = await StatusShorts.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await StatusShorts.countDocuments({ isDeleted: false });
    res.json({ shorts, total });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/admin/shorts/:id
exports.deleteShort = async (req, res) => {
  try {
    const short = await StatusShorts.findById(req.params.id);
    if (!short) return res.status(404).json({ error: 'Short not found' });
    if (short.mediaUrl) { try { const fp = path.join(__dirname, '..', short.mediaUrl); if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {} }
    await StatusShorts.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Short/Status deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
