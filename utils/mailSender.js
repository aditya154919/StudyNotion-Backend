const nodemailer = require("nodemailer");
require("dotenv").config();

// ✅ Create transporter ONCE
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ✅ Verify ONCE
transporter.verify((error) => {
  if (error) {
    console.log("SMTP ERROR ❌", error.message);
  } else {
    console.log("SMTP READY ✅");
  }
});

const mailSender = async (email, title, body) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.FROM,
      to: email,
      subject: title,
      html: body,
    });

    return info;
  } catch (error) {
    console.log("MAIL SEND ERROR ❌", error.message);
    throw error; // ✅ IMPORTANT
  }
};

module.exports = mailSender;
