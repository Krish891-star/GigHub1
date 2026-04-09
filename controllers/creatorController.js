const User = require('../models/User');
const authController = require('./authController');

let useMongoDB = true;

exports.setMongoDBStatus = (status) => {
  useMongoDB = status;
};

exports.getAllCreators = async (req, res) => {
  try {
    let creators;
    if (useMongoDB) {
      creators = await User.find({ role: 'creator' }).select('-password');
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      creators = inMemoryDB.users
        .filter(u => u.role === 'creator')
        .map(({ password, ...user }) => user);
    }

    res.json({ creators });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getCreator = async (req, res) => {
  try {
    let creator;
    if (useMongoDB) {
      creator = await User.findById(req.params.id).select('-password');
    } else {
      const inMemoryDB = authController.getInMemoryDB();
      creator = inMemoryDB.users.find(u => u.id === parseInt(req.params.id));
      if (creator) {
        const { password, ...creatorWithoutPassword } = creator;
        creator = creatorWithoutPassword;
      }
    }

    if (!creator || creator.role !== 'creator') {
      return res.status(404).json({ error: 'Creator not found' });
    }

    res.json({ creator });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
