const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Sends a transactional email using the Brevo (formerly Sendinblue) HTTP API.
 * This method is preferred for production environments (like Render).
 * 
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content
 */
const sendEmail = async (to, subject, text, html) => {
    try {
        const apiKey = process.env.BREVO_API_KEY;
        
        if (!apiKey) {
            console.warn("⚠️ BREVO_API_KEY is missing. Email sending skipped.");
            return;
        }

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify({
                sender: { 
                    name: "La Boîte à Ouvertures", 
                    email: "no-reply@laboiteaouvertures.com" 
                },
                to: [{ email: to }],
                subject: subject,
                textContent: text,
                htmlContent: html
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error sending email via Brevo API');
        }

        console.log(`✉️ Email sent successfully to: ${to}`);
    } catch (error) {
        console.error('❌ Error in sendEmail (Brevo API):', error);
        throw error;
    }
};

module.exports = { sendEmail };
