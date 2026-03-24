const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter using environment variables
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendEmail = async ({ to, subject, html }) => {
    // Fallback for development if no SMTP user is provided
    if (!process.env.SMTP_USER) {
        console.log('--- MOCK EMAIL SENT ---');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('Body:', html);
        console.log('-----------------------');
        return { messageId: 'mock-id' };
    }

    try {
        const info = await transporter.sendMail({
            from: `"La Boîte à Ouvertures" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html
        });
        console.log('Email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = { sendEmail };
