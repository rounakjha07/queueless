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
    // Payment details
    serviceFee: {
      type: Number,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "waived"],
      default: "paid",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "online", "waived", "free"],
      default: "cash",
    },
    paymentRef: {
      type: String,
      trim: true,
      default: "",
    },
    paidAt: {
      type: Date,
      default: Date.now,
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
