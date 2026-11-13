const Question = require("../../modules/questions");

exports.fetchQuestion = async (req, res) => {
  try {
    const question = await Question.find({ status: "Published" });
    return res.status(200).json({
      success: true,
      message: "Question fetched success",
      data: question,
    });
  } catch (error) {
    console.log("server error", error.message);
    return res.status(500).json({
      success: false,
      message: "server error",
    });
  }
};

exports.getTags = async (req, res) => {
  try {
    const tags = await Question.aggregate([
      { $unwind: "$tags" },
      { $group: { _id: "$tags" } },
      { $sort: { _id: 1 } },
    ]);

    const result = tags.map((tag) => tag._id);

    res.status(200).json({
      success: true,
      message: "Tag fetched success",
      data:result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
