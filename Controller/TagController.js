const express = require("express");
const Tag = require("../modules/Tag");
const Course = require("../modules/Course");
const mongoose = require("mongoose");
const ratingAndReview = require("../modules/RatingAndReview");
const path = require("path");
const { getCache, setCache, deleteCache } = require("../utils/cache");

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
    const cachekey = `tag:all`;
    const cachedtag = await getCache(cachekey);

    if (cachedtag != null) {
      console.log("Cached-Hit-Tag");
      return res.status(200).json({
        success: true,
        message: "All Tags are fetched from cached",
        source: "Redis",
        data: cachedtag,
      });
    }
    console.log("Tags Cache MISS - MongoDB");

    const allTags = await Tag.find({}, { name: true, description: true });

    await setCache(cachekey, allTags, 600);
    return res.status(200).json({
      success: true,
      message: "All tags found",
      source: "MongoDB",
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
    const { tagId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(tagId)) {
      return res.status(400).json({
        success: false,
        message: "A valid category is required.",
      });
    }

    const cachekey = `tagPage:details:${tagId}`;
    const cachedtagPage = await getCache(cachekey);

    if (cachedtagPage != null) {
      console.log("Cached-Hit-TagPage");
      return res.status(200).json({
        success: true,
        source: "Redis",
        data: cachedtagPage,
      });
    }

    const selectedTagCourse = await Tag.findById(tagId)
      .populate({
        path: "course",
        select: "-cancelledEnrollments",
        match: { status: "Published" },
        populate: [{ path: "ratingAndReview" }, { path: "instructor" }],
      })
      .exec();

    if (!selectedTagCourse) {
      return res.status(400).json({
        success: false,
        message: "Catogary  not found",
      });
    }


    const relatedCategoryIds = await Course.distinct("tag", {
      status: "Published",
      tag: { $ne: tagId },
    });
    const randomCategoryId =
      relatedCategoryIds.length > 0
        ? relatedCategoryIds[
            Math.floor(Math.random() * relatedCategoryIds.length)
          ]
        : null;
    const differentCourses = randomCategoryId
      ? await Tag.findById(randomCategoryId)
          .populate({
            path: "course",
            select: "-cancelledEnrollments",
            match: { status: "Published" },
            populate: [{ path: "ratingAndReview" }, { path: "instructor" }],
          })
          .exec()
      : null;

      const alldetails = {
        selectedTagCourse,differentCourses
      }

      await setCache(cachekey,alldetails,600);

    return res.status(200).json({
      success: true,
      source:"MongoDB",
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


