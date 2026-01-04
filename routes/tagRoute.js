const express = require("express");
const router = express.Router();
const { createTag, getAllTags, tagPageDetals } = require("../Controller/TagController");
const { authMiddleware, isAdmin, isInstructor, isStudents } = require("../middleware/auth");
const {
  createCourse,
  getCourseDetails,
  getInstructorCourse,
  editCourse,
  deleteCourse,
  getFullCourseDetails,
  getFullEnrolledCourseDetails,
} = require("../Controller/CourseController");
const {
  createSection,
  updateSection,
  deleteSection,
} = require("../Controller/SectionController");
const { createSubSection, deleteSubSection, updateSubSection } = require("../Controller/SubSectionController");
const { createRatingAndReview, getAllRating } = require("../Controller/RatingAndReview");
const { updatedCourseProgress } = require("../Controller/CourseProgressCOn");



router.post("/createTag", authMiddleware, isAdmin, createTag);
router.get("/getAllTag", getAllTags);
router.post("/tagPageDetails",tagPageDetals)
router.post("/createCourse", authMiddleware, isInstructor, createCourse);
router.post("/getFullCourseDetails",getFullCourseDetails)
router.post("/getFullEnrolledCourse",authMiddleware,isStudents,getFullEnrolledCourseDetails)
router.post("/updateCourse",authMiddleware,isInstructor,editCourse)
router.post("/deleteCourse",authMiddleware,isInstructor,deleteCourse)
router.post(
  "/getCourseDetails",
  authMiddleware,
  isInstructor,
  getCourseDetails
);
router.post("/courseProgress",authMiddleware,isStudents,updatedCourseProgress)
router.post("/createSection", authMiddleware, isInstructor, createSection);
router.post("/updateSection", authMiddleware, isInstructor, updateSection);
router.post("/deleteSection", authMiddleware, isInstructor, deleteSection);
router.post(
  "/createSubSection",
  authMiddleware,
  isInstructor,
  createSubSection
);
router.post("/updateSubSection",authMiddleware,isInstructor,updateSubSection)
router.post("/deleteSubSection",authMiddleware,isInstructor,deleteSubSection)
router.get("/getInstructorCourses",authMiddleware,isInstructor,getInstructorCourse)

// rating
router.post("/createRating",authMiddleware,isStudents,createRatingAndReview);
router.post("/getRating",getAllRating)

module.exports = router;
