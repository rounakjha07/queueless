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

  // Timer for currently serving
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Fetch staff user
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("http://localhost:5000/api/auth/me", {
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
      const res = await fetch("http://localhost:5000/api/staff/my-counter", {
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
      const res = await fetch("http://localhost:5000/api/queue/call-next", {
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
      const res = await fetch(`http://localhost:5000/api/queue/${id}/status`, {
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
    setActionLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/queue", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: user.assignedService,
          customerName: walkinName.trim(),
          customerPhone: walkinPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create token.");
      setWalkinName("");
      setWalkinPhone("");
      setShowWalkinForm(false);
      setStatusMessage(`Token #${data.queue.tokenNumber} created for ${data.queue.customerName}!`);
      await fetchCounterStatus();
    } catch (err) {
      setStatusMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("http://localhost:5000/api/auth/logout", {
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
            {showWalkinForm && (
              <form className="walkin-form" onSubmit={handleAddWalkin}>
                <h4>Issue Token for Walk-in Customer</h4>
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
                  <button type="submit" disabled={actionLoading}>
                    {actionLoading ? "Generating..." : "Generate Token"}
                  </button>
                </div>
              </form>
            )}

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
