const express = require("express");
const User = require("../modules/User");
const Tag = require("../modules/Tag");
const { uploadImageToCloudinary } = require("../utils/imageUploder");
const Course = require("../modules/Course");
const { data } = require("react-router");
const path = require("path");
const Section = require("../modules/Section");
const SubSection = require("../modules/SubSection");
const CourseProgress = require("../modules/CourseProgress");
const { convertSecondsToDuration } = require("../utils/ConvertTime");
// const path = require("path");

exports.createCourse = async (req, res) => {
  try {
    console.log("Body Requesr", req.body);
    const userId = req.userId;
    console.log("User", userId);
    console.log(req.files);
    let {
      courseName,
      courseDescription,
      whatYouWillLearn,
      price,
      tag,
      status,
    } = req.body;

    const thumbnail = req.files.thumbnail;
    //validation
    if (
      !courseName ||
      !courseDescription ||
      !whatYouWillLearn ||
      !price ||
      !tag ||
      !thumbnail
    ) {
      return res.status(404).json({
        success: false,
        message: "Please fill all detals",
      });
    }

    if (!status || status === undefined) {
      status = "Draft";
    }

    //need instructor details
    const instructorDetails = await User.findById(userId);
    console.log("Instructor detals", instructorDetails);
    if (!instructorDetails) {
      return res.status(400).json({
        success: false,
        message: "Instructor not found",
      });
    }

    //check either tag is valid or not
    const tagDetails = await Tag.findById(tag);
    if (!tagDetails) {
      return res.status(400).json({
        success: false,
        message: "Tag not found",
      });
    }

    //upload image to cloudinary
    const thumbnailImage = await uploadImageToCloudinary(
      thumbnail.tempFilePath,
      process.env.FOLDER_NAME
    );

    //create an entry for new course
    const newCourse = await Course.create({
      courseName,
      courseDescription,
      instructor: instructorDetails._id,
      whatYouWillLearn,
      price,
      tag: tagDetails._id,
      thumbnail: thumbnailImage.secure_url,
      status: status,
    });

    //update user->Instructor add course
    await User.findByIdAndUpdate(
      { _id: instructorDetails._id },
      {
        $push: {
          courses: newCourse._id,
        },
      }
    );

    //update tag schema;
    await Tag.findByIdAndUpdate(
      {
        _id: tagDetails._id,
      },
      {
        $push: {
          course: newCourse._id,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Course created successfully",
      data: newCourse,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during creating course",
    });
  }
};

exports.getAllCourses = async (req, res) => {
  try {
    const allCourses = await Course.find(
      {},
      {
        //remaining
      }
    );

    return res.status(200).json({
      success: true,
      message: "All courses get Successfully",
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during geting all courses",
    });
  }
};

// exports.editCourse = async(req,res)=>{
//   try {
//     console.log("Hello ji ",req.body)
//     console.log("Kaise ho",req.files)
//     const {courseId} = req.body;
//     const update = req.body

//    const course = await Course.findById(courseId);
//    if(!course){
//     return res.status(400).json({
//       success:false,
//       message:"Course not found"
//     })
//    }

//      if (req.files) {
//       console.log("thumbnail update")
//       const thumbnail = req.files.tempFilePath
//       const thumbnailImage = await uploadImageToCloudinary(
//         thumbnail.tempFilePath,
//         process.env.FOLDER_NAME
//       )
//       course.thumbnail = thumbnailImage.secure_url
//     }

//     for(const key in update){
//       if(update.hasOwnProperty(key)){
//         course[key] = update[key]
//       }
//     }

//     await course.save()

//    return res.status(200).json({
//     success:true,
//     message:"Course Updated Successfully",
//     data:course
//    })

//   } catch (error) {
//     console.log("Error",error)
//     return res.status(500).json({
//       success:false,
//       message:"Server error during updated course"
//     })
//   }
// }

exports.editCourse = async (req, res) => {
  try {
    console.log("REQ BODY", req.body);
    console.log("REQ FILES", req.files);

    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // ✅ Thumbnail update
    if (req.files?.thumbnail) {
      console.log("thumbnail update");

      const thumbnail = req.files.thumbnail;

      const uploadedImage = await uploadImageToCloudinary(
        thumbnail.tem,
        process.env.FOLDER_NAME
      );

      course.thumbnail = uploadedImage.secure_url;
    }

    // ✅ Whitelisted updates only
    const allowedUpdates = [
      "courseName",
      "courseDescription",
      "price",
      "whatYouWillLearn",
      "tag",
      "status",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        course[field] = req.body[field];
      }
    });

    await course.save();

    const updatedCourse = await Course.findById(courseId)
      .populate({
        path: "courseContent",
        populate: {
          path: "subSection",
        },
      })
      .exec();

    return res.status(200).json({
      success: true,
      message: "Course Updated Successfully",
      data: updatedCourse,
    });
  } catch (error) {
    console.error("EDIT COURSE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during course update",
    });
  }
};

