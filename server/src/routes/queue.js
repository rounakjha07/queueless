import express from "express";
import mongoose from "mongoose";
import Queue from "../models/queue.js";
import Service from "../models/service.js";
import User from "../models/user.js";
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

// 1. Get all queue entries (Role-aware: Manager, Staff, Customer)
router.get("/", protect, async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "manager") {
      query.createdBy = req.user.id;
    } else if (req.user.role === "staff") {
      const staffUser = await User.findById(req.user.id);
      if (!staffUser?.managerId || !staffUser?.assignedService) {
        return res.status(400).json({
          success: false,
          message: "Staff member has no assigned manager or service.",
        });
      }
      query.createdBy = staffUser.managerId;
      query.serviceName = staffUser.assignedService;
    } else if (req.user.role === "customer") {
      query.customerId = req.user.id;
    }

    const queues = await Queue.find(query).sort({ createdAt: -1 });

    return res.json({
      success: true,
      queues,
    });
  } catch (error) {
    console.error("Fetch queues error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch queue entries",
    });
  }
});

// 2. Get queue statistics for the logged-in manager
router.get("/stats", protect, async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    let managerId = req.user.id;
    let serviceFilter = null;

    if (req.user.role === "staff") {
      const staffUser = await User.findById(req.user.id);
      managerId = staffUser?.managerId;
      serviceFilter = staffUser?.assignedService;
    }

    const query = { createdBy: managerId };
    if (serviceFilter) query.serviceName = serviceFilter;

    const allQueues = await Queue.find(query);

    const todayQueues = allQueues.filter((item) => {
      const createdAt = new Date(item.createdAt);
      return createdAt >= startOfDay && createdAt < endOfDay;
    });

    const calculateStats = (queues) => {
      const waiting = queues.filter((item) => item.status === "waiting").length;
      const serving = queues.filter((item) => item.status === "serving").length;
      const completed = queues.filter((item) => item.status === "completed").length;
      const cancelled = queues.filter((item) => item.status === "cancelled").length;

      const activeQueues = queues.filter(
        (item) => item.status === "waiting" || item.status === "serving"
      );

      const averageWaitTime =
        activeQueues.length > 0
          ? Math.round(
              activeQueues.reduce(
                (sum, item) => sum + (item.estimatedWaitMinutes || 0),
                0
              ) / activeQueues.length
            )
          : 0;

      return {
        totalCustomers: queues.length,
        waiting,
        serving,
        completed,
        cancelled,
        averageWaitTime,
      };
    };

    return res.json({
      success: true,
      stats: calculateStats(todayQueues),
      allTimeStats: calculateStats(allQueues),
    });
  } catch (error) {
    console.error("Queue stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch queue statistics",
    });
  }
});

// 3. Public/Customer: Explore available services from service providers
router.get("/explore", async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    const services = await Service.find().populate(
      "createdBy",
      "name businessName email"
    );

    const serviceList = await Promise.all(
      services.map(async (srv) => {
        const waitingCount = await Queue.countDocuments({
          createdBy: srv.createdBy?._id,
          serviceName: srv.name,
          status: "waiting",
          createdAt: { $gte: startOfDay, $lt: endOfDay },
        });

        const servingNow = await Queue.findOne({
          createdBy: srv.createdBy?._id,
          serviceName: srv.name,
          status: "serving",
          createdAt: { $gte: startOfDay, $lt: endOfDay },
        }).select("tokenNumber customerName counterNumber");

        return {
          id: srv._id,
          name: srv.name,
          managerId: srv.createdBy?._id,
          providerName: srv.createdBy?.businessName || srv.createdBy?.name || "Service Center",
          waitingCount,
          estimatedWaitMinutes: waitingCount * 5,
          currentlyServingToken: servingNow ? servingNow.tokenNumber : null,
          currentlyServingCounter: servingNow ? servingNow.counterNumber : null,
        };
      })
    );

    return res.json({
      success: true,
      services: serviceList,
    });
  } catch (error) {
    console.error("Explore services error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load services.",
    });
  }
});

