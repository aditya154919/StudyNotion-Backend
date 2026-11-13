const express = require("express");
const mongoose = require("mongoose");
const User = require("../modules/User");
const Tag = require("../modules/Tag");
const { uploadImageToCloudinary } = require("../utils/imageUploder");
const Course = require("../modules/Course");
const path = require("path");
const Section = require("../modules/Section");
const SubSection = require("../modules/SubSection");
const CourseProgress = require("../modules/CourseProgress");
const RatingAndReview = require("../modules/RatingAndReview");
const Stream = require("../modules/stream");
const Attendance = require("../modules/Attendance");
const { RoomServiceClient } = require("livekit-server-sdk");
const { convertSecondsToDuration } = require("../utils/ConvertTime");
const { getCache, setCache,deleteCache } = require("../utils/cache");
const { deleteUploadedMaterials } = require("../utils/sectionMaterials");

exports.createCourse = async (req, res) => {
  try {
    console.log("Body Requesr", req.body);
    const userId = req.userId;
    // console.log("User", userId);
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
      process.env.FOLDER_NAME,
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
      },
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
      },
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

exports.editCourse = async (req, res) => {
  let uploadedImage;
  let courseSaved = false;
  try {
    const { courseId } = req.body;

    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "A valid course ID is required",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.instructor.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own courses",
      });
    }
    const { courseName, courseDescription, whatYouWillLearn } = req.body;
    for (const [field, value] of Object.entries({
      courseName,
      courseDescription,
      whatYouWillLearn,
    })) {
      if (value !== undefined && (typeof value !== "string" || !value.trim())) {
        return res.status(400).json({
          success: false,
          message: `${field} cannot be empty`,
        });
      }
    }

    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: "Course price must be a non-negative number",
        });
      }
      course.price = price;
    }

    if (
      req.body.status !== undefined &&
      !["Draft", "Published"].includes(req.body.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Course status must be Draft or Published",
      });
    }
    if (
      req.body.status !== undefined &&
      req.body.status !== course.status &&
      (course.studentEnrolled?.length || 0) > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Remove active learners individually before unpublishing this course.",
      });
    }

    const previousTagId = course.tag?.toString();
    let updatedTag;
    if (req.body.tag !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(req.body.tag)) {
        return res.status(400).json({
          success: false,
          message: "A valid course category is required",
        });
      }
      updatedTag = await Tag.findById(req.body.tag);
      if (!updatedTag) {
        return res.status(400).json({
          success: false,
          message: "Selected course category was not found",
        });
      }
    }

    if (req.files?.thumbnail) {
      const thumbnail = req.files.thumbnail;
      if (
        !thumbnail.tempFilePath ||
        !String(thumbnail.mimetype || "").startsWith("image/") ||
        thumbnail.size > 10 * 1024 * 1024
      ) {
        return res.status(400).json({
          success: false,
          message: "Course thumbnail must be an image smaller than 10 MB",
        });
      }
      uploadedImage = await uploadImageToCloudinary(
        thumbnail.tempFilePath,
        process.env.FOLDER_NAME,
      );
      if (!uploadedImage?.secure_url) {
        throw new Error("Image storage did not return a thumbnail URL");
      }
      course.thumbnail = uploadedImage.secure_url;
      course.thumbnail_public_id = uploadedImage.public_id;
    }

    if (courseName !== undefined) course.courseName = courseName.trim();
    if (courseDescription !== undefined)
      course.courseDescription = courseDescription.trim();
    if (whatYouWillLearn !== undefined)
      course.whatYouWillLearn = whatYouWillLearn.trim();
    if (updatedTag) course.tag = updatedTag._id;
    if (req.body.status !== undefined) course.status = req.body.status;

    await course.save();
    courseSaved = true;

    if (updatedTag && previousTagId !== updatedTag._id.toString()) {
      await Promise.all([
        previousTagId
          ? Tag.updateOne(
              { _id: previousTagId },
              { $pull: { course: course._id } },
            )
          : Promise.resolve(),
        Tag.updateOne(
          { _id: updatedTag._id },
          { $addToSet: { course: course._id } },
        ),
      ]);
    }

    const updatedCourse = await Course.findById(courseId)
      .populate("tag")
      .populate({
        path: "courseContent",
        populate: {
          path: "subSection",
        },
      })
      .populate({
        path: "studentEnrolled",
        select: "firstName lastName email image",
      })
      .populate({
        path: "cancelledEnrollments.student",
        select: "firstName lastName email image",
      })
      .populate({
        path: "cancelledEnrollments.student",
        select: "firstName lastName email image",
      })
      .exec();
      await deleteCache(`course:details:${courseId}`);

    return res.status(200).json({
      success: true,
      message: "Course Updated Successfully",
      data: updatedCourse,
    });
  } catch (error) {
    console.error("EDIT COURSE ERROR:", error);
    if (!courseSaved && uploadedImage?.public_id) {
      try {
        const cloudinary = require("cloudinary").v2;
        await cloudinary.uploader.destroy(uploadedImage.public_id);
      } catch (cleanupError) {
        console.error(
          "Could not clean up the new course thumbnail:",
          cleanupError,
        );
      }
    }
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
      .select("-cancelledEnrollments")
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

exports.getInstructorCourseForEdit = async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Valid course ID is required",
      });
    }

    const courseDetails = await Course.findOne({
      _id: courseId,
      instructor: req.userId,
    })
      .populate("tag")
      .populate({
        path: "courseContent",
        populate: {
          path: "subSection",
        },
      })
      .exec();

    if (!courseDetails) {
      return res.status(404).json({
        success: false,
        message: "Course not found or you do not own it",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Course details fetched successfully",
      data: courseDetails,
    });
  } catch (error) {
    console.error("Could not load course for editing:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load course for editing",
    });
  }
};

