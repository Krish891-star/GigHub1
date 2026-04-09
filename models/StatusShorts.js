const mongoose = require('mongoose');

const statusShortsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userAvatar: String,
  type: { type: String, enum: ['status', 'shorts'], required: true },
  caption: String,
  mediaUrl: { type: String, required: true },
  mediaType: { type: String, enum: ['video', 'image'], required: true },
  likes: [{ type: String }],
  comments: [{
    userId: String,
    userName: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  views: [{ type: String }],
  viewCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Auto-delete status after 24 hours
statusShortsSchema.index({ createdAt: 1 });

module.exports = mongoose.model('StatusShorts', statusShortsSchema);

