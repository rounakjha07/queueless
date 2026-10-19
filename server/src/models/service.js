
import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
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
