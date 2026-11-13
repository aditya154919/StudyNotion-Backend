
const axios = require("axios");
require("dotenv").config();

const sendEmail = async (to, subject, htmlContent) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is missing");
    }

    if (!process.env.SENDER_EMAIL) {
      throw new Error("SENDER_EMAIL is missing");
    }

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "StudyNotion",
          email: process.env.SENDER_EMAIL,
        },
        to: [{ email: to }],
        subject,
        htmlContent,
      },
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log(
      `Email accepted by Brevo for ${to}`,
      response.data.messageId
    );

    return response.data;

  } catch (error) {
    console.error(
      "Email sending failed:",
      error.response?.data || error.message
    );

    throw error;
  }
};

module.exports = { sendEmail };
