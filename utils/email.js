const nodemailer = require("nodemailer");

const sendPasswordResetEmail = async (to, resetUrl) => {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("Gmail SMTP credentials are not configured");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"nextFEST" <${GMAIL_USER}>`,
    to,
    subject: "Reset your nextFEST password",
    text: `Use this link to reset your password. It expires in 15 minutes: ${resetUrl}`,
    html: `
      <p>We received a request to reset your nextFEST password.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 15 minutes. If you did not request this, ignore this email.</p>
    `,
  });
};

const sendAccountVerificationEmail = async (to, verificationUrl) => {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("Gmail SMTP credentials are not configured");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"nextFEST" <${GMAIL_USER}>`,
    to,
    subject: "Verify your nextFEST account",
    text: `Verify your account using this link. It expires in 24 hours: ${verificationUrl}`,
    html: `
      <p>Click the button below to verify your nextFEST account.</p>
      <p>
        <a href="${verificationUrl}"
           style="display:inline-block;padding:12px 20px;background:#2d7771;color:#fff;text-decoration:none;border-radius:4px">
          Verify account
        </a>
      </p>
      <p>This link expires in 24 hours. If you did not create this account, ignore this email.</p>
    `,
  });
};

const sendVerificationSuccessEmail = async (to) => {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("Gmail SMTP credentials are not configured");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"nextFEST" <${GMAIL_USER}>`,
    to,
    subject: "Your nextFEST account is verified",
    text: "Your email address has been successfully verified.",
    html: `
      <p>Your nextFEST account is verified.</p>
      <p>You can now use your account with your verified email address.</p>
    `,
  });
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });

const sendEventRegistrationConfirmationEmail = async ({
  to,
  fullName,
  eventTitle,
  eventDate,
  eventLocation,
  voucherCode,
}) => {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("Gmail SMTP credentials are not configured");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  const formattedDate = new Date(eventDate).toLocaleString();
  const safeName = escapeHtml(fullName);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeDate = escapeHtml(formattedDate);
  const safeLocation = escapeHtml(eventLocation || "Not specified");
  const safeVoucherCode = escapeHtml(voucherCode);

  await transporter.sendMail({
    from: `"nextFEST" <${GMAIL_USER}>`,
    to,
    subject: `Registration confirmed: ${eventTitle}`,
    text: [
      `Hi ${fullName},`,
      "",
      `Your registration for ${eventTitle} is confirmed.`,
      `Date: ${formattedDate}`,
      `Location: ${eventLocation || "Not specified"}`,
      "",
      `Your 16-character registration voucher code is: ${voucherCode}`,
      "Keep this code. Event organizers can use it to identify your registration.",
    ].join("\n"),
    html: `
      <p>Hi ${safeName},</p>
      <p>Your registration for <strong>${safeEventTitle}</strong> is confirmed.</p>
      <p><strong>Date:</strong> ${safeDate}</p>
      <p><strong>Location:</strong> ${safeLocation}</p>
      <p>Your registration voucher code is:</p>
      <p style="font-family:monospace;font-size:1.5rem;font-weight:bold;letter-spacing:0.15rem">
        ${safeVoucherCode}
      </p>
      <p>Keep this code. Event organizers can use it to identify your registration.</p>
    `,
  });
};

module.exports = {
  sendPasswordResetEmail,
  sendAccountVerificationEmail,
  sendVerificationSuccessEmail,
  sendEventRegistrationConfirmationEmail,
};
