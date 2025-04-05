const express = require('express');
const router = express.Router();
const Donation = require('../models/Donation');
const { auth } = require('../middleware/auth');

// Create new donation
router.post('/', auth, async (req, res) => {
  try {
    const donation = new Donation({
      ...req.body,
      donor: req.user.id
    });
    await donation.save();
    res.json(donation);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's donations
router.get('/my', auth, async (req, res) => {
  try {
    const donations = await Donation.find({ donor: req.user.id })
      .populate('bloodBank', 'name location')
      .sort({ donationDate: -1 });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get donation by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate('bloodBank', 'name location contact email')
      .populate('donor', 'name email');
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }
    res.json(donation);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update donation status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );
    res.json(donation);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
