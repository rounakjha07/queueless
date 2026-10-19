import express from "express";
import Service from "../models/service.js";
import { protect } from "../middleware/authMiddleware.js";
import Queue from "../models/queue.js";

const router = express.Router();

// Get all services for logged-in manager
router.get("/", protect, async (req, res) => {
    try {
        const services = await Service.find({
            createdBy: req.user.id,
        }).sort({ name: 1 });

        res.json({ success: true, services });
    } catch (error) {
        console.error("Fetch services error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch services",
        });
    }
});

// Add a new service
router.post("/", protect, async (req, res) => {
    try {
        const name = req.body.name?.trim();

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Service name is required",
            });
        }

        if (name.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Service name cannot exceed 100 characters",
            });
        }

        const existingService = await Service.findOne({
            createdBy: req.user.id,
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        });

        if (existingService) {
            return res.status(409).json({
                success: false,
                message: "This service already exists",
            });
        }

        const service = await Service.create({
            name,
            createdBy: req.user.id,
        });

        res.status(201).json({
            success: true,
            message: "Service added successfully",
            service,
        });
    } catch (error) {
        console.error("Add service error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "This service already exists",
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to add service",
        });
    }
});

 // Delete a service
router.delete("/:id", protect, async (req, res) => {
    try {
        // First, find the service owned by this manager
        const service = await Service.findOne({
            _id: req.params.id,
            createdBy: req.user.id,
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found",
            });
        }

        // Check whether customers are waiting or being served
        const activeQueue = await Queue.findOne({
            serviceName: service.name,
            createdBy: req.user.id,
            status: { $in: ["waiting", "serving"] },
        });

        if (activeQueue) {
            return res.status(409).json({
                success: false,
                message:
                    "Cannot delete this service while customers are waiting or being served",
            });
        }

        // Delete only after the active queue check passes
        await Service.deleteOne({
            _id: service._id,
            createdBy: req.user.id,
        });

        return res.json({
            success: true,
            message: "Service deleted successfully",
        });
    } catch (error) {
        console.error("Delete service error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete service",
        });
    }
});


export default router;