exports.getCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.body;
    const courseDetails = await Course.findById({ _id: courseId })
      .populate("instructor")
      .populate("tag");
    // .populate("ratingAndReview")
    // .populate({
    //   path: "courseContent",
    //   populate: {
    //     path: "subSection",
    //   },
    // });

    if (!courseDetails) {
      return res.status(400).json({
        success: false,
        message: `Could not find the course with ${courseId}`,
      });
    }
    return res.status(200).json({
      success: true,
      message: "Course details fetched successfully",
      data: courseDetails,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during geting  course Details",
    });
  }
};

exports.getFullCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.body;
    // const userId = req.userId;
    console.log("REQ BODY ", req.body);

    const courseDetails = await Course.findById({ _id: courseId })
      .populate("instructor")
      .populate("tag")
      .populate("ratingAndReview")
      .populate({
        path: "courseContent",
        populate: {
          path: "subSection",
        },
      })
      .exec();

    // let courseProgressCount = await CourseProgress.find({
    //   userId:userId,
    //   courseID:courseId
    // })
    // console.log("courseProgressCount : ", courseProgressCount)

    if (!courseDetails) {
      return res.status(400).json({
        success: false,
        message: `Could not find course with id: ${courseId}`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "CourseDetails fetched success",
      data: { courseDetails },
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getInstructorCourse = async (req, res) => {
  try {
    const InstructorId = req.userId;

    const instructorCourse = await Course.find({
      instructor: InstructorId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: instructorCourse,
    });
  } catch (error) {
    console.log("Error", error);
    console.log("Server error during geting instructor courses");
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course Not found",
      });
    }

    //unenroll the students
    const studentenroled = course.studentEnrolled;
    for (const studentId of studentenroled) {
      await User.findByIdAndUpdate(studentId, {
        $pull: {
          courses: courseId,
        },
      });
    }

    //Delet section and subsection
    // first subsction is deleted then section then course
    const coursesection = course.courseContent;
    for (const sectionId of coursesection) {
      const section = await Section.findById(sectionId);
      if (section) {
        const subsections = section.subSection;
        for (const subsectionId of subsections) {
          await SubSection.findByIdAndDelete(subsectionId);
        }
      }

      await Section.findByIdAndDelete(sectionId);
    }

    //delete course
    await Course.findByIdAndDelete(courseId);

    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getFullEnrolledCourseDetails = async (req, res) => {
  try {
    const courseId = req.body.courseId;
    const userId = req.userId;
    console.log("REQ BODY ", req.body);

    const courseDetails = await Course.findById(courseId)
      .populate("instructor")
      .populate("tag")
      .populate("ratingAndReview")
      .populate({
        path: "courseContent",
        populate: {
          path: "subSection",
        },
      })
      .exec();

    let courseProgressCount = await CourseProgress.findOne({
      userId: userId,
      courseID: courseId,
    });
    console.log("courseProgressCount : ", courseProgressCount)

    if (!courseDetails) {
      return res.status(400).json({
        success: false,
        message: `Could not find course with id: ${courseId}`,
      });
    }
    let totalDurationInSeconds = 0;
    courseDetails.courseContent.forEach((content) => {
      content.subSection.forEach((subSection) => {
        const timeDurationInSeconds = parseInt(subSection.timeDuration);
        totalDurationInSeconds += timeDurationInSeconds;
      });
    });

    const totalDuration = convertSecondsToDuration(totalDurationInSeconds);

    return res.status(200).json({
      success: true,
      message: "CourseDetails fetched success",
      data: { courseDetails,
        totalDuration,
        completedVideos: courseProgressCount?.completedVideo
          
       },
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
