const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Chat = require('../models/Chat');
const User = require('../models/User');

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

// 1. Start a new chat
router.post('/start', [
  auth,
  body('subject').trim().isLength({ min: 3, max: 100 }),
  validate
], async (req, res) => {
  try {
    let chat = await Chat.findOne({
      user: req.user._id,
      status: { $ne: 'closed' }
    });

    if (chat) {
      return res.json({ success: true, data: chat });
    }

    chat = new Chat({
      user: req.user._id,
      subject: req.body.subject || 'General Support',
      status: 'pending'
    });

    await chat.save();
    res.status(201).json({ success: true, data: chat });
  } catch (err) {
    console.error('Start chat error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start chat' 
    });
  }
});

// 2. Send a message
router.post('/:chatId/messages', [
  auth,
  param('chatId').isMongoId(),
  body('content').trim().notEmpty().isLength({ max: 1000 }),
  validate
], async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ 
        success: false, 
        message: 'Chat not found' 
      });
    }

    if (!chat.canUserSendMessage(req.user._id)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    if (chat.status === 'closed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Chat is closed' 
      });
    }

    const message = {
      sender: req.user._id,
      content: req.body.content,
      timestamp: new Date()
    };

    chat.messages.push(message);
    chat.lastActivity = new Date();

    if (chat.status === 'pending' && req.user.isAdmin) {
      chat.status = 'active';
      chat.supportAgent = req.user._id;
    }

    await chat.save();
    res.json({ success: true, data: message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message' 
    });
  }
});

// 3. Get chat history
router.get('/history', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const [chats, total] = await Promise.all([
      Chat.find({ user: req.user._id })
        .populate('supportAgent', 'name')
        .sort({ lastActivity: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Chat.countDocuments({ user: req.user._id })
    ]);

    res.json({
      success: true,
      data: chats,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch chat history' 
    });
  }
});

// 4. Close chat
router.patch('/:chatId/close', [
  auth,
  param('chatId').isMongoId(),
  validate
], async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    
    if (!chat) {
      return res.status(404).json({ 
        success: false, 
        message: 'Chat not found' 
      });
    }

    if (!chat.canUserClose(req.user._id)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized' 
      });
    }

    chat.status = 'closed';
    chat.closedAt = new Date();
    chat.closedBy = req.user._id;

    await chat.save();
    res.json({ success: true, message: 'Chat closed successfully' });
  } catch (err) {
    console.error('Close chat error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to close chat' 
    });
  }
});

module.exports = router;