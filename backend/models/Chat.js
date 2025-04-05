const mongoose = require('mongoose');

// Message sub-schema
const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'document'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    name: String,
    size: Number
  }]
}, {
  timestamps: true
});

// Main chat schema
const chatSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  supportAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    minlength: [3, 'Subject must be at least 3 characters'],
    maxlength: [100, 'Subject cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['support', 'direct'],
      message: '{VALUE} is not a valid chat type'
    },
    default: 'support'
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'active', 'resolved', 'closed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: '{VALUE} is not a valid priority level'
    },
    default: 'medium'
  },
  category: {
    type: String,
    enum: {
      values: ['general', 'technical', 'donation', 'request', 'other'],
      message: '{VALUE} is not a valid category'
    },
    default: 'general'
  },
  messages: [messageSchema],
  lastActivity: {
    type: Date,
    default: Date.now
  },
  closeReason: {
    type: String,
    enum: {
      values: ['resolved', 'abandoned', 'spam', 'other'],
      message: '{VALUE} is not a valid close reason'
    }
  },
  feedback: {
    rating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    comment: {
      type: String,
      maxlength: [500, 'Feedback comment cannot exceed 500 characters']
    },
    givenAt: Date
  },
  metadata: {
    browser: String,
    os: String,
    ip: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
chatSchema.index({ user: 1, status: 1 });
chatSchema.index({ status: 1, lastActivity: -1 });
chatSchema.index({ supportAgent: 1, status: 1 });
chatSchema.index({ createdAt: -1 });
chatSchema.index({ subject: 'text' });

// Virtual for message count
chatSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

// Virtual for chat duration
chatSchema.virtual('duration').get(function() {
  if (this.status === 'closed' || this.status === 'resolved') {
    return this.updatedAt - this.createdAt;
  }
  return null;
});

// Pre-save middleware
chatSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.lastActivity = new Date();
    
    // Update readBy for the last message
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage) {
      lastMessage.readBy = [{
        user: lastMessage.sender,
        readAt: new Date()
      }];
    }
  }
  next();
});

// Methods
chatSchema.methods.markAsRead = async function(userId) {
  this.messages.forEach(message => {
    if (!message.readBy.some(read => read.user.toString() === userId.toString())) {
      message.readBy.push({
        user: userId,
        readAt: new Date()
      });
    }
  });
  return this.save();
};

chatSchema.methods.close = async function(reason = 'resolved') {
  this.status = 'closed';
  this.closeReason = reason;
  return this.save();
};

chatSchema.methods.reopen = async function() {
  if (this.status === 'closed') {
    this.status = 'active';
    this.closeReason = undefined;
    return this.save();
  }
  return this;
};

// Statics
chatSchema.statics.getActiveChats = function(userId) {
  return this.find({
    $or: [
      { user: userId },
      { supportAgent: userId }
    ],
    status: { $ne: 'closed' }
  })
  .sort({ lastActivity: -1 })
  .populate('user supportAgent', 'name email picture');
};

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;