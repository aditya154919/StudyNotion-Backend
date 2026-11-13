const axios = require("axios");
require("dotenv").config();

const runCodeOnJudge0 = async ({ source_code, language_id, stdin }) => {
  try {
    const response = await axios.post(
      `${process.env.JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
      {
        source_code,
        language_id,
        stdin,
      }
    );

    return response.data;
  } catch (error) {
    console.error("Judge0 Error:", error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  runCodeOnJudge0,
};