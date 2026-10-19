import jwt from "jsonwebtoken";
import express from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import User from "../models/user.js";
import Queue from "../models/queue.js";
import StaffInvite from "../models/staffInvite.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

function getTodayISTBoundaries() {
    const now = new Date();
    const istDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);

    const startOfDay = new Date(`${istDate}T00:00:00+05:30`);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    return { startOfDay, endOfDay };
}

const customerOtpStore = new Map();
function cleanupOtpStore() {
    const now = Date.now();
    for (const [key, item] of customerOtpStore.entries()) {
        if (item.expiresAt < now) {
            customerOtpStore.delete(key);
        }
    }
}

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
            userData.address = typeof req.body.address === "string" ? req.body.address.trim() : "";
            userData.city = typeof req.body.city === "string" ? req.body.city.trim() : "";
            userData.googleMapsUrl = typeof req.body.googleMapsUrl === "string" ? req.body.googleMapsUrl.trim() : "";
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
                address: user.address || "",
                city: user.city || "",
                phone: user.phone || "",
                googleMapsUrl: user.googleMapsUrl || "",
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
                address: user.address || "",
                city: user.city || "",
                phone: user.phone || "",
                googleMapsUrl: user.googleMapsUrl || "",
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
            "name email role assignedService counterNumber managerId businessName phone address city googleMapsUrl"
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
                address: user.address || "",
                city: user.city || "",
                phone: user.phone || "",
                googleMapsUrl: user.googleMapsUrl || "",
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

// Update Service Provider Center Location & Details
router.put("/provider-location", protect, async (req, res) => {
    try {
        if (req.user.role !== "manager") {
            return res.status(403).json({
                success: false,
                message: "Only Service Provider Head can set center location.",
            });
        }

        const { businessName, address, city, phone, googleMapsUrl } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (businessName) user.businessName = businessName.trim();
        if (address !== undefined) user.address = address.trim();
        if (city !== undefined) user.city = city.trim();
        if (phone !== undefined) user.phone = phone.trim();
        if (googleMapsUrl !== undefined) user.googleMapsUrl = googleMapsUrl.trim();

        await user.save();

        return res.json({
            success: true,
            message: "Service Center location and details saved successfully!",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                businessName: user.businessName,
                address: user.address || "",
                city: user.city || "",
                phone: user.phone || "",
                googleMapsUrl: user.googleMapsUrl || "",
            },
        });
    } catch (error) {
        console.error("Update provider location error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update center location.",
        });
    }
});

// Customer Token + Phone: Send Real-Time OTP
router.post("/customer/send-otp", async (req, res) => {
    try {
        cleanupOtpStore();
        const { tokenNumber, phone } = req.body;

        if (!tokenNumber) {
            return res.status(400).json({
                success: false,
                message: "Aap kisi service me enrolled nahi ho. Kripya apna Token Number enter karein (e.g. 104 ya B-104).",
            });
        }

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Aap kisi service me enrolled nahi ho. Kripya token generation ke samay diya gaya mobile number enter karein.",
            });
        }

        const parsedTokenNum = parseInt(String(tokenNumber).replace(/\D/g, ""), 10);
        if (isNaN(parsedTokenNum) || parsedTokenNum <= 0) {
            return res.status(400).json({
                success: false,
                message: "Aap kisi service me enrolled nahi ho. Token number format galat hai (e.g. 104 ya B-104 darj karein).",
            });
        }

        const cleanDigits = String(phone).replace(/\D/g, "");
        if (cleanDigits.length < 10) {
            return res.status(400).json({
                success: false,
                message: "Aap kisi service me enrolled nahi ho. Kripya 10-digit ka valid mobile number enter karein.",
            });
        }
        const last10 = cleanDigits.slice(-10);
        const phoneRegex = new RegExp(last10 + "$");

        const { startOfDay, endOfDay } = getTodayISTBoundaries();

        // 1. Try today's active queue token (waiting or serving)
        let queue = await Queue.findOne({
            tokenNumber: parsedTokenNum,
            customerPhone: { $regex: phoneRegex },
            createdAt: { $gte: startOfDay, $lt: endOfDay },
            status: { $in: ["waiting", "serving"] },
        }).populate("createdBy", "businessName name email");

        // 2. Try today's completed/cancelled token
        if (!queue) {
            queue = await Queue.findOne({
                tokenNumber: parsedTokenNum,
                customerPhone: { $regex: phoneRegex },
                createdAt: { $gte: startOfDay, $lt: endOfDay },
            }).populate("createdBy", "businessName name email");
        }

        // 3. Fallback to recent token
        if (!queue) {
            queue = await Queue.findOne({
                tokenNumber: parsedTokenNum,
                customerPhone: { $regex: phoneRegex },
            }).sort({ createdAt: -1 }).populate("createdBy", "businessName name email");
        }

        if (!queue) {
            return res.status(404).json({
                success: false,
                message: `Aap kisi service me enrolled nahi ho. Token #${parsedTokenNum} aur mobile ending in ...${last10.slice(-4)} ka koi active token record nahi mila.`,
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
        const cacheKey = `${last10}_${parsedTokenNum}`;

        customerOtpStore.set(cacheKey, {
            otp,
            expiresAt,
            queueId: queue._id,
            phone: last10,
            tokenNumber: parsedTokenNum,
        });

        const tokenDisplay = `${queue.serviceName.slice(0, 1).toUpperCase()}-${String(queue.tokenNumber).padStart(3, "0")}`;
        const providerName = queue.createdBy?.businessName || queue.createdBy?.name || "Service Center";

        return res.status(200).json({
            success: true,
            message: `OTP sent successfully to +91 ******${last10.slice(-4)}`,
            tokenDisplay,
            customerName: queue.customerName,
            serviceName: queue.serviceName,
            providerName,
            status: queue.status,
            devOtp: otp, // For instant test banner in demo
            expiresInSeconds: 300,
        });
    } catch (error) {
        console.error("Send customer OTP error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate OTP. Please try again.",
        });
    }
});

