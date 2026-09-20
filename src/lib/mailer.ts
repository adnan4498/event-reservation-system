import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendVerificationEmail = async (to: string, rawToken: string) => {
  const verifyUrl = `${process.env.APP_URL}/verify-email?token=${rawToken}`;

  await transporter.sendMail({
    from: `"Your App" <${process.env.EMAIL_FROM}>`,
    to,
    subject: "Verify your email address",
    html: `
      <h2>Welcome!</h2>
      <p>Click the link below to verify your email. This link expires in 24 hours.</p>
      <a href="${verifyUrl}">Verify Email</a>
      <p>If you didn't create an account, ignore this email.</p>
    `,
  });
};

export const sendPasswordResetEmail = async (to: string, rawToken: string) => {
  const resetUrl = `${process.env.APP_URL}/reset-password?token=${rawToken}`;

  await transporter.sendMail({
    from: `"Your App" <${process.env.EMAIL_FROM}>`,
    to,
    subject: "Reset your password",
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If you didn't request this, ignore this email. Your password won't change.</p>
    `,
  });
};
