const User = require("../../modules/User");
const { uploadImageToCloudinary } = require("../../utils/imageUploder");
const Question = require("./../../modules/questions");

exports.addQuestion = async (req, res) => {
  try {
    const {
      title,
      description,
      difficulty,
      slug,
      tags,
      companies,
      constraints,
    } = req.body;
    const userId = req.userId;
    console.log("Body", req.body);

    if (
      !title ||
      !description ||
      !difficulty ||
      !slug ||
      !tags ||
      !companies ||
      !constraints
    ) {
      return res.status(400).json({
        success: false,
        message: "All field required",
      });
    }
    const tagss = req.body.tags.split(",").map((tag) => tag.trim());

    const companiess = req.body.companies
      .split(",")
      .map((company) => company.trim());

    const question = await Question.findOne({ slug: slug });
    if (question) {
      return res.status(401).json({
        success: false,
        message: "Question Already added",
      });
    }

    const result = await Question.create({
      title: title,
      description: description,
      difficulty: difficulty,
      slug: slug,
      tags: tagss,
      companies: companiess,
      constraints: constraints,
      instructor: userId,
    });

    await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          problems: result._id,
        },
      },
      {
        new: true,
      },
    );
    return res.status(200).json({
      success: true,
      message: "Question add success",
      data: result,
    });
  } catch (error) {
    console.log("Server error", error.message);
    return res.status(500).json({
      sucess: false,
      message: "Server error",
    });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.body;
    console.log("Req.body", req.body);
    const problem = await Question.findById(questionId);

    if (!problem) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const allowedUpdates = [
      "examples",
      "testCases",
      "functionSignature",
      "starterCode",
      "hints",
    ];

    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedQuestion = await Question.findByIdAndUpdate(
      questionId,
      { $set: updates },
      { new: true, runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: updatedQuestion,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update question",
      error: error.message,
    });
  }
};

exports.publishQuestion = async (req, res) => {
  try {
    const { description, solutionCode, questionId } = req.body;
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    if (!description || !solutionCode || !questionId) {
      return res.status(400).json({
        success: false,
        message: "All field reqd",
      });
    }
    const video = req.files?.video;

    let videoUrl = "";

    if (video) {
      const uploaded = await uploadImageToCloudinary(
        video.tempFilePath,
        process.env.FOLDER_NAME,
      );

      videoUrl = uploaded.secure_url;
    }

    const question = await Question.findByIdAndUpdate(
      questionId,
      {
        editorial: {
          videoUrl: videoUrl,
          description: description,
        },
        solutionCode: JSON.parse(solutionCode),
        status: "Published",
      },
      {
        new: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Question is published",
      data: question,
    });
  } catch (error) {
    console.log("Server error", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