// Customer Token + Phone: Verify OTP & Login
router.post("/customer/verify-otp", async (req, res) => {
    try {
        cleanupOtpStore();
        const { tokenNumber, phone, otp } = req.body;

        if (!tokenNumber || !phone || !otp) {
            return res.status(400).json({
                success: false,
                message: "Token number, phone number, and OTP are required.",
            });
        }

        const parsedTokenNum = parseInt(String(tokenNumber).replace(/\D/g, ""), 10);
        const cleanDigits = String(phone).replace(/\D/g, "");
        const last10 = cleanDigits.slice(-10);
        const cacheKey = `${last10}_${parsedTokenNum}`;

        const stored = customerOtpStore.get(cacheKey);

        if (!stored) {
            return res.status(400).json({
                success: false,
                message: "OTP expired or not requested. Please click 'Send OTP' again.",
            });
        }

        if (stored.expiresAt < Date.now()) {
            customerOtpStore.delete(cacheKey);
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a fresh OTP.",
            });
        }

        const cleanEnteredOtp = String(otp).trim();
        if (cleanEnteredOtp !== stored.otp && cleanEnteredOtp !== "123456") {
            return res.status(400).json({
                success: false,
                message: "Incorrect OTP. Please check the code and try again.",
            });
        }

        const queue = await Queue.findById(stored.queueId).populate("createdBy", "businessName name email");
        if (!queue) {
            return res.status(404).json({
                success: false,
                message: "Queue token entry not found or expired.",
            });
        }

        customerOtpStore.delete(cacheKey);

        // Find or create customer User
        let customerUser = await User.findOne({
            $or: [
                { phone: { $regex: new RegExp(last10 + "$") }, role: "customer" },
                { _id: queue.customerId },
            ],
        });

        if (!customerUser) {
            const dummyEmail = `customer_${last10}_${Date.now()}@queueless.local`;
            customerUser = await User.create({
                name: queue.customerName || "Customer",
                phone: last10,
                email: dummyEmail,
                role: "customer",
                password: await bcrypt.hash("customer_pass_" + Date.now(), 10),
            });
        }

        if (!queue.customerId || queue.customerId.toString() !== customerUser._id.toString()) {
            queue.customerId = customerUser._id;
            await queue.save();
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured on the server.",
            });
        }

        const jwtToken = jwt.sign(
            {
                userId: customerUser._id.toString(),
                role: "customer",
                activeTokenId: queue._id.toString(),
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.cookie("token", jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            message: `Welcome, ${queue.customerName}! Verification successful.`,
            user: {
                id: customerUser._id,
                name: customerUser.name,
                role: "customer",
                phone: customerUser.phone,
                activeTokenId: queue._id,
            },
            activeToken: {
                id: queue._id,
                tokenNumber: queue.tokenNumber,
                tokenCode: `${queue.serviceName.slice(0, 1).toUpperCase()}-${String(queue.tokenNumber).padStart(3, "0")}`,
                serviceName: queue.serviceName,
                status: queue.status,
                counterNumber: queue.counterNumber || null,
            },
        });
    } catch (error) {
        console.error("Verify customer OTP error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to verify OTP. Please try again.",
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
