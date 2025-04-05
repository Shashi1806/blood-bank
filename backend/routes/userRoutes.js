const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

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

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -__v')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile'
    });
  }
});

// Update user profile
router.put('/profile', [
  auth,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('bloodGroup')
    .optional()
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group'),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-]{10,}$/)
    .withMessage('Invalid phone number format'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('location')
    .optional()
    .isObject()
    .withMessage('Invalid location format'),
  body('location.coordinates')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('Coordinates must be [longitude, latitude]'),
  validate
], async (req, res) => {
  try {
    const updateFields = {};
    const allowedFields = ['name', 'bloodGroup', 'phone', 'email', 'location', 'picture'];

    // Only include fields that are present in the request
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { 
        new: true,
        runValidators: true,
        select: '-password -__v'
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully'
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({
      success: false,
      message: err.code === 11000 ? 'Email already exists' : 'Failed to update profile'
    });
  }
});

// Check user permissions
router.get('/permissions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('isAdmin isDonor isVerified permissions')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        isAdmin: user.isAdmin,
        isDonor: user.isDonor,
        isVerified: user.isVerified,
        permissions: user.permissions || []
      }
    });
  } catch (err) {
    console.error('Get permissions error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user permissions'
    });
  }
});

// Delete account
router.delete('/account', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 
        $set: { 
          isActive: false,
          deactivatedAt: new Date(),
          deactivationReason: req.body.reason
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate account'
    });
  }
});

module.exports = router;