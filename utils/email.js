const nodemailer = require("nodemailer");

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

const emailButton = (url, label) => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0">
    <tr>
      <td align="center" bgcolor="#d6b45d" style="border-radius:8px">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;color:#10100e;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none">
          ${label}
        </a>
      </td>
    </tr>
  </table>
`;

const emailLayout = (preheader, content) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="color-scheme" content="dark">
      <meta name="supported-color-schemes" content="dark">
      <title>nextFEST</title>
    </head>
    <body style="margin:0;padding:0;background-color:#10100e;color:#f4f0e5;font-family:Arial,Helvetica,sans-serif">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
        ${preheader}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#10100e">
        <tr>
          <td align="center" style="padding:36px 16px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px">
              <tr>
                <td style="padding:0 0 22px">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="38" height="38" align="center" valign="middle" bgcolor="#d6b45d" style="border-radius:10px;color:#10100e;font-size:23px;font-weight:bold">
                        N
                      </td>
                      <td style="padding-left:12px;color:#f4f0e5;font-size:22px;letter-spacing:-0.5px">
                        next<strong style="color:#f0d484">FEST</strong>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td bgcolor="#191916" style="padding:36px 34px;border:1px solid #37352b;border-radius:14px">
                  ${content}
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:22px 12px 0;color:#b4afa0;font-size:12px;line-height:1.6">
                  Sent by nextFEST. Discover events and make your next moment memorable.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

const emailHeading = (title) => `
  <h1 style="margin:0 0 20px;color:#f4f0e5;font-size:25px;line-height:1.3">
    ${title}
  </h1>
`;

const emailParagraph = (content) => `
  <p style="margin:0 0 16px;color:#d4d0c4;font-size:15px;line-height:1.7">
    ${content}
  </p>
`;

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
    html: emailLayout(
      "Reset your password securely.",
      `
        ${emailHeading("Reset your password")}
        ${emailParagraph("We received a request to reset your nextFEST password.")}
        ${emailButton(resetUrl, "Reset password")}
        ${emailParagraph('<span style="color:#b4afa0">This link expires in 15 minutes. If you did not request this, you can safely ignore this email.</span>')}
      `,
    ),
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
    html: emailLayout(
      "Verify your nextFEST account.",
      `
        ${emailHeading("Verify your email")}
        ${emailParagraph("One quick step before you join the fun: verify your nextFEST account.")}
        ${emailButton(verificationUrl, "Verify account")}
        ${emailParagraph('<span style="color:#b4afa0">This link expires in 24 hours. If you did not create this account, you can safely ignore this email.</span>')}
      `,
    ),
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
    html: emailLayout(
      "Your nextFEST account is verified.",
      `
        ${emailHeading("You're all set!")}
        ${emailParagraph("Your nextFEST account is verified.")}
        ${emailParagraph("You can now use your account with your verified email address.")}
      `,
    ),
  });
};

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
    html: emailLayout(
      `Registration confirmed for ${safeEventTitle}.`,
      `
        ${emailHeading("You're registered!")}
        ${emailParagraph(`Hi ${safeName}, your registration for <strong style="color:#f4f0e5">${safeEventTitle}</strong> is confirmed.`)}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0">
          <tr>
            <td style="padding:0 0 14px;color:#b4afa0;font-size:13px">EVENT DATE</td>
            <td align="right" style="padding:0 0 14px;color:#f4f0e5;font-size:14px">${safeDate}</td>
          </tr>
          <tr>
            <td style="padding:14px 0;border-top:1px solid #37352b;color:#b4afa0;font-size:13px">LOCATION</td>
            <td align="right" style="padding:14px 0;border-top:1px solid #37352b;color:#f4f0e5;font-size:14px">${safeLocation}</td>
          </tr>
        </table>
        ${emailParagraph("Your registration voucher code:")}
        <p style="margin:0 0 20px;padding:18px 14px;background-color:#10100e;border:1px solid #37352b;border-radius:8px;color:#f0d484;font-family:Courier New,monospace;font-size:20px;font-weight:bold;letter-spacing:3px;text-align:center;overflow-wrap:anywhere">
          ${safeVoucherCode}
        </p>
        ${emailParagraph('<span style="color:#b4afa0">Keep this code safe. Event organizers can use it to identify your registration.</span>')}
      `,
    ),
  });
};

module.exports = {
  sendPasswordResetEmail,
  sendAccountVerificationEmail,
  sendVerificationSuccessEmail,
  sendEventRegistrationConfirmationEmail,
};
