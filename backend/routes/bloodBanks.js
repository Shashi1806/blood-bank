const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const BloodBank = require('../models/BloodBank');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      errors: errors.array() 
    });
  }
  next();
};

// Get all blood banks with search, pagination and filtering
router.get('/', [
  query('search').optional().trim(),
  query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  query('radius').optional().isInt({ min: 1, max: 100000 }).withMessage('Radius must be between 1-100000 meters'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate
], async (req, res) => {
  try {
    const { search, lat, lng, radius = 50000, page = 1, limit = 10 } = req.query;
    let query = { isActive: true };

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Location-based search
    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius)
        }
      };
    }

    const [bloodBanks, total] = await Promise.all([
      BloodBank.find(query)
        .select('-__v')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      BloodBank.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: bloodBanks,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Get blood banks error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch blood banks' 
    });
  }
});

// Get blood bank by ID
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid blood bank ID'),
  validate
], async (req, res) => {
  try {
    const bloodBank = await BloodBank.findById(req.params.id).select('-__v');
    
    if (!bloodBank) {
      return res.status(404).json({
        success: false,
        message: 'Blood bank not found'
      });
    }

    res.json({
      success: true,
      data: bloodBank
    });
  } catch (err) {
    console.error('Get blood bank error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blood bank'
    });
  }
});

// Create blood bank (admin only)
router.post('/', [
  auth,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('phone').matches(/^\+?[\d\s-]{10,}$/).withMessage('Invalid phone number'),
  body('hours').notEmpty().withMessage('Operating hours are required'),
  body('location.coordinates').isArray().withMessage('Coordinates are required'),
  body('location.coordinates.0').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('location.coordinates.1').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  validate
], async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const bloodBank = new BloodBank({
      ...req.body,
      createdBy: req.user._id
    });
    
    await bloodBank.save();

    res.status(201).json({
      success: true,
      data: bloodBank
    });
  } catch (err) {
    console.error('Create blood bank error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create blood bank'
    });
  }
});

// ...existing code for update blood bank...

// Update blood availability
router.patch('/:id/availability', [
  auth,
  param('id').isMongoId().withMessage('Invalid blood bank ID'),
  body('bloodAvailability').isObject().withMessage('Blood availability data required'),
  body('bloodAvailability.*').isIn(['Critical', 'Very Low', 'Low', 'Medium', 'High']),
  validate
], async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const bloodBank = await BloodBank.findByIdAndUpdate(
      req.params.id,
      { $set: { bloodAvailability: req.body.bloodAvailability } },
      { new: true, runValidators: true }
    );

    if (!bloodBank) {
      return res.status(404).json({
        success: false,
        message: 'Blood bank not found'
      });
    }

    res.json({
      success: true,
      data: bloodBank
    });
  } catch (err) {
    console.error('Update availability error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update blood availability'
    });
  }
});

// ...existing code for drives management...

module.exports = router;