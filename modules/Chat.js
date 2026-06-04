const mongoose = require("mongoose")

const chatSchema = new mongoose.Schema({
  stream: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Stream",
  },

  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  message: String,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.exports("Chat",chatSchema)