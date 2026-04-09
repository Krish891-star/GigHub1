const express = require('express');
const router = express.Router();
const followController = require('../controllers/followController');
const { authenticateToken } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimiter');

// Follow routes
router.post('/:userId/follow', authenticateToken, actionLimiter, followController.followUser);
router.get('/:userId/followers', authenticateToken, followController.getFollowers);
router.get('/:userId/following', authenticateToken, followController.getFollowing);
router.get('/:userId/follow-status', authenticateToken, followController.checkFollowStatus);

module.exports = router;
