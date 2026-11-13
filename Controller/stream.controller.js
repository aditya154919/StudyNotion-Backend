const Course = require("../modules/Course");
const mongoose = require("mongoose");
const fs = require("fs");
const Stream = require("../modules/stream");
const Section = require("../modules/Section.js");
const SubSection = require("../modules/SubSection");
const User = require("../modules/User");
const Crypto = require("crypto");
const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");
const mailSender = require("../utils/mailSender.js");
const {
  liveStreamStartedEmail,
} = require("../mail-template/LiveClassNotify.js");
const Attendance = require("../modules/Attendance.js");
const cloudinary = require("cloudinary").v2;
const mailQueue = require("../queues/emailQueue.js")

const isActiveStudent = (course, userId) => {
  if (!course?.studentEnrolled) return false;
  const id = userId.toString();
  const enrolled = course.studentEnrolled.some(
    (studentId) => studentId.toString() === id,
  );
  const cancelled = course.cancelledEnrollments?.some(
    (entry) => entry.student.toString() === id,
  );

  return enrolled && !cancelled;
};

const saveStreamRecording = async (stream, recordingFile) => {
  const fileName = String(recordingFile.name || "").toLowerCase();
  const mimeType = String(recordingFile.mimetype || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  let isWebmRecording = false;
  if (fileName.endsWith(".webm") && recordingFile.tempFilePath) {
    const handle = await fs.promises.open(recordingFile.tempFilePath, "r");
    try {
      const signature = Buffer.alloc(4);
      const { bytesRead } = await handle.read(
        signature,
        0,
        signature.length,
        0,
      );
      isWebmRecording =
        bytesRead === 4 &&
        signature[0] === 0x1a &&
        signature[1] === 0x45 &&
        signature[2] === 0xdf &&
        signature[3] === 0xa3;
    } finally {
      await handle.close();
    }
  }

  if (!mimeType.startsWith("video/") && !isWebmRecording) {
    const error = new Error("The recording must be a valid WebM video file");
    error.statusCode = 400;
    throw error;
  }
  if (recordingFile.size > 500 * 1024 * 1024) {
    const error = new Error("Recording must be smaller than 500 MB");
    error.statusCode = 413;
    throw error;
  }

  const uploaded = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_large(
      recordingFile.tempFilePath,
      {
        folder: process.env.FOLDER_NAME,
        resource_type: "video",
        chunk_size: 20 * 1024 * 1024,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      },
    );
    uploadStream.on("error", reject);
  });
  if (!uploaded?.secure_url || !uploaded.public_id) {
    throw new Error("Cloudinary did not return a usable recording URL");
  }

  let subsection;
  let sectionUpdated = false;
  try {
    subsection = await SubSection.create({
      title: `${stream.title} - Recording`,
      description: stream.description,
      vedioUrl: uploaded.secure_url,
      timeDuration: String(Math.round(uploaded.duration || 0)),
    });
    const section = await Section.findOneAndUpdate(
      { _id: stream.section, subSection: { $ne: subsection._id } },
      { $push: { subSection: subsection._id } },
      { new: true },
    );
    if (!section) throw new Error("The course section could not be updated");
    sectionUpdated = true;

    stream.recordingUrl = uploaded.secure_url;
    stream.recordingSubSection = subsection._id;
    await stream.save();
    return uploaded;
  } catch (error) {
    try {
      if (sectionUpdated && subsection) {
        await Section.updateOne(
          { _id: stream.section },
          { $pull: { subSection: subsection._id } },
        );
      }
      if (subsection) await SubSection.findByIdAndDelete(subsection._id);
      await cloudinary.uploader.destroy(uploaded.public_id, {
        resource_type: "video",
      });
    } catch (cleanupError) {
      console.error("Could not clean up an incomplete recording:", cleanupError);
    }
    throw error;
  }
};

