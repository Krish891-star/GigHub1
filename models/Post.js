const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userPhone: String,
  userWhatsapp: String,
  userAvatar: String,
  title: String,
  description: String,
  category: { 
    type: String, 
    enum: ['poster', 'banner', 'wedding-card', 'website', 'seo', 'logo', 'video', 'other'],
  },
  budget: String,
  postType: { 
    type: String, 
    enum: ['post', 'video'], 
    default: 'post' 
  },
  images: [String],
  videoUrl: String,
  mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
  caption: String,
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

// Index for fast feed queries
postSchema.index({ createdAt: -1 });
postSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
