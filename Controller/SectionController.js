const path = require("path");
const Course = require("../modules/Course");
const Section = require("../modules/Section");
const SubSection = require("../modules/SubSection");
const { data } = require("react-router");

exports.createSection = async (req, res) => {
  try {
    //fetch data
    const { sectionName, courseId } = req.body;
    console.log("SECTION",req.body)
    if (!sectionName || !courseId) {
      return res.status(400).json({
        success: false,
        message: "All filed required",
      });
    }
    // create section
    const section = await Section.create({
      sectionName: sectionName,
    });

    // update course schema
   const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      {
        $push: {
          courseContent: section._id,
        },
      },
      { new: true }
    ).populate({
				path: "courseContent",
				populate: {
					path: "subSection",
				},
			})
			.exec();;

    return res.status(200).json({
      success: true,
      message: "Section created successfully",
      data:updatedCourse
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during creating section",
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
