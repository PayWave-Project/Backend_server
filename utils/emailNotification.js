const nodemailer = require('nodemailer');


// Set up nodemailer transporter (using Gmail as an example)
const transporter = nodemailer.createTransport({
    service: process.env.MAIL_SERVICE,
    auth: {
      user: process.env.MAIL_USER, 
      pass: process.env.MAIL_PASS, 
    },
  });
  
  // Send email notification
  const sendEmailNotification = async (email, subject, message) => {
    try {
      await transporter.sendMail({
        from: process.env.MAIL_USER, 
        to: email, 
        subject: subject, 
        // text: message, 
        html: `<p>${message}</p>`, // HTML body
      });
  
      console.log(`Email sent to ${email} with subject: ${subject}`);
    } catch (error) {
      console.error(`Failed to send email to ${email}:`, error.message);
    }
  };

  module.exports = sendEmailNotification;