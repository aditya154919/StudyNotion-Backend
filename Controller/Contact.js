const { contactUsEmail } = require("../mail-template/contactus");
const mailSender = require("../utils/mailSender");


exports.contactUs = async(req,res)=>{
    try {
        const{email,firstName,lastName,message,phoneNo,countryCode} = req.body;
        console.log("Body",req.body);
        
        const emailRes = await mailSender(
            email,
         "Your Data send successfully",
          contactUsEmail(email, firstName, lastName, message, phoneNo, countryCode)
        )
        console.log("Emailres",emailRes)
        return res.json({
      success: true,
      message: "Email send successfully",
    })
    } catch (error) {
        console.log("Error", error)
    console.log("Error message :", error.message)
    return res.json({
      success: false,
      message: "Something went wrong...",
    })
    }
}