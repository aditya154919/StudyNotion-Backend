const path = require("path");
const Course = require("../modules/Course");
const Section = require("../modules/Section");
const SubSection = require("../modules/SubSection");
const CourseProgress = require("../modules/CourseProgress");
const mongoose = require("mongoose");
const { uploadImageToCloudinary } = require("../utils/imageUploder");
const { deleteUploadedMaterials } = require("../utils/sectionMaterials");

const allowedMaterialTypes = new Map([
  [".pdf", ["application/pdf"]],
  [".doc", ["application/msword", "application/octet-stream"]],
  [
    ".docx",
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
    ],
  ],
  [
    ".ppt",
    ["application/vnd.ms-powerpoint", "application/octet-stream"],
  ],
  [
    ".pptx",
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/octet-stream",
    ],
  ],
]);

const validateMaterialFile = (file) => {
  const extension = path.extname(file.name || "").toLowerCase();
  const allowedMimeTypes = allowedMaterialTypes.get(extension);
  return (
    allowedMimeTypes &&
    allowedMimeTypes.includes(file.mimetype) &&
    file.size <= 25 * 1024 * 1024
  );
};

exports.createSection = async (req, res) => {
  try {
    const sectionName =
      typeof req.body.sectionName === "string"
        ? req.body.sectionName.trim()
        : "";
    const { courseId } = req.body;
    if (!sectionName || !courseId) {
      return res.status(400).json({
        success: false,
        message: "Section name and course are required",
      });
    }

    const course = await Course.findOne({
      _id: courseId,
      instructor: req.userId,
    }).select("_id");
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found or you do not own it",
      });
    }

    const section = await Section.create({
      sectionName,
    });

    let updatedCourse;
    try {
      updatedCourse = await Course.findOneAndUpdate(
        { _id: courseId, instructor: req.userId },
        { $push: { courseContent: section._id } },
        { new: true },
      )
        .populate({
          path: "courseContent",
          populate: { path: "subSection" },
        })
        .exec();
      if (!updatedCourse) {
        await Section.findByIdAndDelete(section._id);
        return res.status(404).json({
          success: false,
          message: "Course not found or you do not own it",
        });
      }
    } catch (error) {
      await Section.findByIdAndDelete(section._id);
      throw error;
    }

    const courseData = updatedCourse.toObject();
    courseData.createdSection = section;
    return res.status(200).json({
      success: true,
      message: "Section created successfully",
      data: courseData,
    });
  } catch (error) {
    console.error("Could not create course section:", error);
    return res.status(500).json({
      success: false,
      message: "Could not create course section",
    });
  }
};

//update section

exports.updateSection = async (req, res) => {
  try {
    const { sectionName, sectionId , courseId } = req.body;
    console.log("req.body",req.body)
    if (!sectionName || !sectionId || !courseId) {
      return res.status(400).json({
        success: false,
        message: "All filed required",
      });
    }

    await Section.findByIdAndUpdate(
      sectionId,
      { sectionName: sectionName },
      { new: true }
    );

    const course = await Course.findById(courseId).populate({
      path:"courseContent",
      populate:{
        path:"subSection"
      }
    }).exec()

    return res.status(200).json({
      success: true,
      message: "Section updated successfully",
      data:course

    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during updating section",
    });
  }
};