exports.createStream = async (req, res) => {
  try {
    const {
      title,
      description,
      courseId,
      sectionId,
      notification,
      scheduledFor,
    } = req.body;
    const userId = req.userId;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      !courseId ||
      !sectionId ||
      !mongoose.Types.ObjectId.isValid(courseId) ||
      !mongoose.Types.ObjectId.isValid(sectionId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Title, description, course, and section are required",
      });
    }

    const courseDetails = await Course.findById(courseId).select(
      "instructor status courseContent",
    );
    if (!courseDetails) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    if (
      courseDetails.instructor.toString() !== userId.toString() ||
      courseDetails.status !== "Published"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only the instructor of an active course can create a room",
      });
    }

    if (
      !courseDetails.courseContent.some(
        (id) => id.toString() === sectionId.toString(),
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Section does not belong to this course",
      });
    }

    let startDate = null;
    if (scheduledFor) {
      startDate = new Date(scheduledFor);
      if (Number.isNaN(startDate.getTime()) || startDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "Scheduled start time must be a valid future date",
        });
      }
    }

    const roomId = Crypto.randomUUID();
    const stream = await Stream.create({
      title: title.trim(),
      description: description.trim(),
      course: courseId,
      section: sectionId,
      roomId,
      instructor: userId,
      status: "scheduled",
      scheduledFor: startDate,
      recordingEnabled: true,
      notifyStudents: notification === true || notification === "true",
    });

    return res.status(201).json({
      success: true,
      message: "Live class scheduled",
      data: stream,
    });
  } catch (error) {
    console.error("Could not create live class:", error);
    return res.status(500).json({
      success: false,
      message: "Could not create the live class",
    });
  }
};

exports.getStreamData = async (req, res) => {
  try {
    const { streamId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(streamId)) {
      return res.status(400).json({
        success: false,
        message: "Stream ID is required",
      });
    }

    const streamData = await Stream.findOne({ _id: streamId }).populate({
      path: "course",
      select: "courseName courseDescription thumbnail status courseContent",
      populate: { path: "courseContent", select: "-materials" },
    });
    if (!streamData) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }
    const isInstructor =
      streamData.instructor?.toString() === req.userId.toString();
    const courseAccess = await Course.findById(streamData.course?._id)
      .select("studentEnrolled cancelledEnrollments status")
      .lean();
    if (
      !courseAccess ||
      courseAccess.status !== "Published" ||
      (!isInstructor && !isActiveStudent(courseAccess, req.userId))
    ) {
      return res.status(403).json({
        success: false,
        message: "You no longer have access to this live class",
      });
    }

    const attendanceQuery = { stream: streamData._id };
    if (!isInstructor) attendanceQuery.user = req.userId;
    const attendance = await Attendance.find(attendanceQuery)
      .populate("user", "firstName lastName")
      .sort({ joinedAt: 1 })
      .lean();
    const presentCount = await Attendance.countDocuments({
      stream: streamData._id,
      status: "present",
    });
    const result = streamData.toObject();
    result.attendance = {
      presentCount,
      records: attendance,
    };

    return res.status(200).json({
      success: true,
      message: "Data found",
      data: result,
    });
  } catch (error) {
    console.error("Could not retrieve live class:", error);
    return res.status(500).json({
      success: false,
      message: "Could not retrieve the live class",
    });
  }
};

