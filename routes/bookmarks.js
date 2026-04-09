const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmarkController');
const { authenticateToken } = require('../middleware/auth');

// Bookmark routes
router.get('/', authenticateToken, bookmarkController.getBookmarks);
router.post('/:postId/toggle', authenticateToken, bookmarkController.toggleBookmark);
router.get('/:postId/status', authenticateToken, bookmarkController.checkBookmarkStatus);
router.delete('/:postId', authenticateToken, bookmarkController.removeBookmark);

module.exports = router;
