const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Donation = require('../models/Donation');
const User = require('../models/User');
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

// Record new donation
router.post('/', [
  auth,
  body('bloodBank').isMongoId().withMessage('Valid blood bank ID is required'),
  body('units')
    .isFloat({ min: 1, max: 5 })
    .withMessage('Units must be between 1 and 5'),
  body('donationDate')
    .isISO8601()
    .custom(value => new Date(value) <= new Date())
    .withMessage('Donation date cannot be in the future'),
  validate
], async (req, res) => {
  try {
    // Verify blood bank exists
    const bloodBank = await BloodBank.findById(req.body.bloodBank);
    if (!bloodBank) {
      return res.status(400).json({
        success: false,
        message: 'Blood bank not found'
      });
    }

    // Check eligibility (3 months since last donation)
    const lastDonation = await Donation.findOne({
      donor: req.user._id,
      donationDate: {
        $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      }
    });

    if (lastDonation) {
      return res.status(400).json({
        success: false,
        message: 'Must wait 3 months between donations',
        nextEligibleDate: new Date(lastDonation.donationDate.getTime() + 90 * 24 * 60 * 60 * 1000)
      });
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

    // Update streak with validation
    const lastDonationDate = new Date(user.lastDonation);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    if (lastDonationDate >= threeMonthsAgo) {
      user.streak = (user.streak || 0) + 1;
      user.rewardPoints += user.streak * 10; // Bonus points for streak
    } else {
      user.streak = 1;
    }

    // Set next eligible date
    const nextEligibleDate = new Date(req.body.donationDate);
    nextEligibleDate.setMonth(nextEligibleDate.getMonth() + 3);
    user.nextEligibleDate = nextEligibleDate;

    // Update level based on donation count
    user.level = calculateUserLevel(user.donationCount);
    user.levelProgress = calculateLevelProgress(user.donationCount);

    // Award badges
    await updateUserBadges(user);

    await user.save();

    // Update blood bank inventory
    await BloodBank.findByIdAndUpdate(bloodBank._id, {
      $inc: { [`bloodInventory.${req.body.bloodGroup}.units`]: req.body.units }
    });

    res.status(201).json({
      success: true,
      data: {
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
      }
    });
  } catch (err) {
    console.error('Donation creation error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create donation'
    });
  }
});

// Get user's donation history with pagination
router.get('/history', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const [donations, total] = await Promise.all([
      Donation.find({ donor: req.user._id })
        .populate('bloodBank', 'name address')
        .sort({ donationDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Donation.countDocuments({ donor: req.user._id })
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
    console.error('Get donation history error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation history'
    });
  }
});

// Get donation statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const [totalStats, monthlyStats] = await Promise.all([
      Donation.aggregate([
        { $match: { donor: req.user._id } },
        { 
          $group: { 
            _id: null, 
            totalDonations: { $sum: 1 },
            totalUnits: { $sum: '$units' }
          }
        }
      ]),
      Donation.aggregate([
        {
          $match: {
            donor: req.user._id,
            donationDate: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $month: '$donationDate' },
            count: { $sum: 1 },
            units: { $sum: '$units' }
          }
        }
      ])
    ]);

    const stats = {
      total: {
        donations: totalStats[0]?.totalDonations || 0,
        units: totalStats[0]?.totalUnits || 0,
        livesImpacted: (totalStats[0]?.totalDonations || 0) * 3
      },
      monthly: monthlyStats.reduce((acc, { _id, count, units }) => {
        acc[_id] = { count, units };
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('Get donation stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch donation statistics'
    });
  }
});

// Helper functions
function calculateUserLevel(donationCount) {
  if (donationCount >= 50) return 'Platinum';
  if (donationCount >= 25) return 'Gold';
  if (donationCount >= 10) return 'Silver';
  return 'Bronze';
}

function calculateLevelProgress(donationCount) {
  if (donationCount >= 50) return 100;
  if (donationCount >= 25) return Math.min(((donationCount - 25) / 25) * 100, 100);
  if (donationCount >= 10) return Math.min(((donationCount - 10) / 15) * 100, 100);
  return Math.min((donationCount / 10) * 100, 100);
}

async function updateUserBadges(user) {
  const badges = new Set(user.badges || []);
  
  badges.add('First Donation');
  if (user.donationCount >= 5) badges.add('Regular Donor');
  if (user.livesImpacted >= 50) badges.add('Life Saver');
  
  user.badges = Array.from(badges);
}

module.exports = router;