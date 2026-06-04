const mongoose = require("mongoose")

const streamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },

  description: String,

  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },

  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Section",
    required: true,
  },

  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  roomId: String,

  egressId: String,
  scheduledFor: Date,

  startedAt: Date,

  endedAt: Date,

  status: {
    type: String,
    enum: ["scheduled", "live", "ended"],
    default: "scheduled",
  },


  recordingUrl: String,
});


module.exports = mongoose.model("Stream",streamSchema)