import express from "express";
import Queue from "../models/queue.js";
import Service from "../models/service.js";
import User from "../models/user.js";
import StaffInvite from "../models/staffInvite.js";
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

// 1. AI Queue Insights & Automated Bottleneck Audit
router.get("/insights", protect, async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    let managerId = req.user.id;
    if (req.user.role === "staff") {
      const staffUser = await User.findById(req.user.id);
      managerId = staffUser?.managerId;
    }

    const todayQueues = await Queue.find({
      createdBy: managerId,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    const waiting = todayQueues.filter((q) => q.status === "waiting");
    const serving = todayQueues.filter((q) => q.status === "serving");
    const completed = todayQueues.filter((q) => q.status === "completed");

    // Group waiting by service to detect bottlenecks
    const serviceCounts = {};
    waiting.forEach((q) => {
      serviceCounts[q.serviceName] = (serviceCounts[q.serviceName] || 0) + 1;
    });

    let bottleneckService = "None";
    let maxWaiters = 0;
    Object.entries(serviceCounts).forEach(([srv, count]) => {
      if (count > maxWaiters) {
        maxWaiters = count;
        bottleneckService = srv;
      }
    });

    const activeStaff = await User.countDocuments({
      managerId,
      role: "staff",
    });

    const avgWait = waiting.length > 0
      ? Math.round(waiting.reduce((sum, q) => sum + (q.estimatedWaitMinutes || 0), 0) / waiting.length)
      : 0;

    // AI Heuristic predictions
    const projectedNextHourLoad = Math.max(2, Math.round(waiting.length * 1.3));
    const efficiencyScore = todayQueues.length > 0
      ? Math.min(99, Math.round((completed.length / todayQueues.length) * 100 + 15))
      : 95;

    const recommendations = [];
    if (maxWaiters >= 3) {
      recommendations.push({
        type: "bottleneck",
        title: `High Demand in "${bottleneckService}"`,
        description: `${maxWaiters} customers are waiting for ${bottleneckService}. Consider assigning an additional counter.`,
        suggestedAction: "assign_staff",
        serviceName: bottleneckService,
      });
    }

    if (serving.length === 0 && waiting.length > 0) {
      recommendations.push({
        type: "idle",
        title: "All Counters Idle with Waiting Customers",
        description: `${waiting.length} customer(s) are in queue. Trigger Auto-Call to resume operations.`,
        suggestedAction: "auto_call",
        serviceName: waiting[0].serviceName,
      });
    }

    if (avgWait > 20) {
      recommendations.push({
        type: "delay",
        title: "Elevated Wait Times Detected",
        description: `Average wait has reached ${avgWait} mins. AI suggests broadcasting delay notification.`,
        suggestedAction: "broadcast_delay",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: "optimal",
        title: "Queue Flow is Highly Optimal",
        description: "Customer clearance rate is within green thresholds. All counters operating efficiently.",
        suggestedAction: "none",
      });
    }

    return res.json({
      success: true,
      insights: {
        efficiencyScore,
        bottleneckService,
        maxWaitersInBottleneck: maxWaiters,
        projectedNextHourLoad,
        activeStaffCount: activeStaff,
        totalWaiting: waiting.length,
        totalServing: serving.length,
        totalCompleted: completed.length,
        avgWaitMinutes: avgWait,
        recommendations,
      },
    });
  } catch (error) {
    console.error("AI Insights error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate AI insights." });
  }
});

