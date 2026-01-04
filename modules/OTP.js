const mongoose = require("mongoose");
const mailSender = require("../utils/mailSender");

const otpSchema = new mongoose.Schema({
    email:{
        type:String,
        required:true,
    },
    otp:{
        type:String,
        required:true,
    },
    createdAt:{
        type:Date,
        default:Data.now(),
        expires:5*60,
    }
});

//sent semail before user create

// async function sendVerificationOtp(email,otp){
//     try {
//         const mailResponse = await mailSender(email,"Verification Email from StudyNotion",otp);
//         console.log("Mail",mailResponse)
//     } catch (error) {
//         console.log("Error occur during sendin mail",error)
//     }
// }

// otpSchema.pre("save",asy)

module.exports = mongoose.exports("OTP",otpSchema);

