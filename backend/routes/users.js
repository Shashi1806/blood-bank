const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, [
  body('name').optional().trim().notEmpty(),
  body('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  body('isDonor').optional().isBoolean(),
  body('phoneNumber').optional().trim(),
  body('address').optional().isObject(),
  body('emergencyContact').optional().isObject(),
  body('medicalInfo').optional().isObject(),
  body('preferences').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      bloodGroup,
      isDonor,
      phoneNumber,
      address,
      emergencyContact,
      medicalInfo,
      preferences
    } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (bloodGroup) updateFields.bloodGroup = bloodGroup;
    if (typeof isDonor !== 'undefined') updateFields.isDonor = isDonor;
    if (phoneNumber) updateFields.phoneNumber = phoneNumber;
    if (address) updateFields.address = address;
    if (emergencyContact) updateFields.emergencyContact = emergencyContact;
    if (medicalInfo) updateFields.medicalInfo = medicalInfo;
    if (preferences) updateFields.preferences = preferences;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile picture
router.put('/profile/picture', auth, async (req, res) => {
  try {
    const { photoUrl } = req.body;
    if (!photoUrl) {
      return res.status(400).json({ message: 'Photo URL is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { picture: photoUrl } },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get nearby donors
router.get('/nearby', auth, async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 10000 } = req.query; // maxDistance in meters

    if (!longitude || !latitude) {
      return res.status(400).json({ message: 'Location coordinates are required' });
    }

    const nearbyDonors = await User.find({
      isDonor: true,
      'address.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    }).select('name bloodGroup picture address');

    res.json(nearbyDonors);
  } catch (error) {
    console.error('Error finding nearby donors:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get top donors
router.get('/top', auth, async (req, res) => {
  try {
    const donors = await User.find({ isDonor: true })
      .select('name bloodGroup donationCount level badges livesImpacted')
      .sort({ donationCount: -1, livesImpacted: -1 })
      .limit(10);

    res.json(donors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user location
router.patch('/location', auth, async (req, res) => {
  try {
    const { longitude, latitude } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          location: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          }
        }
      },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('donationCount rewardPoints level levelProgress streak livesImpacted badges nextEligibleDate');

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user donation eligibility
router.get('/eligibility', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('lastDonation nextEligibleDate');

    const now = new Date();
    const isEligible = user.nextEligibleDate ? now >= user.nextEligibleDate : true;

    res.json({
      isEligible,
      lastDonation: user.lastDonation,
      nextEligibleDate: user.nextEligibleDate
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
