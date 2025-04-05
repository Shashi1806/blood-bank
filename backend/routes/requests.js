const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const BloodRequest = require('../models/BloodRequest');
const User = require('../models/User');

// Create new blood request
router.post('/',
  [
    auth,
    body('patientName').notEmpty().withMessage('Patient name is required'),
    body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
      .withMessage('Invalid blood group'),
    body('units').notEmpty().withMessage('Units required'),
    body('hospital').notEmpty().withMessage('Hospital is required'),
    body('requiredBy').notEmpty().withMessage('Required by date is required'),
    body('reason').notEmpty().withMessage('Reason is required'),
    body('contact').notEmpty().withMessage('Contact information is required'),
    body('urgency').isIn(['normal', 'urgent', 'critical']).withMessage('Invalid urgency level')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const request = new BloodRequest({
        ...req.body,
        requester: req.user._id,
        status: 'in-progress'
      });

      await request.save();

      // Find potential donors
      const donors = await User.find({
        bloodGroup: req.body.bloodGroup,
        isDonor: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: req.body.location?.coordinates || [0, 0]
            },
            $maxDistance: req.body.urgency === 'critical' ? 100000 : 50000 // 100km for critical, 50km for others
          }
        }
      }).select('email name');

      // TODO: Send notifications to potential donors
      // This would be implemented with your notification system

      res.status(201).json(request);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get my requests
router.get('/my-requests', auth, async (req, res) => {
  try {
    const requests = await BloodRequest.find({ requester: req.user._id })
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get nearby requests
router.get('/nearby', auth, async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 50000 } = req.query; // maxDistance in meters (default 50km)

    const requests = await BloodRequest.find({
      status: { $in: ['pending', 'in-progress'] },
      bloodGroup: req.user.bloodGroup,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    })
    .populate('requester', 'name')
    .sort({ urgency: -1, createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update request status
router.patch('/:id/status',
  [
    auth,
    body('status').isIn(['pending', 'in-progress', 'fulfilled', 'cancelled'])
      .withMessage('Invalid status')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const request = await BloodRequest.findById(req.params.id);
      if (!request) {
        return res.status(404).json({ message: 'Request not found' });
      }

      // Only requester can update the status
      if (request.requester.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      request.status = req.body.status;
      await request.save();

      res.json(request);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Respond to a request (for donors)
router.post('/:id/respond', auth, async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if user is already a donor for this request
    if (request.donors.some(d => d.donor.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'Already responded to this request' });
    }

    request.donors.push({
      donor: req.user._id,
      status: 'pending'
    });
    request.donorsResponded = request.donors.length;

    await request.save();

    // TODO: Send notification to requester

    res.json(request);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete request
router.delete('/:id', auth, async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Only requester can delete the request
    if (request.requester.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await request.remove();
    res.json({ message: 'Request deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
