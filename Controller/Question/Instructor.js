const Questions = require("../../modules/questions");
const User = require("../../modules/User");

exports.fetchInstructorQuestion = async (req, res) => {
  try {
    const userId = req.userId;
    // console.log("UsrId", userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const question = await Questions.find({
      instructor: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Fetch success",
      data: question,
    });
  } catch (error) {
    console.log("Server error");
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { QuestionId } = req.body;
    const userId = req.userId;
    console.log("Data",req.body)

    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "user not found",
      });
    }

    const question = await Questions.findById(QuestionId);
    if(!question){
        return res.status(400).json({
            success:true,
            message:"Question not found"
        })
    }

    const studentSolved = question.studentSolved;
    for(const studentId of studentSolved){
        await User.findByIdAndUpdate(studentId,{
            $pull:{
                solvedProblem:QuestionId
            }
        },{
            new:true
        })
    }

    await User.findByIdAndUpdate(
       userId ,
      {
        $pull: {
          problems:QuestionId,
        },
      },
      {
        new: true,
      },
    );

    await Questions.findByIdAndDelete(QuestionId);
    return res.status(200).json({
        success:true,
        message:"Question deleted success"
    })
  } catch (error) {
    console.log("Server error");
    return res.status(500).json({
        success:false,
        message:"Server error"
    })
  }
};
