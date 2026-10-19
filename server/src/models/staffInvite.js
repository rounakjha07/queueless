import mongoose from "mongoose";

const staffInviteSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    counterNumber: {
      type: String,
      default: "Counter 1",
      trim: true,
    },
    staffEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    staffName: {
      type: String,
      trim: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const StaffInvite = mongoose.model("StaffInvite", staffInviteSchema);

export default StaffInvite;
