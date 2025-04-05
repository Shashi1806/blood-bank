const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let authToken = '';
let userId = '';

const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'Test@123',
  bloodGroup: 'O+',
  isDonor: true
};

async function testEndpoints() {
  try {
    console.log('\n=== Testing Auth Routes ===');
    
    // Test Registration
    console.log('\nTesting registration...');
    const registerResponse = await axios.post(`${API_URL}/auth/register`, testUser);
    console.log('Registration successful:', registerResponse.data);

    // Test Login
    console.log('\nTesting login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    authToken = loginResponse.data.token;
    userId = loginResponse.data.user._id;
    console.log('Login successful:', loginResponse.data);

    // Set auth header for subsequent requests
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

    console.log('\n=== Testing User Routes ===');

    // Test Get Profile
    console.log('\nTesting get profile...');
    const profileResponse = await axios.get(`${API_URL}/users/profile`);
    console.log('Profile retrieved:', profileResponse.data);

    // Test Update Profile
    console.log('\nTesting update profile...');
    const updateResponse = await axios.put(`${API_URL}/users/profile`, {
      phoneNumber: '1234567890',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        coordinates: {
          coordinates: [80.2707, 13.0827] // Chennai coordinates
        }
      }
    });
    console.log('Profile updated:', updateResponse.data);

    console.log('\n=== Testing Blood Bank Routes ===');

    // Test Create Blood Bank
    console.log('\nTesting create blood bank...');
    const bloodBank = {
      name: 'Test Blood Bank',
      address: {
        street: '456 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        coordinates: [80.2707, 13.0827]
      },
      contact: {
        phone: '9876543210',
        email: 'bank@test.com'
      },
      inventory: {
        'A+': 10,
        'O+': 15,
        'B+': 5
      }
    };
    const bloodBankResponse = await axios.post(`${API_URL}/blood-banks`, bloodBank);
    console.log('Blood bank created:', bloodBankResponse.data);

    console.log('\n=== Testing Donation Routes ===');

    // Test Create Donation
    console.log('\nTesting create donation...');
    const donation = {
      bloodGroup: 'O+',
      amount: 450, // in ml
      bloodBankId: bloodBankResponse.data._id,
      donationDate: new Date(),
      healthInfo: {
        hemoglobin: 14,
        bloodPressure: '120/80',
        weight: 70
      }
    };
    const donationResponse = await axios.post(`${API_URL}/donations`, donation);
    console.log('Donation created:', donationResponse.data);

    console.log('\n=== Testing Request Routes ===');

    // Test Create Blood Request
    console.log('\nTesting create blood request...');
    const request = {
      bloodGroup: 'O+',
      unitsNeeded: 2,
      urgency: 'high',
      hospital: 'Test Hospital',
      patientName: 'Test Patient',
      contactNumber: '1234567890',
      location: {
        coordinates: [80.2707, 13.0827]
      }
    };
    const requestResponse = await axios.post(`${API_URL}/requests`, request);
    console.log('Blood request created:', requestResponse.data);

    console.log('\n=== All API Tests Completed Successfully ===');

  } catch (error) {
    console.error('\nError during API testing:', error.response?.data || error.message);
  }
}

// Run the tests
testEndpoints();