exports.getFullCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Valid course ID is required",
      });
    }

    const cachekey = `course:details:${courseId}`;

    const cachedCourse = await getCache(cachekey);

    if (cachedCourse != null) {
      console.log("Chache-Hit-Course");

      return res.status(200).json({
        success: true,
        message: "Course details fetched from cache",
        source: "Redis",
        data: {
          courseDetails: cachedCourse,
        },
      });
    }

    console.log("Cache MISS - MongoDB");
    const courseDetails = await Course.findById({ _id: courseId })
      .populate("instructor")
      .populate("tag")
      .populate("ratingAndReview")
      .populate({
        path: "courseContent",
        select: "-materials",
        populate: {
          path: "subSection",
        },
      })
      .exec();
    if (!courseDetails) {
      return res.status(400).json({
        success: false,
        message: `Could not find course with id: ${courseId}`,
      });

    }

    await setCache(cachekey, courseDetails.toObject(), 300);

    return res.status(200).json({
      success: true,
      message: "Course details fetched successfully",
      source: "MongoDB",
      data: {
        courseDetails,
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

exports.getInstructorCourse = async (req, res) => {
  try {
    const InstructorId = req.userId;

    const instructorCourse = await Course.find({
      instructor: InstructorId,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "courseContent",
        populate: {
          path: "subSection",
        },
      })
      .populate({
        path: "studentEnrolled",
        select: "firstName lastName email image",
      })
      .populate({
        path: "cancelledEnrollments.student",
        select: "firstName lastName email image",
      })
      .exec();

    return res.status(200).json({
      success: true,
      data: instructorCourse,
    });
  } catch (error) {
    console.log("Error", error);
    console.log("Server error during geting instructor courses");
    return res.status(500).json({
      success: false,
      message: "Could not fetch instructor courses",
    });
  }
};

exports.cancelStudentEnrollment = async (req, res) => {
  try {
    const { courseId, studentId, reason } = req.body;
    if (!courseId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Course ID and student ID are required",
      });
    }
    if (
      !mongoose.Types.ObjectId.isValid(courseId) ||
      !mongoose.Types.ObjectId.isValid(studentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid course or student ID",
      });
    }
    if (studentId === req.userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "An instructor cannot cancel their own enrollment",
      });
    }
    const student = await User.findOne({
      _id: studentId,
      accountType: "Student",
    }).select("_id");
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason for cancelling this enrollment",
      });
    }
    const cancellationReason = reason.trim().slice(0, 500);
    const course = await Course.findOneAndUpdate(
      {
        _id: courseId,
        instructor: req.userId,
        status: "Published",
        studentEnrolled: studentId,
      },
      {
        $pull: { studentEnrolled: studentId },
        $push: {
          cancelledEnrollments: {
            student: studentId,
            cancelledBy: req.userId,
            cancelledAt: new Date(),
            reason: cancellationReason,
          },
        },
      },
      { new: true, runValidators: true },
    );

    if (!course) {
      const ownedCourse = await Course.findOne({
        _id: courseId,
        instructor: req.userId,
      });
      if (!ownedCourse) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }
      if (
        ownedCourse.cancelledEnrollments.some(
          (enrollment) =>
            enrollment.student.toString() === studentId &&
            !enrollment.reinstatedAt,
        )
      ) {
        return res.status(409).json({
          success: false,
          message: "This learner's enrollment has already been cancelled",
        });
      }
      return res.status(409).json({
        success: false,
        message:
          "This learner does not have an active enrollment in this course",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Enrollment cancelled. The course remains available to other students.",
      data: {
        courseId: course._id,
        studentId,
        cancelledAt: course.cancelledEnrollments.at(-1)?.cancelledAt,
        reason: cancellationReason,
      },
    });
  } catch (error) {
    console.error("Student enrollment cancellation error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not revoke learner access",
    });
  }
};

