const axios = require("axios");
require("dotenv").config();

const { runCodeOnJudge0 } = require("../../utils/judge0Service");

exports.runCode = async (req, res) => {
  try {

    const { source_code, language_id, stdin } = req.body;

    if (!source_code || !language_id) {
      return res.status(400).json({
        success: false,
        message: "Source code and language id are required",
      });
    }

    const result = await runCodeOnJudge0({
      source_code,
      language_id,
      stdin,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to execute code",
      error: error.response?.data || error.message,
    });

  }
};