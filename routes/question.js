const express = require("express");
const { authMiddleware, isInstructor } = require("../middleware/auth");
const { addQuestion, updateQuestion, publishQuestion } = require("../Controller/Question/AddQuestion");
const { fetchInstructorQuestion, deleteQuestion } = require("../Controller/Question/Instructor");
const { fetchQuestion, getTags } = require("../Controller/Question/fetchQuestion");
const router = express.Router();

router.post("/addQuestion",authMiddleware,isInstructor,addQuestion);
router.post("/updateQuestion",authMiddleware,isInstructor,updateQuestion)
router.post("/publishQuestion",authMiddleware,isInstructor,publishQuestion)
router.post("/fetchInstructorQuestion",authMiddleware,isInstructor,fetchInstructorQuestion)
router.delete("/deleteProblem",authMiddleware,isInstructor,deleteQuestion)
router.post("/fetchQuestions",fetchQuestion);
router.post("/getTags",getTags)

module.exports = router;