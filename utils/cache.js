
const redisConnection = require("../config/redis");

// Get data from Redis
exports.getCache = async (key) => {
  try {
    const cachedData = await redisConnection.get(key);

    if (cachedData === null) {
      return null; // Cache MISS
    }

    return JSON.parse(cachedData); // Cache HIT
  } catch (error) {
    console.error("Redis GET error:", error.message);
    return null;
  }
};

// Store data in Redis
exports.setCache = async (key, data, ttl = 300) => {
  try {
    await redisConnection.set(
      key,
      JSON.stringify(data),
      "EX",
      ttl
    );

    return true;
  } catch (error) {
    console.error("Redis SET error:", error.message);
    return false;
  }
};

// Delete data from Redis
exports.deleteCache = async (key) => {
  try {
    await redisConnection.del(key);
    return true;
  } catch (error) {
    console.error("Redis DELETE error:", error.message);
    return false;
  }
};
