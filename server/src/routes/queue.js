import express from "express";
import mongoose from "mongoose";
import Queue from "../models/queue.js";
import Service from "../models/service.js";
import User from "../models/user.js";
import { protect } from "../middleware/authMiddleware.js";
import jwt from "jsonwebtoken";

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

// 1. Get all queue entries (Role-aware: Manager, Staff, Customer) with real-time wait telemetry
router.get("/", protect, async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayISTBoundaries();
    let query = {};

    if (req.user.role === "manager") {
      query.createdBy = req.user.id;
    } else if (req.user.role === "staff") {
      const staffUser = await User.findById(req.user.id);
      if (!staffUser?.managerId) {
        return res.status(400).json({
          success: false,
          message: "Staff member has no assigned manager.",
        });
      }
      query.createdBy = staffUser.managerId;
      if (req.query.service) {
        query.serviceName = req.query.service;
      }
    } else if (req.user.role === "customer") {
      query.customerId = req.user.id;
    }

    const queues = await Queue.find(query).sort({ createdAt: -1 });
    const now = Date.now();

    const enrichedQueues = await Promise.all(
      queues.map(async (item) => {
        const itemObj = item.toObject();
        const createdMs = new Date(item.createdAt).getTime();
        const elapsedWaitMinutes = Math.max(0, Math.floor((now - createdMs) / 60000));
        const elapsedWaitSeconds = Math.max(0, Math.floor((now - createdMs) / 1000));

        let dynamicWaitMinutes = item.estimatedWaitMinutes || 0;
        if (item.status === "waiting") {
          const aheadCount = await Queue.countDocuments({
            createdBy: item.createdBy,
            serviceName: item.serviceName,
            status: "waiting",
            tokenNumber: { $lt: item.tokenNumber },
            createdAt: { $gte: startOfDay, $lt: endOfDay },
          });
          dynamicWaitMinutes = aheadCount === 0 ? 2 : Math.max(2, aheadCount * 5);
          itemObj.peopleAhead = aheadCount;
        } else if (item.status === "serving") {
          dynamicWaitMinutes = 0;
          const calledMs = new Date(item.calledAt || item.updatedAt).getTime();
          itemObj.servingDurationMinutes = Math.max(0, Math.floor((now - calledMs) / 60000));
          itemObj.servingDurationSeconds = Math.max(0, Math.floor((now - calledMs) / 1000));
        } else if (item.status === "completed") {
          dynamicWaitMinutes = 0;
          const endMs = new Date(item.completedAt || item.updatedAt).getTime();
          itemObj.totalWaitMinutes = Math.max(1, Math.round((endMs - createdMs) / 60000));
        }

        itemObj.elapsedWaitMinutes = elapsedWaitMinutes;
        itemObj.elapsedWaitSeconds = elapsedWaitSeconds;
        itemObj.dynamicWaitMinutes = dynamicWaitMinutes;
        return itemObj;
      })
    );

    return res.json({
      success: true,
      queues: enrichedQueues,
      serverTime: now,
    });
  } catch (error) {
    console.error("Fetch queues error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch queue entries",
    });
  }
});

