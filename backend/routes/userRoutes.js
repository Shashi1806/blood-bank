const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, bloodGroup, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name, bloodGroup, phone } },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if user is admin
router.get('/check-admin', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('isAdmin');
    res.json({ isAdmin: user.isAdmin });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
