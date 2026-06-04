const Course = require("../modules/Course");
const Stream = require("../modules/stream");
const Section = require("../modules/Section.js");
const SubSection = require("../modules/SubSection");
const User = require("../modules/User");
const Crypto = require("crypto");
const { AccessToken } = require("livekit-server-sdk");
const mailSender = require("../utils/mailSender.js");
const {
  liveStreamStartedEmail,
} = require("../mail-template/LiveClassNotify.js");
const Attendance = require("../modules/Attendance.js")
const {uploadImageToCloudinary} = require("../utils/imageUploder")

exports.createStream = async (req, res) => {
  try {
    const {
      title,
      description,
      courseId,
      sectionId,
      recording,
      notification,
      schedule,
    } = req.body;
    console.log("BoDY", req.body);
    const userId = req.userId;

    const user = await User.findById(userId);
    if (user.accountType != "Instructor") {
      return res.status(401).json({
        success: false,
        message: "Instructor not found",
      });
    }
    if (!title || !description || !courseId || !sectionId) {
      return res.status(400).json({
        success: false,
        message: "Fill all details",
      });
    }

    const courseDetails = await Course.findById(courseId);
    if (!courseDetails) {
      return res.status(404).json({
        success: false,
        message: "Course Not found",
      });
    }

    const sectionDetails = await Section.findById(sectionId);

    if (!courseDetails.courseContent.includes(sectionId)) {
      return res.status(400).json({
        success: false,
        message: "Section does not belong to this course",
      });
    }

    const roomId = Crypto.randomUUID();

    const status = schedule ? "scheduled" : "live";

    const stream = await Stream.create({
      title,
      description,
      course: courseId,
      section: sectionId,
      roomId,
      instructor: userId,
      status,
      startedAt: status === "live" ? new Date() : null,
      recordingEnabled: recording || false,
    });

    res.status(200).json({
      success: true,
      message: "Room created Success",
      data: stream,
    });
  } catch (error) {
    console.log("Server error", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getStreamData = async (req, res) => {
  try {
    const { streamId } = req.body;
    console.log("StremId", streamId);
    if (!streamId) {
      res.status(400).json({
        success: false,
        message: "StreamId not found",
      });
    }

    const streamData = await Stream.findOne({
      _id: streamId,
    }).populate({
      path: "course",
      populate: {
        path: "courseContent",
      },
    });

    // console.log("Streamdata", streamData);
    res.status(200).json({
      success: true,
      message: "Data found",
      data: streamData,
    });
  } catch (error) {
    console.log("Server error", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.generateToken = async (req, res) => {
  try {
    const { roomId, name } = req.body;

    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: name,
      },
    );

    token.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      recording: true,
    });

    const jwt = await token.toJwt();

    return res.status(200).json({
      success: true,
      token: jwt,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getEnrolledStudentRoom = async (req, res) => {
  try {
    const userId = req.userId;
    // console.log("userid", userId);
    const enrolledCourses = await Course.find({
      studentEnrolled: userId,
    });

    // console.log("Enrolled student", enrolledCourses);

    if (enrolledCourses.length == 0) {
      return res.status(404).json({
        success: false,
        message: "You are not enrolled in any course",
      });
    }

    const courseIds = enrolledCourses.map((course) => course._id);

    const rooms = await Stream.find({
      course: { $in: courseIds },
      status:"live",
    })
      .populate({
        path: "course",
        populate: {
          path: "courseContent",
        },
      })
      .populate({
        path: "instructor",
      });

    console.log("Rooms", rooms);

    if (!rooms) {
      return res.status(404).json({
        success: false,
        message: "No live classes available",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Live classes found",
      data: rooms,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getStudentNotify = async (req, res) => {
  try {
    const { roomId, courseId } = req.body;

    const userId = req.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const stream = await Stream.findOne({ roomId });

    if (stream.length == 0) {
      return res.status(400).json({
        success: false,
        message: "stream not found",
      });
    }

    console.log("Stream", stream);

    const enrolledStudent = await Course.findById(courseId)
      .populate({
        path: "studentEnrolled",
      })
      .exec();

    if (!enrolledStudent) {
      return res.status(400).json({
        success: false,
        message: "Student not enrolled in this course",
      });
    }

    const studentEmail = enrolledStudent.studentEnrolled.map((id) => id.email);

    console.log("Student", studentEmail);

    const joinUrl = `http://localhost:5173/api/v1/stream/live-room/${roomId}`;
    for (const student of enrolledStudent.studentEnrolled) {
      console.log("Sending to:", student.email);

      await mailSender.sendEmail(
        student.email,
        "🔴 Live Class Started",
        liveStreamStartedEmail(
          student.firstName,
          stream.title,
          enrolledStudent.courseName,
          user.firstName,
          joinUrl,
        ),
      );
    }

    return res.status(200).json({
      success: true,
      message: "send Notification success",
    });
  } catch (error) {
    console.log("server error..", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.endStream = async (req, res) => {
  try {
    const { roomId } = req.body;
    console.log("roomId", roomId);
    const stream = await Stream.findOneAndUpdate(
      { roomId: roomId },
      {
        status: "ended",
        endedAt: Date.now(),
      },
      { new: true },
    );

    return res.status(200).json({
      success: true,
      messsage: "Stream ended success",
    });
  } catch (error) {
    console.log("Server errror", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// exports.attendance = async(req,res)=>{
//   try {
//     const {streamId,studentId} = req.body;
//     if(!streamId || !studentId){
//       return res.status(400).json({
//         success:false,
//         message:"fill al field"
//       })
//     }

//     const user  = await User.findById(studentId);
//     if(!user){
//       return res.status(404).json({
//         success:false,
//         message:"Student not found"
//       })
//     }

//     const stream =  await Stream.findById(streamId);
//     if(!stream){
//       return res.status(404).json({
//         success:false,
//         message:"Stream not found"
//       })
//     }

//     const attendance = await Attendance.create({
//       streamId:streamId,
//       user:studentId
//     })
//   } catch (error) {
    
//   }
// }

exports.Uploadrecording = async(req,res)=>{
  try {
    const {title,description,sectionId} = req.body;
    console.log("data",req.body)
    const video  = req.files.file;
     
    console.log("File",req.files)
    if(!title || !description || !sectionId ){
      return res.status(400).json({
        success:false,
        message:"All field requires"
      })
    }
    const section = await Section.findById(sectionId);
    if(!sectionId){
      return res.status(404).json({
        success:false,
        message:"Section not found"
      })
    }
    const vedio = await uploadImageToCloudinary(
      video.tempFilePath,
      process.env.FOLDER_NAME

    )

    const subSection = await SubSection.create({
      title:title,
      description:description,
      vedioUrl:vedio.secure_url,
      timeDuration:`${vedio.duration}`
    })

    const updatedSection = await Section.findByIdAndUpdate(
      sectionId,
      {
        $push:{
          subSection:subSection._id
        }
      },
      {
        new:true
      }
    ).populate("subSection");

    return res.status(200).json({
      success:true,
      message:"Video added success"
    })
  } catch (error) {
    console.log("server error...",error.message);
    return res.status(500).json({
      success:false,
      message:"server error"
    })
  }
}
