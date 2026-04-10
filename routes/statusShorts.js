const express = require('express');
const router = express.Router();
const multer = require('multer');
const statusShortsController = require('../controllers/statusShortsController');
const { authenticateToken } = require('../middleware/auth');

// Multer configuration for status/shorts media
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Status & Shorts routes
router.post('/upload', authenticateToken, upload.single('media'), statusShortsController.upload);
router.post('/story', authenticateToken, upload.single('media'), statusShortsController.uploadStory);
router.get('/feed', statusShortsController.getFeed);
router.get('/stories', statusShortsController.getStories);
router.get('/my', authenticateToken, statusShortsController.getMyPosts);
router.post('/:id/like', authenticateToken, statusShortsController.like);
router.post('/:id/comment', authenticateToken, statusShortsController.comment);
router.post('/:id/view', authenticateToken, statusShortsController.trackView);
router.delete('/:id', authenticateToken, statusShortsController.deletePost);

module.exports = router;
