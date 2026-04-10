const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const postController = require('../controllers/postController');
const { authenticateToken, checkRole } = require('../middleware/auth');

// Multer configuration for post images and videos
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
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed (JPEG, PNG, GIF, WebP, MP4, WebM)'));
    }
  }
});

// Post routes
router.post('/', authenticateToken, upload.array('media', 5), postController.createPost);
router.get('/', postController.getAllPosts);
router.get('/my', authenticateToken, postController.getMyPosts);
router.get('/:id', postController.getPost);
router.put('/:id', authenticateToken, postController.updatePost);
router.delete('/:id', authenticateToken, postController.deletePost);
router.post('/:id/like', authenticateToken, postController.likePost);
router.post('/:id/comment', authenticateToken, postController.commentPost);

module.exports = router;
