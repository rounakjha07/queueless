import express from "express";
import Service from "../models/service.js";
import User from "../models/user.js";
import { protect } from "../middleware/authMiddleware.js";
import Queue from "../models/queue.js";

const router = express.Router();

// Get all services for logged-in manager or staff (filtered by allotted department for staff)
router.get("/", protect, async (req, res) => {
    try {
        let managerId = req.user.id;
        let staffAssignedService = null;

        if (req.user.role === "staff") {
            const staffUser = await User.findById(req.user.id);
            managerId = staffUser?.managerId;
            staffAssignedService = staffUser?.assignedService?.trim() || null;
        }

        let query = { createdBy: managerId };

        // For staff: strictly only return their allotted service/department
        if (req.user.role === "staff" && staffAssignedService) {
            query.name = { $regex: new RegExp(`^${staffAssignedService.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") };
        }

        let services = await Service.find(query).sort({ name: 1 });

        // Fallback for staff if service doc wasn't found under that exact query
        if (req.user.role === "staff" && staffAssignedService && services.length === 0) {
            services = [{ name: staffAssignedService, _id: "allotted", price: 100 }];
        }

        res.json({ success: true, services, assignedService: staffAssignedService });
    } catch (error) {
        console.error("Fetch services error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch services",
        });
    }
});

// Add a new service (Managers only)
router.post("/", protect, async (req, res) => {
    try {
        if (req.user.role !== "manager") {
            return res.status(403).json({
                success: false,
                message: "Only the Service Provider Head can create services.",
            });
        }
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

        const price = typeof req.body.price !== "undefined" ? Math.max(0, Number(req.body.price) || 0) : 100;

        const service = await Service.create({
            name,
            price,
            description: req.body.description?.trim() || "",
            category: req.body.category?.trim() || "General",
            estimatedServiceMinutes: Number(req.body.estimatedServiceMinutes) || 10,
            operatingHours: req.body.operatingHours?.trim() || "09:00 AM - 06:00 PM",
            requirements: Array.isArray(req.body.requirements) ? req.body.requirements : (req.body.requirements ? [req.body.requirements] : []),
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

// Update a service (Managers only)
router.put("/:id", protect, async (req, res) => {
    try {
        if (req.user.role !== "manager") {
            return res.status(403).json({
                success: false,
                message: "Only the Service Provider Head can update services.",
            });
        }

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

        if (typeof req.body.name === "string" && req.body.name.trim()) {
            service.name = req.body.name.trim();
        }
        if (typeof req.body.price !== "undefined") {
            service.price = Math.max(0, Number(req.body.price) || 0);
        }
        if (typeof req.body.estimatedServiceMinutes !== "undefined") {
            service.estimatedServiceMinutes = Math.max(1, Number(req.body.estimatedServiceMinutes) || 10);
        }
        if (typeof req.body.description === "string") {
            service.description = req.body.description.trim();
        }
        if (typeof req.body.category === "string" && req.body.category.trim()) {
            service.category = req.body.category.trim();
        }
        if (typeof req.body.operatingHours === "string") {
            service.operatingHours = req.body.operatingHours.trim();
        }

        await service.save();

        return res.json({
            success: true,
            message: "Service updated successfully",
            service,
        });
    } catch (error) {
        console.error("Update service error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update service",
        });
    }
});

// Delete a service (Managers only)
router.delete("/:id", protect, async (req, res) => {
    try {
        if (req.user.role !== "manager") {
            return res.status(403).json({
                success: false,
                message: "Only the Service Provider Head can delete services.",
            });
        }
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
