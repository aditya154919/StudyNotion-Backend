const Course = require("../modules/Course");
const RatingAndReview = require("../modules/RatingAndReview");
const mongoose = require("mongoose");

exports.createRatingAndReview = async (req, res) => {
  try {
    const userId = req.userId;
    const { courseId, rating, review } = req.body;
    // console.log("Rating", req.body);
    // console.log("user", req.userId);
    // console.log("Type of userId:", typeof req.userId);
    // const user = await User.findById(userId);
    const courseDetails = await Course.findOne({
      _id: courseId,
      studentEnrolled: { $in: [userId] },
    });

    if (!courseDetails) {
      return res.status(403).json({
        success: false,
        message: "User is not enrolled in this course",
      });
    }

    const alreadyReview = await RatingAndReview.findOne({
      user: userId,
      course: courseId,
    });
    if (alreadyReview) {
      return res.status(401).json({
        success: false,
        message: "Already Review",
      });
    }

    const ratingAndReview = await RatingAndReview.create({
      rating,
      review,
      course: courseId,
      user: userId,
    });

    const updatedCourseDetails = await Course.findByIdAndUpdate(
      courseId,
      {
        $push: {
          ratingAndReview: ratingAndReview._id,
        },
      },
      { new: true }
    );

    console.log("Updated course details", updatedCourseDetails);

    return res.status(200).json({
      success: true,
      message: "Rating and review are created successfully",
      ratingAndReview,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during creating Review",
    });
  }
};

exports.getAverageRating = async (req, res) => {
  try {
    //get course id
    const { courseId } = req.body;

    //db call and aggregate and avg rating
    const result = await RatingAndReview.aggregate([
      {
        $match: {
          course: new mongoose.Types.ObjectId(courseId),
        },
      },
      {
        $group: {
          _id: null,
          averageRating: {
            $avg: "rating",
          },
        },
      },
    ]);

    if (result.length > 0) {
      return res.status(200).json({
        success: true,
        averageRating: result[0].averageRating,
      });
    }
    //if no rating and review exist
    return res.status(200).json({
      success: true,
      message: "Average rating is 0 no rating ",
      averageRating: 0,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: true,
      message: "Server error during fnding Avg rating",
    });
  }
};

exports.getAllRating = async (req, res) => {
  try {
    const allReviews = await RatingAndReview.find({})
      .sort({ rating: "descending" })
      .populate({
        path: "user",
        select: "firstName lastName email image",
      })
      .populate({
        path: "course",
        select: "courseName",
      })
      .exec();

    return res.status(200).json({
      success: true,
      message: "All revies get success",
      data: allReviews,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error getting all rating ",
    });
  }
};
