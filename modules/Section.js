const mongoose = require("mongoose")

const sectionSchema = new mongoose.Schema({
   sectionName:{
    type:String,

   },
   subSection:[
    {
    type:mongoose.Schema.Types.ObjectId,
    default:null,
    ref:"SubSection"
    }
   ],
   materials:{
      notes:{
         url:String,
         name:String,
         publicId:String,
         resourceType:String
      },
      assignment:{
         url:String,
         name:String,
         publicId:String,
         resourceType:String
      }
   }
})

module.exports = mongoose.model("Section",sectionSchema)