exports.getStreamStatus = async (req, res) => {
  try {
    const { streamId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(streamId)) {
      return res.status(400).json({
        success: false,
        message: "Stream ID is invalid",
      });
    }

    const stream = await Stream.findById(streamId)
      .select("status instructor course")
      .lean();
    if (!stream) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }
    const isInstructor =
      stream.instructor?.toString() === req.userId.toString();
    const course = await Course.findById(stream.course)
      .select("status studentEnrolled cancelledEnrollments")
      .lean();
    if (
      !course ||
      course.status !== "Published" ||
      (!isInstructor && !isActiveStudent(course, req.userId))
    ) {
      return res.status(403).json({
        success: false,
        message: "You no longer have access to this live class",
      });
    }

    const attendanceQuery = { stream: stream._id };
    if (!isInstructor) attendanceQuery.user = req.userId;
    const [records, presentCount] = await Promise.all([
      Attendance.find(attendanceQuery)
        .populate("user", "firstName lastName")
        .sort({ joinedAt: 1 })
        .lean(),
      Attendance.countDocuments({ stream: stream._id, status: "present" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        status: stream.status,
        attendance: { presentCount, records },
      },
    });
  } catch (error) {
    console.error("Could not retrieve live-class status:", error);
    return res.status(500).json({
      success: false,
      message: "Could not retrieve live-class status",
    });
  }
};

exports.generateToken = async (req, res) => {
  try {
    const { roomId } = req.body;
    if (typeof roomId !== "string" || !roomId) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required",
      });
    }
    const stream = await Stream.findOne({ roomId, status: "live" }).populate(
      "course",
    );
    if (!stream || stream.course?.status !== "Published") {
      return res.status(410).json({
        success: false,
        message: "This live class is no longer available",
      });
    }
    const isInstructor = stream.instructor.toString() === req.userId.toString();
    const course = await Course.findById(stream.course._id)
      .select("studentEnrolled cancelledEnrollments")
      .lean();
    const hasCourseAccess = isActiveStudent(course, req.userId);
    if (!isInstructor && !hasCourseAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this course",
      });
    }
    const user = await User.findById(req.userId).select("firstName lastName");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: req.userId.toString(),
        name: `${user.firstName} ${user.lastName}`,
      },
    );

    token.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
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
    const enrolledCourses = await Course.find({
        studentEnrolled: userId,
        status: "Published",
    }).select("_id cancelledEnrollments");

    const courseIds = enrolledCourses.map((course) => course._id);
    const cancelledCourseIds = enrolledCourses
        .filter((course) =>
          course.cancelledEnrollments.some(
            (entry) => entry.student.toString() === userId.toString(),
          ),
        )
        .map((course) => course._id);
    const rooms = await Stream.find({
        course: { $in: courseIds, $nin: cancelledCourseIds },
        status: "live",
    })
        .populate({
          path: "course",
          select: "courseName thumbnail",
        },
        )
        .populate("instructor", "firstName lastName");

    return res.status(200).json({
        success: true,
      message: "Live classes found",
      data: rooms,
    });
  } catch (error) {
    console.error("Could not retrieve live classes:", error);
    return res.status(500).json({
      success: false,
      message: "Could not retrieve live classes",
    });
  }
};

