const express = require("express");
const User = require("../modules/User");
const bcrypt = require("bcrypt");
const mailSender = require("../utils/mailSender");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const Session = require("../modules/Session");
const passwordResetOtpTemplate = require("../mail-template/OTPVERIFY");
const { verify } = require("../mail-template/verificationlink");
const emailQueue = require("../queues/emailQueue");
const crypto = require("crypto");

exports.signUp = async (req, res) => {
  try {
    console.log("FORM", req.body);
    const {
      accountType,
      email,
      firstName,
      lastName,
      password,
      confirmPassword,
    } = req.body;
    if (
      !accountType ||
      !email ||
      !firstName ||
      !lastName ||
      !password ||
      !confirmPassword
    ) {
      return res.status(404).json({
        success: false,
        message: "Please fill All details",
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password do not Matched",
      });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User Already exist",
      });
    }
    const hashpass = await bcrypt.hash(confirmPassword, 10);

    const user = await User.create({
      email,
      password: hashpass,
      accountType: accountType,
      firstName,
      lastName,
      image: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`,
    });
    const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "7d",
    });

    await emailQueue.add("Account-verify-queue",{
      to:email,
      subject: "Verifify Your Account",
      htmlContent:verify(token)
    } );
    user.token = token;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User Created successfully",
      user: user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server error during signup",
    });
  }
};
exports.verify = async (req, res) => {
  try {
    console.log("TOKEN", req.params.token);
    const { token } = req.params;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Missing token",
      });
    }

    let decode;
    try {
      decode = jwt.verify(token, process.env.SECRET_KEY);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(400).json({
          success: false,
          message: "Token expired",
        });
      }

      return res.status(400).json({
        success: true,
        message: "Token verification failed",
      });
    }
    const user = await User.findById(decode.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User Not Found",
      });
    }

    user.token = null;
    user.isAccountVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verification success",
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during verification",
    });
  }
};

exports.login = async (req, res) => {
  try {
    console.log("LOGIN FORM", req.body);
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill all details",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User does not exit",
      });
    }
    const pass = await bcrypt.compare(password, user.password);
    if (!pass) {
      return res.status(400).json({
        success: false,
        message: "Invalid Password",
      });
    }
    if (user.isAccountVerified === false) {
      return res.status(400).json({
        success: false,
        message: "First verify then Login",
      });
    }

    const existingSession = await Session.findOne({ userId: user._id });
    if (existingSession) {
      await Session.deleteMany({ userId: user._id });
    }

    await Session.create({ userId: user._id });

    const accesstoken = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "20m",
    });
    const refreshtoken = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "20d",
    });

    user.isLoggedin = true;
    user.token = refreshtoken;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Login Success",
      accesstoken,
      refreshtoken,
      user,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const userId = req.userId;
    console.log(userId);
    await Session.deleteMany({ userId });
    await User.findByIdAndUpdate(userId, { isLoggedin: false, token: null });

    return res.status(201).json({
      success: true,
      message: "Logout success",
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during logout",
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.userId;
    if (!oldPassword || !newPassword || !userId) {
      return res.status(400).json({
        success: false,
        message: "Please enter all field",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }
    // Validate old password
    const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordMatch) {
      // If old password does not match, return a 401 (Unauthorized) error
      return res
        .status(401)
        .json({ success: false, message: "The password is incorrect" });
    }
    const encryptNewPass = await bcrypt.hash(newPassword, 10);
    //update
    user.password = encryptNewPass;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated succesfully",
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during change password",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("email", req.body);
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please enter email",
      });
    }

    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    console.log("otp", otp);

    const hashedOtp = await bcrypt.hash(otp, 10);

    await User.findOneAndUpdate(
      { email },
      {
        resetPassOtp: hashedOtp,
        resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        resetTokenHash: null,
        resetTokenExpires: null,
      },
      { new: true },
    );

    await emailQueue.add("reset-pass-queue", {
      to: email,
      subject: "Password Reset ",
      htmlContent: passwordResetOtpTemplate(otp, user.firstName),
    });

    res.status(200).json({
      success: true,
      message:
        "Email Sent Successfully, Please Check Your Email to Continue Further",
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({
      success: false,
      message: "Server error during sent forgotPassword link",
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { otp, email } = req.body;

    if (!otp || !email || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 6-digit OTP and email",
      });
    }


    const user = await User.findOneAndUpdate(
      {
        email: email.trim().toLowerCase(),
        resetPassOtp: { $ne: null },
        resetPasswordExpires: { $gt: new Date() },
        otpAttempts: { $lt: 5 },
      },
      {
        $inc: { otpAttempts: 1 },
      },
      {
        new: true,
      },
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid, expired or unavailable OTP",
      });
    }

    const isValid = await bcrypt.compare(String(otp), user.resetPassOtp);

    if (!isValid) {
      if (user.otpAttempts >= 5) {
        await User.updateOne(
          {
            _id: user._id,
            resetPassOtp: user.resetPassOtp,
          },
          {
            $set: {
              resetPassOtp: null,
              resetPasswordExpires: null,
            },
          },
        );

        return res.status(429).json({
          success: false,
          message: "Maximum OTP attempts reached. Request a new OTP.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        remainingAttempts: 5 - user.otpAttempts,
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        resetPassOtp: user.resetPassOtp,
        otpAttempts: user.otpAttempts,
      },
      {
        $set: {
          resetPassOtp: null,
          resetPasswordExpires: null,
          otpAttempts: 0,
          resetTokenHash: resetTokenHash,
          resetTokenExpires: new Date(Date.now() + 10 * 60 * 1000),
        },
      },
      {
        new: true,
      },
    );

    if (!updatedUser) {
      return res.status(409).json({
        success: false,
        message: "OTP verification could not be completed. Please retry.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("OTP verification error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
    });
  }
};


exports.resetPassword = async (req, res) => {
    try {
        const { resetToken, password, confirmPassword } = req.body;

        if (!resetToken || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Please fill all details"
            });
        }

        if (!/^[a-f0-9]{64}$/i.test(resetToken)) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters"
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }

        const resetTokenHash = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.findOneAndUpdate(
            {
                resetTokenHash: resetTokenHash,
                resetTokenExpires: { $gt: new Date() }
            },
            {
                $set: {
                    password: hashedPassword,
                    resetTokenHash: null,
                    resetTokenExpires: null,
                    resetPassOtp: null,
                    resetPasswordExpires: null,
                    otpAttempts: 0,
                    token: null,
                    isLoggedin: false
                }
            },
            {
                new: true
            }
        );

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token"
            });
        }

        await Session.deleteMany({
            userId: user._id
        });

        return res.status(200).json({
            success: true,
            message: "Password reset successfully. Please login again."
        });

    } catch (error) {
        console.error("Password reset error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error during password reset"
        });
    }
};

