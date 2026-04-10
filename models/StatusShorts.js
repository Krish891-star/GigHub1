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
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Index for auto-deletion of status after 24 hours
statusShortsSchema.index({ createdAt: 1 });
statusShortsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Set expiresAt for status type (24 hours from creation)
statusShortsSchema.pre('save', function(next) {
  if (this.type === 'status' && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }
  next();
});

module.exports = mongoose.model('StatusShorts', statusShortsSchema);

