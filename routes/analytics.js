const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');

// Analytics routes
router.get('/user', authenticateToken, analyticsController.getUserAnalytics);
router.get('/platform', authenticateToken, analyticsController.getPlatformAnalytics);

module.exports = router;
