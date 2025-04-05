const nodemailer = require('nodemailer');

// Email templates
const EMAIL_TEMPLATES = {
  WELCOME: {
    subject: 'Welcome to Blood Donation System',
    template: (name) => ({
      text: `Welcome ${name}! Thank you for joining our blood donation community.`,
      html: `<h1>Welcome ${name}!</h1><p>Thank you for joining our blood donation community.</p>`
    })
  },
  DONATION_CONFIRMATION: {
    subject: 'Donation Confirmation',
    template: (details) => ({
      text: `Thank you for your blood donation on ${details.date} at ${details.location}.`,
      html: `<h1>Donation Confirmation</h1><p>Thank you for your blood donation on ${details.date} at ${details.location}.</p>`
    })
  }
};

// Create reusable transporter object using the default SMTP transport
let transporter;

// Validate email configuration
const validateEmailConfig = () => {
  const requiredConfig = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missingConfig = requiredConfig.filter(key => !process.env[key]);
  
  if (missingConfig.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing email configuration: ${missingConfig.join(', ')}`);
  }
};

// Initialize email transport
const initializeTransport = () => {
  if (process.env.NODE_ENV !== 'production') {
    // Development mode - log emails to console
    return {
      sendMail: async (mailOptions) => {
        console.log('\n=== Development Mode: Email would have been sent ===');
        console.log('From:', mailOptions.from);
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('Text:', mailOptions.text);
        if (mailOptions.html) {
          console.log('HTML:', mailOptions.html);
        }
        console.log('=== End of Email ===\n');
        return { messageId: 'development-mode' };
      }
    };
  }

  // Production mode - use real SMTP
  validateEmailConfig();
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true, // Use pooled connections
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 20 // Max 20 emails per second
  });
};

transporter = initializeTransport();

/**
 * Send an email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text version of email
 * @param {string} [options.html] - HTML version of email (optional)
 * @param {number} [options.retries=3] - Number of retries on failure
 * @returns {Promise<Object>} - Nodemailer send result
 */
const sendEmail = async (options, retries = 3) => {
  try {
    // Validate email address
    if (!options.to || !options.to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new Error('Invalid email address');
    }

    const mailOptions = {
      from: `Blood Donation System <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      headers: {
        'X-Priority': '1',
        'X-Application': 'Blood Donation System'
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    if (retries > 0) {
      console.log(`Retrying... (${retries} attempts remaining)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return sendEmail(options, retries - 1);
    }
    throw error;
  }
};

// Verify transport connection
const verifyConnection = async () => {
  if (process.env.NODE_ENV === 'production') {
    try {
      await transporter.verify();
      console.log('Email service is ready');
    } catch (error) {
      console.error('Email service verification failed:', error);
    }
  }
};

// Initialize email service
verifyConnection();

module.exports = {
  sendEmail,
  EMAIL_TEMPLATES
};