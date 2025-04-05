const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bloodBank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BloodBank',
    required: true
  },
  bloodGroup: {
    type: String,
    required: true,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  units: {
    type: Number,
    required: true,
    min: 1
  },
  donationDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'completed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: String
  },
  notes: String,
  healthInfo: {
    hemoglobin: Number,
    bloodPressure: String,
    weight: Number,
    lastDonation: Date,
    medications: [String],
    diseases: [String]
  }
}, {
  timestamps: true
});

// Create indexes
donationSchema.index({ donor: 1, donationDate: -1 });
donationSchema.index({ bloodBank: 1 });
donationSchema.index({ 'location.coordinates': '2dsphere' });

const Donation = mongoose.model('Donation', donationSchema);

module.exports = Donation;
