const mongoose  = require("mongoose");
const proboblemSchema = new mongoose.Schema({
  title:{
    type:String,
    required:true
  },
  difficulty:{
    type:String,
    enum:["Easy","Medium","Hard"],
    required:true
  },
  topic:{
    type:String,
    required:true
  },
  LeetcodeUrl:{
    type:String,
    required:true
  },
  students:[
    {
      type:mongoose.Schema.Types.ObjectId,
      ref:"User"
    }
  ]
    
  
});
module.exports = mongoose.model("Question",proboblemSchema);