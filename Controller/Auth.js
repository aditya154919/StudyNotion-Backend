const express = require("express");
const User = require("../modules/User");
const bcrypt = require("bcrypt");
const mailSender = require("../utils/mailSender");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const { PassThrough } = require("stream");
const Session = require("../modules/Session");
const crypto = require("crypto");
const passwordResetOtpTemplate = require("../mail-template/OTPVERIFY");

exports.signUp = async (req, res) => {
  try {
    console.log("FORM",req.body)
    const {  accountType, email, firstName, lastName, password, confirmPassword } = req.body;
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
      image:`https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`
    });
    const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "7d",
    });

    const templatePath = path.join(
      __dirname,
      "../mail-template/verificationlink.hbs"
    );
    const source = fs.readFileSync(templatePath, "utf8");
    const template = handlebars.compile(source);

    const htmlToSend = template({ token });

    mailSender(email, "Verifify Your Account", htmlToSend);
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
    console.log("TOKEN",req.params.token)
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
    if(!user){
      return res.status(404).json({
        success:false,
        message:"User Not Found"
      })
    }

    user.token = null;
    user.isAccountVerified = true
    await user.save();

    return res.status(200).json({
      success:true,
      message:"Email verification success"
    })

  } catch (error) {
    console.log("Error",error);
    return res.status(500).json({
      success:false,
      message:"Server error during verification"
    })
  }
};

exports.login = async(req,res) =>{
  try {
    console.log("LOGIN FORM",req.body)
    const {email,password} = req.body;
    if(!email || !password){
      return res.status(400).json({
        success:false,
        message:"Please fill all details"
      })
    }

    const user = await User.findOne({email});
    if(!user){
      return res.status(401).json({
        success:false,
        message:"User does not exit"
      })
    }
    const pass = await bcrypt.compare(password,user.password);
    if(!pass){
      return res.status(400).json({
        success:false,
        message:"Invalid Password"
      })
    }
    if(user.isAccountVerified === false){
      return res.status(400).json({
        success:false,
        message:"First verify then Login"
      })
    }
   
    const existingSession = await Session.findOne({userId:user._id});
    if(existingSession){
      await Session.deleteMany({userId:user._id})
    }

    await Session.create({userId:user._id});

    const accesstoken = jwt.sign({id:user._id},process.env.SECRET_KEY,{expiresIn:"20m"});
    const refreshtoken = jwt.sign({id:user._id},process.env.SECRET_KEY,{expiresIn:"20d"});

    user.isLoggedin=true;
    user.token = refreshtoken;
    await user.save();

    return res.status(200).json({
      success:true,
      message:"Login Success",
      accesstoken,
      refreshtoken,
      user
    })

  } catch (error) {
    console.log("Error",error);
    return res.status(500).json({
      success:false,
      message:"Server error during login"
    })
  }
}

exports.logout = async(req,res) =>{
  try {
    const userId = req.userId;
    console.log(userId)
    await Session.deleteMany({userId});
    await User.findByIdAndUpdate(userId,{isLoggedin:false,token:null})
    
    return res.status(201).json({
      success:true,
      message:"Logout success"
    })
  } catch (error) {
    console.log("Error",error);
    return res.status(500).json({
      success:false,
      message:"Server error during logout"
    })
  }
}

exports.changePassword = async(req,res) =>{
  try {
    const {oldPassword,newPassword} = req.body;
    const userId = req.userId;
    if(!oldPassword || !newPassword || !userId){
      return res.status(400).json({
        success:false,
        message:"Please enter all field"
      })
    }

    const user = await User.findById(userId)
    if(!user){
      return res.status(400).json({
        success:false,
        message:"User not found"
      })
    }
    // Validate old password
    const isPasswordMatch = await bcrypt.compare(
      oldPassword,
      user.password
    )
    if (!isPasswordMatch) {
      // If old password does not match, return a 401 (Unauthorized) error
      return res
        .status(401)
        .json({ success: false, message: "The password is incorrect" })
    }
     const encryptNewPass = await bcrypt.hash(newPassword,10);
     //update
     user.password = encryptNewPass;
     await user.save();

     return res.status(200).json({
      success:true,
      message:"Password updated succesfully"
     })

  } catch (error) {
    console.log("Error",error);
    return res.status(500).json({
      success:false,
      message:"Server error during change password"
    })
  }
}

exports.forgotPassword = async(req,res) =>{
  try {
    const {email} = req.body;
    console.log("email",req.body)
    if(!email){
      return res.status(400).json({
        success:false,
        message:"Please enter email"
      })
    }

    const user = await User.findOne({email:email});
    if(!user){
      return res.status(400).json({
        success:false,
        message:"User not found"
      })
    }

    const otp = Math.floor(100000 + Math.random() * 900000)
    console.log("otp",otp)

    const updateresetPassOtp = await User.findOneAndUpdate({email:email},
      {
        resetPassOtp:otp,
        resetPasswordExpires:Date.now() + 3600000,
      },
      {new:true}
    )

   

    await mailSender(email,"Password Reset",
      passwordResetOtpTemplate(otp,user.firstName)
    )

    res.status(200).json({
			success: true,
			message:
				"Email Sent Successfully, Please Check Your Email to Continue Further",
		});

  } catch (error) {
    console.log("Error",error);
    return res.status(500).json({
      success:false,
      message:"Server error during sent forgotPassword link"
    })
  }
}

exports.verifyOtp = async(req,res)=>{
  try {
    const {otp,email} = req.body;
    if(!otp || !email){
      return res.status(404).json({
        success:false,
        message:"Please enter all data"
      })
    }

    const user = await User.findOne({email:email});
    if(!user){
      return res.status(401).json({
        success:false,
        message:"User not found"
      })
    }

    //compare otp
    if(Date.now() > user.resetPasswordExpires){
      return res.status(403).json({
        success:false,
        message:"Otp expires please retry"
      })
    }

    if(otp != user.resetPassOtp){
      return res.status(401).json({
        success:false,
        message:"Invalid Otp"
      })
    }
    else{
      user.resetPassOtp = null
      user.resetPasswordExpires = null
      await user.save()
    }

     return res.status(200).json({
      success:true,
      message:"OTP Verify success"
     })



  } catch (error) {
    
  }
}

exports.resetPassword = async(req,res) =>{
  try {
    const {password,confirmPassword,email} = req.body;
    
    if(!password || !confirmPassword || !email){
      return res.status(400).json({
        success:false,
        message:"Please fill detals"
      })
    }
    if(password !== confirmPassword){
      return res.status(401).json({
        success:false,
        message:"Password do not matched"
      })
    }

    

    const user = await User.findOne({email});
    if(!user){
      return res.status(400).json({
        success:false,
        message:"User not fjbound"
      })
    }
    
    
    const hashpass = await bcrypt.hash(confirmPassword,10);
    await User.findOneAndUpdate({email},
      {
        password:hashpass,
      },
      {
        new:true
      }
    )
    
    return res.status(200).json({
      success:true,
      message:"Password reset successfully"
    })

  } catch (error) {
    console.log("Error",error);
    return res.status(200).json({
      success:true,
      message:"Server error during Password reset "
    })
  }
}