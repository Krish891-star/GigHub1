const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');

// All admin routes require auth + owner check
router.use(authenticateToken, adminController.requireOwner);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getAllUsers);
router.delete('/users/:id', adminController.deleteUser);
router.get('/posts', adminController.getAllPosts);
router.delete('/posts/:id', adminController.deletePost);
router.get('/shorts', adminController.getAllShorts);
router.delete('/shorts/:id', adminController.deleteShort);

module.exports = router;
