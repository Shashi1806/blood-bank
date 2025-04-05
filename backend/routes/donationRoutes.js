const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Donation = require('../models/Donation');
const User = require('../models/User');
const BloodBank = require('../models/BloodBank');
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

// Create new donation
router.post('/', [
  auth,
  body('bloodBank').isMongoId().withMessage('Valid blood bank ID is required'),
  body('bloodGroup')
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Valid blood group is required'),
  body('units')
    .isInt({ min: 1, max: 5 })
    .withMessage('Units must be between 1 and 5'),
  body('donationDate')
    .isISO8601()
    .withMessage('Valid donation date is required'),
  validate
], async (req, res) => {
  try {
    // Check if user can donate (last donation > 3 months)
    const lastDonation = await Donation.findOne({ 
      donor: req.user._id,
      status: 'completed',
      donationDate: { 
        $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      }
    });

    if (lastDonation) {
      return res.status(400).json({
        success: false,
        message: 'Must wait 3 months between donations'
      });
    }

    const donation = new Donation({
      ...req.body,
      donor: req.user._id,
      status: 'pending'
    });

    await donation.save();

    // Update user's donation count and last donation date
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { donationCount: 1 },
      $set: { lastDonation: donation.donationDate }
    });

    res.status(201).json({
      success: true,
      data: donation
    });
  } catch (err) {
    console.error('Create donation error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create donation'
    });
  }
});

// Get user's donations with pagination and filtering
router.get('/my', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['pending', 'approved', 'completed', 'cancelled']),
  validate
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const query = { donor: req.user._id };

    if (req.query.status) {
      query.status = req.query.status;
    }

    const [donations, total] = await Promise.all([
      Donation.find(query)
        .populate('bloodBank', 'name location')
        .sort({ donationDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Donation.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: donations,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Get donations error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donations'
    });
  }
});

// Get donation by ID
router.get('/:id', [
  auth,
  param('id').isMongoId().withMessage('Invalid donation ID'),
  validate
], async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate('bloodBank', 'name location contact email')
      .populate('donor', 'name email');

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    // Check if user is authorized to view this donation
    if (donation.donor._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    res.json({
      success: true,
      data: donation
    });
  } catch (err) {
    console.error('Get donation error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation'
    });
  }
});

// Update donation status (admin only)
router.patch('/:id/status', [
  auth,
  param('id').isMongoId().withMessage('Invalid donation ID'),
  body('status')
    .isIn(['pending', 'approved', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('note').optional().trim().isLength({ max: 500 }),
  validate
], async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { status, note } = req.body;
    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          status,
          statusNote: note,
          statusUpdatedAt: Date.now(),
          statusUpdatedBy: req.user._id
        }
      },
      { new: true }
    ).populate('bloodBank', 'name');

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    res.json({
      success: true,
      data: donation
    });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update status'
    });
  }
});

module.exports = router;