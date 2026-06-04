const express = require("express");
const Tag = require("../modules/Tag");
const ratingAndReview = require("../modules/RatingAndReview");
const path = require("path");

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

exports.createTag = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(404).json({
        success: false,
        message: "Please fill all details",
      });
    }

    const tagDetails = await Tag.create({
      name: name,
      description: description,
    });

    console.log(tagDetails);

    return res.status(200).json({
      success: true,
      message: "Tag created successfully",
      tagDetails,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error durnig creatng tag",
    });
  }
};

exports.getAllTags = async (req, res) => {
  try {
    const allTags = await Tag.find({}, { name: true, description: true });
    // console.log("TAGS",allTags)
    return res.status(200).json({
      success: false,
      message: "All tags found",
      data: allTags,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error durnig geting all tag",
    });
  }
};

exports.tagPageDetals = async (req, res) => {
  try {
    // console.log("sd dsf",req.body)
    const { tagId } = req.body;

    const selectedTagCourse = await Tag.findById(tagId)
      .populate({
        path: "course",
        populate: [{ path: "ratingAndReview" }, { path: "instructor" }],
      })
      .exec();

    if (!selectedTagCourse) {
      return res.status(400).json({
        success: false,
        message: "Catogary  not found",
      });
    }

    if (selectedTagCourse.course.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found ",
      });
    }
    //different tag courses
    const differentTagCourses = await Tag.find({ _id: { $ne: tagId } });

    
    const randomTag =
      differentTagCourses[getRandomInt(differentTagCourses.length)];

    const differentCourses = await Tag.findById(randomTag._id)
      .populate({
        path: "course",
        populate: [{ path: "ratingAndReview" }, { path: "instructor" }],
      })
      .exec();

    return res.status(200).json({
      success: true,
      data: {
        selectedTagCourse,
        differentCourses,
      },
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error durnig geting tag based courses",
    });
  }
};

// exports.tagPageDetals = async (req, res) => {
//   try {
//     // ✅ GET query param
//     const { tagId } = req.body;

//     if (!tagId) {
//       return res.status(400).json({
//         success: false,
//         message: "Tag ID is missing",
//       });
//     }

//     // ✅ Selected tag courses
//     const selectedTagCourse = await Tag.findById(tagId)
//       .populate({
//         path: "course",
//         match: { status: "Published" },
//         populate: "ratingAndReview",
//       })
//       .exec();

//     if (!selectedTagCourse) {
//       return res.status(404).json({
//         success: false,
//         message: "Category not found",
//       });
//     }

//     if (!selectedTagCourse.course || selectedTagCourse.course.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No courses found for this category",
//       });
//     }

//     // ✅ Get other tags
//     const differentTagCourses = await Tag.find({ _id: { $ne: tagId } });

//     let differentCourses = null;

//     if (differentTagCourses.length > 0) {
//       const randomTag =
//         differentTagCourses[
//           Math.floor(Math.random() * differentTagCourses.length)
//         ];

//       differentCourses = await Tag.findById(randomTag._id)
//         .populate({
//           path: "course",
//           match: { status: "Published" },
//         })
//         .exec();
//     }

//     return res.status(200).json({
//       success: true,
//       data: {
//         selectedTagCourse,
//         differentCourses,
//       },
//     });
//   } catch (error) {
//     console.log("Error", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error during getting tag based courses",
//     });
//   }
// };
