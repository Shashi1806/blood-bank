require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const BloodBank = require('../models/BloodBank');
const Donation = require('../models/Donation');
const BloodRequest = require('../models/BloodRequest');

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad'];

const generateSampleData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      BloodBank.deleteMany({}),
      Donation.deleteMany({}),
      BloodRequest.deleteMany({})
    ]);

    // Create admin user
    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    const admin = new User({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: adminPassword,
      isAdmin: true,
      isActive: true,
      bloodGroup: 'O+'
    });
    await admin.save();
    console.log('Admin user created');

    // Create sample users
    const users = [];
    for (let i = 1; i <= 10; i++) {
      const user = new User({
        name: `User ${i}`,
        email: `user${i}@example.com`,
        password: await bcrypt.hash('User@2024!', 10),
        isAdmin: false,
        isActive: true,
        bloodGroup: bloodGroups[Math.floor(Math.random() * bloodGroups.length)]
      });
      users.push(await user.save());
    }
    console.log('Sample users created');

    // Create blood banks
    const bloodBanks = [];
    for (const city of cities) {
      const bloodBank = new BloodBank({
        name: `${city} Blood Bank`,
        location: {
          type: 'Point',
          coordinates: [
            72 + Math.random() * 5, // Longitude
            19 + Math.random() * 5  // Latitude
          ],
          address: `123 Main St, ${city}`
        },
        contact: `+91 ${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        email: `${city.toLowerCase()}@bloodbank.com`,
        operatingHours: '9 AM - 6 PM',
        isActive: true,
        bloodInventory: bloodGroups.map(group => ({
          bloodGroup: group,
          units: Math.floor(Math.random() * 50)
        }))
      });
      bloodBanks.push(await bloodBank.save());
    }
    console.log('Blood banks created');

    // Create donations
    for (const user of users) {
      if (Math.random() > 0.5) {
        const bloodBank = bloodBanks[Math.floor(Math.random() * bloodBanks.length)];
        const donation = new Donation({
          donor: user._id,
          bloodBank: bloodBank._id,
          bloodGroup: user.bloodGroup,
          units: Math.floor(Math.random() * 2) + 1,
          donationDate: new Date(),
          status: 'pending',
          location: bloodBank.location,
          notes: 'Regular donation',
          healthInfo: {
            hemoglobin: 13 + Math.random() * 2,
            bloodPressure: '120/80',
            weight: 60 + Math.random() * 20,
            lastDonation: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          }
        });
        await donation.save();
      }
    }
    console.log('Donations created');

    // Create blood requests
    for (const user of users) {
      if (Math.random() > 0.7) {
        const bloodBank = bloodBanks[Math.floor(Math.random() * bloodBanks.length)];
        const request = new BloodRequest({
          requesterId: user._id,
          patientName: `Patient ${Math.floor(Math.random() * 100)}`,
          bloodGroup: bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
          units: Math.floor(Math.random() * 3) + 1,
          urgency: ['Normal', 'Urgent', 'Emergency'][Math.floor(Math.random() * 3)],
          hospitalName: `${cities[Math.floor(Math.random() * cities.length)]} Hospital`,
          location: bloodBank.location,
          contactPhone: `+91 ${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
          requiredDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000),
          status: 'Open',
          reason: 'Medical procedure',
          targetBloodBanks: [bloodBank._id]
        });
        await request.save();
      }
    }
    console.log('Blood requests created');

    console.log('Sample data generated successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error generating sample data:', err);
    process.exit(1);
  }
};

generateSampleData();
