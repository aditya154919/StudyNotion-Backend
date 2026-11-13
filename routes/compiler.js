const express  = require("express");
const router =  express.Router();
const { runCode } = require("../Controller/Compiler/Runcode");
const { authMiddleware, isStudents } = require("../middleware/auth");



router.post("/run",runCode);

module.exports = router;