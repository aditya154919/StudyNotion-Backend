const mongoose = require("mongoose");


const userSchema = new mongoose.Schema({
    firstName:{
        type:String,
        required:true,
        trim:true,
    },
     lastName:{
        type:String,
        required:true,
        trim:true,
    },
     email:{
        type:String,
        required:true,
        trim:true,
    },
     password:{
        type:String,
        required:true,
       
    },
    accountType:{
        type:String,
        enum:["Admin","Student","Instructor"],
        required:true,
    },
    courses:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Course",
        
    }],
    image:{
        type:String,
        default:null
    },
    courseProgress:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"CourseProgress",
        
    }],
    token:{
        type:String,
        default:null
    },
    gender:{
        type:String,
        default:null
    },
    dateOfBirth:{
        type:String,
        default:null,
    },
    about:{
        type:String,
        default:null
    },
    contactNumber:{
        type:Number,
        default:null
    },
    isAccountVerified:{
        type:Boolean,
        default:false,
    },
    isLoggedin:{
        type:Boolean,
        default:false,
    },
    resetPasswordExpires:{
        type:String,
        default:null
    },
    resetPassOtp:{
        type:Number,
        default:null
    }

})

module.exports = mongoose.model("User",userSchema);