// 2. Get queue statistics for the logged-in manager or staff with accurate live average wait times
router.get("/stats", protect, async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    let managerId = req.user.id;
    let serviceFilter = null;

    if (req.user.role === "staff") {
      const staffUser = await User.findById(req.user.id);
      managerId = staffUser?.managerId;
      if (req.query.service) {
        serviceFilter = req.query.service;
      }
    } else if (req.query.service) {
      serviceFilter = req.query.service;
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

      // Calculate actual wait times of served/completed customers
      const servedQueues = queues.filter(
        (item) => (item.status === "completed" || item.status === "serving") && (item.calledAt || item.completedAt || item.updatedAt)
      );

      let waitTimeSamples = [];

      servedQueues.forEach((item) => {
        const start = new Date(item.createdAt).getTime();
        let diffMinutes = 0;
        if (item.calledAt) {
          diffMinutes = Math.max(1, Math.round((new Date(item.calledAt).getTime() - start) / 60000));
        } else if (item.completedAt) {
          diffMinutes = Math.max(1, Math.round((new Date(item.completedAt).getTime() - start) / 60000));
        } else if (item.estimatedWaitMinutes && item.estimatedWaitMinutes > 0) {
          diffMinutes = item.estimatedWaitMinutes;
        } else if (item.updatedAt) {
          diffMinutes = Math.max(1, Math.round((new Date(item.updatedAt).getTime() - start) / 60000));
        }
        if (diffMinutes > 0 && diffMinutes < 1440) {
          waitTimeSamples.push(diffMinutes);
        }
      });

      // If no served customers yet, compute from current waiting elapsed times
      if (waitTimeSamples.length === 0) {
        const now = Date.now();
        const waitingQueues = queues.filter((item) => item.status === "waiting");
        waitingQueues.forEach((item) => {
          const start = new Date(item.createdAt).getTime();
          const elapsed = Math.max(1, Math.round((now - start) / 60000));
          if (elapsed > 0 && elapsed < 1440) {
            waitTimeSamples.push(elapsed);
          } else if (item.estimatedWaitMinutes && item.estimatedWaitMinutes > 0) {
            waitTimeSamples.push(item.estimatedWaitMinutes);
          }
        });
      }

      const averageWaitTime =
        waitTimeSamples.length > 0
          ? Math.round(waitTimeSamples.reduce((sum, val) => sum + val, 0) / waitTimeSamples.length)
          : (waiting > 0 ? 5 : 0);

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

    const filter = req.query.provider ? { createdBy: req.query.provider } : {};
    const services = await Service.find(filter).populate(
      "createdBy",
      "name businessName email address city phone googleMapsUrl"
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

        const providerAddress = srv.createdBy?.address || "";
        const providerCity = srv.createdBy?.city || "";
        const providerName = srv.createdBy?.businessName || srv.createdBy?.name || "Service Center";

        let navigationUrl = srv.createdBy?.googleMapsUrl || "";
        if (!navigationUrl && (providerAddress || providerCity)) {
          const query = [providerName, providerAddress, providerCity].filter(Boolean).join(", ");
          navigationUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        }

        return {
          id: srv._id,
          name: srv.name,
          description: srv.description || "Fast, transparent, and responsive counter service with digital queue notifications.",
          category: srv.category || "General",
          estimatedServiceMinutes: srv.estimatedServiceMinutes || 10,
          operatingHours: srv.operatingHours || "09:00 AM - 06:00 PM",
          requirements: srv.requirements && srv.requirements.length > 0 ? srv.requirements : ["Original Photo Identification (Aadhaar / Passport / DL)", "Service application or booking token"],
          managerId: srv.createdBy?._id,
          providerName,
          providerAddress: providerAddress || "Main Office / Reception Desk",
          providerCity: providerCity || "",
          providerPhone: srv.createdBy?.phone || "",
          navigationUrl,
          waitingCount,
          estimatedWaitMinutes: waitingCount === 0 ? (servingNow ? 2 : 0) : waitingCount * (srv.estimatedServiceMinutes || 5),
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

// 3.1 Live Waiting Room TV Display Board (Provider Isolated)
router.get("/board", async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayISTBoundaries();
    const { provider } = req.query;

    let targetManagerId = provider || null;

    // If no provider query was passed, check auth cookie if user is logged in
    if (!targetManagerId && req.cookies?.token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        if (decoded?.role === "manager") {
          targetManagerId = decoded.userId;
        } else if (decoded?.role === "staff") {
          const staffUser = await User.findById(decoded.userId);
          targetManagerId = staffUser?.managerId;
        }
      } catch {
        // ignore
      }
    }

    // If still no provider ID, return all available providers so TV screen can display a selector
    if (!targetManagerId) {
      const managers = await User.find({ role: "manager" }).select("name businessName address city phone");
      return res.json({
        success: true,
        isProviderSelected: false,
        providers: managers.map((m) => ({
          id: m._id,
          name: m.businessName || m.name,
          address: m.address || "Main Branch",
          city: m.city || "",
        })),
        services: [],
        activeServing: [],
      });
    }

    const providerUser = await User.findById(targetManagerId).select(
      "name businessName email address city phone googleMapsUrl"
    );

    if (!providerUser) {
      return res.status(404).json({
        success: false,
        message: "Service Provider Center not found.",
      });
    }

    const providerName = providerUser.businessName || providerUser.name || "Service Center";

    // 1. Fetch only services created by this provider
    const services = await Service.find({ createdBy: targetManagerId });

    const serviceList = await Promise.all(
      services.map(async (srv) => {
        const waitingCount = await Queue.countDocuments({
          createdBy: targetManagerId,
          serviceName: srv.name,
          status: "waiting",
          createdAt: { $gte: startOfDay, $lt: endOfDay },
        });

        const servingNow = await Queue.findOne({
          createdBy: targetManagerId,
          serviceName: srv.name,
          status: "serving",
          createdAt: { $gte: startOfDay, $lt: endOfDay },
        }).select("tokenNumber customerName counterNumber calledAt");

        return {
          id: srv._id,
          name: srv.name,
          category: srv.category || "General",
          waitingCount,
          estimatedWaitMinutes: waitingCount === 0 ? (servingNow ? 2 : 0) : waitingCount * (srv.estimatedServiceMinutes || 5),
          currentlyServingToken: servingNow ? servingNow.tokenNumber : null,
          currentlyServingCounter: servingNow ? servingNow.counterNumber : null,
          calledAt: servingNow?.calledAt || null,
        };
      })
    );

    // 2. Fetch all active serving tokens for this provider today
    const servingQueues = await Queue.find({
      createdBy: targetManagerId,
      status: "serving",
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    }).select("tokenNumber customerName counterNumber serviceName calledAt updatedAt");

    const activeServing = servingQueues.map((item) => ({
      id: item._id,
      tokenNumber: item.tokenNumber,
      customerName: item.customerName,
      counterNumber: item.counterNumber || "Counter 1",
      serviceName: item.serviceName,
      calledAt: item.calledAt || item.updatedAt,
      providerName,
    }));

    return res.json({
      success: true,
      isProviderSelected: true,
      provider: {
        id: providerUser._id,
        name: providerName,
        address: providerUser.address || "",
        city: providerUser.city || "",
        phone: providerUser.phone || "",
      },
      services: serviceList,
      activeServing,
    });
  } catch (error) {
    console.error("TV Display Board error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load TV display board data.",
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

// 4.3 Public: Quick Track Token status by token number & optional phone
router.get("/track-public", async (req, res) => {
  try {
    const { tokenNumber, phone } = req.query;

    if (!tokenNumber) {
      return res.status(400).json({
        success: false,
        message: "Aap kisi service me enrolled nahi ho. Kripya valid token number darj karein.",
      });
    }

    const parsedTokenNum = parseInt(String(tokenNumber).replace(/\D/g, ""), 10);
    if (isNaN(parsedTokenNum) || parsedTokenNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Aap kisi service me enrolled nahi ho. Token number format galat hai.",
      });
    }

    const { startOfDay, endOfDay } = getTodayISTBoundaries();
    const query = { tokenNumber: parsedTokenNum };

    if (phone) {
      const cleanDigits = String(phone).replace(/\D/g, "");
      if (cleanDigits.length >= 4) {
        query.customerPhone = { $regex: new RegExp(cleanDigits.slice(-10) + "$") };
      }
    }

    // 1. Check today's active waiting/serving token
    let token = await Queue.findOne({
      ...query,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
      status: { $in: ["waiting", "serving"] },
    })
      .populate("createdBy", "businessName name email address city phone")
      .populate("servedBy", "name counterNumber")
      .sort({ createdAt: -1 });

    // 2. Check today's completed/cancelled token
    if (!token) {
      token = await Queue.findOne({
        ...query,
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      })
        .populate("createdBy", "businessName name email address city phone")
        .populate("servedBy", "name counterNumber")
        .sort({ createdAt: -1 });
    }

    // 3. Fallback to recent token
    if (!token) {
      token = await Queue.findOne(query)
        .populate("createdBy", "businessName name email address city phone")
        .populate("servedBy", "name counterNumber")
        .sort({ createdAt: -1 });
    }

    if (!token) {
      return res.status(404).json({
        success: false,
        message: `Aap kisi service me enrolled nahi ho. Token #${parsedTokenNum} ka koi active record nahi mila.`,
      });
    }

    // Count people ahead
    const peopleAhead = await Queue.countDocuments({
      createdBy: token.createdBy?._id,
      serviceName: token.serviceName,
      status: "waiting",
      tokenNumber: { $lt: token.tokenNumber },
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    const isServing = token.status === "serving";
    const isCompleted = token.status === "completed";
    const isCancelled = token.status === "cancelled";
    const isWaiting = token.status === "waiting";

    const nowMs = Date.now();
    const createdMs = new Date(token.createdAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
    const servingSeconds = token.calledAt ? Math.max(0, Math.floor((nowMs - new Date(token.calledAt).getTime()) / 1000)) : 0;

    let dynamicWaitMinutes = 0;
    if (isWaiting) {
      dynamicWaitMinutes = peopleAhead === 0 ? 2 : Math.max(2, peopleAhead * 5);
    }

    return res.json({
      success: true,
      hasActiveToken: isWaiting || isServing,
      serverTime: nowMs,
      token: {
        id: token._id,
        tokenNumber: token.tokenNumber,
        tokenCode: `#${token.serviceName.slice(0, 1).toUpperCase()}-${String(token.tokenNumber).padStart(3, "0")}`,
        serviceName: token.serviceName,
        status: token.status,
        customerName: token.customerName,
        customerPhone: token.customerPhone,
        peopleAhead,
        estimatedWaitMinutes: dynamicWaitMinutes,
        elapsedSeconds,
        servingSeconds,
        counterNumber: token.servedBy?.counterNumber || token.counterNumber || null,
        staffName: token.servedBy?.name || null,
        calledAt: token.calledAt,
        completedAt: token.completedAt,
        provider: {
          id: token.createdBy?._id,
          name: token.createdBy?.name || "Service Center",
          businessName: token.createdBy?.businessName || "",
          address: token.createdBy?.address || "",
          city: token.createdBy?.city || "",
          phone: token.createdBy?.phone || "",
        },
        createdAt: token.createdAt,
      },
    });
  } catch (error) {
    console.error("Public track error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to track token right now.",
    });
  }
});

// 4.5 Customer: Get 100% Accurate Live Queue Status
router.get("/customer-live-status", protect, async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    const customerUser = await User.findById(req.user.id);
    const userPhone = customerUser?.phone || "";
    const last10 = userPhone.replace(/\D/g, "").slice(-10);

    const queryConditions = [{ customerId: req.user.id }];
    if (last10) {
      queryConditions.push({ customerPhone: { $regex: new RegExp(last10 + "$") } });
    }

    let token = null;

    // Check if user is searching for a specific manual token number
    if (req.query.tokenNumber) {
      const parsedNum = parseInt(String(req.query.tokenNumber).replace(/\D/g, ""), 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        token = await Queue.findOne({
          tokenNumber: parsedNum,
          createdAt: { $gte: startOfDay, $lt: endOfDay },
          status: { $in: ["waiting", "serving"] },
        })
          .populate("createdBy", "businessName name email address city phone")
          .populate("servedBy", "name counterNumber")
          .sort({ createdAt: -1 });

        if (!token) {
          token = await Queue.findOne({
            tokenNumber: parsedNum,
            createdAt: { $gte: startOfDay, $lt: endOfDay },
          })
            .populate("createdBy", "businessName name email address city phone")
            .populate("servedBy", "name counterNumber")
            .sort({ createdAt: -1 });
        }

        if (!token) {
          token = await Queue.findOne({ tokenNumber: parsedNum })
            .populate("createdBy", "businessName name email address city phone")
            .populate("servedBy", "name counterNumber")
            .sort({ createdAt: -1 });
        }

        if (!token) {
          return res.json({
            success: true,
            hasActiveToken: false,
            message: `Aap kisi service me enrolled nahi ho. Token #${parsedNum} ka koi active record nahi mila.`,
          });
        }
      }
    }

    // Default: Find by customerId or phone
    if (!token) {
      token = await Queue.findOne({
        $or: queryConditions,
        createdAt: { $gte: startOfDay, $lt: endOfDay },
        status: { $in: ["waiting", "serving"] },
      })
        .populate("createdBy", "businessName name email address city phone")
        .populate("servedBy", "name counterNumber")
        .sort({ createdAt: -1 });
    }

    // 2. Second priority: Today's completed or cancelled token
    if (!token) {
      token = await Queue.findOne({
        $or: queryConditions,
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      })
        .populate("createdBy", "businessName name email address city phone")
        .populate("servedBy", "name counterNumber")
        .sort({ createdAt: -1 });
    }

    // 3. Fallback: Recent all-time token
    if (!token) {
      token = await Queue.findOne({
        $or: queryConditions,
      })
        .populate("createdBy", "businessName name email address city phone")
        .populate("servedBy", "name counterNumber")
        .sort({ createdAt: -1 });
    }

    if (!token) {
      return res.json({
        success: true,
        hasActiveToken: false,
        message: "Aap kisi service me enrolled nahi ho.",
      });
    }

    // Exact count of waiting customers ahead in the same service today
    const peopleAhead = await Queue.countDocuments({
      createdBy: token.createdBy?._id,
      serviceName: token.serviceName,
      status: "waiting",
      tokenNumber: { $lt: token.tokenNumber },
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    // Currently serving token at this service
    const currentServing = await Queue.findOne({
      createdBy: token.createdBy?._id,
      serviceName: token.serviceName,
      status: "serving",
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    }).populate("servedBy", "name counterNumber");

    // Dynamic wait minutes calculation
    let estimatedWaitMinutes = 0;
    if (token.status === "waiting") {
      estimatedWaitMinutes = peopleAhead === 0 ? 2 : Math.max(2, peopleAhead * 5);
    } else if (token.status === "serving") {
      estimatedWaitMinutes = 0;
    }

    const nowMs = Date.now();
    const createdMs = new Date(token.createdAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
    const servingSeconds = token.calledAt ? Math.max(0, Math.floor((nowMs - new Date(token.calledAt).getTime()) / 1000)) : 0;

    let counterNumber = token.counterNumber || null;
    let staffName = token.servedBy?.name || null;
    if (token.status === "serving") {
      counterNumber = token.counterNumber || currentServing?.counterNumber || "Counter 1";
      staffName = token.servedBy?.name || currentServing?.servedBy?.name || "Counter Officer";
    }

    const tokenCode = `${token.serviceName.slice(0, 1).toUpperCase()}-${String(token.tokenNumber).padStart(3, "0")}`;

    return res.json({
      success: true,
      hasActiveToken: true,
      serverTime: nowMs,
      token: {
        id: token._id,
        tokenNumber: token.tokenNumber,
        tokenCode,
        serviceName: token.serviceName,
        customerName: token.customerName,
        customerPhone: token.customerPhone,
        status: token.status,
        peopleAhead,
        estimatedWaitMinutes,
        elapsedSeconds,
        servingSeconds,
        counterNumber,
        staffName,
        calledAt: token.calledAt,
        completedAt: token.completedAt,
        createdAt: token.createdAt,
        provider: {
          businessName: token.createdBy?.businessName || token.createdBy?.name || "Service Center",
          name: token.createdBy?.name,
        },
        currentlyServing: currentServing
          ? {
              tokenNumber: currentServing.tokenNumber,
              tokenCode: `${token.serviceName.slice(0, 1).toUpperCase()}-${String(currentServing.tokenNumber).padStart(3, "0")}`,
              counterNumber: currentServing.counterNumber || "Counter 1",
              customerName: currentServing.customerName,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Customer live status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer live status.",
    });
  }
});

// 5. Customer: Get my active tokens & live ticket status
router.get("/my-tokens", protect, async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    const customerUser = await User.findById(req.user.id);
    const userPhone = customerUser?.phone || "";
    const last10 = userPhone.replace(/\D/g, "").slice(-10);

    const queryConditions = [{ customerId: req.user.id }];
    if (last10) {
      queryConditions.push({ customerPhone: { $regex: new RegExp(last10 + "$") } });
    }

    const allMyTokens = await Queue.find({ $or: queryConditions })
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

// 9. Manager: Seed sample demo data (for instant visualization of charts & stats)
router.post("/seed-demo", protect, async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ success: false, message: "Only managers can seed demo data." });
    }

    const managerId = req.user.id;

    // 1. Ensure sample services exist
    const defaultServices = [
      "General Consultation",
      "Document Verification",
      "Express Payments",
    ];

    for (const name of defaultServices) {
      const exists = await Service.findOne({ createdBy: managerId, name });
      if (!exists) {
        await Service.create({ name, createdBy: managerId });
      }
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 2. Sample records for today
    const sampleToday = [
      { serviceName: "General Consultation", customerName: "Priya Verma", customerPhone: "+91 98765 11001", status: "completed", estimatedWaitMinutes: 5, tokenNumber: 1 },
      { serviceName: "General Consultation", customerName: "Anil Kapoor", customerPhone: "+91 98765 11002", status: "serving", estimatedWaitMinutes: 10, tokenNumber: 2, counterNumber: "Counter 1" },
      { serviceName: "General Consultation", customerName: "Vikram Singh", customerPhone: "+91 98765 11003", status: "waiting", estimatedWaitMinutes: 15, tokenNumber: 3 },
      { serviceName: "Document Verification", customerName: "Neha Sharma", customerPhone: "+91 98765 11004", status: "waiting", estimatedWaitMinutes: 8, tokenNumber: 1 },
      { serviceName: "Document Verification", customerName: "Rajesh Patel", customerPhone: "+91 98765 11005", status: "waiting", estimatedWaitMinutes: 14, tokenNumber: 2 },
      { serviceName: "Express Payments", customerName: "Sunita Rao", customerPhone: "+91 98765 11006", status: "completed", estimatedWaitMinutes: 4, tokenNumber: 1 },
    ];

    // 3. Sample records for yesterday (so All-Time Total differs from Today)
    const samplePast = [
      { serviceName: "General Consultation", customerName: "Manish Tiwari", customerPhone: "+91 98765 22001", status: "completed", estimatedWaitMinutes: 6, tokenNumber: 101, createdAt: yesterday, updatedAt: yesterday },
      { serviceName: "Document Verification", customerName: "Sneha Roy", customerPhone: "+91 98765 22002", status: "completed", estimatedWaitMinutes: 12, tokenNumber: 102, createdAt: yesterday, updatedAt: yesterday },
      { serviceName: "Express Payments", customerName: "Deepak Joshi", customerPhone: "+91 98765 22003", status: "completed", estimatedWaitMinutes: 5, tokenNumber: 103, createdAt: yesterday, updatedAt: yesterday },
      { serviceName: "General Consultation", customerName: "Karan Malhotra", customerPhone: "+91 98765 22004", status: "cancelled", estimatedWaitMinutes: 0, tokenNumber: 104, createdAt: yesterday, updatedAt: yesterday },
    ];

    for (const item of sampleToday) {
      await Queue.create({
        ...item,
        createdBy: managerId,
      });
    }

    for (const item of samplePast) {
      await Queue.create({
        ...item,
        createdBy: managerId,
      });
    }

    return res.json({
      success: true,
      message: "Sample demo dataset loaded successfully with services, queues, and analytics!",
    });
  } catch (error) {
    console.error("Seed demo error:", error);
    return res.status(500).json({ success: false, message: "Failed to load demo data." });
  }
});

export default router;
