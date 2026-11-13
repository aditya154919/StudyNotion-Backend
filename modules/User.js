const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  accountType: {
    type: String,
    enum: ["Admin", "Student", "Instructor"],
    required: true,
  },
  courses: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
  ],
  image: {
    type: String,
    default: null,
  },
  courseProgress: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseProgress",
    },
  ],
  token: {
    type: String,
    default: null,
  },
  gender: {
    type: String,
    default: null,
  },
  dateOfBirth: {
    type: String,
    default: null,
  },
  about: {
    type: String,
    default: null,
  },
  contactNumber: {
    type: Number,
    default: null,
  },
  isAccountVerified: {
    type: Boolean,
    default: false,
  },
  isLoggedin: {
    type: Boolean,
    default: false,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
  otpAttempts: {
    type: Number,
    default: 0,
  },
  resetPassOtp: {
    type: String,
    default: null,
  },
  resetTokenHash: {
    type: String,
    default: null,
  },

  resetTokenExpires: {
    type: Date,
    default: null,
  },
  solvedProblem: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