exports.restoreStudentEnrollment = async (req, res) => {
  try {
    const { courseId, studentId } = req.body;
    if (
      !mongoose.Types.ObjectId.isValid(courseId) ||
      !mongoose.Types.ObjectId.isValid(studentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid course and student IDs are required",
      });
    }

    const student = await User.findOne({
      _id: studentId,
      accountType: "Student",
    }).select("_id");
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const course = await Course.findOne({
      _id: courseId,
      instructor: req.userId,
    });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    if (course.status !== "Published") {
      return res.status(409).json({
        success: false,
        message: "Publish this course before restoring student access",
      });
    }
    if (course.studentEnrolled.some((id) => id.toString() === studentId)) {
      return res.status(409).json({
        success: false,
        message: "This student already has access to the course",
      });
    }

    const updatedCourse = await Course.findOneAndUpdate(
      {
        _id: courseId,
        instructor: req.userId,
        cancelledEnrollments: {
          $elemMatch: { student: studentId, reinstatedAt: null },
        },
      },
      {
        $addToSet: { studentEnrolled: studentId },
        $set: {
          "cancelledEnrollments.$.reinstatedAt": new Date(),
          "cancelledEnrollments.$.reinstatedBy": req.userId,
        },
      },
      { new: true, runValidators: true },
    );

    if (!updatedCourse) {
      return res.status(409).json({
        success: false,
        message: "No cancelled enrollment exists for this student",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student access restored. Their course progress has been kept.",
      data: {
        courseId: updatedCourse._id,
        studentId,
      },
    });
  } catch (error) {
    console.error("Student enrollment restoration error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not restore student access",
    });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "A valid course ID is required",
      });
    }
    const course = await Course.findOne({
      _id: courseId,
      instructor: req.userId,
    });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const sectionIds = course.courseContent || [];
    const sections = await Section.find({ _id: { $in: sectionIds } }).select(
      "subSection materials",
    );
    const subsectionIds = [
      ...new Set(
        sections.flatMap((section) =>
          (section.subSection || []).filter(Boolean).map((id) => id.toString()),
        ),
      ),
    ];
    const progressRecords = await CourseProgress.find({
      courseID: course._id,
    }).select("_id");
    const progressIds = progressRecords.map((record) => record._id);
    const streams = await Stream.find({ course: course._id }).select(
      "_id roomId status recordingSubSection",
    );
    const streamIds = streams.map((stream) => stream._id);
    const recordingSubsectionIds = streams
      .map((stream) => stream.recordingSubSection?.toString())
      .filter(Boolean);
    const allSubsectionIds = [
      ...new Set([...subsectionIds, ...recordingSubsectionIds]),
    ];
    // Hide the course and remove student library references before deleting content.
    course.status = "Draft";
    await course.save();
    await User.updateMany(
      {
        $or: [
          { courses: course._id },
          ...(progressIds.length
            ? [{ courseProgress: { $in: progressIds } }]
            : []),
        ],
      },
      {
        $pull: {
          courses: course._id,
          ...(progressIds.length
            ? { courseProgress: { $in: progressIds } }
            : {}),
        },
      },
    );
    if (course.tag) {
      await Tag.updateOne(
        { _id: course.tag },
        { $pull: { course: course._id } },
      );
    }

    if (streamIds.length) {
      try {
        const livekitHost = process.env.LIVEKIT_URL?.replace(
          /^wss:/,
          "https:",
        ).replace(/^ws:/, "http:");
        if (livekitHost) {
          const roomService = new RoomServiceClient(
            livekitHost,
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
          );
          await Promise.all(
            streams
              .filter((stream) => stream.status === "live")
              .map(async (stream) => {
                try {
                  await roomService.deleteRoom(stream.roomId);
                } catch (error) {
                  console.error(
                    `Could not close LiveKit room for deleted course ${course._id}:`,
                    error,
                  );
                }
              }),
          );
        }
      } catch (error) {
        console.error(
          `Could not initialize LiveKit cleanup for deleted course ${course._id}:`,
          error,
        );
      }
    }

    if (streamIds.length) {
      await Attendance.deleteMany({ stream: { $in: streamIds } });
      await Stream.deleteMany({ _id: { $in: streamIds } });
    }
    if (allSubsectionIds.length) {
      await SubSection.deleteMany({ _id: { $in: allSubsectionIds } });
    }
    if (sectionIds.length) {
      await Section.deleteMany({ _id: { $in: sectionIds } });
    }
    await Promise.all([
      CourseProgress.deleteMany({ courseID: course._id }),
      RatingAndReview.deleteMany({ course: course._id }),
    ]);

    await Course.deleteOne({ _id: course._id, instructor: req.userId });
    await deleteUploadedMaterials(
      sections.flatMap((section) => [
        section.materials?.notes,
        section.materials?.assignment,
      ]),
    );
    await deleteCache(`course:details:${course._id}`);

    if (course.thumbnail_public_id) {
      try {
        const cloudinary = require("cloudinary").v2;
        await cloudinary.uploader.destroy(course.thumbnail_public_id);
      } catch (error) {
        console.error("Could not remove deleted course thumbnail:", error);
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Course deleted. Enrolled students have lost access, and its lessons and course records were removed.",
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
      .select("-cancelledEnrollments")
      .populate("instructor")
      .populate("tag")
      .populate("ratingAndReview")
      .populate({
        path: "courseContent",
        select: "-materials",
        populate: {
          path: "subSection",
        },
      })
      .exec();

    if (!courseDetails) {
      return res.status(400).json({
        success: false,
        message: `Could not find course with id: ${courseId}`,
      });
    }
    if (courseDetails.status !== "Published") {
      return res.status(410).json({
        success: false,
        message: "This course is not currently available",
      });
    }
    if (
      !courseDetails.studentEnrolled.some(
        (studentId) => studentId.toString() === userId.toString(),
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this course",
      });
    }

    const courseProgressCount = await CourseProgress.findOne({
      userId: userId,
      courseID: courseId,
    });
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
      data: {
        courseDetails,
        totalDuration,
        completedVideos: courseProgressCount?.completedVideo,
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
