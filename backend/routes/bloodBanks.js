const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const BloodBank = require('../models/BloodBank');

// Get all blood banks with optional search
router.get('/', async (req, res) => {
  try {
    const { search, lat, lng, radius = 50000 } = req.query; // radius in meters (default 50km)
    let query = { isActive: true };

    // Text search if provided
    if (search) {
      query.$text = { $search: search };
    }

    // Location-based search if coordinates provided
    if (lat && lng) {
      query.coordinates = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius)
        }
      };
    }

    const bloodBanks = await BloodBank.find(query)
      .sort({ name: 1 });

    res.json(bloodBanks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get blood bank by ID
router.get('/:id', async (req, res) => {
  try {
    const bloodBank = await BloodBank.findById(req.params.id);
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }
    res.json(bloodBank);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create blood bank (admin only)
router.post('/',
  [
    auth,
    body('name').notEmpty().withMessage('Name is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('hours').notEmpty().withMessage('Operating hours are required'),
    body('coordinates').isObject().withMessage('Coordinates are required'),
    body('coordinates.lat').isFloat().withMessage('Invalid latitude'),
    body('coordinates.lng').isFloat().withMessage('Invalid longitude')
  ],
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const bloodBank = new BloodBank(req.body);
      await bloodBank.save();

      res.status(201).json(bloodBank);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update blood bank (admin only)
router.patch('/:id',
  [
    auth,
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('address').optional().notEmpty().withMessage('Address cannot be empty'),
    body('phone').optional().notEmpty().withMessage('Phone cannot be empty'),
    body('hours').optional().notEmpty().withMessage('Operating hours cannot be empty'),
    body('coordinates').optional().isObject().withMessage('Invalid coordinates format'),
    body('coordinates.lat').optional().isFloat().withMessage('Invalid latitude'),
    body('coordinates.lng').optional().isFloat().withMessage('Invalid longitude')
  ],
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const bloodBank = await BloodBank.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!bloodBank) {
        return res.status(404).json({ message: 'Blood bank not found' });
      }

      res.json(bloodBank);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Update blood availability (admin only)
router.patch('/:id/availability',
  [
    auth,
    body('bloodAvailability').isObject().withMessage('Blood availability data is required'),
    body('bloodAvailability.*').isIn(['Critical', 'Very Low', 'Low', 'Medium', 'High'])
      .withMessage('Invalid availability level')
  ],
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const bloodBank = await BloodBank.findByIdAndUpdate(
        req.params.id,
        { $set: { bloodAvailability: req.body.bloodAvailability } },
        { new: true, runValidators: true }
      );

      if (!bloodBank) {
        return res.status(404).json({ message: 'Blood bank not found' });
      }

      res.json(bloodBank);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Add upcoming drive (admin only)
router.post('/:id/drives',
  [
    auth,
    body('name').notEmpty().withMessage('Drive name is required'),
    body('date').notEmpty().withMessage('Date is required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('bloodTypesNeeded').isArray().withMessage('Blood types needed must be an array'),
    body('bloodTypesNeeded.*').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
      .withMessage('Invalid blood type')
  ],
  async (req, res) => {
    try {
      // Check if user is admin
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const bloodBank = await BloodBank.findByIdAndUpdate(
        req.params.id,
        { $push: { upcomingDrives: req.body } },
        { new: true, runValidators: true }
      );

      if (!bloodBank) {
        return res.status(404).json({ message: 'Blood bank not found' });
      }

      res.status(201).json(bloodBank);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Remove upcoming drive (admin only)
router.delete('/:id/drives/:driveId', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const bloodBank = await BloodBank.findByIdAndUpdate(
      req.params.id,
      { $pull: { upcomingDrives: { _id: req.params.driveId } } },
      { new: true }
    );

    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }

    res.json({ message: 'Drive removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
