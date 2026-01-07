const nodemailer = require("nodemailer");
require("dotenv").config();
const axios = require("axios")


const sendEmail = async (to, subject, htmlContent) => {
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { email: process.env.SENDER_EMAIL, name: "StudyNoton" },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });
    console.log(`Email sent to ${to}`);
  } catch (err) {
    console.error(" Email failed:", err.message);
  }
};

let transporter;
const isProduction = process.env.NODE_ENV === "production";

console.log(`📦 Mail mode: ${isProduction ? "BREVO API (production)" : "SMTP (local)"}`);

if(isProduction){
  transporter = {
   
    sendEmail: async({to,subject,html,text})=>{
      try {
        await axios.post(
          "https://api.brevo.com/v3/smtp/email",
          {
            sender: { name: "StudyNoton support", email: process.env.SMTP_USER },
            to: [{ email: to }],
            subject,
            htmlContent: html || `<p>${text}</p>`,
          },
          {
            headers: {
              accept: "application/json",
              "api-key": process.env.BREVO_API_KEY,
              "content-type": "application/json",
            },
          }
        );
        console.log(`✅ Email sent via Brevo API to ${to}`);
      } catch (err) {
        console.error("❌ Brevo API failed:", err.response?.data || err.message);
      }
    }
  }
}
else {
 
  transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  
  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ SMTP connection failed:", error);
    } else {
      console.log("✅ SMTP server ready to send emails locally");
    }
  });
}

module.exports ={ transporter,sendEmail};