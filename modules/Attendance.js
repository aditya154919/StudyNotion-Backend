const mongoose = require("mongoose");

const AttendanceSchema = new mongoose.Schema({
  stream: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Stream",
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  joinedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  lastJoinedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  leftAt: Date,
  durationSeconds: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ["present", "left"],
    default: "present",
  },
}, { timestamps: true });

AttendanceSchema.index({ stream: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
