const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google login/signup
router.post('/google',
  [
    body('credential').notEmpty().withMessage('Google credential is required'),
    body('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
      .withMessage('Valid blood group is required'),
    body('isDonor').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify Google token
      const ticket = await client.verifyIdToken({
        idToken: req.body.credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const { sub: googleId, email, name, picture } = ticket.getPayload();

      // Check if user exists
      let user = await User.findOne({ googleId });
      
      if (!user) {
        // Check if email exists
        user = await User.findOne({ email });
        
        if (user) {
          // Link Google account to existing email account
          user.googleId = googleId;
          user.picture = picture;
          await user.save();
        } else {
          // Create new user
          user = new User({
            googleId,
            email,
            name,
            picture,
            bloodGroup: req.body.bloodGroup,
            isDonor: req.body.isDonor ?? true
          });

          // If bloodGroup is not provided in first login, return error
          if (!req.body.bloodGroup) {
            return res.status(400).json({
              needsAdditionalInfo: true,
              message: 'Please provide your blood group'
            });
          }

          await user.save();
        }
      }

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          picture: user.picture,
          bloodGroup: user.bloodGroup,
          isDonor: user.isDonor,
          isAdmin: user.isAdmin,
          rewardPoints: user.rewardPoints,
          level: user.level,
          levelProgress: user.levelProgress,
          streak: user.streak,
          livesImpacted: user.livesImpacted,
          badges: user.badges
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Regular email/password registration
router.post('/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
      .withMessage('Valid blood group is required'),
    body('isDonor').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password, bloodGroup, isDonor } = req.body;

      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create user
      user = new User({
        name,
        email,
        password: await bcrypt.hash(password, 10),
        bloodGroup,
        isDonor: isDonor ?? true
      });

      await user.save();

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          picture: user.picture,
          bloodGroup: user.bloodGroup,
          isDonor: user.isDonor,
          isAdmin: user.isAdmin,
          rewardPoints: user.rewardPoints,
          level: user.level,
          levelProgress: user.levelProgress,
          streak: user.streak,
          livesImpacted: user.livesImpacted,
          badges: user.badges
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Login with email/password
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').exists().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // If user has only Google login
      if (!user.password) {
        return res.status(400).json({ 
          message: 'Please login with Google',
          useGoogle: true
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          picture: user.picture,
          bloodGroup: user.bloodGroup,
          isDonor: user.isDonor,
          isAdmin: user.isAdmin,
          rewardPoints: user.rewardPoints,
          level: user.level,
          levelProgress: user.levelProgress,
          streak: user.streak,
          livesImpacted: user.livesImpacted,
          badges: user.badges
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.patch('/profile',
  [
    auth,
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
      .withMessage('Valid blood group is required'),
    body('isDonor').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: req.body },
        { new: true, runValidators: true }
      ).select('-password');

      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Change password (only for email/password users)
router.patch('/password',
  [
    auth,
    body('currentPassword').exists().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.user._id);
      
      // Check if user uses Google login
      if (!user.password) {
        return res.status(400).json({ 
          message: 'Password change not available for Google login users',
          useGoogle: true
        });
      }

      const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      user.password = await bcrypt.hash(req.body.newPassword, 10);
      await user.save();

      res.json({ message: 'Password updated successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
