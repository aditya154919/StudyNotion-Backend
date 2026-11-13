const mongoose = require("mongoose");
const { instance } = require("../config/razorpay");
const Course = require("../modules/Course");
const crypto = require("crypto");
const User = require("../modules/User");
const mailSender = require("../utils/mailSender");
const CourseProgress = require("../modules/CourseProgress");
const {
  courseEnrollmentEmail,
} = require("../mail-template/courseEnrollementEmial");
const { paymentSuccessEmail } = require("../mail-template/paymentSuccess");
const {
  instructorEnrollmentEmail,
} = require("../mail-template/instructorenrollmail");

const mailQueue = require("../queues/emailQueue");

exports.capturePayment = async (req, res) => {
  try {
    const requestedCourses = Array.isArray(req.body)
      ? req.body
      : req.body?.courses;
    if (!Array.isArray(requestedCourses) || requestedCourses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Courses array is required",
      });
    }

    const courses = requestedCourses.map((item) =>
      typeof item === "string" ? item : item?.courseId || item?._id,
    );
    const userId = req.userId;

    if (
      courses.some((courseId) => !mongoose.Types.ObjectId.isValid(courseId))
    ) {
      return res.status(400).json({
        success: false,
        message: "One or more course IDs are invalid",
      });
    }

    let totalAmount = 0;
    const uid = new mongoose.Types.ObjectId(userId);

    for (const courseId of courses) {
      const course = await Course.findById(courseId);

      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      if (course.status !== "Published") {
        return res.status(409).json({
          success: false,
          message: "This course is not available for purchase",
        });
      }

      if (course.studentEnrolled.includes(uid)) {
        return res.status(400).json({
          success: false,
          message: "You are already enrolled ",
        });
      }
      if (
        course.cancelledEnrollments.some(
          (enrollment) =>
            enrollment.student.toString() === uid.toString() &&
            !enrollment.reinstatedAt,
        )
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Your access to this course was revoked. Contact eTech support if you believe this was a mistake.",
        });
      }

      totalAmount += course.price;
    }

    const options = {
      amount: totalAmount * 100, // paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const paymentResponse = await instance.orders.create(options); //return an object
    //This order is used by frontend to complete payment
    // Node.js sends request to Razorpay server
    // Razorpay creates an order
    // Razorpay returns response
    // You store it in paymentResponse

    return res.status(200).json({
      success: true,
      data: paymentResponse,
    });
  } catch (error) {
    console.error("capturePayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while capturing payment",
    });
  }
};

//verify payment

exports.verifyPayment = async (req, res) => {
  const razorpay_order_id = req.body.razorpay_order_id;
  const razorpay_payment_id = req.body.razorpay_payment_id;
  const razorpay_signature = req.body.razorpay_signature;
  const courses = req.body.courses;
  const userId = req.userId;

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !courses ||
    !userId
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields required",
    });
  }

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
    .update(body.toString())
    .digest("hex");

  const receivedSignature = Buffer.from(razorpay_signature, "hex");
  const calculatedSignature = Buffer.from(expectedSignature, "hex");
  if (
    receivedSignature.length !== calculatedSignature.length ||
    !crypto.timingSafeEqual(receivedSignature, calculatedSignature)
  ) {
    return res.status(400).json({
      success: false,
      message: "Payment signature verification failed",
    });
  }

  const enrolled = await enrollStudents(courses, userId, res);
  if (!enrolled) return;

  return res.status(200).json({
    success: true,
    message: "Payment verified and course access is ready",
  });
};

const enrollStudents = async (courses, userId, res) => {
  try {
    if (!Array.isArray(courses) || !userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid courses or userId",
      });
    }

    const courseIds = courses.map((item) =>
      typeof item === "string" ? item : item?.courseId || item?._id,
    );
    if (
      courseIds.length === 0 ||
      courseIds.some((courseId) => !mongoose.Types.ObjectId.isValid(courseId))
    ) {
      throw new Error("One or more course IDs are invalid");
    }

    const enrolledCourses = [];
    const enrolledStudent = await User.findById(userId);
    if (!enrolledStudent) {
      throw new Error("Student account could not be found");
    }

    for (const courseId of courseIds) {
      let enrolledCourse = await Course.findById(courseId);
      if (!enrolledCourse || enrolledCourse.status !== "Published") {
        throw new Error("Course is no longer available for enrollment");
      }

      const alreadyEnrolled = enrolledCourse.studentEnrolled.some(
        (studentId) => studentId.toString() === userId.toString(),
      );
      const enrollmentCancelled = enrolledCourse.cancelledEnrollments.some(
        (enrollment) =>
          enrollment.student.toString() === userId.toString() &&
          !enrollment.reinstatedAt,
      );
      if (enrollmentCancelled) {
        throw new Error("Your access to this course has been cancelled");
      }

      if (!alreadyEnrolled) {
        enrolledCourse = await Course.findOneAndUpdate(
          {
            _id: courseId,
            status: "Published",
            studentEnrolled: { $ne: userId },
            cancelledEnrollments: {
              $not: {
                $elemMatch: { student: userId, reinstatedAt: null },
              },
            },
          },
          { $addToSet: { studentEnrolled: userId } },
          { new: true },
        );
        if (!enrolledCourse) {
          enrolledCourse = await Course.findById(courseId);
          const concurrentEnrollment = enrolledCourse?.studentEnrolled.some(
            (studentId) => studentId.toString() === userId.toString(),
          );
          if (!concurrentEnrollment) {
            throw new Error("Course is no longer available for enrollment");
          }
        }
      }

      let courseProgress = await CourseProgress.findOne({
        courseID: courseId,
        userId,
      });
      if (!courseProgress) {
        courseProgress = await CourseProgress.create({
          courseID: courseId,
          userId,
          completedVideo: [],
        });
      }

      await User.findByIdAndUpdate(userId, {
        $addToSet: {
          courses: courseId,
          courseProgress: courseProgress._id,
        },
      });
      enrolledCourses.push(enrolledCourse);
    }

    for (const course of enrolledCourses) {
      try {
        await mailQueue.add("Enrollment-course-queue", {
          to: enrolledStudent.email,
          subject: "Course Enrollment Success",
          htmlContent: courseEnrollmentEmail(
            course.courseName,
            enrolledStudent.firstName,
          ),
        });
      } catch (emailError) {
        console.error(
          `Enrollment email failed for course ${course._id}:`,
          emailError,
        );
      }
    }

    return true;
  } catch (error) {
    console.error("Enroll error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Enrollment failed",
    });
    return false;
  }
};

exports.sendMailSuccsee = async (req, res) => {
  const { orderId, paymentId, amount } = req.body;
  const userId = req.userId;
  if (!orderId || !paymentId || !amount || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide all the details" });
  }
  try {
    const enrolledStudent = await User.findById(userId).populate({
      path: "courses",
      populate: {
        path: "instructor",
      },
    });

    const course = enrolledStudent.courses[0];
    const instructor = course.instructor;

    await mailQueue.add("payment-received-queue", {
      to: enrolledStudent.email,
      subject: "Payment Recived",
      htmlContent: paymentSuccessEmail(
        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount / 100,
        orderId,
        paymentId,
      ),
    });

    await mailQueue.add("payment-received-queue", {
      to: instructor.email,
      subject: "New Student Enrolled 🎉",
      htmlContent: instructorEnrollmentEmail(
        course.courseName,
        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount / 100,
      ),
    });
  } catch (error) {
    console.log("error in sending mail", error);
    return res
      .status(400)
      .json({ success: false, message: "Could not send email" });
  }
};
