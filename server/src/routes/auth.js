import jwt from "jsonwebtoken";
import express from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import User from "../models/user.js";
import StaffInvite from "../models/staffInvite.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/register", registerLimiter, async (req, res) => {
    try {
        const { name, email, password, role = "customer", inviteCode, businessName, phone } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required.",
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const selectedRole = ["manager", "staff", "customer"].includes(role) ? role : "customer";

        if (cleanName.length < 2 || cleanName.length > 80) {
            return res.status(400).json({
                success: false,
                message: "Name must be between 2 and 80 characters.",
            });
        }

        if (
            cleanEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address.",
            });
        }

        if (
            password.length < 8 ||
            password.length > 72 ||
            !/[a-z]/.test(password) ||
            !/[A-Z]/.test(password) ||
            !/[0-9]/.test(password) ||
            !/[^A-Za-z0-9\s]/.test(password) ||
            /\s/.test(password)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Password must contain uppercase, lowercase, a number, and a special character, with no spaces.",
            });
        }

        const existingUser = await User.findOne({ email: cleanEmail });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists.",
            });
        }

        let staffInvite = null;
        if (selectedRole === "staff") {
            if (!inviteCode || typeof inviteCode !== "string" || !inviteCode.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "A valid Unique Staff Invite Code is required to register as staff. Please contact your Service Provider Head.",
                });
            }

            staffInvite = await StaffInvite.findOne({
                code: inviteCode.trim().toUpperCase(),
                isUsed: false,
            });

            if (!staffInvite) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or already used Staff Invite Code. Please check with your Service Provider Head.",
                });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const userData = {
            name: cleanName,
            email: cleanEmail,
            password: hashedPassword,
            role: selectedRole,
            phone: typeof phone === "string" ? phone.trim() : "",
        };

        if (selectedRole === "manager") {
            userData.businessName = typeof businessName === "string" && businessName.trim()
                ? businessName.trim()
                : `${cleanName}'s Service Center`;
        }

        if (selectedRole === "staff" && staffInvite) {
            userData.managerId = staffInvite.managerId;
            userData.assignedService = staffInvite.serviceName;
            userData.counterNumber = staffInvite.counterNumber;
        }

        const user = await User.create(userData);

        if (staffInvite) {
            staffInvite.isUsed = true;
            staffInvite.usedBy = user._id;
            await staffInvite.save();
        }

        let roleMessage = "Account created successfully.";
        if (selectedRole === "manager") roleMessage = "Service Provider Head account created successfully.";
        if (selectedRole === "staff") roleMessage = `Staff account created and assigned to ${staffInvite.serviceName} (${staffInvite.counterNumber}).`;
        if (selectedRole === "customer") roleMessage = "Customer account created successfully.";

        return res.status(201).json({
            success: true,
            message: roleMessage,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                assignedService: user.assignedService,
                counterNumber: user.counterNumber,
                managerId: user.managerId,
                businessName: user.businessName,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists.",
            });
        }

        console.error("Registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to create account. Please try again.",
        });
    }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/login", loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required.",
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase(),
        }).select("+password");
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password.",
            });
        }

        const passwordMatches = await bcrypt.compare(password, user.password);

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password.",
            });
        }
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured on the server.",
            });
        }

        const token = jwt.sign(
            {
                userId: user._id.toString(),
                role: user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                assignedService: user.assignedService,
                counterNumber: user.counterNumber,
                managerId: user.managerId,
                businessName: user.businessName,
                phone: user.phone,
            },
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to log in. Please try again.",
        });
    }
});

router.get("/me", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select(
            "name email role assignedService counterNumber managerId businessName phone"
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User account not found.",
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                assignedService: user.assignedService,
                counterNumber: user.counterNumber,
                managerId: user.managerId,
                businessName: user.businessName,
                phone: user.phone,
            },
        });
    } catch (error) {
        console.error("Fetch current user failed:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch user details.",
        });
    }
});
router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    });

    return res.status(200).json({
        success: true,
        message: "Logged out successfully.",
    });
});
export default router;
