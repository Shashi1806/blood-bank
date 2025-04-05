const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const BloodRequest = require('../models/BloodRequest');
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

// Create blood request
router.post('/', [
  auth,
  body('bloodGroup')
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group'),
  body('units')
    .isInt({ min: 1, max: 10 })
    .withMessage('Units must be between 1 and 10'),
  body('requiredDate')
    .isISO8601()
    .custom(value => new Date(value) > new Date())
    .withMessage('Required date must be in the future'),
  body('targetBloodBanks')
    .isArray()
    .withMessage('Target blood banks must be an array'),
  body('targetBloodBanks.*')
    .isMongoId()
    .withMessage('Invalid blood bank ID'),
  validate
], async (req, res) => {
  try {
    const request = new BloodRequest({
      ...req.body,
      requesterId: req.user.id,
      status: 'Open'
    });
    await request.save();

    const populatedRequest = await BloodRequest.findById(request._id)
      .populate('requesterId', 'name email')
      .populate('targetBloodBanks', 'name location');

    res.status(201).json({
      success: true,
      data: populatedRequest
    });
  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create blood request'
    });
  }
});

// Get all blood requests with pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['Open', 'Fulfilled', 'Cancelled']),
  validate
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    const [requests, total] = await Promise.all([
      BloodRequest.find(query)
        .populate('requesterId', 'name email')
        .populate('targetBloodBanks', 'name location')
        .sort({ requiredDate: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      BloodRequest.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: requests,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blood requests'
    });
  }
});

// Get user's blood requests
router.get('/my', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const [requests, total] = await Promise.all([
      BloodRequest.find({ requesterId: req.user.id })
        .populate('targetBloodBanks', 'name location')
        .sort({ requiredDate: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      BloodRequest.countDocuments({ requesterId: req.user.id })
    ]);

    res.json({
      success: true,
      data: requests,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Get user requests error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user requests'
    });
  }
});

// Get blood request by ID
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid request ID'),
  validate
], async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id)
      .populate('requesterId', 'name email')
      .populate('targetBloodBanks', 'name location contact email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Blood request not found'
      });
    }

    res.json({
      success: true,
      data: request
    });
  } catch (err) {
    console.error('Get request error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blood request'
    });
  }
});

// Update blood request status
router.patch('/:id/status', [
  auth,
  param('id').isMongoId().withMessage('Invalid request ID'),
  body('status')
    .isIn(['Open', 'Fulfilled', 'Cancelled'])
    .withMessage('Invalid status'),
  body('note').optional().trim().isLength({ max: 500 }),
  validate
], async (req, res) => {
  try {
    const { status, note } = req.body;
    const request = await BloodRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Blood request not found'
      });
    }

    if (request.requesterId.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    request.status = status;
    request.statusNote = note;
    request.statusUpdatedAt = new Date();
    request.statusUpdatedBy = req.user.id;

    await request.save();

    res.json({
      success: true,
      data: request
    });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update status'
    });
  }
});

// Search blood requests by location
router.get('/search/location', [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  query('maxDistance')
    .optional()
    .isInt({ min: 1000, max: 100000 })
    .withMessage('Distance must be between 1 and 100 kilometers'),
  validate
], async (req, res) => {
  try {
    const { lat, lng, maxDistance = 10000 } = req.query;

    const requests = await BloodRequest.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      },
      status: 'Open'
    })
      .populate('requesterId', 'name')
      .populate('targetBloodBanks', 'name location')
      .sort({ requiredDate: 1 });

    res.json({
      success: true,
      data: requests
    });
  } catch (err) {
    console.error('Location search error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to search blood requests'
    });
  }
});

module.exports = router;