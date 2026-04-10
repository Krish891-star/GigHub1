const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const authController = require('../controllers/authController');

let useMongoDB = true;

// Set MongoDB status from app.js
exports.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

// Complete creator profile (POST - for new creators after registration)
router.post('/complete-profile', authenticateToken, async (req, res) => {
  try {
    console.log('=== COMPLETE PROFILE REQUEST ===');
    console.log('User ID:', req.user.id);
    console.log('Request body:', req.body);
    console.log('Using MongoDB:', useMongoDB);
    
    const updateData = req.body;

    // Remove sensitive fields
    delete updateData.password;
    delete updateData.phone;
    delete updateData.role;

    console.log('Update data (sanitized):', updateData);

    if (useMongoDB) {
      // MongoDB mode
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        console.error('User not found:', req.user.id);
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('Profile updated successfully for:', user.name);
      console.log('Updated user object:', user);
      
      res.json({ success: true, user });
    } else {
      // In-memory mode
      const inMemoryDB = authController.getInMemoryDB();
      const userIndex = inMemoryDB.users.findIndex(u => u.id === req.user.id);

      if (userIndex === -1) {
        console.error('User not found in memory:', req.user.id);
        return res.status(404).json({ error: 'User not found' });
      }

      // Update user data
      inMemoryDB.users[userIndex] = {
        ...inMemoryDB.users[userIndex],
        ...updateData,
        profileCompleted: true
      };

      const user = inMemoryDB.users[userIndex];
      console.log('Profile updated successfully in memory for:', user.name);
      
      res.json({ success: true, user });
    }
  } catch (err) {
    console.error('Profile completion error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Get public profile
router.get('/profile/:id', async (req, res) => {
  try {
    if (useMongoDB) {
      const user = await User.findById(req.params.id).select('-password');
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      const user = inMemoryDB.users.find(u => u.id === req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Remove password
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get my profile
router.get('/my-profile', authenticateToken, async (req, res) => {
  try {
    if (useMongoDB) {
      const user = await User.findById(req.user.id).select('-password');
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      const user = inMemoryDB.users.find(u => u.id === req.user.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Remove password
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile (PUT - for existing profiles)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updateData = req.body;

    // Remove sensitive fields
    delete updateData.password;
    delete updateData.phone;
    delete updateData.role;

    if (useMongoDB) {
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ success: true, user });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      const userIndex = inMemoryDB.users.findIndex(u => u.id === req.user.id);

      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update user data
      inMemoryDB.users[userIndex] = {
        ...inMemoryDB.users[userIndex],
        ...updateData
      };

      res.json({ success: true, user: inMemoryDB.users[userIndex] });
    }
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export both router and setMongoDBStatus function
const usersRouter = router;
usersRouter.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

module.exports = usersRouter;
