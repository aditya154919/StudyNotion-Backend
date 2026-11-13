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
const helmet = require("helmet");
const {globalRateLimiter} = require("./middleware/rateLimiter")
app.use(helmet());


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://study-notion-frontend-zeta.vercel.app",
];

const corsOptions = {
    origin: function (origin, callback) {

        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));



app.use(
    fileupload({
        useTempFiles:true,
        tempFileDir:"/temp/",
        limits: {
            fileSize: 500 * 1024 * 1024,
        },
        abortOnLimit:true,
    })
)
app.use("/api/v1",userRoute);
app.use("/api/v1/tag/",tagRoute)
app.use("/api/v1/payment",Payment)
app.use("/api/v1/stream",Stream)
app.use("/",(req,res) =>{
    res.send("HEllo")
})


const startServer = async () => {
  try {
    await connect.connect();

    const PORT = process.env.PORT || 4000;

    app.listen(PORT, () => {
      console.log(`YOUR APP IS RUNNING AT PORT: ${PORT}`);
    });

  } catch (error) {
    console.error("SERVER STARTUP FAILED:", error.message);
    process.exit(1);
  }
};

startServer();
