import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { playChime } from "../utils/audioChime";
import "./customerPortal.css";

export default function CustomerPortal() {
  const navigate = useNavigate();

  // Auth & Session state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Live Queue Telemetry state
  const [liveToken, setLiveToken] = useState(null);
  const [pastTokens, setPastTokens] = useState([]);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // OTP Login states (when customer is not logged in)
  const [tokenInput, setTokenInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [otpStep, setOtpStep] = useState(1); // 1 = Token & Phone, 2 = Enter OTP
  const [otpInput, setOtpInput] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccessMsg, setOtpSuccessMsg] = useState("");
  const [devOtpBanner, setDevOtpBanner] = useState("");
  const [tokenPreview, setTokenPreview] = useState(null);
  const [countdown, setCountdown] = useState(0);

  // Track chime playback to prevent repeat noise while token is serving
  const chimePlayedTokensRef = useRef(new Set());

  // Check auth session
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("http://localhost:5000/api/auth/me", {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.user) {
          if (data.user.role === "customer") {
            setUser(data.user);
          } else {
            // If staff or manager visited /customer, redirect to dashboard
            navigate(data.user.role === "staff" ? "/staff-portal" : "/dashboard", { replace: true });
            return;
          }
        }
      } catch {
        // Not logged in - will show OTP access form
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, [navigate]);

  // Countdown timer for OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Fetch 100% accurate live queue status
  async function fetchLiveStatus() {
    try {
      const res = await fetch("http://localhost:5000/api/queue/customer-live-status", {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.hasActiveToken) {
        setLiveToken(data.token);

        // Audio chime when token transitions to serving
        if (data.token.status === "serving" && !chimePlayedTokensRef.current.has(data.token.id)) {
          playChime();
          chimePlayedTokensRef.current.add(data.token.id);
        }
      } else {
        setLiveToken(null);
      }

      // Also fetch past token history
      const historyRes = await fetch("http://localhost:5000/api/queue/my-tokens", {
        credentials: "include",
      });
      const historyData = await historyRes.json();
      if (historyRes.ok && historyData.pastTokens) {
        setPastTokens(historyData.pastTokens);
      }
    } catch (err) {
      console.error("Live status error:", err);
    }
  }

  // Polling for live queue telemetry
  useEffect(() => {
    if (!user) return;
    fetchLiveStatus();
    const interval = setInterval(fetchLiveStatus, 3500);
    return () => clearInterval(interval);
  }, [user]);

  // Handle Step 1: Send OTP
  async function handleSendOtp(e) {
    e.preventDefault();
    setOtpError("");
    setOtpSuccessMsg("");
    setDevOtpBanner("");
    setOtpLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/auth/customer/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenNumber: tokenInput.trim(),
          phone: phoneInput.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to find token or send OTP.");
      }

      setOtpSuccessMsg(data.message);
      setTokenPreview(data);
      if (data.devOtp) {
        setDevOtpBanner(data.devOtp);
      }
      setOtpStep(2);
      setCountdown(45);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  }

  // Handle Step 2: Verify OTP
  async function handleVerifyOtp(e) {
    e.preventDefault();
    setOtpError("");
    setOtpLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/auth/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tokenNumber: tokenInput.trim(),
          phone: phoneInput.trim(),
          otp: otpInput.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Invalid OTP code.");
      }

      setUser(data.user);
      setOtpStep(1);
      setOtpInput("");
      setDevOtpBanner("");
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  }

  // Handle Customer Logout / Switch Token
  async function handleLogout() {
    try {
      await fetch("http://localhost:5000/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    setUser(null);
    setLiveToken(null);
    setOtpStep(1);
    setTokenInput("");
    setPhoneInput("");
    setOtpInput("");
  }

  if (authLoading) {
    return (
      <div className="cust-loading-wrap">
        <div className="cust-spinner" />
        <p>Connecting to QueueLess Live Network...</p>
      </div>
    );
  }

  // ================= VIEW A: UNREGISTERED / NOT LOGGED IN CUSTOMER (OTP ACCESS) =================
  if (!user) {
    return (
      <div className="cust-otp-wrapper">
        <div className="cust-otp-card">
          <div className="cust-otp-header">
            <div className="cust-otp-icon">🎟️</div>
            <h1 className="cust-otp-title">Customer Live Token Portal</h1>
            <p className="cust-otp-subtitle">
              No registration or account needed! Enter your <b>Token Number</b> & <b>Phone</b> to track your live queue status.
            </p>
          </div>

          {/* Realistic SMS Delivery Simulation Toast */}
          {devOtpBanner && (
            <div className="cust-simulated-sms-banner">
              <span style={{ fontSize: "22px" }}>📱</span>
              <div>
                <strong style={{ display: "block", color: "#065f46", fontSize: "12.5px" }}>
                  SMS Gateway: Instant OTP Generated!
                </strong>
                <span style={{ fontSize: "12.5px", color: "#047857" }}>
                  Your verification code is:{" "}
                  <b style={{ fontSize: "16px", letterSpacing: "2px", color: "#065f46" }}>
                    {devOtpBanner}
                  </b>{" "}
                  (Valid for 5 mins)
                </span>
              </div>
            </div>
          )}

          {otpError && (
            <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "12px 14px", borderRadius: "10px", fontSize: "13px", marginBottom: "16px" }}>
              ⚠️ {otpError}
            </div>
          )}

          {otpSuccessMsg && !devOtpBanner && (
            <div style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "12px 14px", borderRadius: "10px", fontSize: "13px", marginBottom: "16px" }}>
              ✓ {otpSuccessMsg}
            </div>
          )}

          {/* STEP 1: Enter Token # & Phone */}
          {otpStep === 1 && (
            <form onSubmit={handleSendOtp} className="cust-otp-form">
              <div className="cust-input-group">
                <label>Token Number</label>
                <input
                  type="text"
                  placeholder="e.g. 104 or B-104"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="cust-input-group">
                <label>Mobile Number (Provided at Counter)</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="cust-submit-btn" disabled={otpLoading}>
                {otpLoading ? "Checking Token Record..." : "Send Verification OTP 📲"}
              </button>

              <div style={{ textAlign: "center", marginTop: "14px" }}>
                <Link to="/login" style={{ fontSize: "12.5px", color: "#64748b", textDecoration: "none" }}>
                  Are you a Service Provider or Staff? <b>Log in here →</b>
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Enter OTP */}
          {otpStep === 2 && (
            <form onSubmit={handleVerifyOtp} className="cust-otp-form">
              {tokenPreview && (
                <div className="cust-token-preview-chip">
                  <div>
                    <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                      Matched Token
                    </span>
                    <strong style={{ fontSize: "14px", color: "#1e293b" }}>
                      {tokenPreview.tokenDisplay} ({tokenPreview.serviceName})
                    </strong>
                  </div>
                  <span style={{ fontSize: "12px", background: "#dbeafe", color: "#1e40af", padding: "4px 8px", borderRadius: "6px", fontWeight: "700" }}>
                    {tokenPreview.customerName}
                  </span>
                </div>
              )}

              <div className="cust-input-group">
                <label>Enter 6-Digit OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  className="cust-otp-big-input"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="cust-submit-btn" disabled={otpLoading || otpInput.trim().length < 4}>
                {otpLoading ? "Verifying..." : "Verify & Access Live Dashboard 🚀"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                <button
                  type="button"
                  className="cust-back-btn"
                  onClick={() => {
                    setOtpStep(1);
                    setOtpError("");
                    setDevOtpBanner("");
                  }}
                >
                  ← Change Token / Phone
                </button>

                <button
                  type="button"
                  className="cust-back-btn"
                  disabled={countdown > 0}
                  onClick={handleSendOtp}
                  style={{ color: countdown > 0 ? "#94a3b8" : "#2563eb" }}
                >
                  {countdown > 0 ? `Resend OTP (${countdown}s)` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ================= VIEW B: AUTHENTICATED CUSTOMER LIVE DASHBOARD =================
  const isServing = liveToken?.status === "serving";
  const isWaiting = liveToken?.status === "waiting";
  const isCompleted = liveToken?.status === "completed";
  const isCancelled = liveToken?.status === "cancelled";

  return (
    <div className="cust-app">
      {/* Navbar */}
      <header className="cust-navbar">
        <div className="cust-brand">
          <span className="cust-logo-icon">Q</span>
          <span className="cust-brand-title">
            QueueLess <b>Live Customer</b>
          </span>
        </div>

        <div className="cust-user-nav">
          <div className="cust-user-badge">
            <div className="cust-avatar">
              {liveToken?.customerName?.slice(0, 2).toUpperCase() || user.name?.slice(0, 2).toUpperCase() || "CU"}
            </div>
            <span>{liveToken?.customerName || user.name}</span>
          </div>
          <button className="cust-logout-btn" onClick={handleLogout} title="Switch or exit token session">
            Switch Token ↗
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="cust-container">
        {feedbackMsg && (
          <div className="cust-feedback-banner">
            <span>📢 {feedbackMsg}</span>
            <button onClick={() => setFeedbackMsg("")}>×</button>
          </div>
        )}

        {/* Master Live Queue Card */}
        <section className="cust-hero-section">
          {!liveToken ? (
            <div className="no-active-ticket-card">
              <div className="ticket-empty-icon">🎟️</div>
              <h3>No Active Token in Queue</h3>
              <p>You have no pending waiting tokens right now. If you just received a new token slip at the counter, click "Switch Token" above to track it!</p>
            </div>
          ) : (
            <div className={`live-ticket-card ${isServing ? "ticket-serving-now" : "ticket-waiting"}`}>
              {/* Top Row: Provider & Live Status Badge */}
              <div className="ticket-top-row">
                <div>
                  <span className="ticket-provider-badge">
                    🏢 {liveToken.provider?.businessName || liveToken.provider?.name || "Service Center"}
                  </span>
                  <h2 className="ticket-service-name">{liveToken.serviceName}</h2>
                </div>

                <div className={`ticket-status-pill ${isServing ? "status-serving" : "status-waiting"}`}>
                  <span className="status-dot" />
                  {isServing && "NOW SERVING!"}
                  {isWaiting && "WAITING IN QUEUE"}
                  {isCompleted && "SERVICE COMPLETED"}
                  {isCancelled && "TOKEN CANCELLED"}
                </div>
              </div>

              {/* Big Hero Token Badge */}
              <div className="token-number-hero">
                <span className="token-label">YOUR TOKEN CODE</span>
                <strong className="token-code">{liveToken.tokenCode}</strong>
                <span style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "block" }}>
                  Customer: <b>{liveToken.customerName}</b> ({liveToken.customerPhone || user.phone})
                </span>
              </div>

              {/* Progress & Live Telemetry Info */}
              {isServing && (
                <div className="serving-announcement-box" style={{ background: "#22c55e15", border: "2px solid #22c55e", padding: "18px 20px", borderRadius: "14px", marginTop: "18px", display: "flex", alignItems: "center", gap: "16px" }}>
                  <span style={{ fontSize: "36px", animation: "pulse-node 1.2s infinite" }}>🔔</span>
                  <div>
                    <strong style={{ fontSize: "19px", color: "#15803d", display: "block" }}>
                      IT'S YOUR TURN! PROCEED TO COUNTER
                    </strong>
                    <p style={{ margin: "4px 0 0", fontSize: "14.5px", color: "#166534" }}>
                      Please proceed immediately to: <b style={{ fontSize: "17px", textDecoration: "underline" }}>{liveToken.counterNumber || "Counter 1"}</b>
                      {liveToken.staffName && <span> (Staff: <b>{liveToken.staffName}</b>)</span>}
                    </p>
                  </div>
                </div>
              )}

              {isWaiting && (
                <div className="ticket-metrics-row">
                  <div className="metric-box">
                    <span className="metric-num" style={{ color: "#2563eb" }}>{liveToken.peopleAhead}</span>
                    <span className="metric-sub">People Ahead</span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-num" style={{ color: "#059669" }}>
                      {liveToken.estimatedWaitMinutes === 0 ? "Next!" : `~${liveToken.estimatedWaitMinutes} min`}
                    </span>
                    <span className="metric-sub">Est. Wait Time</span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-num" style={{ color: "#d97706" }}>
                      {liveToken.currentlyServing ? liveToken.currentlyServing.tokenCode : "Waiting"}
                    </span>
                    <span className="metric-sub">
                      {liveToken.currentlyServing ? `At ${liveToken.currentlyServing.counterNumber}` : "Counter Ready"}
                    </span>
                  </div>
                </div>
              )}

              {isCompleted && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "16px 20px", borderRadius: "12px", marginTop: "16px", color: "#15803d" }}>
                  <strong style={{ fontSize: "16px", display: "block", marginBottom: "4px" }}>
                    ✓ Consultation / Service Completed
                  </strong>
                  <span>Your token #{liveToken.tokenCode} was served successfully. Thank you for using QueueLess!</span>
                </div>
              )}

              {/* Visual Queue Timeline Progression */}
              <div className="cust-timeline-box">
                <div className="cust-timeline-title">Live Queue Progression</div>
                <div className="cust-timeline-steps">
                  <div className="cust-timeline-line">
                    <div
                      className="cust-timeline-line-progress"
                      style={{
                        width: isCompleted ? "100%" : isServing ? "70%" : "35%",
                      }}
                    />
                  </div>

                  {/* Step 1 */}
                  <div className="cust-step-node">
                    <div className="cust-node-circle active">✓</div>
                    <span className="cust-node-label active">Token Issued</span>
                  </div>

                  {/* Step 2 */}
                  <div className="cust-step-node">
                    <div className={`cust-node-circle ${isWaiting || isServing || isCompleted ? "active" : ""}`}>
                      {isWaiting ? "⏳" : "✓"}
                    </div>
                    <span className={`cust-node-label ${isWaiting ? "active" : ""}`}>
                      {isWaiting ? `In Queue (${liveToken.peopleAhead} ahead)` : "Queue Cleared"}
                    </span>
                  </div>

                  {/* Step 3 */}
                  <div className="cust-step-node">
                    <div className={`cust-node-circle ${isServing ? "current-serving" : isCompleted ? "active" : ""}`}>
                      {isServing ? "🔔" : isCompleted ? "✓" : "3"}
                    </div>
                    <span className={`cust-node-label ${isServing ? "active" : ""}`}>
                      {isServing ? "Called to Counter!" : "Counter Station"}
                    </span>
                  </div>

                  {/* Step 4 */}
                  <div className="cust-step-node">
                    <div className={`cust-node-circle ${isCompleted ? "active" : ""}`}>
                      {isCompleted ? "★" : "4"}
                    </div>
                    <span className={`cust-node-label ${isCompleted ? "active" : ""}`}>Done</span>
                  </div>
                </div>
              </div>

              {/* Footer Row */}
              <div className="ticket-footer-row" style={{ marginTop: "18px" }}>
                <span className="ticket-timestamp">
                  Token generated at {new Date(liveToken.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "700" }}>
                  ● Live Auto-Sync Active (Updates every 3s)
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Service Details & Preparation Checklist */}
        {liveToken && (
          <section className="cust-guide-box">
            <h3 className="cust-guide-title">
              <span>📋</span> Service Information & Counter Checklist
            </h3>

            <div className="cust-guide-grid">
              <div className="cust-guide-item">
                <span className="cust-guide-item-icon">🪪</span>
                <div className="cust-guide-item-text">
                  <strong>Identification & Documents</strong>
                  <p>Keep your original ID card, booking slip, and relevant department files ready in hand before reaching the counter.</p>
                </div>
              </div>

              <div className="cust-guide-item">
                <span className="cust-guide-item-icon">🔊</span>
                <div className="cust-guide-item-text">
                  <strong>Keep Sound Alert Enabled</strong>
                  <p>When your turn arrives, an audio chime will play on your device. Please do not close this browser tab.</p>
                </div>
              </div>

              <div className="cust-guide-item">
                <span className="cust-guide-item-icon">📍</span>
                <div className="cust-guide-item-text">
                  <strong>Counter Reporting Policy</strong>
                  <p>
                    Please reach {liveToken.counterNumber || "the assigned counter"} within 2 minutes of your announcement to prevent token re-call.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Past Tokens History */}
        {pastTokens.length > 0 && (
          <section className="cust-history-section" style={{ marginTop: "24px" }}>
            <div className="section-title-wrap">
              <h2>My Previous Tokens</h2>
              <p>Completed visits and history on this mobile number</p>
            </div>

            <div className="history-table-wrap">
              <table className="cust-history-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Service</th>
                    <th>Provider</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pastTokens.slice(0, 5).map((item) => (
                    <tr key={item._id}>
                      <td>
                        <span className="hist-token-pill">
                          {item.serviceName.slice(0, 1).toUpperCase()}-{String(item.tokenNumber).padStart(3, "0")}
                        </span>
                      </td>
                      <td><b>{item.serviceName}</b></td>
                      <td>{item.createdBy?.businessName || item.createdBy?.name || "Provider"}</td>
                      <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span className={`hist-status-pill ${item.status}`}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
