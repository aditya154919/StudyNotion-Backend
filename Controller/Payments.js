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
const { instructorEnrollmentEmail } = require("../mail-template/instructorenrollmail");

//razorpay order
// exports.capturePayment = async (req, res) => {
//   console.log("req.body",req.body);
//   const { courses } = req.body;
//   const userId = req.userId;

//   let totalAmount = 0;
//   for (const course_id of courses) {
//     let course;
//     try {
//       course = await Course.findById(course_id);
//       if (!course) {
//         return res.status(400).json({
//           success: false,
//           message: "Please provide course id",
//         });
//       }

//       const uid = new mongoose.Types.ObjectId(userId);
//       if (course.studentEnrolled.includes(uid)) {
//         return res.status(200).json({
//           success: false,
//           message: "Student already enrolled",
//         });
//       }
//       totalAmount += course.price;
//     } catch (error) {
//       console.log("Error", error);
//       return res.status(500).json({
//         success: false,
//         message: "Server error",
//       });
//     }

//     const option = {
//       amount: totalAmount * 100,
//       currency: "INR",
//       receipt: Math.random(Date.now()).toString(),
//     };
//   }

//   try {
//     const paymentResponse = await instance.orders.create(option);
//     res.json({
//       success: true,
//       message: paymentResponse,
//     });
//   } catch (error) {
//     console.log("Error", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error during creating order",
//     });
//   }
// };

exports.capturePayment = async (req, res) => {
  try {
    // const { courses } = req.body;
    const courses = req.body.map((item) => item.courseId);

    console.log("hello", courses);
    const userId = req.userId;

    // ✅ validation
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

    // ✅ create order AFTER loop
    const options = {
      amount: totalAmount * 100, // paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const paymentResponse = await instance.orders.create(options);

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

  let body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
    .update(body.toString())
    .digest("hex");

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

// const enrollStudents = async (courses, userId, res) => {
//   if (!courses || !userId) {
//     return res.status(400).json({
//       success: false,
//       message: "Please provide required details",
//     });
//   }
//   for (const courseId of courses) {
//     //find the course and enrolled it
//     try {
//       const enrollcourse = await Course.findByIdAndUpdate(
//         courseId,
//         {
//           $push: {
//             studentEnrolled: userId,
//           },
//         },
//         { new: true }
//       );

//       if (!enrollcourse) {
//         return res.status(400).json({
//           success: false,
//           message: "Course not found",
//         });
//       }

//       //fond the student and add the course to their list
//       const enrolledStudent = await User.findByIdAndUpdate(
//         userId,
//         {
//           $push: {
//             courses: courseId,
//           },
//         },
//         { new: true }
//       );

//       const courseProgress = await courseProgress.create({
//         courseID:courseId,
//         userId:userId,
//         completedVideo:[]
//       })

//       //sent mail to student
//       const emailres = await mailSender(
//         enrollStudents.email,
//         `Successfully Enrolled into ${
//           (enrollcourse.courseName,
//           courseEnrollmentEmail(
//             enrollcourse.courseName,
//             `${enrolledStudent.firstName}`
//           ))
//         }`
//       );

//       console.log("Email sent successfully", emailres.response);
//     } catch (error) {
//       console.log("Error",error.message);
//       return res.status(500).json({
//         success:false,
//         message:"Server error during enrolled student"
//       })
//     }
//   }
// };

const enrollStudents = async (courses, userId, res) => {
  try {
    if (!Array.isArray(courses) || !userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid courses or userId",
      });
    }

    // ✅ normalize courseIds
    const courseIds = courses.map((item) =>
      typeof item === "string" ? item : item.courseId
    );

    for (const courseId of courseIds) {
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        throw new Error("Invalid course ID");
      }

      const enrolledCourse = await Course.findByIdAndUpdate(
        courseId,
        { $addToSet: { studentEnrolled: userId } },
        { new: true }
      );

      if (!enrolledCourse) {
        throw new Error("Course not found");
      }

      

   const courseProgress  = await CourseProgress.create({
        courseID: courseId,
        userId,
        completedVideo: [],
      });

      const enrolledStudent = await User.findByIdAndUpdate(
        userId,
        { $push: { courses: courseId,courseProgress:courseProgress._id } },
        { new: true }
      );
      console.log("Enrolled student: ", enrolledStudent)
      await mailSender(
        enrolledStudent.email,
        "Successfully Enrolled",
        courseEnrollmentEmail(
          enrolledCourse.courseName,
          enrolledStudent.firstName
        )
      );
    }

    // ✅ SEND RESPONSE ONCE
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

    await mailSender(
      enrolledStudent.email,
      `Payment Recived`,
      paymentSuccessEmail(
        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount / 100,
        orderId,
        paymentId
      )
    );

    await mailSender(
      instructor.email,
      "New Student Enrolled 🎉",
      instructorEnrollmentEmail(
        course.courseName,
        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount / 100
      )
    );
  } catch (error) {
    console.log("error in sending mail", error);
    return res
      .status(400)
      .json({ success: false, message: "Could not send email" });
  }
};
