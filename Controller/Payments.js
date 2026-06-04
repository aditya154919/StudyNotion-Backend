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

exports.capturePayment = async (req, res) => {
  try {
    // const { courses } = req.body;
    const courses = req.body.map((item) => item.courseId);

    console.log("hello", courses);
    const userId = req.userId;

    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Courses array is required",
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

      if (course.studentEnrolled.includes(uid)) {
        return res.status(400).json({
          success: false,
          message: "You are already enrolled ",
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

  let body = razorpay_order_id + "|" + razorpay_payment_id; // This exact format is required by Razorpay
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY) // HMAC = Hash-based Message Authentication Code. “Create a secure fingerprint of data using a secret key”
    .update(body.toString())
    .digest("hex");

  // 1. User pays
  // 2. Razorpay returns payment details
  // 3. Backend recreates signature
  // 4. Compare signatures
  // 5. If valid:
  //      → store in DB
  //      → enroll user
  //      → send email
  // 6. Else:
  //      → reject

  if (expectedSignature == razorpay_signature) {
    //enroll student
    enrollStudents(courses, userId, res);
    return res.status(200).json({
      success: true,
      message: "Payment verified",
    });
  }
  return res.status(200).json({
    success: false,
    message: "Payment failed",
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
      typeof item === "string" ? item : item.courseId,
    );

    for (const courseId of courseIds) {
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        throw new Error("Invalid course ID");
      }

      const enrolledCourse = await Course.findByIdAndUpdate(
        courseId,
        { $addToSet: { studentEnrolled: userId } },
        { new: true },
      );

      if (!enrolledCourse) {
        throw new Error("Course not found");
      }

      const courseProgress = await CourseProgress.create({
        courseID: courseId,
        userId,
        completedVideo: [],
      });

      const enrolledStudent = await User.findByIdAndUpdate(
        userId,
        { $push: { courses: courseId, courseProgress: courseProgress._id } },
        { new: true },
      );
      console.log("Enrolled student: ", enrolledStudent);
      await mailSender.sendEmail(
        enrolledStudent.email,
        "Successfully Enrolled",
        courseEnrollmentEmail(
          enrolledCourse.courseName,
          enrolledStudent.firstName,
        ),
      );
    }

    return true;
  } catch (error) {
    console.error("Enroll error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Enrollment failed",
    });
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

    await mailSender.sendEmail(
      enrolledStudent.email,
      `Payment Recived`,
      paymentSuccessEmail(
        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount / 100,
        orderId,
        paymentId,
      ),
    );

    await mailSender.sendEmail(
      instructor.email,
      "New Student Enrolled 🎉",
      instructorEnrollmentEmail(
        course.courseName,
        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount / 100,
      ),
    );
  } catch (error) {
    console.log("error in sending mail", error);
    return res
      .status(400)
      .json({ success: false, message: "Could not send email" });
  }
};
