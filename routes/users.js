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

      inMemoryDB.users[userIndex] = { ...inMemoryDB.users[userIndex], ...updateData };
      res.json({ success: true, user: inMemoryDB.users[userIndex] });
    }
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update account details — phone, email, name, password (requires current password)
router.put('/account', authenticateToken, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { name, email, phone, currentPassword, newPassword } = req.body;

    if (useMongoDB) {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // If changing phone or password, require current password
      const needsVerify = phone || newPassword;
      if (needsVerify) {
        if (!currentPassword) return res.status(400).json({ error: 'Current password is required to change phone or password' });
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      }

      if (name) user.name = name;
      if (email !== undefined) user.email = email;
      if (phone) {
        const existing = await User.findOne({ phone, _id: { $ne: user._id } });
        if (existing) return res.status(400).json({ error: 'Phone number already in use' });
        user.phone = phone;
      }
      if (newPassword) {
        if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
        user.password = await bcrypt.hash(newPassword, 10);
      }

      await user.save();
      const { password: _, ...safeUser } = user.toObject();
      res.json({ success: true, user: safeUser });
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      const idx = inMemoryDB.users.findIndex(u => u.id === req.user.id);
      if (idx === -1) return res.status(404).json({ error: 'User not found' });
      const user = inMemoryDB.users[idx];

      const needsVerify = phone || newPassword;
      if (needsVerify) {
        if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      }

      if (name) user.name = name;
      if (email !== undefined) user.email = email;
      if (phone) user.phone = phone;
      if (newPassword) user.password = await bcrypt.hash(newPassword, 10);

      const { password: _, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    }
  } catch (err) {
    console.error('Account update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export both router and setMongoDBStatus function
const usersRouter = router;
usersRouter.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

module.exports = usersRouter;
