const express = require('express');
const router = express.Router();
const creatorController = require('../controllers/creatorController');

// Creator routes
router.get('/', creatorController.getAllCreators);
router.get('/:id', creatorController.getCreator);

module.exports = router;
