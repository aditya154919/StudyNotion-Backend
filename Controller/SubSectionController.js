
const Section = require("../modules/Section");
const SubSection = require("../modules/SubSection");
const { uploadImageToCloudinary } = require("../utils/imageUploder");

exports.createSubSection = async (req, res) => {
  try {
    const { title, description, sectionId } = req.body;
    const vedio = req.files.vedio;
    const notes = req.files.notes;
    console.log("Formdata", req.body);
    console.log("Vedio", vedio);
    console.log("Notes", notes);
    if (!title || !description || !sectionId || !vedio || !notes) {
      return res.status(400).json({
        success: false,
        message: "All filed required",
      });
    }

    const vedioUploader = await uploadImageToCloudinary(
      vedio.tempFilePath,
      process.env.FOLDER_NAME
    );
    const NotesUploder = await uploadImageToCloudinary(
      notes.tempFilePath,
      process.env.FOLDER_NAME
    )

    const subSection = await SubSection.create({
      title: title,
      timeDuration: `${vedioUploader.duration}`,
      description: description,
      vedioUrl: vedioUploader.secure_url,
      notes:NotesUploder.secure_url
    });

    //update section
    const updatedSection = await Section.findByIdAndUpdate(
      sectionId,
      {
        $push: {
          subSection: subSection._id,
        },
      },
      { new: true }
    ).populate("subSection");

    return res.status(200).json({
      success: true,
      message: "SubSection created successfully",
      data: updatedSection,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during creating subSection section",
    });
  }
};

//updateSubsection
exports.updateSubSection = async (req, res) => {
  try {
    const { sectionId,title, description, subSectionId } = req.body;
    // const vedio = req.file.vedio;
    const subSection = await SubSection.findById(subSectionId);
     if (!subSection) {
      return res.status(404).json({
        success: false,
        message: "SubSection not found",
      })
    }
   

    if(title != undefined){
        subSection.title = title
    }

    if(description != undefined){
        subSection.description = description
    }


     if(req.files && req.files.video !== undefined) {
      const video = req.files.video
      const uploadDetails = await uploadImageToCloudinary(
        video.tempFilePath,
        process.env.FOLDER_NAME
      )
      subSection.vedioUrl = uploadDetails.secure_url
      subSection.timeDuration = `${uploadDetails.duration}`
    }

    await subSection.save();

    const updatedSection = await Section.findById(sectionId).populate("subSection")

    return res.status(200).json({
      success: true,
      message: "Subsection updated successfully",
      data:updatedSection
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during updating subSection section",
    });
  }
};

//deletesubsection

exports.deleteSubSection = async (req, res) => {
  try {
    const { subSectionId, sectionId } = req.body;
    if (!subSectionId || !sectionId) {
      return res.status(400).json({
        success: false,
        message: "All field required",
      });
    }

    await Section.findByIdAndUpdate(sectionId, {
      $pull: {
        subSection: subSectionId,
      },
    });

    const subSection = await SubSection.findByIdAndDelete(subSectionId);

    if (!subSection) {
      return res
        .status(404)
        .json({ success: false, message: "SubSection not found" });
    }

    const section = await Section.findById(sectionId).populate("subSection");

    return res.status(200).json({
      success: true,
      message: "SubSection deleted successfully",
      data: section,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during deleting subSection section",
    });
  }
};

exports.addNotes = async(req,res)=>{
  try {
    const {} = req.body;

    const notes = req.files.notes;
   
     console.log("SectionId",sectionId);
     console.log("Notes",notes);
     if(!sectionId || !notes){
      return res.status(404).json({
        success:false,
        message:"All field required"
      })
     }

     const UpdatedSubSection = await SubSection.fin
  } catch (error) {
    
  }
}
