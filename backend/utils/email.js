const nodemailer = require('nodemailer');

// Create reusable transporter object using the default SMTP transport
let transporter;

if (process.env.SMTP_HOST === 'null') {
  // Development mode - log emails to console
  transporter = {
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
} else {
  // Production mode - use real SMTP
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send an email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text version of email
 * @param {string} [options.html] - HTML version of email (optional)
 * @returns {Promise<Object>} - Nodemailer send result
 */
const sendEmail = async (options) => {
  const mailOptions = {
    from: `Blood Donation System <${process.env.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
  };

  if (options.html) {
    mailOptions.html = options.html;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
};
