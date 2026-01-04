const CourseProgress = require("../modules/CourseProgress");
const SubSection = require("../modules/SubSection");


exports.updatedCourseProgress = async(req,res)=>{
    const {courseId,subSectionId} = req.body;
    console.log("hello",req.body)
    const userId = req.userId;
    try {
        //check valid subsection
        const subSection = await SubSection.findById(subSectionId);
        if(!subSection){
            return res.status(400).json({
                success:false,
                message:"Invalid SubSection"
            })
        }
        //check for old entry
        let courseProgress = await CourseProgress.findOne({
            courseID:courseId,
            userId:userId
        })
        if(!courseProgress){
            return res.status(404).json({
                success:false,
                message:"Course progress does not exist"
            })
        }
        else{
            //check for recompleting vedio or subsection
            if(courseProgress.completedVideo.includes(subSectionId)){
                return res.status(400).json({
                    success:false,
                    message:"SubSection Already completed"
                })
            }

            //push into completed vedio
            courseProgress.completedVideo.push(subSectionId);
        }

        await courseProgress.save();
        return res.status(200).json({
            success:true,
            message:"Course Process Updated successfully"
        })
    } catch (error) {
        console.log("Error",error);
        return res.status(500).json({
            success:false,
            message:"Server error"
        })
    }
}