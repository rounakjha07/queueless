import express from "express";
import crypto from "crypto";
import User from "../models/user.js";
import StaffInvite from "../models/staffInvite.js";
import Queue from "../models/queue.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

function generateStaffCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "QL-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 1. Manager generates a unique Staff Invite Code
router.post("/invite", protect, async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Only Service Provider Heads can invite staff.",
      });
    }

    const { serviceName, counterNumber = "Counter 1", staffEmail, staffName } = req.body;

    if (!serviceName || typeof serviceName !== "string" || !serviceName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assigned service name is required.",
      });
    }

    const cleanEmail = staffEmail?.trim()?.toLowerCase() || "";

    // If an existing registered staff member has this email, immediately reassign their service
    if (cleanEmail) {
      const existingStaff = await User.findOne({
        email: cleanEmail,
        managerId: req.user.id,
        role: "staff",
      });

      if (existingStaff) {
        const oldService = existingStaff.assignedService;
        existingStaff.assignedService = serviceName.trim();
        if (counterNumber && typeof counterNumber === "string" && counterNumber.trim()) {
          existingStaff.counterNumber = counterNumber.trim();
        }
        if (staffName && typeof staffName === "string" && staffName.trim()) {
          existingStaff.name = staffName.trim();
        }
        await existingStaff.save();

        return res.status(200).json({
          success: true,
          reassigned: true,
          message: `Staff member "${existingStaff.name}" is already registered! Their service was successfully changed from "${oldService}" to "${existingStaff.assignedService}" (${existingStaff.counterNumber || "Counter 1"}).`,
          staff: existingStaff,
        });
      }
    }

    let code = generateStaffCode();
    let existing = await StaffInvite.findOne({ code });
    while (existing) {
      code = generateStaffCode();
      existing = await StaffInvite.findOne({ code });
    }

    const invite = await StaffInvite.create({
      code,
      managerId: req.user.id,
      serviceName: serviceName.trim(),
      counterNumber: (counterNumber || "Counter 1").trim(),
      staffEmail: staffEmail?.trim()?.toLowerCase() || "",
      staffName: staffName?.trim() || "",
      isUsed: false,
    });

    return res.status(201).json({
      success: true,
      message: `Invite code generated successfully! Give code "${code}" to your staff member to register.`,
      invite,
    });
  } catch (error) {
    console.error("Staff invite error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate staff invite code.",
    });
  }
});

// 2. Manager fetches all active staff & pending invites
router.get("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Only Service Provider Heads can view staff lists.",
      });
    }

    const staffList = await User.find({
      managerId: req.user.id,
      role: "staff",
    }).select("name email assignedService counterNumber createdAt");

    const pendingInvites = await StaffInvite.find({
      managerId: req.user.id,
      isUsed: false,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      staff: staffList,
      pendingInvites,
    });
  } catch (error) {
    console.error("Fetch staff error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load staff list.",
    });
  }
});

// 3. Manager revokes a pending invite
router.delete("/invite/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const invite = await StaffInvite.findOneAndDelete({
      _id: req.params.id,
      managerId: req.user.id,
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: "Invite not found.",
      });
    }

    return res.json({
      success: true,
      message: "Invite code revoked successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to revoke invite.",
    });
  }
});

// 4. Manager removes a staff member
router.delete("/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const staff = await User.findOneAndDelete({
      _id: req.params.id,
      managerId: req.user.id,
      role: "staff",
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found.",
      });
    }

    return res.json({
      success: true,
      message: "Staff member removed successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove staff member.",
    });
  }
});

// 4.5 Manager reassigns / shuffles staff member to another service & counter
router.patch("/:id/reassign", protect, async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Only Service Provider Heads can reassign staff.",
      });
    }

    const { serviceName, assignedService, counterNumber } = req.body;
    const targetService = (serviceName || assignedService)?.trim();

    if (!targetService) {
      return res.status(400).json({
        success: false,
        message: "Please specify a target department/service to reassign.",
      });
    }

    const staff = await User.findOne({
      _id: req.params.id,
      managerId: req.user.id,
      role: "staff",
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found or does not belong to your center.",
      });
    }

    const oldService = staff.assignedService;
    const oldCounter = staff.counterNumber || "Counter 1";

    staff.assignedService = targetService;
    if (counterNumber && typeof counterNumber === "string" && counterNumber.trim()) {
      staff.counterNumber = counterNumber.trim();
    }
    await staff.save();

    return res.json({
      success: true,
      message: `${staff.name} successfully shuffled from ${oldService} (${oldCounter}) to ${staff.assignedService} (${staff.counterNumber}).`,
      staff: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        assignedService: staff.assignedService,
        counterNumber: staff.counterNumber,
      },
    });
  } catch (error) {
    console.error("Staff reassign error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reassign staff member.",
    });
  }
});

// 5. Staff fetches their counter status & assigned service queue
router.get("/my-counter", protect, async (req, res) => {
  try {
    if (req.user.role !== "staff") {
      return res.status(403).json({
        success: false,
        message: "Only staff members can access this counter.",
      });
    }

    const staffUser = await User.findById(req.user.id);
    if (!staffUser || !staffUser.assignedService || !staffUser.managerId) {
      return res.status(400).json({
        success: false,
        message: "Your staff account is missing counter or service assignment.",
      });
    }

    const now = new Date();
    const istDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const startOfDay = new Date(`${istDate}T00:00:00+05:30`);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const queues = await Queue.find({
      createdBy: staffUser.managerId,
      serviceName: staffUser.assignedService,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    }).sort({ tokenNumber: 1 });

    const currentlyServing = queues.find(
      (q) => q.status === "serving" && q.servedBy?.toString() === staffUser._id.toString()
    ) || queues.find((q) => q.status === "serving");

    const waitingQueue = queues.filter((q) => q.status === "waiting");
    const completedToday = queues.filter(
      (q) => q.status === "completed" && q.servedBy?.toString() === staffUser._id.toString()
    ).length;

    return res.json({
      success: true,
      counter: {
        counterNumber: staffUser.counterNumber || "Counter 1",
        assignedService: staffUser.assignedService,
        staffName: staffUser.name,
      },
      currentlyServing: currentlyServing || null,
      waitingQueue,
      stats: {
        waitingCount: waitingQueue.length,
        servedTodayCount: completedToday,
      },
    });
  } catch (error) {
    console.error("Staff counter error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load counter status.",
    });
  }
});

export default router;
