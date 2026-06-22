const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined
});

const isConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';

/**
 * Send welcome email with temporary password and reset link
 * @param {string} to - recipient email
 * @param {string} tempPassword - plain temporary password
 * @param {string} role - 'doctor' | 'patient'
 * @param {string} resetToken - token for set-password link
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
async function sendWelcomeAndResetEmail(to, tempPassword, role, resetToken) {
  const resetLink = `${baseUrl}/set-password?token=${resetToken}`;
  const roleLabel = role === 'doctor' ? 'Doctor' : 'Patient';
  const subject = `Your Health Portal ${roleLabel} Account`;
  const html = `
    <h2>Welcome to Health Portal</h2>
    <p>Your ${roleLabel} account has been created.</p>
    <p><strong>Email:</strong> ${to}</p>
    <p><strong>Temporary password:</strong> ${tempPassword}</p>
    <p>Please sign in and set your own password using the link below:</p>
    <p><a href="${resetLink}">Set your password</a></p>
    <p>Or copy this link: ${resetLink}</p>
    <p>This link expires in 7 days.</p>
    <p>If you did not request this account, please contact the administrator.</p>
  `;
  const text = `Welcome to Health Portal. Your ${roleLabel} account: Email: ${to}, Temporary password: ${tempPassword}. Set your password: ${resetLink} (expires in 7 days).`;

  if (!isConfigured) {
    console.warn('Email not configured (SMTP_HOST/USER/PASS). Welcome email not sent. Temp password:', tempPassword);
    return { sent: false, error: 'Email not configured' };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@healthportal.com',
      to,
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('Send welcome email error:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendWelcomeAndResetEmail, isConfigured };
