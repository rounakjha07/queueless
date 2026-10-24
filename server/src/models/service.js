import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    price: {
      type: Number,
      default: 100,
      min: 0,
    },
    estimatedServiceMinutes: {
      type: Number,
      default: 10,
    },
    operatingHours: {
      type: String,
      trim: true,
      default: "09:00 AM - 06:00 PM",
    },
    requirements: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

serviceSchema.index({ createdBy: 1, name: 1 }, { unique: true });

const Service = mongoose.model("Service", serviceSchema);

export default Service;
