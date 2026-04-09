const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Search routes
router.get('/posts', searchController.searchPosts);
router.get('/creators', searchController.searchCreators);
router.get('/trending', searchController.getTrendingPosts);

module.exports = router;
