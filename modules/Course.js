const mongoose = require("mongoose")

const courseSchema = new mongoose.Schema({
    courseName:{
        type:String,

    },
    courseDescription:{
        type:String,
    },
    instructor:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    whatYouWillLearn:{
        type:String,
    },
    courseContent:[
        {
        type:mongoose.Schema.Types.ObjectId,
        ref:"Section",
        default:null
        }
    ],
    ratingAndReview:[
        {
        type:mongoose.Schema.Types.ObjectId,
        ref:"RatingAndReview",
        }
    ],
    price:{
        type:Number,
    },
    thumbnail:{
        type:String,
    },
    thumbnail_public_id:{
        type:String
    },
    tag:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Tag",
    },
    studentEnrolled:[
        {
             type:mongoose.Schema.Types.ObjectId,
             ref:"User",
            
        }
    ],  
    
    
    status:{
        type:String,
        enum:["Draft","Published"]
    }
},{timestamps:true})

module.exports = mongoose.model("Course",courseSchema)