const mongoose = require('mongoose');
const validator = require('validator');

const bloodRequestSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requester is required']
  },
  patientName: {
    type: String,
    required: [true, 'Patient name is required'],
    trim: true,
    minlength: [2, 'Patient name must be at least 2 characters'],
    maxlength: [100, 'Patient name cannot exceed 100 characters']
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
    required: [true, 'Units required is required'],
    min: [1, 'Minimum 1 unit required'],
    max: [10, 'Maximum 10 units allowed'],
    validate: {
      validator: Number.isInteger,
      message: 'Units must be a whole number'
    }
  },
  hospital: {
    type: String,
    required: [true, 'Hospital name is required'],
    trim: true,
    minlength: [3, 'Hospital name must be at least 3 characters'],
    maxlength: [200, 'Hospital name cannot exceed 200 characters']
  },
  requiredBy: {
    type: Date,
    required: [true, 'Required by date is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Required by date must be in the future'
    }
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true,
    minlength: [10, 'Reason must be at least 10 characters'],
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  contact: {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      validate: {
        validator: function(v) {
          return /^\+?[\d\s-]{10,}$/.test(v);
        },
        message: 'Invalid phone number format'
      }
    },
    email: {
      type: String,
      validate: {
        validator: validator.isEmail,
        message: 'Invalid email address'
      }
    },
    alternatePhone: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^\+?[\d\s-]{10,}$/.test(v);
        },
        message: 'Invalid phone number format'
      }
    }
  },
  urgency: {
    type: String,
    enum: {
      values: ['normal', 'urgent', 'critical'],
      message: '{VALUE} is not a valid urgency level'
    },
    default: 'normal'
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'in-progress', 'fulfilled', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending'
  },
  statusNote: {
    type: String,
    trim: true,
    maxlength: [500, 'Status note cannot exceed 500 characters']
  },
  statusUpdatedAt: Date,
  statusUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  donorsResponded: {
    type: Number,
    default: 0,
    min: [0, 'Donors responded cannot be negative']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && 
                 coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Invalid coordinates'
      }
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      minlength: [5, 'Address must be at least 5 characters']
    }
  },
  donors: [{
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'completed', 'cancelled'],
        message: '{VALUE} is not a valid donor status'
      },
      default: 'pending'
    },
    respondedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: Date,
    note: {
      type: String,
      trim: true,
      maxlength: [200, 'Note cannot exceed 200 characters']
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
bloodRequestSchema.index({ location: '2dsphere' });
bloodRequestSchema.index({ status: 1, urgency: 1 });
bloodRequestSchema.index({ bloodGroup: 1 });
bloodRequestSchema.index({ requester: 1 });
bloodRequestSchema.index({ 'donors.donor': 1 });
bloodRequestSchema.index({ createdAt: -1 });

// Virtual for time until required
bloodRequestSchema.virtual('timeUntilRequired').get(function() {
  return this.requiredBy - new Date();
});

// Virtual for request age
bloodRequestSchema.virtual('age').get(function() {
  return new Date() - this.createdAt;
});

// Pre-save middleware
bloodRequestSchema.pre('save', function(next) {
  if (this.isModified('donors')) {
    this.donorsResponded = this.donors.length;
  }
  next();
});

// Methods
bloodRequestSchema.methods.addDonor = function(donorId) {
  if (!this.donors.some(d => d.donor.toString() === donorId.toString())) {
    this.donors.push({ donor: donorId });
    return this.save();
  }
  return this;
};

bloodRequestSchema.methods.updateDonorStatus = function(donorId, status) {
  const donor = this.donors.find(d => d.donor.toString() === donorId.toString());
  if (donor) {
    donor.status = status;
    if (status === 'completed') {
      donor.completedAt = new Date();
    }
    return this.save();
  }
  return this;
};

const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);

module.exports = BloodRequest;