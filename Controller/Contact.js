const { contactUsEmail } = require("../mail-template/contactus");
const mailQueue = require("../queues/emailQueue");

exports.contactUs = async (req, res) => {
  try {
    const { email, firstName, lastName, message, phoneNo, countryCode } =
      req.body;
    console.log("Body", req.body);

    const emailRes = await mailQueue.add("contact-mail-queue",{
      to:email,
      subject:"You email is sent to StudyNotion team",
      htmlContent:contactUsEmail(email, firstName, lastName, message, phoneNo, countryCode),
    })

     await mailQueue.add("contact-mail-queue",{
      to:"aditya154919@gmail.com",
      subject:"Contact",
      htmlContent:contactUsEmail(email, firstName, lastName, message, phoneNo, countryCode),
    })
    console.log("Emailres", emailRes);
    return res.json({
      success: true,
      message: "Email send successfully",
    });
  } catch (error) {
    console.log("Error", error);
    console.log("Error message :", error.message);
    return res.json({
      success: false,
      message: "Something went wrong...",
    });
  }
};

