const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Donation = require('../models/Donation');
const User = require('../models/User');

// Record new donation
router.post('/',
  [
    auth,
    body('bloodBank').notEmpty().withMessage('Blood bank is required'),
    body('units').isFloat({ min: 1 }).withMessage('Valid units amount is required'),
    body('donationDate').isISO8601().withMessage('Valid donation date is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const donation = new Donation({
        ...req.body,
        donor: req.user._id
      });

      await donation.save();

      // Update user stats
      const user = await User.findById(req.user._id);
      user.lastDonation = req.body.donationDate;
      user.donationCount += 1;
      user.rewardPoints += 100; // Base points for donation
      user.livesImpacted += 3; // Each donation can save up to 3 lives

      // Update streak
      const lastDonationDate = new Date(user.lastDonation);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      if (lastDonationDate >= threeMonthsAgo) {
        user.streak += 1;
        user.rewardPoints += user.streak * 10; // Bonus points for streak
      } else {
        user.streak = 1;
      }

      // Set next eligible date (3 months from donation)
      const nextEligibleDate = new Date(req.body.donationDate);
      nextEligibleDate.setMonth(nextEligibleDate.getMonth() + 3);
      user.nextEligibleDate = nextEligibleDate;

      // Update level based on donation count
      if (user.donationCount >= 50) {
        user.level = 'Platinum';
        user.levelProgress = 100;
      } else if (user.donationCount >= 25) {
        user.level = 'Gold';
        user.levelProgress = Math.min(((user.donationCount - 25) / 25) * 100, 100);
      } else if (user.donationCount >= 10) {
        user.level = 'Silver';
        user.levelProgress = Math.min(((user.donationCount - 10) / 15) * 100, 100);
      } else {
        user.level = 'Bronze';
        user.levelProgress = Math.min((user.donationCount / 10) * 100, 100);
      }

      // Award badges
      if (!user.badges.includes('First Donation')) {
        user.badges.push('First Donation');
      }
      if (user.donationCount >= 5 && !user.badges.includes('Regular Donor')) {
        user.badges.push('Regular Donor');
      }
      if (user.livesImpacted >= 50 && !user.badges.includes('Life Saver')) {
        user.badges.push('Life Saver');
      }

      await user.save();

      res.status(201).json({
        donation,
        userStats: {
          donationCount: user.donationCount,
          rewardPoints: user.rewardPoints,
          level: user.level,
          levelProgress: user.levelProgress,
          streak: user.streak,
          livesImpacted: user.livesImpacted,
          badges: user.badges,
          nextEligibleDate: user.nextEligibleDate
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get user's donation history
router.get('/history', auth, async (req, res) => {
  try {
    const donations = await Donation.find({ donor: req.user._id })
      .populate('bloodBank', 'name address')
      .sort({ donationDate: -1 });

    res.json(donations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get donation statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const totalDonations = await Donation.countDocuments({ donor: req.user._id });
    const totalUnits = await Donation.aggregate([
      { $match: { donor: req.user._id } },
      { $group: { _id: null, total: { $sum: '$units' } } }
    ]);

    const stats = {
      totalDonations,
      totalUnits: totalUnits[0]?.total || 0,
      livesImpacted: totalDonations * 3 // Each donation can save up to 3 lives
    };

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
