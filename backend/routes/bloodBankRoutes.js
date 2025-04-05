const express = require('express');
const router = express.Router();
const BloodBank = require('../models/BloodBank');
const { auth, admin } = require('../middleware/auth');

// Get all blood banks
router.get('/', async (req, res) => {
  try {
    const bloodBanks = await BloodBank.find({ isActive: true });
    res.json(bloodBanks);
  } catch (err) {
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
    res.status(500).json({ message: 'Server error' });
  }
});

// Create blood bank (admin only)
router.post('/', auth, admin, async (req, res) => {
  try {
    const bloodBank = new BloodBank(req.body);
    await bloodBank.save();
    res.status(201).json(bloodBank);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update blood bank (admin only)
router.put('/:id', auth, admin, async (req, res) => {
  try {
    const bloodBank = await BloodBank.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }
    res.json(bloodBank);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update blood inventory
router.patch('/:id/inventory', auth, async (req, res) => {
  try {
    const { bloodGroup, units } = req.body;
    const bloodBank = await BloodBank.findById(req.params.id);
    
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }

    const inventory = bloodBank.bloodInventory.find(
      item => item.bloodGroup === bloodGroup
    );

    if (inventory) {
      inventory.units = Math.max(0, inventory.units + units);
    } else {
      bloodBank.bloodInventory.push({ bloodGroup, units: Math.max(0, units) });
    }

    await bloodBank.save();
    res.json(bloodBank);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search blood banks by location
router.get('/search/location', async (req, res) => {
  try {
    const { lat, lng, maxDistance = 10000 } = req.query;

    const bloodBanks = await BloodBank.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      },
      isActive: true
    });

    res.json(bloodBanks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
