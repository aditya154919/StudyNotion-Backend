const cloudinary = require("cloudinary").v2;
const fs = require("fs")

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});
exports.module = cloudinary
// exports.uploadFile = async(LocalFilePath,res)=>{
//     try {
//         if(!LocalFilePath){
//             return res.status(400).json({
//                 success:false,
//                 message:"LOcalfilepath is missing"
//             })
//         }
//         const response = await cloudinary.uploader.upload(LocalFilePath,{
//             resource_type:"auto"
//         });

//         fs.unlinkSync(LocalFilePath);
        
//         return res.status(200).json({
//             success:true,
//             message:"File uploaded successfully"
//         });
//     } catch (error) {
//         console.log("Error",error);
//         return res.status(500).json({
//             success:false,
//             message:"Server error during file upload"
//         })
//     }
// }

