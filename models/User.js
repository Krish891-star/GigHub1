const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  email: { type: String, sparse: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['user', 'creator'], required: true },
  
  // Creator specific fields
  skills: [String],
  bio: String,
  portfolioLinks: [String],
  profileImage: String,
  whatsapp: String,
  
  // Enhanced Creator Profile Fields
  experience: [{
    title: String,
    company: String,
    duration: String,
    description: String,
    year: String
  }],
  certificates: [{
    name: String,
    issuer: String,
    year: String,
    url: String
  }],
  education: [{
    degree: String,
    institution: String,
    year: String
  }],
  languages: [String],
  hourlyRate: String,
  availability: { type: String, enum: ['available', 'busy', 'not-available'], default: 'available' },
  serviceCategories: [String],
  yearsOfExperience: Number,
  tagline: String,
  website: String,
  socialLinks: {
    instagram: String,
    twitter: String,
    linkedin: String,
    behance: String,
    dribbble: String
  },
  
  // Stats
  completedProjects: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  followers: [{ type: String }],
  following: [{ type: String }],
  
  // Profile completion
  profileCompleted: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
