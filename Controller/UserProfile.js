const path = require("path");
const User = require("../modules/User");
const { uploadImageToCloudinary } = require("../utils/imageUploder");
const { convertSecondsToDuration } = require("../utils/ConvertTime");
const CourseProgress = require("../modules/CourseProgress");
const Course = require("../modules/Course");
require("dotenv").config();

exports.profileUpdate = async (req, res) => {
  try {
    const { firstName, lastName, about, dateOfBirth, gender, contactNumber } =
      req.body;
    const userId = req.userId;

    const userDetails = await User.findById(userId);
    userDetails.firstName = firstName || userDetails.firstName;
    userDetails.lastName = lastName || userDetails.lastName;
    userDetails.about = about || userDetails.about;
    userDetails.dateOfBirth = dateOfBirth || userDetails.dateOfBirth;
    userDetails.gender = gender || userDetails.gender;
    userDetails.contactNumber = contactNumber || userDetails.contactNumber;
    await userDetails.save();

    const updatedDetails = await User.findById(userId)

    return res.status(200).json({
      success: true,
      message: "User Profile update Successfully",
      data:updatedDetails
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error durnig updating profile/user details",
    });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;

    const userDetails = await User.findById(userId);
    if (!userId) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    userDetails.courses = null;
    userDetails.isLoggedin = false;
    await userDetails.save();

    const deleteAccount = await User.findByIdAndDelete(userId);
    return res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error durnig deletng Account",
    });
  }
};

exports.getAccountDetails = async (req, res) => {
  try {
    const userId = req.userId;

    const userDetails = await User.findById(userId);

    return res.status(200).json({
      success: true,
      message: "Account detalis get success",
      userDetails,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error durnig Geting Account",
    });
  }
};

exports.updateProfilePic = async (req, res) => {
  try {
    const userId = req.userId;
    const pic = req.files.pic;
    console.log("FILES =>", req.files);
    const user = await User.findById(userId);

    const profilePic = await uploadImageToCloudinary(
      pic.tempFilePath,
      process.env.FOLDER_NAME
    );

    const updatedProfilePic = await User.findByIdAndUpdate(userId,{
      image:profilePic.secure_url
    },{new:true})
    return res.status(200).json({
      success: true,
      message: "Profile pic updated successfully",
      picture: updatedProfilePic,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during updating profile pic",
    });
  }
};

exports.getEnrolledCourses = async (req, res) => {
  try {
    const userId = req.userId;
    // console.log("tokn",userId)
    let userDetails = await User.findById(userId)
      .populate({
        path: "courses",
        populate: {
          path: "courseContent",
          populate: {
            path: "subSection",
          },
        },
      })
      .exec();
    //   console.log("user",userDetails)

    userDetails = userDetails.toObject();

    var SubsectionLength = 0;
    for (var i = 0; i < userDetails.courses.length; i++) {
      let totalDurationInSeconds = 0;
      SubsectionLength = 0;
      for (var j = 0; j < userDetails.courses[i].courseContent.length; j++) {
        totalDurationInSeconds += userDetails.courses[i].courseContent[
          j
        ].subSection.reduce(
          (acc, curr) => acc + parseInt(curr.timeDuration),
          0
        );
        // console.log("hello")
        userDetails.courses[i].totalDuration = convertSecondsToDuration(
          totalDurationInSeconds
        );
        // console.log("sulululu")
        SubsectionLength +=
          userDetails.courses[i].courseContent[j].subSection.length;
      }
      let courseProgressCount = await CourseProgress.findOne({
        courseID: userDetails.courses[i]._id,
        userId: userId,
      });
      courseProgressCount = courseProgressCount?.completedVideo.length;
      if (SubsectionLength === 0) {
        userDetails.courses[i].progressPercentage = 100;
      } else {
        // To make it up to 2 decimal point
        const multiplier = Math.pow(10, 2);
        userDetails.courses[i].progressPercentage =
          Math.round(
            (courseProgressCount / SubsectionLength) * 100 * multiplier
          ) / multiplier;
      }
    }


    if (!userDetails) {
      return res.status(400).json({
        success: false,
        message: `Could not find user with id: ${userDetails}`,
      })
    }
    return res.status(200).json({
      success: true,
      data: userDetails.courses,
    })
  } catch (error) {
     console.log("Error",error)
     return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
};

exports.instructorDashboard = async(req,res)=>{
  try {
    const courseDetails = await Course.find({instructor:req.userId});

    const courseData = courseDetails.map((course)=>{
      const totalStudentsEnrolled = course.studentEnrolled.length;
      const totalEarning = totalStudentsEnrolled * course.price

      // create a new object with the Additional field
      const courseDataWithStats = {
        _id:course._id,
        courseName:course.courseName,
        courseDescription:course.courseDescription,
        totalStudentsEnrolled,
        totalEarning

      }
      return courseDataWithStats
    })


    res.status(200).json({
      success:true,
      data:courseData
    })
  } catch (error) {
    console.log("Error",error);
    return res.status(500).json({
      success:false,
      message:"Server error"
    })
  }
}
