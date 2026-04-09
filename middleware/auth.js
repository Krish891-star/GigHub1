const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gighub-secret-key-2024';

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.session?.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

const checkRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { authenticateToken, checkRole };
