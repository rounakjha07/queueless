import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { playChime } from "../utils/audioChime";
import "./customerPortal.css";

export default function CustomerPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTokens, setActiveTokens] = useState([]);
  const [pastTokens, setPastTokens] = useState([]);
  const [services, setServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Track if chime has played for a serving token to avoid repeat noise
  const chimePlayedTokensRef = useRef(new Set());

  // Check auth
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
        if (data.user?.role !== "customer") {
          if (data.user?.role === "staff") {
            navigate("/staff-portal", { replace: true });
          } else {
            navigate("/dashboard", { replace: true });
          }
          return;
        }
        setUser(data.user);
      } catch (err) {
        setError("Unable to connect to QueueLess.");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [navigate]);

  // Fetch customer tokens & available services
  async function fetchCustomerData() {
    try {
      // 1. Customer tokens
      const tokenRes = await fetch("http://localhost:5000/api/queue/my-tokens", {
        credentials: "include",
      });
      const tokenData = await tokenRes.json();
      if (tokenRes.ok) {
        setActiveTokens(tokenData.activeTokens || []);
        setPastTokens(tokenData.pastTokens || []);

        // Check if any token just switched to "serving"
        tokenData.activeTokens?.forEach((tok) => {
          if (tok.status === "serving" && !chimePlayedTokensRef.current.has(tok._id)) {
            playChime();
            chimePlayedTokensRef.current.add(tok._id);
          }
        });
      }

      // 2. Available services
      const srvRes = await fetch("http://localhost:5000/api/queue/explore");
      const srvData = await srvRes.json();
      if (srvRes.ok) {
        setServices(srvData.services || []);
      }
    } catch (err) {
      console.error("Customer data fetch error:", err);
    }
  }

  useEffect(() => {
    if (!user) return;
    fetchCustomerData();
    const interval = setInterval(fetchCustomerData, 6000);
    return () => clearInterval(interval);
  }, [user]);

  // Book a new token
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

      setFeedbackMsg(data.message);
      await fetchCustomerData();
    } catch (err) {
      setFeedbackMsg(err.message);
    } finally {
      setBookingLoading(false);
    }
  }

  // Cancel an active token
  async function handleCancelToken(tokenId) {
    const confirmCancel = window.confirm("Are you sure you want to cancel this token?");
    if (!confirmCancel) return;

    try {
      const res = await fetch(`http://localhost:5000/api/queue/${tokenId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cancel.");
      setFeedbackMsg("Token cancelled successfully.");
      await fetchCustomerData();
    } catch (err) {
      setFeedbackMsg(err.message);
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
      <div className="cust-loading-wrap">
        <div className="cust-spinner" />
        <p>Loading your Customer Portal...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="cust-loading-wrap">
        <h2>{error || "Session expired."}</h2>
        <button onClick={() => navigate("/login")}>Go to Login</button>
      </div>
    );
  }

  const filteredServices = services.filter((srv) =>
    srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    srv.providerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="cust-app">
      {/* Navbar */}
      <header className="cust-navbar">
        <div className="cust-brand">
          <span className="cust-logo-icon">Q</span>
          <span className="cust-brand-title">QueueLess <b>Customer</b></span>
        </div>

        <div className="cust-user-nav">
          <div className="cust-user-badge">
            <div className="cust-avatar">{user.name?.slice(0, 2).toUpperCase() || "CU"}</div>
            <span>{user.name}</span>
          </div>
          <button className="cust-logout-btn" onClick={handleLogout}>
            Logout ↗
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="cust-container">
        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="cust-feedback-banner">
            <span>📢 {feedbackMsg}</span>
            <button onClick={() => setFeedbackMsg("")}>×</button>
          </div>
        )}

        {/* Hero Section: Active Tickets */}
        <section className="cust-hero-section">
          <div className="section-title-wrap">
            <h2>My Live Queue Tokens</h2>
            <p>Real-time updates on your wait time and position in line</p>
          </div>

          {activeTokens.length === 0 ? (
            <div className="no-active-ticket-card">
              <div className="ticket-empty-icon">🎟️</div>
              <h3>No Active Tokens Right Now</h3>
              <p>You are not currently waiting in any queues. Explore the available services below and book a digital token instantly!</p>
            </div>
          ) : (
            <div className="active-tokens-grid">
              {activeTokens.map((tok) => {
                const isServing = tok.status === "serving";
                return (
                  <div
                    key={tok._id}
                    className={`live-ticket-card ${isServing ? "ticket-serving-now" : "ticket-waiting"}`}
                  >
                    <div className="ticket-top-row">
                      <div>
                        <span className="ticket-provider-badge">
                          🏢 {tok.createdBy?.businessName || tok.createdBy?.name || "Service Provider"}
                        </span>
                        <h3 className="ticket-service-name">{tok.serviceName}</h3>
                      </div>

                      <div className={`ticket-status-pill ${isServing ? "status-serving" : "status-waiting"}`}>
                        <span className="status-dot" />
                        {isServing ? "NOW SERVING!" : "WAITING IN QUEUE"}
                      </div>
                    </div>

                    {/* Big Token Number */}
                    <div className="token-number-hero">
                      <span className="token-label">YOUR TOKEN</span>
                      <strong className="token-code">
                        {tok.serviceName.slice(0, 1).toUpperCase()}-
                        {String(tok.tokenNumber).padStart(3, "0")}
                      </strong>
                    </div>

                    {/* Progress Info */}
                    {isServing ? (
                      <div className="serving-announcement-box">
                        <span className="bell-icon">🔔</span>
                        <div>
                          <strong>IT'S YOUR TURN!</strong>
                          <p>Please proceed to <b>{tok.counterNumber || "Counter 1"}</b> immediately.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="ticket-metrics-row">
                        <div className="metric-box">
                          <span className="metric-num">{tok.peopleAhead}</span>
                          <span className="metric-sub">People Ahead</span>
                        </div>

                        <div className="metric-box">
                          <span className="metric-num">~{tok.dynamicWaitMinutes} min</span>
                          <span className="metric-sub">Est. Wait Time</span>
                        </div>

                        <div className="metric-box">
                          <span className="metric-num">
                            {tok.currentServingToken
                              ? `${tok.serviceName.slice(0, 1).toUpperCase()}-${String(tok.currentServingToken).padStart(3, "0")}`
                              : "None"}
                          </span>
                          <span className="metric-sub">Serving Now</span>
                        </div>
                      </div>
                    )}

                    <div className="ticket-footer-row">
                      <span className="ticket-timestamp">
                        Issued at {new Date(tok.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {!isServing && (
                        <button
                          className="cancel-token-btn"
                          onClick={() => handleCancelToken(tok._id)}
                        >
                          Cancel Token
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Explore & Book Services Section */}
        <section className="cust-services-section">
          <div className="services-header-row">
            <div>
              <h2>Explore & Book Services</h2>
              <p>Find a counter, see current wait times, and get your virtual token</p>
            </div>

            <div className="service-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search services or providers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {filteredServices.length === 0 ? (
            <div className="empty-services-card">
              <p>No services match your search or no providers have registered services yet.</p>
            </div>
          ) : (
            <div className="services-cards-grid">
              {filteredServices.map((srv) => {
                const alreadyBooked = activeTokens.some(
                  (t) => t.serviceName === srv.name && t.createdBy?._id === srv.managerId
                );
                return (
                  <div key={srv.id} className="service-booking-card">
                    <div className="srv-card-top">
                      <span className="srv-provider-tag">🏢 {srv.providerName}</span>
                      <span className="srv-queue-tag">
                        👥 {srv.waitingCount} in line
                      </span>
                    </div>

                    <h3 className="srv-title">{srv.name}</h3>

                    <div className="srv-stats-preview">
                      <div>
                        <span>Est. Wait</span>
                        <strong>~{srv.estimatedWaitMinutes} mins</strong>
                      </div>
                      <div>
                        <span>Now Serving</span>
                        <strong>
                          {srv.currentlyServingToken
                            ? `${srv.name.slice(0, 1).toUpperCase()}-${String(srv.currentlyServingToken).padStart(3, "0")}`
                            : "Idle"}
                        </strong>
                      </div>
                    </div>

                    <button
                      className={`book-token-btn ${alreadyBooked ? "btn-already-booked" : ""}`}
                      onClick={() => handleBookToken(srv)}
                      disabled={bookingLoading || alreadyBooked}
                    >
                      {alreadyBooked ? "✓ Token Already Active" : "🎫 Get Token Now"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Past Token History */}
        {pastTokens.length > 0 && (
          <section className="cust-history-section">
            <div className="section-title-wrap">
              <h2>My Token History</h2>
              <p>Past visits and completed services</p>
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
                  {pastTokens.slice(0, 6).map((item) => (
                    <tr key={item._id}>
                      <td>
                        <span className="hist-token-pill">
                          {item.serviceName.slice(0, 1).toUpperCase()}-
                          {String(item.tokenNumber).padStart(3, "0")}
                        </span>
                      </td>
                      <td><strong>{item.serviceName}</strong></td>
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
