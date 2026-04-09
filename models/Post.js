const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userPhone: String,
  userWhatsapp: String,
  userAvatar: String,
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['poster', 'banner', 'wedding-card', 'website', 'seo', 'logo', 'video', 'other'],
    required: true 
  },
  budget: { type: String, required: true },
  images: [String],
  likes: [{ type: String }],
  comments: [{
    userId: String,
    userName: String,
    userAvatar: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['open', 'in-progress', 'completed', 'closed'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);
