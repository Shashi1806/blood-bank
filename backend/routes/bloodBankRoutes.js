const express = require('express');
const router = express.Router();
const BloodBank = require('../models/BloodBank');
const auth = require('../middleware/auth');

// Get all blood banks
router.get('/', async (req, res) => {
  try {
    const bloodBanks = await BloodBank.find().lean();
    res.json({
      success: true,
      data: bloodBanks
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blood banks'
    });
  }
});

// Get single blood bank
router.get('/:id', async (req, res) => {
  try {
    const bloodBank = await BloodBank.findById(req.params.id);
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blood bank'
    });
  }
});

// Create blood bank
router.post('/', auth, async (req, res) => {
  try {
    const bloodBank = new BloodBank(req.body);
    await bloodBank.save();
    res.status(201).json({
      success: true,
      data: bloodBank
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to create blood bank'
    });
  }
});

// Update blood bank
router.put('/:id', auth, async (req, res) => {
  try {
    const bloodBank = await BloodBank.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
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
    res.status(500).json({
      success: false,
      message: 'Failed to update blood bank'
    });
  }
});

// Delete blood bank
router.delete('/:id', auth, async (req, res) => {
  try {
    const bloodBank = await BloodBank.findByIdAndDelete(req.params.id);
    if (!bloodBank) {
      return res.status(404).json({
        success: false,
        message: 'Blood bank not found'
      });
    }
    res.json({
      success: true,
      message: 'Blood bank deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete blood bank'
    });
  }
});

module.exports = router;