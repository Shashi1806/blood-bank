const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Chat = require('../models/Chat');
const User = require('../models/User');

// Start a new chat or get existing chat
router.post('/start', auth, async (req, res) => {
  try {
    // Check if chat already exists
    let chat = await Chat.findOne({
      $or: [
        { user: req.user._id, status: { $ne: 'closed' } },
        { user: req.user._id, createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) } }
      ]
    }).populate('supportAgent', 'name');

    if (chat) {
      return res.json(chat);
    }

    // Create new chat
    chat = new Chat({
      user: req.user._id,
      subject: 'General Support',
      status: 'pending'
    });

    await chat.save();
    res.status(201).json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post('/:chatId/messages',
  [
    auth,
    body('content').notEmpty().withMessage('Message content is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const chat = await Chat.findById(req.params.chatId);
      if (!chat) {
        return res.status(404).json({ message: 'Chat not found' });
      }

      // Verify user is part of this chat
      if (chat.user.toString() !== req.user._id.toString() && 
          (!chat.supportAgent || chat.supportAgent.toString() !== req.user._id.toString())) {
        return res.status(403).json({ message: 'Not authorized' });
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

      // Emit socket event for real-time updates
      // This would be implemented with your socket.io setup
      // io.to(chat._id).emit('new_message', { chatId: chat._id, message });

      res.json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get chat history
router.get('/history', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user._id })
      .populate('supportAgent', 'name')
      .sort({ lastActivity: -1 });

    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get active chat
router.get('/active', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      user: req.user._id,
      status: { $in: ['pending', 'active'] }
    }).populate('supportAgent', 'name');

    if (!chat) {
      return res.status(404).json({ message: 'No active chat found' });
    }

    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Close chat
router.patch('/:chatId/close', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Only user or support agent can close the chat
    if (chat.user.toString() !== req.user._id.toString() && 
        (!chat.supportAgent || chat.supportAgent.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    chat.status = 'closed';
    chat.closedAt = new Date();
    await chat.save();

    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending chats (admin only)
router.get('/pending', auth, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const chats = await Chat.find({ status: 'pending' })
      .populate('user', 'name')
      .sort({ createdAt: 1 });

    res.json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