exports.updateSectionMaterials = async (req, res) => {
  const uploadedMaterials = [];
  try {
    const { courseId, sectionId } = req.body;
    const files = req.files || {};
    const notesFile = files.notes;
    const assignmentFile = files.assignment;

    if (!courseId || !sectionId || (!notesFile && !assignmentFile)) {
      return res.status(400).json({
        success: false,
        message: "Course, section, and at least one material file are required",
      });
    }
    if (
      !mongoose.Types.ObjectId.isValid(courseId) ||
      !mongoose.Types.ObjectId.isValid(sectionId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid course and section IDs are required",
      });
    }

    for (const file of [notesFile, assignmentFile].filter(Boolean)) {
      if (!validateMaterialFile(file)) {
        return res.status(400).json({
          success: false,
          message:
            "Materials must be PDF, DOC, DOCX, PPT, or PPTX files no larger than 25 MB",
        });
      }
    }

    const course = await Course.findOne({
      _id: courseId,
      instructor: req.userId,
    }).select("courseContent");
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found or you do not own it",
      });
    }

    if (!course.courseContent.some((id) => id.toString() === sectionId)) {
      return res.status(404).json({
        success: false,
        message: "Section does not belong to this course",
      });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }
    section.materials = section.materials || {};

    const previousMaterials = [];
    for (const [field, file] of [
      ["notes", notesFile],
      ["assignment", assignmentFile],
    ]) {
      if (!file) continue;

      const upload = await uploadImageToCloudinary(
        file.tempFilePath,
        process.env.FOLDER_NAME,
      );
      const nextMaterial = {
        url: upload.secure_url,
        name: file.name,
        publicId: upload.public_id,
        resourceType: upload.resource_type,
      };
      uploadedMaterials.push(nextMaterial);
      if (section.materials?.[field]?.publicId) {
        previousMaterials.push(section.materials[field]);
      }
      section.materials[field] = nextMaterial;
    }

    await section.save();
    await deleteUploadedMaterials(previousMaterials);

    return res.status(200).json({
      success: true,
      message: "Section materials saved successfully",
      data: {
        sectionId: section._id,
        materials: section.materials,
      },
    });
  } catch (error) {
    await deleteUploadedMaterials(uploadedMaterials);
    console.error("Could not save section materials:", error);
    return res.status(500).json({
      success: false,
      message: "Could not save section materials",
    });
  }
};

exports.getCompletedSectionMaterials = async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    const course = await Course.findOne({
      _id: courseId,
      status: "Published",
      studentEnrolled: req.userId,
    }).select("courseContent");
    if (!course) {
      return res.status(403).json({
        success: false,
        message: "Course access is unavailable",
      });
    }

    const [sections, progress] = await Promise.all([
      Section.find({ _id: { $in: course.courseContent } }).select(
        "sectionName subSection materials",
      ),
      CourseProgress.findOne({
        courseID: courseId,
        userId: req.userId,
      }).select("completedVideo"),
    ]);

    const completedVideoIds = new Set(
      (progress?.completedVideo || []).map((id) => id.toString()),
    );
    const materials = sections
      .filter(
        (section) =>
          section.subSection.length > 0 &&
          section.subSection.every((id) => completedVideoIds.has(id.toString())),
      )
      .filter(
        (section) => section.materials?.notes || section.materials?.assignment,
      )
      .map((section) => ({
        sectionId: section._id,
        sectionName: section.sectionName,
        notes: section.materials?.notes
          ? {
              url: section.materials.notes.url,
              name: section.materials.notes.name,
            }
          : null,
        assignment: section.materials?.assignment
          ? {
              url: section.materials.assignment.url,
              name: section.materials.assignment.name,
            }
          : null,
      }));

    return res.status(200).json({
      success: true,
      data: materials,
    });
  } catch (error) {
    console.error("Could not load completed section materials:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load section materials",
    });
  }
};

//delate Section

exports.deleteSection = async (req, res) => {
  try {
    const { sectionId, courseId } = req.body; //from parameter
    console.log("DELETE",req.body)
    if (!sectionId || !courseId) {
      return res.status(400).json({
        success: false,
        message: "All filed required",
      });
    }

    await Course.findByIdAndUpdate(courseId, {
      $pull: {
        courseContent: sectionId,
      },
    });

    const section = await Section.findById(sectionId);
    if(!section){
        return res.status(400).json({
            success:false,
            message:"No section found"
        })
    }
    //delete subSection all
    await SubSection.deleteMany({_id: {$in:section.subSection}})
    
    await Section.findByIdAndDelete(sectionId)
    await deleteUploadedMaterials([
      section.materials?.notes,
      section.materials?.assignment,
    ]);

    const course = await Course.findById(courseId).populate({
      path:"courseContent",
      populate:{
        path:"subSection"
      }
    }).exec()

    return res.status(200).json({
      success: true,
      message: "Section deleted successfully",
      data:course
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during delete section",
    });
  }
};
