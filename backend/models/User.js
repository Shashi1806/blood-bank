const mongoose = require('mongoose');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    },
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false
  },
  googleId: {
    type: String,
    sparse: true
  },
  picture: {
    type: String,
    default: '/uploads/default-avatar.png',
    validate: {
      validator: function(v) {
        return /\.(jpg|jpeg|png|gif)$/i.test(v);
      },
      message: 'Picture must be a valid image URL'
    }
  },
  bloodGroup: {
    type: String,
    required: [true, 'Blood group is required'],
    enum: {
      values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      message: '{VALUE} is not a valid blood group'
    }
  },
  roles: {
    isDonor: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false }
  },
  contact: {
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^\+?[\d\s-]{10,}$/.test(v);
        },
        message: 'Invalid phone number format'
      }
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number],
          default: [0, 0]
        }
      }
    }
  },
  donationHistory: {
    lastDonation: Date,
    totalDonations: { type: Number, default: 0 },
    nextEligibleDate: Date
  },
  rewards: {
    points: { type: Number, default: 0 },
    level: { type: String, default: 'Bronze' },
    badges: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Define indexes once
userSchema.index({ 'contact.address.location': '2dsphere' });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ bloodGroup: 1 });
userSchema.index({ 'roles.isDonor': 1 });
userSchema.index({ 'rewards.points': -1 });

const User = mongoose.model('User', userSchema);
module.exports = User;