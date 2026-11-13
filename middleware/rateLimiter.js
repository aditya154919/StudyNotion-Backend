const {rateLimit} = require("express-rate-limit");
const {RedisStore} = require("rate-limit-redis");

const redisConnection = require("../config/redis");


const globalRateLimiter = rateLimit({
    windowMs:15*60*1000,
    limit:10,
    standardHeaders:"draft-8",
    legacyHeaders:false,

    store:new RedisStore({
        sendCommand:(...arg)=>redisConnection.call(...arg)
    }),

    message:{
        success:false,
        message:"To many request, Please try after some time",
    }
});

const createStore = (prefix) => {
    return new RedisStore({
        sendCommand: (...args) => redisConnection.call(...args),
        prefix,
    });
};


const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    store: createStore("login:"),
    message: {
        success: false,
        message: "Too many login attempts. Please try again later.",
    },
});


const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: createStore("signup:"),
    message: {
        success: false,
        message: "Too many signup attempts. Please try again later.",
    },
});


const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: createStore("forgot-password:"),
    message: {
        success: false,
        message: "Too many password reset requests. Try again later.",
    },
});


const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: createStore("otp:"),
    message: {
        success: false,
        message: "Too many OTP attempts. Please try again later.",
    },
});

module.exports = {
    globalRateLimiter,
    loginLimiter,
    signupLimiter,
    forgotPasswordLimiter,
    otpLimiter,
};


