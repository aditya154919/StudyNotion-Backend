const express = require("express");
const { signUp, verify, login, logout, changePassword, forgotPassword, resetPassword, verifyOtp } = require("../Controller/Auth");
const { authMiddleware, isInstructor } = require("../middleware/auth");
const { profileUpdate, deleteAccount, getAccountDetails, updateProfilePic, getEnrolledCourses, instructorDashboard } = require("../Controller/UserProfile");
const { contactUs } = require("../Controller/Contact");
const router = express.Router();


router.post("/signup",signUp);
router.post("/verify/:token",verify);
router.post("/login",login);
router.post("/logout",authMiddleware,logout);
router.post("/verifyOtp",verifyOtp)
router.post("/updateProfile",authMiddleware,profileUpdate);
router.delete("/deleteAccount",authMiddleware,deleteAccount);
router.get("/getUserDetails",authMiddleware,getAccountDetails);
router.post("/changepass",authMiddleware,changePassword);
router.post("/forgotPassword",forgotPassword);
router.post("/resetPassword",resetPassword);
router.post("/updateProfilePic",authMiddleware,updateProfilePic);
router.post("/getEnrolledCourses",authMiddleware,getEnrolledCourses);
router.post("/instructorDashboard",authMiddleware,isInstructor,instructorDashboard);
router.post("/contactUs",contactUs)

module.exports = router