const express = require("express");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("../modules/User");

exports.authMiddleware = async(req,res,next)=>{
    try {
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith("Bearer ")){
            return res.status(400).json({
                success:false,
                message:"Missing or invalid token"
            })
        }
        const token = authHeader.split(" ")[1];
        // console.log("toen",token)
        let decode;
        try {
            // console.log("aaaaa")
            decode = jwt.verify(token,process.env.SECRET_KEY);
            // console.log("frdt")
        } catch (error) {
            if(error.name === "TokenExpiredError"){
                return res.status(400).json({
                    success:false,
                    message:"Token expired"
                })
            }

            return res.status(400).json({
                success:false,
                message:"Authentication failed edit"
            })
        }
        const user = await User.findById(decode.id);
        if(!user){
            return res.status(404).json({
                success:false,
                message:"User not found"
            })
        }

        req.userId = user._id;
        req.user = user;

        next();

    } catch (error) {
        console.log("Error", error);
        return res.status(500).json({
            success:false,
            message:"Server error during Authentication"
        })
    }
}

exports.isStudents = async(req,res,next) =>{
    try {
        const {email} = req.user;
        const user = await User.findOne({email});

        if(user.accountType !== "Student"){
            res.status(400).json({
                success:false,
                message:"This is protected route for student only"
            })
        }
        next()
    } catch (error) {
        console.log("Error", error);
        return res.status(500).json({
            success:false,
            message:"Server error during Role Authentication "
        })
    }
}


exports.isInstructor = async(req,res,next) =>{
    try {
        const {email} = req.user;
        const user = await User.findOne({email});

        if(user.accountType !== "Instructor"){
            res.status(400).json({
                success:false,
                message:"This is protected route for Instructor only"
            })
        }
        next()
    } catch (error) {
        console.log("Error", error);
        return res.status(500).json({
            success:false,
            message:"Server error during Role Authentication "
        })
    }
}


exports.isAdmin = async(req,res,next) =>{
    try {
        const {email} = req.user;
        const user = await User.findOne({email});
         console.log(user)
        if(user.accountType !== "Admin"){
            res.status(400).json({
                success:false,
                message:"This is protected route for Admin only"
            })
        }
        next()
    } catch (error) {
        console.log("Error", error);
        return res.status(500).json({
            success:false,
            message:"Server error during Role Authentication "
        })
    }
}