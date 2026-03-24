const nodemailer = require('nodemailer');
require('dotenv').config();

// Default values for ports: 465 is always secure (TLS), 587 is secure via STARTTLS
const port = parseInt(process.env.SMTP_PORT) || 465;
// If port is 465, secure MUST be true. Otherwise, respect the environment variable or default to false (for 587).
const isSecure = port === 465 ? true : (process.env.SMTP_SECURE === 'true');

// Create a transporter using environment variables
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: port,
    secure: isSecure,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    // Add timeouts and TLS options to prevent Cloud platforms (Render) from blocking/dropping the connection
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
        // do not fail on invalid certs in cloud environments
        rejectUnauthorized: false
    }
});

const sendEmail = async ({ to, subject, html }) => {
    // Fallback for development if no SMTP user is provided
    if (!process.env.SMTP_USER || process.env.SMTP_USER === '') {
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
