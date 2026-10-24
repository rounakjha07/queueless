import { API_BASE } from "../config/api.js";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { playChime } from "../utils/audioChime";
import "./staffPortal.css";

export default function StaffPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counterData, setCounterData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Walk-in form state
  const [walkinName, setWalkinName] = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [showWalkinForm, setShowWalkinForm] = useState(false);
  const [walkinPaymentMethod, setWalkinPaymentMethod] = useState("cash"); // "cash" | "upi" | "waived"
  const [walkinPaymentConfirmed, setWalkinPaymentConfirmed] = useState(false);

  // Timer for currently serving
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Fetch staff user
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          navigate("/login", { replace: true });
          return;
        }
        if (data.user?.role !== "staff") {
          navigate("/dashboard", { replace: true });
          return;
        }
        setUser(data.user);
      } catch (err) {
        setError("Unable to authenticate staff account.");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [navigate]);

  // Fetch counter status & queue
  async function fetchCounterStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/staff/my-counter`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setCounterData(data);
      }
    } catch (err) {
      console.error("Counter fetch error:", err);
    }
  }

  useEffect(() => {
    if (!user) return;
    fetchCounterStatus();
    const interval = setInterval(fetchCounterStatus, 2500);
    return () => clearInterval(interval);
  }, [user]);

  // Service timer calculation
  useEffect(() => {
    if (!counterData?.currentlyServing?.calledAt) {
      setElapsedSeconds(0);
      return;
    }
    const calledTime = new Date(counterData.currentlyServing.calledAt).getTime();
    const updateTimer = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - calledTime) / 1000)));
    };
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [counterData?.currentlyServing]);

  // Call Next Customer
  async function handleCallNext() {
    setActionLoading(true);
    setStatusMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/queue/call-next`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to call next customer.");
      }
      playChime();
      setStatusMessage(data.message);
      await fetchCounterStatus();
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Update Status of Currently Serving Customer (Complete / Cancel)
  async function handleUpdateStatus(id, newStatus) {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/queue/${id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Status update failed.");
      }
      setStatusMessage(`Customer marked as ${newStatus}.`);
      await fetchCounterStatus();
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Add Walk-in customer to this counter
  async function handleAddWalkin(e) {
    e.preventDefault();
    if (!walkinName.trim()) return;
    const fee = counterData?.counter?.serviceFee ?? 100;
    const isWaived = walkinPaymentMethod === "waived";

    if (fee > 0 && !isWaived && !walkinPaymentConfirmed) {
      setStatusMessage(`⚠️ Please collect ₹${fee} payment from the customer before issuing token.`);
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/queue`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: user.assignedService,
          customerName: walkinName.trim(),
          customerPhone: walkinPhone.trim(),
          paidAmount: isWaived ? 0 : fee,
          paymentStatus: isWaived ? "waived" : "paid",
          paymentMethod: walkinPaymentMethod,
          paymentRef: walkinPaymentMethod === "cash" ? `CASH-${Date.now().toString().slice(-6)}` : `UPI-${Date.now().toString().slice(-6)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create token.");
      setWalkinName("");
      setWalkinPhone("");
      setWalkinPaymentConfirmed(false);
      setWalkinPaymentMethod("cash");
      setShowWalkinForm(false);
      setStatusMessage(`✓ Token #${data.queue.tokenNumber} created for ${data.queue.customerName}! Payment ₹${data.queue.paidAmount} verified.`);
      await fetchCounterStatus();
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLogout() {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <div className="staff-loading-wrap">
        <div className="staff-spinner" />
        <p>Loading Staff Counter Workspace...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="staff-loading-wrap">
        <h2>{error || "Staff session expired."}</h2>
        <button onClick={() => navigate("/login")}>Go to Login</button>
      </div>
    );
  }

  const formatTimer = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const currentlyServing = counterData?.currentlyServing;
  const waitingQueue = counterData?.waitingQueue || [];

  return (
    <div className="staff-app">
      {/* Top Navigation */}
      <header className="staff-navbar">
        <div className="staff-nav-brand">
          <span className="staff-logo-icon">Q</span>
          <span className="staff-brand-text">QueueLess <b>Staff</b></span>
        </div>

        <div className="staff-counter-badges">
          <div className="staff-badge counter-pill">
            <span>📍 Counter:</span> <strong>{user.counterNumber || "Counter 1"}</strong>
          </div>
          <div className="staff-badge service-pill">
            <span>🛠️ Service:</span> <strong>{user.assignedService || "General"}</strong>
          </div>
        </div>

        <div className="staff-user-menu">
          <div className="staff-avatar">
            {user.name?.slice(0, 2).toUpperCase() || "ST"}
          </div>
          <div className="staff-user-info">
            <strong>{user.name}</strong>
            <small>Staff Operator</small>
          </div>
          <button className="staff-logout-btn" onClick={handleLogout} title="Log out">
            Logout ↗
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="staff-main-container">
        {/* Alerts / Status Banner */}
        {statusMessage && (
          <div className="staff-status-alert">
            <span>📢 {statusMessage}</span>
            <button onClick={() => setStatusMessage("")}>×</button>
          </div>
        )}

        {/* Counter KPI Summary */}
        <section className="staff-kpi-row">
          <div className="staff-kpi-card">
            <span className="kpi-label">Waiting in Line</span>
            <span className="kpi-value warning">{counterData?.stats?.waitingCount || 0}</span>
            <span className="kpi-desc">Customers queued for {user.assignedService}</span>
          </div>

          <div className="staff-kpi-card">
            <span className="kpi-label">Served Today</span>
            <span className="kpi-value success">{counterData?.stats?.servedTodayCount || 0}</span>
            <span className="kpi-desc">Completed at this counter</span>
          </div>

          <div className="staff-kpi-card">
            <span className="kpi-label">Counter Collection</span>
            <span className="kpi-value info" style={{ color: "#10b981" }}>₹{counterData?.stats?.counterRevenue || 0}</span>
            <span className="kpi-desc">Today's collection at counter</span>
          </div>

          <div className="staff-kpi-card">
            <span className="kpi-label">Counter Station</span>
            <span className="kpi-value info">{user.counterNumber}</span>
            <span className="kpi-desc">Assigned by Service Provider Head</span>
          </div>
        </section>

        {/* Center Stage: Active Serving Card */}
        <div className="staff-grid-split">
          <section className="staff-card serving-stage-card">
            <div className="card-header-row">
              <div>
                <h2>Now Serving</h2>
                <p>Current customer at {user.counterNumber}</p>
              </div>
              <button
                type="button"
                className="staff-primary-call-btn"
                onClick={handleCallNext}
                disabled={actionLoading || waitingQueue.length === 0}
              >
                ⚡ Call Next Customer ({waitingQueue.length})
              </button>
            </div>

            {currentlyServing ? (
              <div className="active-serving-box">
                <div className="active-token-header">
                  <div className="token-display-badge">
                    <span>TOKEN NUMBER</span>
                    <strong>
                      {currentlyServing.serviceName.slice(0, 1).toUpperCase()}-
                      {String(currentlyServing.tokenNumber).padStart(3, "0")}
                    </strong>
                  </div>

                  <div className="service-timer-box">
                    <span>ELAPSED TIME</span>
                    <strong className="timer-digits">{formatTimer(elapsedSeconds)}</strong>
                  </div>
                </div>

                <div className="customer-details-card">
                  <div className="cust-info-group">
                    <span className="label">Customer Name</span>
                    <span className="val-name">{currentlyServing.customerName}</span>
                  </div>
                  {currentlyServing.customerPhone && (
                    <div className="cust-info-group">
                      <span className="label">Phone</span>
                      <span className="val">{currentlyServing.customerPhone}</span>
                    </div>
                  )}
                  <div className="cust-info-group">
                    <span className="label">Service</span>
                    <span className="val">{currentlyServing.serviceName}</span>
                  </div>
                  <div className="cust-info-group">
                    <span className="label">Payment Status</span>
                    <span className="val" style={{ color: "#10b981", fontWeight: "700" }}>
                      {currentlyServing.paymentStatus === "waived"
                        ? "🎁 WAIVED"
                        : `✓ PAID ₹${currentlyServing.paidAmount !== undefined ? currentlyServing.paidAmount : (currentlyServing.serviceFee || 100)} (${(currentlyServing.paymentMethod || "cash").toUpperCase()})`}
                    </span>
                  </div>
                </div>

                <div className="serving-action-bar">
                  <button
                    className="action-btn complete-btn"
                    onClick={() => handleUpdateStatus(currentlyServing._id, "completed")}
                    disabled={actionLoading}
                  >
                    ✓ Complete Service
                  </button>
                  <button
                    className="action-btn cancel-btn"
                    onClick={() => handleUpdateStatus(currentlyServing._id, "cancelled")}
                    disabled={actionLoading}
                  >
                    ✕ No-Show / Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="idle-serving-box">
                <div className="idle-icon">☕</div>
                <h3>Counter is Idle</h3>
                <p>
                  No customer is currently being served. Click <strong>Call Next Customer</strong> to begin serving the next person in line.
                </p>
                {waitingQueue.length > 0 && (
                  <button
                    className="idle-call-btn"
                    onClick={handleCallNext}
                    disabled={actionLoading}
                  >
                    Call Token #{waitingQueue[0].serviceName.slice(0, 1).toUpperCase()}-{String(waitingQueue[0].tokenNumber).padStart(3, "0")} Now
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Right Column: Waiting Queue List */}
          <section className="staff-card waiting-list-card">
            <div className="card-header-row">
              <div>
                <h2>Waiting Queue</h2>
                <p>{waitingQueue.length} customer(s) waiting</p>
              </div>
              <button
                className="walkin-toggle-btn"
                onClick={() => setShowWalkinForm(!showWalkinForm)}
              >
                {showWalkinForm ? "Close Form" : "+ Walk-in Token"}
              </button>
            </div>

            {/* Quick Walk-in Customer Form */}
            {showWalkinForm && (() => {
              const fee = counterData?.counter?.serviceFee ?? 100;
              const isWaived = walkinPaymentMethod === "waived";
              const canIssue = actionLoading || isWaived || fee === 0 || walkinPaymentConfirmed;

              return (
                <form className="walkin-form" onSubmit={handleAddWalkin}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h4 style={{ margin: 0 }}>Issue Token for Walk-in Customer</h4>
                    <span style={{ fontSize: "12px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: "700", padding: "3px 10px", borderRadius: "10px" }}>
                      Fee: ₹{fee}
                    </span>
                  </div>

                  <div className="form-fields">
                    <input
                      type="text"
                      placeholder="Customer Name"
                      value={walkinName}
                      onChange={(e) => setWalkinName(e.target.value)}
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Phone (Optional)"
                      value={walkinPhone}
                      onChange={(e) => setWalkinPhone(e.target.value)}
                    />
                  </div>

                  {/* Payment Collection Options */}
                  <div style={{
                    background: "rgba(0, 0, 0, 0.15)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "10px",
                    padding: "12px",
                    marginTop: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", color: "var(--staff-text-muted)" }}>Select Payment Mode:</span>
                      <strong style={{ color: "#10b981", fontSize: "14px" }}>
                        ₹{isWaived ? 0 : fee}
                      </strong>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setWalkinPaymentMethod("cash")}
                        style={{
                          padding: "6px 8px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "700",
                          border: walkinPaymentMethod === "cash" ? "2px solid #10b981" : "1px solid rgba(255,255,255,0.15)",
                          background: walkinPaymentMethod === "cash" ? "rgba(16, 185, 129, 0.2)" : "transparent",
                          color: walkinPaymentMethod === "cash" ? "#10b981" : "inherit",
                          cursor: "pointer"
                        }}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalkinPaymentMethod("upi")}
                        style={{
                          padding: "6px 8px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "700",
                          border: walkinPaymentMethod === "upi" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.15)",
                          background: walkinPaymentMethod === "upi" ? "rgba(59, 130, 246, 0.2)" : "transparent",
                          color: walkinPaymentMethod === "upi" ? "#3b82f6" : "inherit",
                          cursor: "pointer"
                        }}
                      >
                        📱 UPI QR
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalkinPaymentMethod("waived")}
                        style={{
                          padding: "6px 8px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "700",
                          border: walkinPaymentMethod === "waived" ? "2px solid #8b5cf6" : "1px solid rgba(255,255,255,0.15)",
                          background: walkinPaymentMethod === "waived" ? "rgba(139, 92, 246, 0.2)" : "transparent",
                          color: walkinPaymentMethod === "waived" ? "#8b5cf6" : "inherit",
                          cursor: "pointer"
                        }}
                      >
                        🎁 Waived
                      </button>
                    </div>

                    {walkinPaymentMethod === "upi" && (
                      <div style={{ textAlign: "center", background: "#ffffff", padding: "10px", borderRadius: "8px" }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                            `upi://pay?pa=queueless@upi&pn=QueueLess&am=${fee}&cu=INR`
                          )}`}
                          alt="Counter UPI QR"
                          style={{ width: "110px", height: "110px", display: "inline-block" }}
                        />
                        <div style={{ color: "#1e293b", fontSize: "11.5px", fontWeight: "700", marginTop: "3px" }}>
                          Ask customer to scan with PhonePe / GPay (₹{fee})
                        </div>
                      </div>
                    )}

                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12.5px", fontWeight: "600" }}>
                      <input
                        type="checkbox"
                        checked={walkinPaymentConfirmed}
                        onChange={(e) => setWalkinPaymentConfirmed(e.target.checked)}
                        style={{ width: "16px", height: "16px", accentColor: "#10b981", cursor: "pointer" }}
                      />
                      <span>
                        {isWaived
                          ? "Confirm Fee Waived / Free Token"
                          : `Confirm ₹${fee} received from customer (${walkinPaymentMethod.toUpperCase()})`}
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading || !canIssue}
                    style={{
                      marginTop: "12px",
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      fontWeight: "700",
                      background: !canIssue ? "#475569" : "#10b981",
                      cursor: !canIssue ? "not-allowed" : "pointer",
                      border: "none",
                      color: "#ffffff"
                    }}
                  >
                    {actionLoading
                      ? "Generating..."
                      : !canIssue
                      ? `🔒 Collect ₹${fee} to Issue Token`
                      : "✓ Payment Confirmed - Generate Token"}
                  </button>
                </form>
              );
            })()}

            {/* Waiting Queue Table */}
            <div className="waiting-table-wrap">
              {waitingQueue.length === 0 ? (
                <div className="empty-queue-msg">
                  <span>✦</span>
                  <p>All caught up! No customers waiting in this queue.</p>
                </div>
              ) : (
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Customer</th>
                      <th>Time Waiting</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitingQueue.map((item, idx) => {
                      const waitMinutes = Math.max(
                        0,
                        Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 60000)
                      );
                      return (
                        <tr key={item._id} className={idx === 0 ? "next-up-row" : ""}>
                          <td>
                            <span className="token-pill">
                              {item.serviceName.slice(0, 1).toUpperCase()}-
                              {String(item.tokenNumber).padStart(3, "0")}
                            </span>
                          </td>
                          <td>
                            <strong>{item.customerName}</strong>
                            <div style={{ marginTop: "2px" }}>
                              <span style={{
                                fontSize: "10px",
                                fontWeight: "700",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                background: item.paymentStatus === "waived" ? "rgba(139, 92, 246, 0.2)" : "rgba(16, 185, 129, 0.2)",
                                color: item.paymentStatus === "waived" ? "#8b5cf6" : "#10b981",
                              }}>
                                {item.paymentStatus === "waived" ? "WAIVED" : `PAID ₹${item.paidAmount || item.serviceFee || 100} (${(item.paymentMethod || "cash").toUpperCase()})`}
                              </span>
                            </div>
                            {idx === 0 && <span className="next-tag">NEXT</span>}
                          </td>
                          <td>{waitMinutes} min ago</td>
                          <td>
                            <button
                              className="direct-serve-btn"
                              onClick={() => handleUpdateStatus(item._id, "serving")}
                              disabled={actionLoading}
                              title="Start serving directly"
                            >
                              Serve ↗
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
