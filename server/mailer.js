require('dotenv').config();

/**
 * Sends an email via the Brevo (formerly Sendinblue) HTTP API.
 * This method is necessary on Render (Free Tier) because SMTP ports (465, 587) are blocked.
 * The HTTP API uses port 443 (HTTPS), which is always open.
 */
const sendEmail = async ({ to, subject, html }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SMTP_USER; // Reusing this variable for the sender email

  // Mock mode if no API key (for local dev without config)
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
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'La Boîte à Ouvertures',
          email: senderEmail,
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
      }),
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
