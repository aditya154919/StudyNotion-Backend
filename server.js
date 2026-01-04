const express = require("express")
const app = express();
require("dotenv").config();
const connect = require("./config/database");
const cloudinary = require("./config/cloudinary")
const userRoute = require("./routes/userRoute");
const tagRoute = require("./routes/tagRoute")
const Payment = require("./routes/PaymentRoute")
const cors = require("cors")
const fileupload = require("express-fileupload")

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin:"http://localhost:5173",
    credentials:true
}))

app.use(
    fileupload({
        useTempFiles:true,
        tempFileDir:"/temp/"
    })
)
connect.connect();
// cloudinary.connect();
app.use("/api/v1",userRoute);
app.use("/api/v1/tag/",tagRoute)
app.use("/api/v1/payment",Payment)
app.use("/",(req,res) =>{
    res.send("HEllo")
})

app.listen(process.env.PORT,()=>{
    console.log(`YOUR APP IS RUNNING AT PORT:${process.env.PORT}`)
})