exports.startStream = async (req, res) => {
  try {
    const { streamId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(streamId)) {
      return res.status(400).json({
        success: false,
        message: "Stream ID is invalid",
      });
    }
    const stream = await Stream.findById(streamId);
    if (!stream || stream.instructor?.toString() !== req.userId.toString()) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }
    if (stream.status !== "scheduled") {
      return res.status(409).json({
        success: false,
        message: "Only a scheduled live class can be started",
      });
    }
    if (stream.scheduledFor && stream.scheduledFor > new Date()) {
      return res.status(409).json({
        success: false,
        message: "This class is scheduled for a later time",
      });
    }
    let course;
    let instructor;
    if (stream.notifyStudents) {
      [course, instructor] = await Promise.all([
        Course.findById(stream.course)
          .populate("studentEnrolled", "firstName lastName email")
          .select("courseName status studentEnrolled cancelledEnrollments"),
        User.findById(req.userId).select("firstName"),
      ]);
      if (!course || course.status !== "Published" || !instructor) {
        return res.status(409).json({
          success: false,
          message: "The course or instructor is no longer available",
        });
      }
    }

    const liveStream = await Stream.findOneAndUpdate(
      { _id: streamId, instructor: req.userId, status: "scheduled" },
      { $set: { status: "live", startedAt: new Date() } },
      { new: true },
    );
    if (!liveStream) {
      return res.status(409).json({
        success: false,
        message: "This live class has already been started or ended",
      });
    }

    let notificationFailures = 0;
    if (liveStream.notifyStudents) {
      const cancelledIds = new Set(
        (course?.cancelledEnrollments || []).map((entry) =>
          entry.student.toString(),
        ),
      );
      const recipients = (course?.studentEnrolled || []).filter(
        (student) =>
          !cancelledIds.has(student._id.toString()) &&
          student.email,
      );
      const baseUrl = (
        process.env.FRONTEND_URL || "http://localhost:5173"
      ).replace(/\/$/, "");
      const joinUrl = `${baseUrl}/live-room/${liveStream.roomId}/${liveStream._id}/${liveStream.section}`;
      const results = await Promise.allSettled(
        recipients.map((student) =>
          mailQueue.add("Live-class-queue",{
            to:student.email,
            subject:"Live class started",
            htmlContent:liveStreamStartedEmail(
              student.firstName,
              liveStream.title,
              course.courseName,
              instructor.firstName,
              joinUrl,
            ),
          }
            
          ),
        ),
      );
      notificationFailures = results.filter(
        (result) => result.status === "rejected",
      ).length;
      if (notificationFailures) {
        console.error(
          `${notificationFailures} live-class notification(s) failed for stream ${liveStream._id}`,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Live class started",
      data: liveStream,
      notificationFailures,
    });
  } catch (error) {
    console.error("Could not start live class:", error);
    return res.status(500).json({
      success: false,
      message: "Could not start the live class",
    });
  }
};

exports.joinAttendance = async (req, res) => {
  try {
    const { streamId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(streamId)) {
      return res.status(400).json({
        success: false,
        message: "Stream ID is required",
      });
    }
    const stream = await Stream.findById(streamId).populate("course");
    if (!stream || stream.status !== "live") {
      return res.status(410).json({
        success: false,
        message: "This live class is no longer available",
      });
    }
    if (
      stream.course.status !== "Published" ||
      !isActiveStudent(stream.course, req.userId)
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this live class",
      });
    }

    const joinedAt = new Date();
    let attendance = await Attendance.findOne({
      stream: stream._id,
      user: req.userId,
    });
    if (attendance?.status === "present") {
      return res.status(200).json({
        success: true,
        message: "Attendance is already recorded",
        data: attendance,
      });
    }

    if (attendance) {
      attendance = await Attendance.findOneAndUpdate(
        { _id: attendance._id, status: "left" },
        { $set: { lastJoinedAt: joinedAt, leftAt: null, status: "present" } },
        { new: true },
      );
      if (!attendance) {
        attendance = await Attendance.findOne({
          stream: stream._id,
          user: req.userId,
        });
      }
    } else {
      try {
        attendance = await Attendance.create({
          stream: stream._id,
          course: stream.course._id,
          user: req.userId,
          joinedAt,
          lastJoinedAt: joinedAt,
          durationSeconds: 0,
          status: "present",
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        attendance = await Attendance.findOne({
          stream: stream._id,
          user: req.userId,
        });
        if (attendance?.status !== "present") throw error;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Attendance recorded",
      data: attendance,
    });
  } catch (error) {
    console.error("Could not record attendance:", error);
    return res.status(500).json({
      success: false,
      message: "Could not record attendance",
    });
  }
};

exports.leaveAttendance = async (req, res) => {
  try {
    const { streamId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(streamId)) {
      return res.status(400).json({
        success: false,
        message: "Stream ID is required",
      });
    }
    const attendance = await Attendance.findOne({
      stream: streamId,
      user: req.userId,
      status: "present",
    });
    if (!attendance) {
      return res.status(200).json({
        success: true,
        message: "No active attendance session",
      });
    }

    const leftAt = new Date();
    attendance.durationSeconds += Math.max(
      0,
      Math.floor((leftAt - attendance.lastJoinedAt) / 1000),
    );
    attendance.leftAt = leftAt;
    attendance.status = "left";
    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Attendance session closed",
    });
  } catch (error) {
    console.error("Could not close attendance session:", error);
    return res.status(500).json({
      success: false,
      message: "Could not close attendance session",
    });
  }
};

