const mongoose = require('mongoose');

const bloodBankSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  license: {
    number: {
      type: String,
      required: [true, 'License number is required'],
      trim: true,
      unique: true
    },
    validUntil: Date
  },
  contact: {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number],
          required: true
        }
      }
    }
  },
  inventory: [{
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    },
    units: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],
  operatingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Define indexes once
bloodBankSchema.index({ 'contact.address.location': '2dsphere' });
bloodBankSchema.index({ 'license.number': 1 }, { unique: true });
bloodBankSchema.index({ isActive: 1 });
bloodBankSchema.index({ 'inventory.bloodGroup': 1 });

const BloodBank = mongoose.model('BloodBank', bloodBankSchema);
module.exports = BloodBank;