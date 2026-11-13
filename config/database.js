const mongoose = require("mongoose");
require("dotenv").config();

const connect = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);

    console.log("DATABASE CONNECTED SUCCESS");

  } catch (error) {
    console.error("DATABASE CONNECTION FAILED:", error.message);
    throw error;
  }
};

module.exports = { connect };