exports.leaveStream = async (req, res) => {
  try {
    const { streamId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(streamId)) {
      return res.status(400).json({
        success: false,
        message: "Stream ID is invalid",
      });
    }

    const stream = await Stream.findById(streamId);
    if (!stream || stream.status !== "live") {
      return res.status(409).json({
        success: false,
        message: "This live class is no longer active",
      });
    }

    if (req.user.accountType === "Instructor") {
      if (stream.instructor?.toString() !== req.userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "You cannot leave another instructor's live class",
        });
      }

      const recordingFile = req.files?.recording;
      if (recordingFile) await saveStreamRecording(stream, recordingFile);

      return res.status(200).json({
        success: true,
        message: recordingFile
          ? "You left the class. The recording segment was saved; students can remain in the live room."
          : "You left the live room. The class remains open for students.",
      });
    }

    if (req.user.accountType !== "Student") {
      return res.status(403).json({
        success: false,
        message: "Only an instructor or enrolled student can leave this class",
      });
    }

    const attendance = await Attendance.findOne({
      stream: stream._id,
      user: req.userId,
      status: "present",
    });
    if (attendance) {
      const leftAt = new Date();
      attendance.durationSeconds += Math.max(
        0,
        Math.floor((leftAt - attendance.lastJoinedAt) / 1000),
      );
      attendance.leftAt = leftAt;
      attendance.status = "left";
      await attendance.save();
    }

    return res.status(200).json({
      success: true,
      message: "You left the live class",
    });
  } catch (error) {
    console.error("Could not leave live class:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Could not leave live class",
    });
  }
};

exports.endStream = async (req, res) => {
  let stream;
  try {
    const { streamId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(streamId)) {
      return res.status(400).json({
        success: false,
        message: "Stream ID is required",
      });
    }
    stream = await Stream.findById(streamId);
    if (!stream || stream.instructor?.toString() !== req.userId.toString()) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }
    if (stream.status !== "live") {
      return res.status(409).json({
        success: false,
        message: "This live class is not currently live",
      });
    }

    const recordingFile = req.files?.recording;
    if (recordingFile) await saveStreamRecording(stream, recordingFile);

    const endedAt = new Date();
    const activeAttendance = await Attendance.find({
      stream: stream._id,
      status: "present",
    });
    for (const record of activeAttendance) {
      record.durationSeconds += Math.max(
        0,
        Math.floor((endedAt - record.lastJoinedAt) / 1000),
      );
      record.leftAt = endedAt;
      record.status = "left";
      await record.save();
    }

    stream.status = "ended";
    stream.endedAt = endedAt;
    await stream.save();

    let participantsDisconnected = false;
    try {
      const livekitHost = process.env.LIVEKIT_URL
        ?.replace(/^wss:/, "https:")
        .replace(/^ws:/, "http:");
      if (!livekitHost) {
        throw new Error("LIVEKIT_URL is not configured");
      }
      const roomService = new RoomServiceClient(
        livekitHost,
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
      );
      await roomService.deleteRoom(stream.roomId);
      participantsDisconnected = true;
    } catch (disconnectError) {
      console.error(
        `Class ended but LiveKit participants could not be disconnected for stream ${stream._id}:`,
        disconnectError,
      );
    }

    return res.status(200).json({
      success: true,
      message: recordingFile
        ? "Live class ended and recording added to the course"
        : "Live class ended",
      data: stream,
      participantsDisconnected,
    });
  } catch (error) {
    console.error("Could not finalize live class:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Could not finalize the live class or save its recording",
    });
  }
};
