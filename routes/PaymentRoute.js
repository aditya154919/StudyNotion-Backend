const express = require("express");
const { authMiddleware, isStudents } = require("../middleware/auth");
const { capturePayment, verifyPayment, sendMailSuccsee } = require("../Controller/Payments");
const router = express.Router()


router.post("/capturePayment",authMiddleware,isStudents,capturePayment);
router.post("/verifyPayment",authMiddleware,isStudents,verifyPayment);
router.post("/sendMailSuccess",authMiddleware,sendMailSuccsee)


module.exports = router