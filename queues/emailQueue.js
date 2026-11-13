const {Queue} = require("bullmq");
const redisConnection = require("../config/redis");

const emailQueue = new Queue("StudyNotion-email-queue",{
    connection:redisConnection,
    
    defaultJobOptions:{
        attempts:3,

        backoff:{
            type:"exponential",
            delay:5000
        },

        removeOnComplete:{
            count:1000
        },
        removeOnFail:{
            count:5000
        }
    }
});

emailQueue.on("error",(error)=>{
    console.log("Email Queue Error ",error.message);
})

module.exports = emailQueue;