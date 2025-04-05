const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Donor is required']
  },
  bloodBank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BloodBank',
    required: [true, 'Blood bank is required']
  },
  bloodGroup: {
    type: String,
    required: [true, 'Blood group is required'],
    enum: {
      values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      message: '{VALUE} is not a valid blood group'
    }
  },
  units: {
    type: Number,
    required: [true, 'Units are required'],
    min: [1, 'Minimum 1 unit required'],
    max: [5, 'Maximum 5 units allowed'],
    validate: {
      validator: Number.isInteger,
      message: 'Units must be a whole number'
    }
  },
  donationDate: {
    type: Date,
    required: [true, 'Donation date is required'],
    validate: {
      validator: function(v) {
        return v <= new Date();
      },
      message: 'Donation date cannot be in the future'
    }
  },
  status: {
    type: String,
    required: true,
    enum: {
      values: ['pending', 'approved', 'completed', 'rejected', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'approved', 'completed', 'rejected', 'cancelled']
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: [true, 'Location coordinates are required'],
      validate: {
        validator: function(v) {
          return v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && 
                 v[1] >= -90 && v[1] <= 90;
        },
        message: 'Invalid coordinates'
      }
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    }
  },
  healthInfo: {
    hemoglobin: {
      value: {
        type: Number,
        min: [8, 'Hemoglobin too low'],
        max: [20, 'Hemoglobin too high']
      },
      unit: {
        type: String,
        enum: ['g/dL', 'g/L'],
        default: 'g/dL'
      }
    },
    bloodPressure: {
      systolic: {
        type: Number,
        min: [60, 'Systolic pressure too low'],
        max: [180, 'Systolic pressure too high']
      },
      diastolic: {
        type: Number,
        min: [40, 'Diastolic pressure too low'],
        max: [120, 'Diastolic pressure too high']
      }
    },
    weight: {
      value: {
        type: Number,
        min: [45, 'Weight too low'],
        max: [150, 'Weight too high']
      },
      unit: {
        type: String,
        enum: ['kg', 'lb'],
        default: 'kg'
      }
    },
    pulseRate: {
      type: Number,
      min: [50, 'Pulse rate too low'],
      max: [100, 'Pulse rate too high']
    },
    temperature: {
      value: {
        type: Number,
        min: [35, 'Temperature too low'],
        max: [38, 'Temperature too high']
      },
      unit: {
        type: String,
        enum: ['C', 'F'],
        default: 'C'
      }
    },
    medications: [{
      name: String,
      dosage: String,
      frequency: String
    }],
    conditions: [String],
    notes: String,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  rewards: {
    points: {
      type: Number,
      default: 100
    },
    bonusPoints: {
      type: Number,
      default: 0
    },
    streakMaintained: {
      type: Boolean,
      default: false
    }
  },
  impactMetrics: {
    livesImpacted: {
      type: Number,
      default: 3
    },
    carbonFootprint: Number,
    localImpact: String
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500
    },
    givenAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
donationSchema.index({ donor: 1, donationDate: -1 });
donationSchema.index({ bloodBank: 1 });
donationSchema.index({ 'location.coordinates': '2dsphere' });
donationSchema.index({ status: 1, donationDate: -1 });
donationSchema.index({ bloodGroup: 1 });

// Virtuals
donationSchema.virtual('age').get(function() {
  return new Date() - this.donationDate;
});

donationSchema.virtual('totalPoints').get(function() {
  return this.rewards.points + this.rewards.bonusPoints;
});

// Pre-save middleware
donationSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      updatedBy: this.updatedBy,
      updatedAt: new Date()
    });
  }
  next();
});

// Methods
donationSchema.methods.updateStatus = async function(newStatus, updatedBy, reason) {
  this.status = newStatus;
  this.updatedBy = updatedBy;
  this.statusHistory.push({
    status: newStatus,
    updatedBy,
    reason,
    updatedAt: new Date()
  });
  return this.save();
};

donationSchema.methods.addFeedback = async function(rating, comment) {
  this.feedback = {
    rating,
    comment,
    givenAt: new Date()
  };
  return this.save();
};

const Donation = mongoose.model('Donation', donationSchema);

module.exports = Donation;