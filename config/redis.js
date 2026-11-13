
const Redis = require("ioredis");
require("dotenv").config();

const redisConnection = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    })
  : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
    });

redisConnection.on("connect", () => {
  console.log("Redis connection established");
});

redisConnection.on("ready", () => {
  console.log("Redis is ready to accept commands");
});

redisConnection.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});

module.exports = redisConnection;
