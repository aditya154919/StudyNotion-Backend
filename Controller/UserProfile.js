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

    const updatedDetails = await User.findById(userId);

    return res.status(200).json({
      success: true,
      message: "User Profile update Successfully",
      data: updatedDetails,
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
      process.env.FOLDER_NAME,
    );

    const updatedProfilePic = await User.findByIdAndUpdate(
      userId,
      {
        image: profilePic.secure_url,
      },
      { new: true },
    );
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
          select: "-materials",
          populate: {
            path: "subSection",
          },
        },
      })
      .exec();
    //   console.log("user",userDetails)

    if (!userDetails) {
      return res.status(404).json({
        success: false,
        message: "Could not find user",
      });
    }

    userDetails = userDetails.toObject();

    var SubsectionLength = 0;
    for (var i = 0; i < userDetails.courses.length; i++) {
      const course = userDetails.courses[i];
      const cancelledEnrollment = course.cancelledEnrollments?.find(
        (enrollment) =>
          enrollment.student?.toString() === userId.toString() &&
          !enrollment.reinstatedAt,
      );
      course.enrollmentStatus = cancelledEnrollment ? "Cancelled" : "Active";
      course.enrollmentCancelledAt = cancelledEnrollment?.cancelledAt || null;
      course.enrollmentCancellationReason = cancelledEnrollment?.reason || null;
      delete course.cancelledEnrollments;

      let totalDurationInSeconds = 0;
      SubsectionLength = 0;
      for (var j = 0; j < course.courseContent.length; j++) {
        totalDurationInSeconds += course.courseContent[j].subSection.reduce(
          (acc, curr) => acc + parseInt(curr.timeDuration),
          0,
        );
        SubsectionLength += course.courseContent[j].subSection.length;
      }
      course.totalDuration =
        convertSecondsToDuration(totalDurationInSeconds);
      let courseProgressCount = await CourseProgress.findOne({
        courseID: course._id,
        userId: userId,
      });
      courseProgressCount = courseProgressCount?.completedVideo.length || 0;
      if (SubsectionLength === 0) {
        course.progressPercentage = 100;
      } else {
        // To make it up to 2 decimal point
        const multiplier = Math.pow(10, 2);
        course.progressPercentage =
          Math.round(
            (courseProgressCount / SubsectionLength) * 100 * multiplier,
          ) / multiplier;
      }
    }

    return res.status(200).json({
      success: true,
      data: userDetails.courses,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.instructorDashboard = async (req, res) => {
  try {
    const courseDetails = await Course.find({ instructor: req.userId });

    const courseData = courseDetails.map((course) => {
      const totalStudentsEnrolled = course.studentEnrolled.length;

      const courseDataWithStats = {
        _id: course._id,
        courseName: course.courseName,
        courseDescription: course.courseDescription,
        totalStudentsEnrolled,
        cancelledStudentsCount: course.cancelledEnrollments.length,
      };
      return courseDataWithStats;
    });

    res.status(200).json({
      success: true,
      data: courseData,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
