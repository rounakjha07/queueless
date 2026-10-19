import queueRoutes from "./routes/queue.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import serviceRoutes from "./routes/service.js";
import staffRoutes from "./routes/staff.js";
import aiRoutes from "./routes/ai.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "QueueLess API is running!" });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend is healthy",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/ai", aiRoutes);

async function startServer() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/queueless"
    );

    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`QueueLess server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
