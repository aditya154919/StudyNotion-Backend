
require("dotenv").config();

const emailQueue = require("../queues/emailQueue");

const testEmail = async () => {
  try {
    const job = await emailQueue.add("send-email", {
      to: process.env.TEST_EMAIL,

      subject: "StudyNotion Background Job Test",

      htmlContent: `
        <h2>Hello from StudyNotion!</h2>
        <p>Your first BullMQ background email job is working.</p>
      `,
    });

    console.log("Email job added successfully!");
    console.log("Job ID:", job.id);

  } catch (error) {
    console.error(
      "Failed to add email job:",
      error.message
    );

    process.exitCode = 1;

  } finally {
    await emailQueue.close();
  }
};

testEmail();
