const express = require("express")
const app = express();
require("dotenv").config();
const connect = require("./config/database");
const cloudinary = require("./config/cloudinary")
const userRoute = require("./routes/userRoute");
const tagRoute = require("./routes/tagRoute")
const Payment = require("./routes/PaymentRoute")
const Stream = require("./routes/streamRoute")
const cors = require("cors")
const fileupload = require("express-fileupload")

app.use(express.json());
app.use(express.urlencoded({ extended: true }));




const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://study-notion-frontend-zeta.vercel.app",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


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
app.use("/api/v1/stream",Stream)
app.use("/",(req,res) =>{
    res.send("HEllo")
})

app.listen(process.env.PORT,()=>{
    console.log(`YOUR APP IS RUNNING AT PORT:${process.env.PORT}`)
})
