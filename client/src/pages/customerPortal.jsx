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
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Explore Services across providers state
  const [services, setServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeModalService, setActiveModalService] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

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

  // Manual counter token lookup state
  const [manualTokenInput, setManualTokenInput] = useState("");
  const [manualTrackError, setManualTrackError] = useState("");
  const [manualTrackLoading, setManualTrackLoading] = useState(false);

  // Registered Customer Login state (when unauthenticated)
  const [customerAccessMode, setCustomerAccessMode] = useState("login"); // "login" or "otp"
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [customerShowPassword, setCustomerShowPassword] = useState(false);
  const [customerLoginLoading, setCustomerLoginLoading] = useState(false);
  const [customerLoginError, setCustomerLoginError] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("queueless-theme") || "light");

  useEffect(() => {
    localStorage.setItem("queueless-theme", theme);
  }, [theme]);

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
            navigate("/dashboard", { replace: true });
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

      // Fetch past token history
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

  // Fetch explore services across all providers
  async function fetchExploreServices() {
    try {
      const res = await fetch("http://localhost:5000/api/queue/explore");
      const data = await res.json();
      if (res.ok && data.services) {
        setServices(data.services);
      }
    } catch (err) {
      console.error("Explore fetch error:", err);
    }
  }

  // Polling for live queue telemetry & services
  useEffect(() => {
    if (!user) return;
    fetchLiveStatus();
    fetchExploreServices();
    const interval = setInterval(() => {
      fetchLiveStatus();
      fetchExploreServices();
    }, 3500);
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
        throw new Error(data.message || "Aap kisi service me enrolled nahi ho.");
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

  const handleSendCustomerOtp = handleSendOtp;
  const handleVerifyCustomerOtp = handleVerifyOtp;

  // Handle Manual Counter Token Search (when customer wants to track a slip)
  async function handleManualTrack(e) {
    if (e) e.preventDefault();
    if (!manualTokenInput.trim()) {
      setManualTrackError("Aap kisi service me enrolled nahi ho. Kripya counter token number enter karein.");
      return;
    }
    setManualTrackLoading(true);
    setManualTrackError("");
    try {
      const parsed = parseInt(manualTokenInput.replace(/\D/g, ""), 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error("Aap kisi service me enrolled nahi ho. Kripya valid token number darj karein (e.g. 5 ya A-005).");
      }

      const res = await fetch(`http://localhost:5000/api/queue/track-public?tokenNumber=${parsed}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.token) {
        throw new Error(data.message || `Aap kisi service me enrolled nahi ho. Token #${parsed} ka koi active record nahi mila.`);
      }

      setLiveToken(data.token);
      setFeedbackMsg(`✓ Token #${data.token.tokenNumber} (${data.token.serviceName}) ka live telemetry load ho gaya!`);
      setManualTrackError("");
      setManualTokenInput("");
    } catch (err) {
      setManualTrackError(err.message);
    } finally {
      setManualTrackLoading(false);
    }
  }

  // Handle Registered Customer Email & Password Login
  async function handleCustomerPasswordLogin(e) {
    e.preventDefault();
    setCustomerLoginError("");
    setCustomerLoginLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: customerEmail.trim(), password: customerPassword, portalType: "customer" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid email or password.");
      }
      if (data.user.role !== "customer") {
        await fetch("http://localhost:5000/api/auth/logout", { method: "POST", credentials: "include" });
        throw new Error("Yeh portal sirf Customers ke liye hai. Staff aur Manager accounts yaha login nahi kar sakte.");
      }
      setUser(data.user);
    } catch (err) {
      setCustomerLoginError(err.message);
    } finally {
      setCustomerLoginLoading(false);
    }
  }

  // Handle Digital Token Booking
  async function handleBookToken(service) {
    setBookingLoading(true);
    setFeedbackMsg("");
    try {
      const res = await fetch("http://localhost:5000/api/queue/book", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: service.name,
          managerId: service.managerId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to book token.");
      }

      setFeedbackMsg(`✓ Token #${data.queue.tokenNumber} issued successfully for ${service.name}!`);
      setActiveModalService(null);
      await fetchLiveStatus();
      await fetchExploreServices();
    } catch (err) {
      setFeedbackMsg("⚠️ " + err.message);
    } finally {
      setBookingLoading(false);
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
      <div className={`cust-app ${theme === "dark" ? "cust-dark" : "cust-light"}`}>
        <div className="cust-loading-wrap">
          <div className="cust-spinner" />
          <p>Connecting to QueueLess Live Network...</p>
        </div>
      </div>
    );
  }

  // ================= VIEW A: UNREGISTERED / NOT LOGGED IN CUSTOMER (OTP ACCESS) =================
  if (!user) {
    return (
      <div className={`cust-app ${theme === "dark" ? "cust-dark" : "cust-light"}`}>
        <div className="cust-otp-wrapper">
          <div className="cust-otp-card">
            {/* Top Bar with Dark/Light Mode Switcher */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
              <button
                type="button"
                className="cust-theme-toggle-btn"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                title="Toggle Light / Dark mode"
              >
                {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
              </button>
            </div>

            <div className="cust-otp-header">
              <div className="cust-otp-icon">🎟️</div>
              <h1 className="cust-otp-title">Customer Live Token Portal</h1>
              <p className="cust-otp-subtitle">
                Enter your <b>Token Number</b> & <b>Phone</b> for quick OTP access, or log in with your registered account.
              </p>
            </div>

            {/* 2-Tab Switcher: Account Login vs Counter Slip OTP */}
            <div className="cust-auth-tab-group">
              <button
                type="button"
                onClick={() => {
                  setCustomerAccessMode("login");
                  setOtpError("");
                }}
                className={`cust-auth-tab-btn ${customerAccessMode === "login" ? "is-active" : ""}`}
              >
                🔑 Account Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerAccessMode("otp");
                  setCustomerLoginError("");
                }}
                className={`cust-auth-tab-btn ${customerAccessMode === "otp" ? "is-active" : ""}`}
              >
                🎟️ Counter Token (OTP)
              </button>
            </div>

          {/* TAB 1: Registered Customer Email & Password Login */}
          {customerAccessMode === "login" && (
            <form onSubmit={handleCustomerPasswordLogin} className="cust-otp-form">
              {customerLoginError && (
                <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", marginBottom: "14px" }}>
                  ⚠️ {customerLoginError}
                </div>
              )}

              <div className="cust-input-group">
                <label>Registered Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. rohan@gmail.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="cust-input-group">
                <label>Account Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={customerShowPassword ? "text" : "password"}
                    placeholder="Enter your account password"
                    value={customerPassword}
                    onChange={(e) => setCustomerPassword(e.target.value)}
                    required
                    style={{ paddingRight: "50px", width: "100%", boxSizing: "border-box" }}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomerShowPassword(!customerShowPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "700",
                    }}
                  >
                    {customerShowPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button type="submit" className="cust-submit-btn" disabled={customerLoginLoading}>
                {customerLoginLoading ? "Logging in..." : "Log In to Customer Dashboard 🚀"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", fontSize: "12.5px" }}>
                <Link to="/register" style={{ color: "#2563eb", textDecoration: "none", fontWeight: "700" }}>
                  Create Customer Account ↗
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerAccessMode("otp");
                    setCustomerLoginError("");
                  }}
                  style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline", fontSize: "12px" }}
                >
                  Track Token with OTP →
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Walk-in Token OTP */}
          {customerAccessMode === "otp" && (
            <div>
              {/* Simulated SMS Toast */}
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
                <form onSubmit={handleSendCustomerOtp} className="cust-otp-form">
                  <div className="cust-input-group">
                    <label>Token Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 4 or B-104"
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
                    {otpLoading ? "Checking Token Record..." : "Track Token 🚀"}
                  </button>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", fontSize: "12.5px" }}>
                    <Link to="/register" style={{ color: "#2563eb", textDecoration: "none", fontWeight: "700" }}>
                      Create Customer Account ↗
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCustomerAccessMode("login")}
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline", fontSize: "12px" }}
                    >
                      Login with Password →
                    </button>
                  </div>
                </form>
              )}

          {/* STEP 2: Enter OTP */}
          {otpStep === 2 && (
            <form onSubmit={handleVerifyCustomerOtp} className="cust-otp-form">
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
                  onClick={handleSendCustomerOtp}
                  style={{ color: countdown > 0 ? "#94a3b8" : "#2563eb" }}
                >
                  {countdown > 0 ? `Resend OTP (${countdown}s)` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

  // ================= VIEW B: AUTHENTICATED CUSTOMER DASHBOARD =================
  const isServing = liveToken?.status === "serving";
  const isWaiting = liveToken?.status === "waiting";
  const isCompleted = liveToken?.status === "completed";
  const isCancelled = liveToken?.status === "cancelled";

  // Filter services by search query and category
  const categories = ["All", "Healthcare", "Banking", "Government", "Salon & Wellness", "General"];
  const filteredServices = services.filter((srv) => {
    const matchesCat = selectedCategory === "All" || srv.category?.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      srv.name.toLowerCase().includes(q) ||
      srv.providerName.toLowerCase().includes(q) ||
      (srv.providerAddress && srv.providerAddress.toLowerCase().includes(q)) ||
      (srv.providerCity && srv.providerCity.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div className={`cust-app ${theme === "dark" ? "cust-dark" : "cust-light"}`}>
      {/* Navbar */}
      <header className="cust-navbar">
        <div className="cust-brand">
          <span className="cust-logo-icon">Q</span>
          <span className="cust-brand-title">
            QueueLess <b>Customer</b>
          </span>
        </div>

        <div className="cust-user-nav">
          <button
            type="button"
            className="cust-theme-toggle-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="Toggle Light / Dark mode"
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
          <div className="cust-user-badge">
            <div className="cust-avatar">
              {user.name?.slice(0, 2).toUpperCase() || "CU"}
            </div>
            <span>{user.name}</span>
          </div>
          <button className="cust-logout-btn" onClick={handleLogout} title="Log out or switch token">
            Log Out ↗
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

        {/* 1. Master Live Queue Hero Card */}
        <section className="cust-hero-section">
          <div className="section-title-wrap">
            <h2>My Active Queue Token</h2>
            <p>Real-time updates on your wait time, position in line, and counter calls</p>
          </div>

          {!liveToken ? (
            <div className="no-active-ticket-card">
              <div className="ticket-empty-icon">🎟️</div>
              <h3 style={{ fontSize: "21px", color: "var(--cust-text-main)", margin: "6px 0", fontWeight: "800" }}>
                Aap kisi service me enrolled nahi ho
              </h3>
              <span style={{ fontSize: "13px", color: "var(--cust-text-dim)", fontWeight: "700", display: "block", marginBottom: "8px" }}>
                (No Active Token Generated)
              </span>
              <p style={{ color: "var(--cust-text-muted)", fontSize: "14px", maxWidth: "520px", margin: "0 auto 18px", lineHeight: "1.5" }}>
                Aapka filhaal kisi bhi service provider ke paas koi active queue token generate nahi hua hai. Agar aapne physical counter se token slip li hai, to neeche apna Token Number daal kar live status track karein!
              </p>

              {/* Inline Counter Slip Token Tracker */}
              <form onSubmit={handleManualTrack} style={{ display: "flex", gap: "8px", maxWidth: "440px", margin: "0 auto 14px", width: "100%" }}>
                <input
                  type="text"
                  placeholder="e.g. 5 ya A-005"
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  className="cust-manual-track-input"
                />
                <button
                  type="submit"
                  disabled={manualTrackLoading}
                  className="cust-submit-btn"
                  style={{ padding: "10px 18px", fontSize: "13.5px", whiteSpace: "nowrap" }}
                >
                  {manualTrackLoading ? "Searching..." : "Track Token 🔍"}
                </button>
              </form>

              {manualTrackError && (
                <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", maxWidth: "440px", margin: "0 auto 16px", fontWeight: "600" }}>
                  ⚠️ {manualTrackError}
                </div>
              )}

              <p style={{ fontSize: "13px", color: "#94a3b8", margin: "14px 0 0" }}>
                Ya neeche di gayi service provider list me se kisi bhi service par click karke direct <b>online token book</b> karein.
              </p>
            </div>
          ) : (
            <div className={`live-ticket-card ${isServing ? "ticket-serving-now" : "ticket-waiting"}`}>
              {/* Top Row: Provider & Status */}
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

              {/* Big Token Number */}
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

        {/* 2. Explore Services Across Providers Section */}
        <section className="cust-explore-header">
          <div className="section-title-wrap">
            <h2>Explore Service Providers & Centers</h2>
            <p>Browse active services, view physical locations, check wait times, and navigate with Google Maps</p>
          </div>

          {/* Search Row */}
          <div className="cust-search-row">
            <input
              type="text"
              className="cust-search-input"
              placeholder="🔍 Search service, hospital, bank, or city/address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Pills */}
          <div className="cust-category-pills">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cust-category-pill ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Services Grid */}
          {filteredServices.length === 0 ? (
            <div className="empty-services-card" style={{ marginTop: "20px" }}>
              <p>No services found matching your criteria. Try adjusting your search or category filter.</p>
            </div>
          ) : (
            <div className="cust-services-grid">
              {filteredServices.map((srv) => {
                const alreadyBooked = liveToken && liveToken.serviceName === srv.name;
                return (
                  <div
                    key={srv.id}
                    className="cust-service-card"
                    onClick={() => setActiveModalService(srv)}
                  >
                    <div>
                      <div className="cust-card-top-tags">
                        <span className="cust-provider-name-tag">
                          🏢 {srv.providerName}
                        </span>
                        <span className="cust-category-badge">{srv.category}</span>
                      </div>

                      <h3 className="cust-service-title">{srv.name}</h3>

                      {/* Location Badge */}
                      <div className="cust-location-badge">
                        <span>📍</span>
                        <span style={{ fontWeight: "600" }}>
                          {srv.providerAddress}
                          {srv.providerCity ? `, ${srv.providerCity}` : ""}
                        </span>
                      </div>

                      {/* Live Queue Telemetry Preview */}
                      <div className="cust-card-telemetry">
                        <div>
                          <span>Live Wait</span>
                          <strong style={{ color: "#2563eb" }}>~{srv.estimatedWaitMinutes} mins</strong>
                        </div>
                        <div>
                          <span>Waiting In Line</span>
                          <strong>{srv.waitingCount} customers</strong>
                        </div>
                        <div>
                          <span>Serving</span>
                          <strong style={{ color: "#059669" }}>
                            {srv.currentlyServingToken ? `#${srv.currentlyServingToken}` : "Idle"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="cust-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="cust-view-details-btn"
                        onClick={() => setActiveModalService(srv)}
                      >
                        Details & Directions ↗
                      </button>

                      <button
                        type="button"
                        className="cust-quick-book-btn"
                        disabled={bookingLoading || alreadyBooked}
                        onClick={() => handleBookToken(srv)}
                      >
                        {alreadyBooked ? "✓ In Line" : "🎫 Book Token"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Interactive Service Details & Live Navigation Modal */}
        {activeModalService && (
          <div className="cust-modal-backdrop" onClick={() => setActiveModalService(null)}>
            <div className="cust-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="cust-modal-header">
                <div>
                  <span style={{ fontSize: "11.5px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>
                    {activeModalService.category} Service
                  </span>
                  <h2 style={{ margin: "2px 0 0", fontSize: "20px", color: "#0f172a" }}>
                    {activeModalService.name}
                  </h2>
                </div>
                <button className="cust-modal-close-btn" onClick={() => setActiveModalService(null)}>
                  ✕
                </button>
              </div>

              {/* Exact Location & Navigation Card */}
              <div className="cust-location-card-hero">
                <h4>
                  <span>📍</span> {activeModalService.providerName}
                </h4>
                <p>
                  <b>Physical Location:</b> {activeModalService.providerAddress}
                  {activeModalService.providerCity ? `, ${activeModalService.providerCity}` : ""}
                  {activeModalService.providerPhone && (
                    <span style={{ display: "block", marginTop: "4px" }}>
                      📞 Contact: <b>{activeModalService.providerPhone}</b>
                    </span>
                  )}
                </p>

                {activeModalService.navigationUrl ? (
                  <a
                    href={activeModalService.navigationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cust-nav-btn"
                  >
                    🧭 Open in Google Maps Navigation ↗
                  </a>
                ) : (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${activeModalService.providerName} ${activeModalService.providerAddress} ${activeModalService.providerCity}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cust-nav-btn"
                  >
                    🧭 Open in Google Maps Navigation ↗
                  </a>
                )}
              </div>

              {/* Real-time Queue Stats */}
              <div className="cust-card-telemetry" style={{ padding: "14px 18px", borderRadius: "12px", margin: "18px 0" }}>
                <div>
                  <span>Current Wait</span>
                  <strong style={{ fontSize: "16px", color: "#2563eb" }}>
                    ~{activeModalService.estimatedWaitMinutes} mins
                  </strong>
                </div>
                <div>
                  <span>Queue Length</span>
                  <strong style={{ fontSize: "16px" }}>{activeModalService.waitingCount} in line</strong>
                </div>
                <div>
                  <span>Operating Hours</span>
                  <strong style={{ fontSize: "14px", color: "#475569" }}>
                    {activeModalService.operatingHours || "09:00 AM - 06:00 PM"}
                  </strong>
                </div>
              </div>

              {/* Service Description */}
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ fontSize: "13.5px", color: "#0f172a", margin: "0 0 6px" }}>
                  Service Description
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.5" }}>
                  {activeModalService.description || "Fast, transparent, and responsive counter service with digital queue notifications."}
                </p>
              </div>

              {/* Requirements & Checklist */}
              <div className="cust-modal-checklist">
                <h5>📋 What to Bring / Required Documents</h5>
                <ul>
                  {(activeModalService.requirements && activeModalService.requirements.length > 0
                    ? activeModalService.requirements
                    : ["Original Photo Identification (Aadhaar / Driving License / Passport)", "Appointment confirmation or booking slip"]
                  ).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "12px", marginTop: "22px" }}>
                <button
                  type="button"
                  className="cust-submit-btn"
                  style={{ flex: 1 }}
                  disabled={bookingLoading || (liveToken && liveToken.serviceName === activeModalService.name)}
                  onClick={() => handleBookToken(activeModalService)}
                >
                  {bookingLoading
                    ? "Issuing Token..."
                    : liveToken && liveToken.serviceName === activeModalService.name
                    ? "✓ You Already Have an Active Token"
                    : "🎫 Book Digital Token Now"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Past Tokens History */}
        {pastTokens.length > 0 && (
          <section className="cust-history-section" style={{ marginTop: "32px" }}>
            <div className="section-title-wrap">
              <h2>My Previous Tokens</h2>
              <p>Completed visits and history on this account</p>
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
