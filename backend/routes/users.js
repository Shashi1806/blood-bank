const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all users
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user
router.patch('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only allow updating certain fields
    const allowedUpdates = [
      'name',
      'bloodGroup',
      'phoneNumber',
      'address',
      'emergencyContact',
      'medicalInfo',
      'preferences'
    ];

    Object.keys(req.body).forEach(update => {
      if (allowedUpdates.includes(update)) {
        user[update] = req.body[update];
      }
    });

    const updatedUser = await user.save();
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Find donors by blood group
router.get('/donors/:bloodGroup', auth, async (req, res) => {
  try {
    const users = await User.find({
      bloodGroup: req.params.bloodGroup,
      'roles.isDonor': true,
      'accountStatus.isActive': true
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update donation history
router.post('/:id/donations', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.donationHistory.lastDonation = new Date();
    user.donationHistory.donationCount += 1;
    user.donationHistory.totalUnits += req.body.units || 1;

    // Calculate next eligible date (3 months from last donation)
    const nextEligibleDate = new Date(user.donationHistory.lastDonation);
    nextEligibleDate.setMonth(nextEligibleDate.getMonth() + 3);
    user.donationHistory.nextEligibleDate = nextEligibleDate;

    // Update reward points (10 points per donation)
    await user.updateRewardPoints(10);

    const updatedUser = await user.save();
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;