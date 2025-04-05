const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

// Get user's rewards status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('rewardPoints level levelProgress badges streak');

    const nextLevel = {
      Bronze: { next: 'Silver', pointsNeeded: 1000 },
      Silver: { next: 'Gold', pointsNeeded: 2500 },
      Gold: { next: 'Platinum', pointsNeeded: 5000 },
      Platinum: { next: null, pointsNeeded: null }
    };

    res.json({
      currentPoints: user.rewardPoints,
      currentLevel: user.level,
      levelProgress: user.levelProgress,
      nextLevel: nextLevel[user.level].next,
      pointsToNextLevel: nextLevel[user.level].pointsNeeded,
      badges: user.badges,
      streak: user.streak
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get available badges
router.get('/badges', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('badges donationCount livesImpacted');

    const allBadges = [
      {
        id: 'first_donation',
        name: 'First Donation',
        description: 'Awarded for your first blood donation',
        requirement: '1 donation',
        earned: user.badges.includes('First Donation')
      },
      {
        id: 'regular_donor',
        name: 'Regular Donor',
        description: 'Awarded for making 5 or more donations',
        requirement: '5 donations',
        earned: user.badges.includes('Regular Donor'),
        progress: Math.min(user.donationCount / 5 * 100, 100)
      },
      {
        id: 'life_saver',
        name: 'Life Saver',
        description: 'Your donations have impacted 50 or more lives',
        requirement: '50 lives impacted',
        earned: user.badges.includes('Life Saver'),
        progress: Math.min(user.livesImpacted / 50 * 100, 100)
      }
    ];

    res.json(allBadges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const { type = 'points', limit = 10 } = req.query;

    let sortField;
    switch (type) {
      case 'donations':
        sortField = 'donationCount';
        break;
      case 'streak':
        sortField = 'streak';
        break;
      case 'lives':
        sortField = 'livesImpacted';
        break;
      default:
        sortField = 'rewardPoints';
    }

    const leaderboard = await User.find({ isDonor: true })
      .select(`name ${sortField} level badges`)
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit));

    // Get user's rank
    const userRank = await User.countDocuments({
      isDonor: true,
      [sortField]: { $gt: req.user[sortField] }
    }) + 1;

    res.json({
      leaderboard,
      userRank,
      userScore: req.user[sortField]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get level requirements
router.get('/levels', auth, async (req, res) => {
  try {
    const levels = [
      {
        name: 'Bronze',
        requirement: '0-9 donations',
        perks: ['Basic donor badge', 'Access to donation history']
      },
      {
        name: 'Silver',
        requirement: '10-24 donations',
        perks: ['Silver donor badge', 'Priority support', '10% bonus points']
      },
      {
        name: 'Gold',
        requirement: '25-49 donations',
        perks: ['Gold donor badge', 'VIP support', '25% bonus points', 'Early access to blood drives']
      },
      {
        name: 'Platinum',
        requirement: '50+ donations',
        perks: ['Platinum donor badge', 'Dedicated support line', '50% bonus points', 'Special recognition at events']
      }
    ];

    res.json(levels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's achievement history
router.get('/achievements', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('badges level donationCount streak livesImpacted');

    const achievements = [];

    // Add badge achievements
    user.badges.forEach(badge => {
      achievements.push({
        type: 'badge',
        title: badge,
        description: `Earned the ${badge} badge`,
        date: new Date() // In a real app, you'd store the date when each badge was earned
      });
    });

    // Add level achievements
    const levels = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    const currentLevelIndex = levels.indexOf(user.level);
    for (let i = 0; i <= currentLevelIndex; i++) {
      achievements.push({
        type: 'level',
        title: `Reached ${levels[i]} Level`,
        description: `Advanced to ${levels[i]} donor status`,
        date: new Date() // In a real app, you'd store the date when each level was reached
      });
    }

    // Add milestone achievements
    if (user.donationCount >= 10) {
      achievements.push({
        type: 'milestone',
        title: '10 Donations',
        description: 'Completed 10 blood donations',
        date: new Date()
      });
    }
    if (user.livesImpacted >= 30) {
      achievements.push({
        type: 'milestone',
        title: '30 Lives Impacted',
        description: 'Your donations have helped 30 people',
        date: new Date()
      });
    }
    if (user.streak >= 4) {
      achievements.push({
        type: 'milestone',
        title: '4x Streak',
        description: 'Maintained a 4 donation streak',
        date: new Date()
      });
    }

    res.json(achievements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
