const express = require('express');
const router = express.Router();
const BloodRequest = require('../models/BloodRequest');
const { auth } = require('../middleware/auth');

// Create blood request
router.post('/', auth, async (req, res) => {
  try {
    const request = new BloodRequest({
      ...req.body,
      requesterId: req.user.id
    });
    await request.save();
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all blood requests
router.get('/', async (req, res) => {
  try {
    const requests = await BloodRequest.find()
      .populate('requesterId', 'name email')
      .populate('targetBloodBanks', 'name location')
      .sort({ requiredDate: 1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's blood requests
router.get('/my', auth, async (req, res) => {
  try {
    const requests = await BloodRequest.find({ requesterId: req.user.id })
      .populate('targetBloodBanks', 'name location')
      .sort({ requiredDate: 1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get blood request by ID
router.get('/:id', async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id)
      .populate('requesterId', 'name email')
      .populate('targetBloodBanks', 'name location contact email');
    if (!request) {
      return res.status(404).json({ message: 'Blood request not found' });
    }
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update blood request status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const request = await BloodRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ message: 'Blood request not found' });
    }

    // Only allow requester or admin to update status
    if (request.requesterId.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    request.status = status;
    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search blood requests by location
router.get('/search/location', async (req, res) => {
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
      .populate('targetBloodBanks', 'name location');

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
