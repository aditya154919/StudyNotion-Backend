const {Worker}  = require("bullmq");
const redisConnection = require("../config/redis");
const mailSender = require("../utils/mailSender");
const { connection } = require("mongoose");

const emailWorker = new Worker(
    "StudyNotion-email-queue",

    async(job)=>{
        console.log("Processing email job",job.id);

        const {to,subject,htmlContent} = job.data;

        await mailSender.sendEmail(to,subject,htmlContent);
        console.log(`Email job completed: ${job.id}`);

        return{
            success:true,
            recipient:to
        };
    },

    {
        connection:redisConnection,
        concurrency:5,
    }
);

emailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

emailWorker.on("failed", (job, error) => {
  console.error(
    `Job ${job?.id} failed:`,
    error.message
  );
});


emailWorker.on("error", (error) => {
  console.error("Worker error:", error.message);
});

console.log("Email worker is running...");

module.exports = emailWorker;