// 2. Interactive AI Copilot Chat & Automation Engine
router.post("/chat", protect, async (req, res) => {
  try {
    const { message, execute = false } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "Prompt is required." });
    }

    const { startOfDay, endOfDay } = getTodayISTBoundaries();

    let managerId = req.user.id;
    if (req.user.role === "staff") {
      const staffUser = await User.findById(req.user.id);
      managerId = staffUser?.managerId;
    }

    const todayQueues = await Queue.find({
      createdBy: managerId,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    const waiting = todayQueues.filter((q) => q.status === "waiting");
    const serving = todayQueues.filter((q) => q.status === "serving");
    const completed = todayQueues.filter((q) => q.status === "completed");

    const services = await Service.find({ createdBy: managerId }).select("name");
    const serviceNames = services.map((s) => s.name);

    const staffMembers = await User.find({
      managerId,
      role: "staff",
    }).select("name assignedService counterNumber");

    const contextSummary = `
Current Service Center Context:
- Active Services: ${serviceNames.join(", ") || "None"}
- Counter Staff: ${staffMembers.map((s) => `${s.name} at ${s.counterNumber} (${s.assignedService})`).join(", ") || "None"}
- Customers Waiting: ${waiting.length}
- Customers Being Served: ${serving.length}
- Completed Today: ${completed.length}
- Waiting Customer Details: ${waiting.map((w) => `#${w.tokenNumber} ${w.customerName} (${w.serviceName})`).join("; ") || "None"}
- User Role: ${req.user.role}
`;

    const activeApiKey = (req.headers["x-openai-key"] || req.body.apiKey || process.env.OPENAI_API_KEY || "").trim();

    // 1. If OpenAI API key is configured (via header, body, or .env)
    if (activeApiKey) {
      try {
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are QueueCopilot AI, an intelligent queue optimization assistant for QueueLess. You analyze queue bottlenecks, advise service managers and counter staff, automate customer call tasks, and give crisp, professional responses.
Answer questions in the language the user asked (English, Hindi, or Hinglish). Keep responses concise, clear, and actionable.

${contextSummary}

Instructions for Action Triggering:
If the user asks to call the next customer, serve someone, or resolve a bottleneck, include an ACTION line at the end of your response in this exact format:
ACTION: {"type": "call_next", "serviceName": "<ServiceName>", "label": "Call Next in <ServiceName> ⚡"}
If the user asks to mark current customer done:
ACTION: {"type": "complete_token", "tokenId": "<TokenId>", "label": "Mark Completed ✓"}
If the user asks to load demo data:
ACTION: {"type": "seed_demo", "label": "Load Demo Dataset 🚀"}
Do not output ACTION if no specific action is needed.`,
              },
              { role: "user", content: message },
            ],
            temperature: 0.3,
          }),
        });

        const aiData = await aiResponse.json();
        if (aiData.choices?.[0]?.message?.content) {
          let rawText = aiData.choices[0].message.content;
          let action = null;

          // Extract ACTION if returned
          const actionMatch = rawText.match(/ACTION:\s*(\{.*\})/);
          if (actionMatch) {
            try {
              action = JSON.parse(actionMatch[1]);
              rawText = rawText.replace(/ACTION:\s*\{.*\}/, "").trim();
            } catch (e) {
              console.warn("Failed to parse ChatGPT ACTION json:", e);
            }
          }

          // Fallback heuristic for action if not extracted
          if (!action && waiting.length > 0 && (message.toLowerCase().includes("call") || message.toLowerCase().includes("next") || message.toLowerCase().includes("bula"))) {
            action = { type: "call_next", serviceName: waiting[0].serviceName, label: `Call #${waiting[0].tokenNumber} Now` };
          }

          return res.json({
            success: true,
            reply: rawText,
            action,
            provider: "OpenAI ChatGPT (GPT-4o-mini)",
          });
        } else if (aiData.error) {
          console.warn("OpenAI API returned error:", aiData.error.message);
        }
      } catch (openAiErr) {
        console.warn("OpenAI API call failed, falling back to built-in smart assistant:", openAiErr.message);
      }
    }

    // 2. Comprehensive Built-in Copilot (Deterministic, Instant, Multilingual for Hackathon)
    const lower = message.toLowerCase();
    let reply = "";
    let executableAction = null;

    // A. Task: Call Next Customer / Bulao
    if (
      lower.includes("call") ||
      lower.includes("next") ||
      lower.includes("serve") ||
      lower.includes("bula") ||
      lower.includes("agla") ||
      lower.includes("counter pe bula")
    ) {
      // Check if user specified a service name
      const matchedService = serviceNames.find((s) => lower.includes(s.toLowerCase()));
      const targetService = matchedService || (waiting[0] ? waiting[0].serviceName : serviceNames[0]);

      const waitingInTarget = waiting.filter((q) => !targetService || q.serviceName === targetService);

      if (waitingInTarget.length > 0) {
        const nextCustomer = waitingInTarget[0];
        reply = `⚡ **Auto-Call Recommendation**:
- **Token**: #${nextCustomer.serviceName.slice(0, 1).toUpperCase()}-${String(nextCustomer.tokenNumber).padStart(3, "0")}
- **Customer**: ${nextCustomer.customerName}
- **Department**: ${nextCustomer.serviceName}
- **Wait Duration**: ~${nextCustomer.estimatedWaitMinutes} mins

I am ready to dispatch this ticket to the active counter station.`;
        executableAction = {
          type: "call_next",
          serviceName: nextCustomer.serviceName,
          label: `⚡ Dispatch #${nextCustomer.tokenNumber} to Counter`,
        };
      } else {
        reply = `☕ **No Queue Backlog**: There are currently no waiting customers in line for ${targetService ? `"${targetService}"` : "any department"}. All counters are up to date!`;
      }
    }
    // B. Task: Complete Current Customer
    else if (
      lower.includes("complete") ||
      lower.includes("done") ||
      lower.includes("finish") ||
      lower.includes("khatam") ||
      lower.includes("ho gaya")
    ) {
      if (serving.length > 0) {
        const current = serving[0];
        reply = `✅ **Active Session**: Token #${current.serviceName.slice(0, 1).toUpperCase()}-${String(current.tokenNumber).padStart(3, "0")} (${current.customerName}) is currently being served at ${current.counterNumber || "Counter 1"}.`;
        executableAction = {
          type: "complete_token",
          tokenId: current._id,
          label: `Mark Token #${current.tokenNumber} Completed ✓`,
        };
      } else {
        reply = `ℹ️ No token is currently marked as "serving". To serve a customer, call the next token from the Live Queue.`;
      }
    }
    // C. Query / Task: Bottlenecks & Queue Load
    else if (
      lower.includes("bottleneck") ||
      lower.includes("traffic") ||
      lower.includes("load") ||
      lower.includes("bheed") ||
      lower.includes("crowd") ||
      lower.includes("rush") ||
      lower.includes("delay")
    ) {
      const breakdown = {};
      waiting.forEach((q) => {
        breakdown[q.serviceName] = (breakdown[q.serviceName] || 0) + 1;
      });
      const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
      const top = entries[0];

      if (top && top[1] > 0) {
        reply = `🔍 **Queue Bottleneck Analysis**:
- **Highest Volume Department**: "${top[0]}" with **${top[1]} waiting customer(s)**.
- **Traffic Intensity**: ${top[1] >= 4 ? "🔴 HIGH BACKLOG" : top[1] >= 2 ? "🟡 MODERATE" : "🟢 OPTIMAL"}
- **Action Plan**: Prioritize calling the next customer in "${top[0]}" or reassign an available counter to balance the workload.`;
        executableAction = {
          type: "call_next",
          serviceName: top[0],
          label: `Call Next in ${top[0]} ⚡`,
        };
      } else {
        reply = "✅ **Traffic Status**: Zero queue bottlenecks detected! All queues are running in real-time with no customer backlog.";
      }
    }
    // D. Query: Daily Summary & Performance
    else if (
      lower.includes("summary") ||
      lower.includes("performance") ||
      lower.includes("today") ||
      lower.includes("hisab") ||
      lower.includes("stats") ||
      lower.includes("kaisa chal raha")
    ) {
      const total = todayQueues.length;
      const rate = total > 0 ? Math.round((completed.length / total) * 100) : 100;
      const avgWait = waiting.length > 0
        ? Math.round(waiting.reduce((sum, q) => sum + (q.estimatedWaitMinutes || 0), 0) / waiting.length)
        : 0;

      reply = `📊 **QueueLess Daily Executive Summary**:
- **Total Inflow**: ${total} customer tokens today
- **Currently Waiting**: ${waiting.length} in line
- **Actively Serving**: ${serving.length} at counters
- **Completed**: ${completed.length} tickets resolved
- **Resolution Rate**: ${rate}%
- **Average Active Wait**: ${avgWait} minutes

${rate >= 80 ? "🚀 Operational efficiency is exceptional." : "⚠️ Recommend expediting active calls to improve throughput."}`;
    }
    // E. Query: Wait Time Prediction & Peak Forecast
    else if (
      lower.includes("predict") ||
      lower.includes("wait") ||
      lower.includes("time") ||
      lower.includes("der") ||
      lower.includes("kitna samay")
    ) {
      const avgWait = waiting.length * 5;
      reply = `⏱️ **AI Wait Time & Traffic Forecast**:
- **Current Average Wait**: **~${avgWait} minutes** per incoming customer.
- **Projected Next-Hour Load**: ~${Math.max(3, Math.round(waiting.length * 1.3))} arrivals expected.
- **Peak Flow Interval**: Usually between 11:30 AM – 2:30 PM.
- **AI Recommendation**: Keeping counter handling times below 5–6 minutes maintains waiting hall occupancy under comfortable levels.`;
    }
    // F. Query: Staff and Counters Status
    else if (
      lower.includes("staff") ||
      lower.includes("counter") ||
      lower.includes("operator") ||
      lower.includes("desk")
    ) {
      if (staffMembers.length > 0) {
        reply = `🧑‍💼 **Active Staff Deployment (${staffMembers.length})**:
${staffMembers.map((s, idx) => `${idx + 1}. **${s.name}** → ${s.counterNumber || "Counter 1"} (Department: *${s.assignedService}*)`).join("\n")}

All assigned staff operators can manage their counters simultaneously in real-time.`;
      } else {
        reply = `🧑‍💼 **Staff Management**: Currently no external staff members have joined this workspace. You can invite staff members in the **Staff & Counters** tab using unique 6-digit codes.`;
      }
    }
    // G. Task: Seed Demo Data
    else if (
      lower.includes("demo") ||
      lower.includes("seed") ||
      lower.includes("sample data") ||
      lower.includes("fake data")
    ) {
      reply = `🌱 **Demo Dataset Generator**: You can instantly populate realistic departments, today's queues, and historical visits so that the analytics charts and metrics are fully illustrated for judges!`;
      executableAction = {
        type: "seed_demo",
        label: "Populate Demo Dataset Now 🚀",
      };
    }
    // H. Query: What is QueueLess / How it Works / Help
    else if (
      lower.includes("what is") ||
      lower.includes("how does") ||
      lower.includes("help") ||
      lower.includes("kya hai") ||
      lower.includes("kaise") ||
      lower.includes("features")
    ) {
      reply = `💡 **QueueLess Smart Ecosystem Overview**:
1. **Multi-Role Flow**:
   - **Service Provider Head**: Full dashboard oversight, analytics, staff invites, and counter configuration.
   - **Staff Operators**: Identical sleek UI to call and manage tickets at their designated counter.
   - **Customers**: Dedicated mobile portal to track live tokens, people ahead, and hear chime alerts.
2. **Waiting Room Live TV Board**: Open \`/display\` to show bank/airport style live token callouts on any TV screen.
3. **AI Copilot**: Automatically detects bottlenecks, forecasts wait times, and provides 1-click customer dispatching!`;
    }
    // General Conversational Response
    else {
      reply = `🤖 **QueueCopilot Active**: I am monitoring your queue operations in real-time.
- Current Status: **${waiting.length} waiting**, **${serving.length} serving**, **${completed.length} completed**.
- Active Departments: ${serviceNames.join(", ") || "None registered yet"}.

You can ask me to:
- *"Call next customer in General Medicine"*
- *"Where is the biggest queue bottleneck?"*
- *"Show today's performance summary"*
- *"Forecast wait times for new arrivals"*`;
    }

    return res.json({
      success: true,
      reply,
      action: executableAction,
      provider: "QueueCopilot Intelligence (Autonomous)",
    });
  } catch (error) {
    console.error("AI Chat error:", error);
    return res.status(500).json({ success: false, message: "AI Copilot processing failed." });
  }
});

export default router;
