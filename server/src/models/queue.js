
import mongoose from "mongoose";

const queueSchema = new mongoose.Schema(
  {
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    tokenNumber: {
      type: Number,
      required: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["waiting", "serving", "completed", "cancelled"],
      default: "waiting",
    },
    estimatedWaitMinutes: {
      type: Number,
      default: 0,
    },
    counterNumber: {
      type: String,
      trim: true,
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    calledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Queue = mongoose.model("Queue", queueSchema);

export default Queue;