// 4. Customer: Book a digital token
router.post("/book", protect, async (req, res) => {
  try {
    const { serviceName, managerId } = req.body;

    if (!serviceName || !managerId) {
      return res.status(400).json({
        success: false,
        message: "Service name and provider ID are required.",
      });
    }

    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    // Check if customer already has a waiting or serving token for this service today
    const existingActive = await Queue.findOne({
      customerId: req.user.id,
      createdBy: managerId,
      serviceName,
      status: { $in: ["waiting", "serving"] },
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: `You already have an active token (${existingActive.serviceName.slice(0, 1).toUpperCase()}-${String(existingActive.tokenNumber).padStart(3, "0")}) for this service.`,
        token: existingActive,
      });
    }

    const customerUser = await User.findById(req.user.id);

    const latestQueue = await Queue.findOne({
      createdBy: managerId,
      serviceName,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    }).sort({ tokenNumber: -1 });

    const waitingAhead = await Queue.countDocuments({
      createdBy: managerId,
      serviceName,
      status: "waiting",
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    const tokenNumber = (latestQueue?.tokenNumber || 0) + 1;
    const estimatedWaitMinutes = waitingAhead * 5;

    const queue = await Queue.create({
      serviceName,
      tokenNumber,
      customerName: customerUser?.name || "Customer",
      customerId: customerUser?._id,
      customerPhone: customerUser?.phone || "",
      estimatedWaitMinutes,
      createdBy: new mongoose.Types.ObjectId(managerId),
      status: "waiting",
    });

    return res.status(201).json({
      success: true,
      message: `Token #${queue.serviceName.slice(0, 1).toUpperCase()}-${String(queue.tokenNumber).padStart(3, "0")} issued successfully!`,
      queue,
    });
  } catch (error) {
    console.error("Book token error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to book token.",
    });
  }
});

// 5. Customer: Get my active tokens & live ticket status
router.get("/my-tokens", protect, async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    const allMyTokens = await Queue.find({
      customerId: req.user.id,
    })
      .populate("createdBy", "businessName name")
      .sort({ createdAt: -1 });

    const activeTokens = await Promise.all(
      allMyTokens
        .filter(
          (t) =>
            (t.status === "waiting" || t.status === "serving") &&
            new Date(t.createdAt) >= startOfDay &&
            new Date(t.createdAt) < endOfDay
        )
        .map(async (t) => {
          const peopleAhead = await Queue.countDocuments({
            createdBy: t.createdBy?._id,
            serviceName: t.serviceName,
            status: "waiting",
            tokenNumber: { $lt: t.tokenNumber },
            createdAt: { $gte: startOfDay, $lt: endOfDay },
          });

          const currentServing = await Queue.findOne({
            createdBy: t.createdBy?._id,
            serviceName: t.serviceName,
            status: "serving",
            createdAt: { $gte: startOfDay, $lt: endOfDay },
          }).select("tokenNumber counterNumber");

          return {
            ...t.toObject(),
            peopleAhead,
            currentServingToken: currentServing?.tokenNumber || null,
            currentServingCounter: currentServing?.counterNumber || null,
            dynamicWaitMinutes: peopleAhead * 5,
          };
        })
    );

    const pastTokens = allMyTokens.filter(
      (t) => t.status === "completed" || t.status === "cancelled"
    );

    return res.json({
      success: true,
      activeTokens,
      pastTokens,
    });
  } catch (error) {
    console.error("My tokens error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tokens.",
    });
  }
});

