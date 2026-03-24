const nodemailer = require('nodemailer'); // Gardé pour la compatibilité locale si besoin, mais inutilisé en ligne
require('dotenv').config();

/**
 * Envoie un email via l'API HTTP de Brevo (anciennement Sendinblue).
 * Cette méthode est nécessaire sur Render (Free Tier) car les ports SMTP (465, 587) sont bloqués.
 * L'API HTTP utilise le port 443 (HTTPS), qui est toujours ouvert.
 */
const sendEmail = async ({ to, subject, html }) => {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.SMTP_USER; // On réutilise cette variable pour l'email d'expédition

    // Mode Mock si pas de clé API (pour le dev local sans config)
    if (!apiKey || apiKey === '') {
        console.log('--- MOCK EMAIL SENT (No Brevo API Key) ---');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('Body:', html);
        console.log('------------------------------------------');
        return { messageId: 'mock-id' };
    }

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    name: "La Boîte à Ouvertures",
                    email: senderEmail
                },
                to: [{ email: to }],
                subject: subject,
                htmlContent: html
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Email sent successfully via Brevo API:', data.messageId);
            return data;
        } else {
            console.error('Brevo API error:', data);
            throw new Error(data.message || 'Error sending email via Brevo API');
        }
    } catch (error) {
        console.error('Error in sendEmail (Brevo API):', error);
        throw error;
    }
};

module.exports = { sendEmail };
