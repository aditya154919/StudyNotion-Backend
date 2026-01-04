const nodemailer = require("nodemailer");
require("dotenv").config();

const mailSender = async (email, title, body) => {
  try {
    let transport = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    let info = await transport.sendMail({
      from: process.env.FROM,
      to: `${email}`,
      subject: `${title}`,
      html:body,
    });

    console.log(info);
    return info;
  } catch (error) {
    console.log(error);
  }
};

module.exports = mailSender;
