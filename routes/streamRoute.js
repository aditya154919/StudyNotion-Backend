const express = require("express");
const { authMiddleware, isInstructor, isStudents } = require("../middleware/auth");
const { createStream, getStreamData, generateToken, getEnrolledStudentRoom, getStudentNotify, endStream, Uploadrecording } = require("../Controller/stream.controller");
const router = express.Router();

router.post("/createRoom",authMiddleware,isInstructor,createStream);
router.post("/getStreamData",authMiddleware,getStreamData)
router.post("/token",generateToken);
router.post("/studentRoom",authMiddleware,isStudents,getEnrolledStudentRoom)
router.post("/notification",authMiddleware,isInstructor,getStudentNotify)
router.post("/endStream",authMiddleware,isInstructor,endStream)
router.post("/uploadrecording",authMiddleware,isInstructor,Uploadrecording)

module.exports = router;