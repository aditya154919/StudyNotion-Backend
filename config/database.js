const mongoose = require("mongoose")
require("dotenv").config()

exports.connect = () =>{
    mongoose.connect(process.env.DATABASE_URL)
    .then(()=>{
        console.log("DATABASE CONNECTED SUCCESS")
    })
    .catch(()=>{
        console.log("DATABASE NOT CONNECTED ")
    })
};