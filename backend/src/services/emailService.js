import nodemailer from "nodemailer";

export const sendConfirmationEmail = async (email, name, confirmUrl) => {
  const transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST,
    port: Number(process.env.BREVO_SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER,
      pass: process.env.BREVO_SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"UrbanLviv" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "Please confirm your email",
    html: `
      <div style="max-width: 700px; margin: 0 auto; border: 1px solid #222; border-radius: 8px; overflow: hidden; font-family: Arial, sans-serif; color: #111;">
        <div style="background: #000; color: #fff; text-align: center; padding: 28px 20px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">
            Please Confirm Your Email
          </h1>
        </div>

        <div style="padding: 36px 32px;">
          <p>Dear <strong>${name}</strong>,</p>

          <p>
            Thank you for signing up with <strong>UrbanLviv</strong>! You're one step away from activating your account.
          </p>

          <p>
            To start using all features, such as reporting city issues, tracking progress, and receiving updates, please confirm your email by clicking the button below:
          </p>

          <div style="text-align: center; margin: 44px 0;">
            <a href="${confirmUrl}"
               style="display: inline-block; background: #000; color: #fff; padding: 18px 36px; border-radius: 20px; text-decoration: none; font-size: 18px; font-weight: 700;">
              Confirm Email
            </a>
          </div>

          <p style="text-align: center; font-weight: 700;">
            If you did not create an account with UrbanLviv, no action is needed — simply ignore this email and your information will not be used.
          </p>

          <p style="font-size: 14px; text-align: center; margin-top: 64px;">
            © 2026 UrbanLviv. All rights reserved.
          </p>
        </div>
      </div>
    `,
  });
};
