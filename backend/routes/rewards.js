const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

// Constants
const LEVELS = {
  Bronze: { next: 'Silver', pointsNeeded: 1000, donationsNeeded: 10 },
  Silver: { next: 'Gold', pointsNeeded: 2500, donationsNeeded: 25 },
  Gold: { next: 'Platinum', pointsNeeded: 5000, donationsNeeded: 50 },
  Platinum: { next: null, pointsNeeded: null, donationsNeeded: null }
};

const BADGES = [
  {
    id: 'first_donation',
    name: 'First Donation',
    description: 'Awarded for your first blood donation',
    requirement: '1 donation'
  },
  {
    id: 'regular_donor',
    name: 'Regular Donor',
    description: 'Awarded for making 5 or more donations',
    requirement: '5 donations'
  },
  {
    id: 'life_saver',
    name: 'Life Saver',
    description: 'Your donations have impacted 50 or more lives',
    requirement: '50 lives impacted'
  }
];

// Get user's rewards status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('rewardPoints level levelProgress badges streak donationCount')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentLevel = LEVELS[user.level];
    const response = {
      success: true,
      data: {
        currentPoints: user.rewardPoints,
        currentLevel: user.level,
        levelProgress: calculateLevelProgress(user.donationCount, user.level),
        nextLevel: currentLevel.next,
        pointsToNextLevel: currentLevel.pointsNeeded,
        pointsProgress: (user.rewardPoints / (currentLevel.pointsNeeded || user.rewardPoints)) * 100,
        badges: user.badges,
        streak: user.streak,
        multiplier: calculatePointsMultiplier(user.level)
      }
    };

    res.json(response);
  } catch (err) {
    console.error('Get rewards status error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rewards status'
    });
  }
});

// Get available badges
router.get('/badges', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('badges donationCount livesImpacted')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const badgesWithProgress = BADGES.map(badge => ({
      ...badge,
      earned: user.badges.includes(badge.name),
      progress: calculateBadgeProgress(badge.id, user)
    }));

    res.json({
      success: true,
      data: badgesWithProgress
    });
  } catch (err) {
    console.error('Get badges error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch badges'
    });
  }
});

// Get leaderboard
router.get('/leaderboard', [
  auth,
  query('type').optional().isIn(['points', 'donations', 'streak', 'lives']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const { type = 'points', limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const sortField = {
      points: 'rewardPoints',
      donations: 'donationCount',
      streak: 'streak',
      lives: 'livesImpacted'
    }[type];

    const [leaderboard, total, userRank] = await Promise.all([
      User.find({ isDonor: true })
        .select(`name ${sortField} level badges picture`)
        .sort({ [sortField]: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments({ isDonor: true }),
      User.countDocuments({
        isDonor: true,
        [sortField]: { $gt: req.user[sortField] }
      })
    ]);

    res.json({
      success: true,
      data: {
        leaderboard,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          limit
        },
        userStats: {
          rank: userRank + 1,
          score: req.user[sortField],
          total
        }
      }
    });
  } catch (err) {
    console.error('Get leaderboard error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard'
    });
  }
});

// Helper functions
function calculateLevelProgress(donationCount, currentLevel) {
  const level = LEVELS[currentLevel];
  if (!level.next) return 100;
  const nextLevel = LEVELS[level.next];
  return Math.min(
    ((donationCount - level.donationsNeeded) /
    (nextLevel.donationsNeeded - level.donationsNeeded)) * 100,
    100
  );
}

function calculatePointsMultiplier(level) {
  const multipliers = {
    Bronze: 1,
    Silver: 1.1,
    Gold: 1.25,
    Platinum: 1.5
  };
  return multipliers[level] || 1;
}

function calculateBadgeProgress(badgeId, user) {
  switch (badgeId) {
    case 'first_donation':
      return user.donationCount > 0 ? 100 : 0;
    case 'regular_donor':
      return Math.min((user.donationCount / 5) * 100, 100);
    case 'life_saver':
      return Math.min((user.livesImpacted / 50) * 100, 100);
    default:
      return 0;
  }
}

module.exports = router;