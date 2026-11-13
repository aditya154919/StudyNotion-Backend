const mongoose = require("mongoose");

const streamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    required: true,
  },

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
    required: true,
  },

  roomId: {
    type: String,
    required: true,
    unique: true,
  },

  scheduledFor: Date,
  startedAt: Date,
  endedAt: Date,
  recordingEnabled: {
    type: Boolean,
    default: false,
  },
  notifyStudents: {
    type: Boolean,
    default: false,
  },

  status: {
    type: String,
    enum: ["scheduled", "live", "ended"],
    default: "scheduled",
  },

  recordingUrl: String,
  recordingSubSection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubSection",
  },
});

module.exports = mongoose.model("Stream", streamSchema);