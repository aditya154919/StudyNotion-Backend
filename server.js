
const express = require("express");
const app = express();

require("dotenv").config();

const connect = require("./config/database");
const redisConnection = require("./config/redis");
const emailWorker = require("./worker/emailWorker");

const cloudinary = require("./config/cloudinary");

const userRoute = require("./routes/userRoute");
const tagRoute = require("./routes/tagRoute");
const Payment = require("./routes/PaymentRoute");
const Stream = require("./routes/streamRoute");

const cors = require("cors");
const fileupload = require("express-fileupload");
const helmet = require("helmet");

const { globalRateLimiter } = require("./middleware/rateLimiter");

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
        if (!origin || allowedOrigins.includes(origin)) {
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
        useTempFiles: true,
        tempFileDir: "/temp/",
        limits: {
            fileSize: 500 * 1024 * 1024,
        },
        abortOnLimit: true,
    })
);

app.use("/api/v1", userRoute);
app.use("/api/v1/tag/", tagRoute);
app.use("/api/v1/payment", Payment);
app.use("/api/v1/stream", Stream);

app.use("/", (req, res) => {
    res.send("Hello");
});

let server;

const startServer = async () => {
    try {
        // Connect MongoDB
        await connect.connect();
        console.log("MongoDB connected successfully");

        // Wait for Redis
        await redisConnection.ping();
        console.log("Redis connection verified");

        // Wait for BullMQ worker to become ready
        await emailWorker.waitUntilReady();
        console.log("Email worker is ready");

        const PORT = process.env.PORT || 4000;

        server = app.listen(PORT, () => {
            console.log(`YOUR APP IS RUNNING AT PORT: ${PORT}`);
        });

    } catch (error) {
        console.error("SERVER STARTUP FAILED:", error.message);
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async () => {
    console.log("Shutting down server...");

    try {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }

        await emailWorker.close();
        await redisConnection.quit();

        console.log("Server shutdown completed");
        process.exit(0);

    } catch (error) {
        console.error("Shutdown error:", error.message);
        process.exit(1);
    }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

startServer();