// 6. Manager: Create a walk-in queue entry (Token Generation)
router.post("/", protect, async (req, res) => {
  try {
    const { serviceName, customerName, customerPhone } = req.body;
    const normalizedServiceName = typeof serviceName === "string" ? serviceName.trim() : "";
    const normalizedCustomerName = typeof customerName === "string" ? customerName.trim() : "";

    if (!normalizedServiceName || !normalizedCustomerName) {
      return res.status(400).json({
        success: false,
        message: "Service name and customer name are required",
      });
    }

    let managerId = req.user.id;
    if (req.user.role === "staff") {
      const staffUser = await User.findById(req.user.id);
      managerId = staffUser?.managerId;
    }

    const service = await Service.findOne({
      name: {
        $regex: `^${normalizedServiceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
      createdBy: managerId,
    });

    if (!service) {
      return res.status(400).json({
        success: false,
        message: "Please add this service before generating a token",
      });
    }

    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    const latestQueue = await Queue.findOne({
      createdBy: managerId,
      serviceName: normalizedServiceName,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    }).sort({ tokenNumber: -1 });

    const waitingAhead = await Queue.countDocuments({
      createdBy: managerId,
      serviceName: normalizedServiceName,
      status: "waiting",
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    const queue = await Queue.create({
      serviceName: normalizedServiceName,
      customerName: normalizedCustomerName,
      customerPhone: customerPhone?.trim() || "",
      tokenNumber: (latestQueue?.tokenNumber || 0) + 1,
      estimatedWaitMinutes: waitingAhead * 5,
      createdBy: new mongoose.Types.ObjectId(managerId),
    });

    return res.status(201).json({
      success: true,
      queue,
    });
  } catch (error) {
    console.error("Create queue error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create queue entry",
    });
  }
});

// 7. Staff or Manager: Call Next Customer
router.post("/call-next", protect, async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    let managerId = req.user.id;
    let serviceName = req.body.serviceName;
    let counterNumber = "Counter 1";

    if (req.user.role === "staff") {
      const staffUser = await User.findById(req.user.id);
      if (!staffUser || !staffUser.managerId || !staffUser.assignedService) {
        return res.status(400).json({
          success: false,
          message: "Staff member configuration missing.",
        });
      }
      managerId = staffUser.managerId;
      serviceName = staffUser.assignedService;
      counterNumber = staffUser.counterNumber || "Counter 1";
    }

    if (!serviceName) {
      return res.status(400).json({
        success: false,
        message: "Service name is required to call next customer.",
      });
    }

    // Auto-complete any existing token currently being served at this counter
    await Queue.updateMany(
      {
        createdBy: managerId,
        serviceName,
        status: "serving",
        servedBy: req.user.id,
      },
      {
        status: "completed",
        completedAt: new Date(),
      }
    );

    // Find earliest waiting token today
    const nextInLine = await Queue.findOne({
      createdBy: managerId,
      serviceName,
      status: "waiting",
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    }).sort({ tokenNumber: 1 });

    if (!nextInLine) {
      return res.status(404).json({
        success: false,
        message: "No customers currently waiting for this service.",
      });
    }

    nextInLine.status = "serving";
    nextInLine.servedBy = req.user.id;
    nextInLine.counterNumber = counterNumber;
    nextInLine.calledAt = new Date();
    await nextInLine.save();

    return res.json({
      success: true,
      message: `Now serving Token ${nextInLine.serviceName.slice(0, 1).toUpperCase()}-${String(nextInLine.tokenNumber).padStart(3, "0")} (${nextInLine.customerName}) at ${counterNumber}!`,
      queue: nextInLine,
    });
  } catch (error) {
    console.error("Call next error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to call next customer.",
    });
  }
});

// 8. Update queue entry status (serving, completed, cancelled, waiting)
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["waiting", "serving", "completed", "cancelled"];

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid queue ID",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid queue status",
      });
    }

    const queue = await Queue.findById(id);
    if (!queue) {
      return res.status(404).json({
        success: false,
        message: "Queue entry not found",
      });
    }

    // Authorization check
    if (req.user.role === "manager") {
      if (queue.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
    } else if (req.user.role === "staff") {
      const staffUser = await User.findById(req.user.id);
      if (
        queue.createdBy.toString() !== staffUser?.managerId?.toString() ||
        queue.serviceName !== staffUser?.assignedService
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only update customers in your assigned service.",
        });
      }
    }

    queue.status = status;
    if (status === "serving") {
      queue.servedBy = req.user.id;
      queue.calledAt = new Date();
      if (req.user.role === "staff") {
        const staff = await User.findById(req.user.id);
        queue.counterNumber = staff.counterNumber || "Counter 1";
      }
    } else if (status === "completed" || status === "cancelled") {
      queue.completedAt = new Date();
    }

    await queue.save();

    return res.json({
      success: true,
      message: "Queue status updated successfully",
      queue,
    });
  } catch (error) {
    console.error("Queue status update error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update queue status",
    });
  }
});

export default router;
