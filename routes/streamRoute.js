const express = require("express");
const { authMiddleware, isInstructor, isStudents } = require("../middleware/auth");
const {
  createStream,
  getStreamData,
  getStreamStatus,
  generateToken,
  getEnrolledStudentRoom,
  startStream,
  joinAttendance,
  leaveAttendance,
  leaveStream,
  endStream,
} = require("../Controller/stream.controller");
const router = express.Router();

router.post("/createRoom", authMiddleware, isInstructor, createStream);
router.post("/getStreamData", authMiddleware, getStreamData);
router.post("/status", authMiddleware, getStreamStatus);
router.post("/token", authMiddleware, generateToken);
router.post("/studentRoom", authMiddleware, isStudents, getEnrolledStudentRoom);
router.post("/start", authMiddleware, isInstructor, startStream);
router.post("/attendance/join", authMiddleware, isStudents, joinAttendance);
router.post("/attendance/leave", authMiddleware, isStudents, leaveAttendance);
router.post("/leave", authMiddleware, leaveStream);
router.post("/endStream", authMiddleware, isInstructor, endStream);

module.exports = router;