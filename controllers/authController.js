const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'gighub-secret-key-2024';

// In-memory fallback - will be set by app.js
let inMemoryDB = null;
let useMongoDB = true;

exports.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

exports.setInMemoryDB = (db) => {
  inMemoryDB = db;
};

exports.signup = async (req, res) => {
  try {
    const { phone, email, password, name, role } = req.body;

    if (!phone || !password || !name || !role) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }

    if (useMongoDB) {
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        phone,
        email,
        password: hashedPassword,
        name,
        role
      });

      await user.save();

      const token = jwt.sign(
        { id: user._id, phone: user.phone, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'Signup successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role
        }
      });
    } else {
      const existingUser = inMemoryDB.users.find(u => u.phone === phone);
      if (existingUser) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: inMemoryDB.nextUserId++,
        phone,
        email,
        password: hashedPassword,
        name,
        role,
        skills: [],
        bio: '',
        portfolioLinks: [],
        whatsapp: '',
        completedProjects: 0,
        rating: 0,
        followers: [],
        following: [],
        createdAt: new Date()
      };

      inMemoryDB.users.push(user);

      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'Signup successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role
        }
      });
    }
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    let user;
    if (useMongoDB) {
      user = await User.findOne({ phone });
    } else {
      user = inMemoryDB.users.find(u => u.phone === phone);
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id || user.id, phone: user.phone, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    req.session.token = token;

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

exports.getMe = async (req, res) => {
  try {
    let user;
    if (useMongoDB) {
      user = await User.findById(req.user.id).select('-password');
    } else {
      user = inMemoryDB.users.find(u => u.id === req.user.id);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        user = userWithoutPassword;
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    
    if (useMongoDB) {
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password');
      
      res.json({ message: 'Profile updated', user });
    } else {
      const userIndex = inMemoryDB.users.findIndex(u => u.id === req.user.id);
      if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      inMemoryDB.users[userIndex] = { ...inMemoryDB.users[userIndex], ...updates };
      res.json({ message: 'Profile updated', user: inMemoryDB.users[userIndex] });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getInMemoryDB = () => inMemoryDB;
