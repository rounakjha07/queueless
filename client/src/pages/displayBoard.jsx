import { API_BASE } from "../config/api.js";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { playChime } from "../utils/audioChime";
import "./displayBoard.css";

export default function DisplayBoard() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialProvider = searchParams.get("provider") || searchParams.get("providerId") || localStorage.getItem("queueless-tv-provider") || "";

  const [providerId, setProviderId] = useState(initialProvider);
  const [currentProvider, setCurrentProvider] = useState(null);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [services, setServices] = useState([]);
  const [activeServing, setActiveServing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const lastServingIdRef = useRef(null);

  // Live 1-second clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live board data for selected provider
  async function fetchLiveBoard() {
    try {
      const url = providerId
        ? `${API_BASE}/api/queue/board?provider=${encodeURIComponent(providerId)}`
        : `${API_BASE}/api/queue/board`;

      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();

      if (res.ok) {
        if (data.isProviderSelected && data.provider) {
          setCurrentProvider(data.provider);
          setServices(data.services || []);
          setActiveServing(data.activeServing || []);
          if (data.provider.id) {
            localStorage.setItem("queueless-tv-provider", data.provider.id);
          }
        } else {
          setAvailableProviders(data.providers || []);
          setCurrentProvider(null);
          setServices([]);
          setActiveServing([]);
        }
      }
    } catch (err) {
      console.error("Board fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLiveBoard();
    const interval = setInterval(fetchLiveBoard, 2500);
    return () => clearInterval(interval);
  }, [providerId]);

  // Audio chime alert when a new token is called for this center
  useEffect(() => {
    const servingTokensKey = activeServing
      .map((s) => `${s.id}:${s.tokenNumber}:${s.counterNumber}`)
      .sort()
      .join("|");

    if (servingTokensKey && lastServingIdRef.current && lastServingIdRef.current !== servingTokensKey) {
      try {
        playChime();
      } catch (err) {
        console.error("Board chime error:", err);
      }
    }

    if (servingTokensKey) {
      lastServingIdRef.current = servingTokensKey;
    }
  }, [activeServing]);

  function handleSelectProvider(selectedId) {
    setProviderId(selectedId);
    localStorage.setItem("queueless-tv-provider", selectedId);
    setLoading(true);
  }

  function handleSwitchCenter() {
    localStorage.removeItem("queueless-tv-provider");
    setProviderId("");
    setCurrentProvider(null);
    window.history.replaceState({}, document.title, window.location.pathname);
    setLoading(true);
  }

  // 1. Center Selection View (when no provider is active/selected)
  if (!loading && !currentProvider) {
    return (
      <div className="tv-board-app">
        <header className="tv-header">
          <div className="tv-brand">
            <span className="tv-logo-box">Q</span>
            <div>
              <h1>QueueLess <span>Display Network</span></h1>
              <p>Select your Service Center / Hospital / Branch Waiting Hall</p>
            </div>
          </div>
          <div className="tv-clock-pill">
            <span className="live-dot" />
            <span className="tv-clock-digits">
              {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </header>

        <main className="tv-canvas" style={{ justifyContent: "center", alignItems: "center", padding: "40px 24px" }}>
          <div style={{ maxWidth: "800px", width: "100%", textAlign: "center" }}>
            <h2 style={{ fontSize: "28px", fontWeight: "900", marginBottom: "8px" }}>
              📺 Choose Service Center TV Display
            </h2>
            <p style={{ color: "#9ca3af", marginBottom: "32px", fontSize: "15px" }}>
              Each display board is dedicated exclusively to its own counters and waiting list. Select your center to launch full screen:
            </p>

            {availableProviders.length === 0 ? (
              <div className="tv-idle-box">
                <h3>No Service Centers Online</h3>
                <p>Register a Service Provider account to launch a waiting room TV display.</p>
                <Link to="/login" style={{ color: "#22c55e", fontWeight: "700", textDecoration: "none" }}>
                  Go to Provider Login →
                </Link>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                {availableProviders.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProvider(p.id)}
                    style={{
                      background: "#111827",
                      border: "2px solid #1f2937",
                      borderRadius: "16px",
                      padding: "24px 20px",
                      color: "#f9fafb",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#22c55e";
                      e.currentTarget.style.transform = "translateY(-3px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#1f2937";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    <span style={{ fontSize: "28px", display: "block", marginBottom: "12px" }}>🏢</span>
                    <strong style={{ fontSize: "18px", display: "block", color: "#f9fafb" }}>{p.name}</strong>
                    <span style={{ fontSize: "13px", color: "#9ca3af", display: "block", marginTop: "4px" }}>
                      📍 {p.address ? `${p.address}${p.city ? `, ${p.city}` : ""}` : "Main Center"}
                    </span>
                    <span style={{ display: "inline-block", marginTop: "14px", fontSize: "12.5px", color: "#22c55e", fontWeight: "700" }}>
                      Launch TV Board ↗
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // 2. Dedicated Provider TV Waiting Hall Display Board
  const providerTitle = currentProvider?.name || "Service Center";

  return (
    <div className="tv-board-app">
      {/* Top Banner */}
      <header className="tv-header">
        <div className="tv-brand">
          <span className="tv-logo-box">Q</span>
          <div>
            <h1>{providerTitle} <span>Live Board</span></h1>
            <p>
              {currentProvider?.address ? `📍 ${currentProvider.address}${currentProvider.city ? `, ${currentProvider.city}` : ""} · ` : ""}
              Dedicated Waiting Hall Display · Real-Time Counter Calling
            </p>
          </div>
        </div>

        <div className="tv-clock-pill">
          <span className="live-dot" />
          <span className="tv-clock-digits">
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className="tv-date">{currentTime.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
        </div>
      </header>

      {/* Main Content: Huge Now Serving Section for THIS provider */}
      <main className="tv-canvas">
        <div className="tv-serving-hero-card">
          <div className="tv-hero-label">
            <span className="pulsing-speaker">📢</span> NOW SERVING
          </div>

          {activeServing.length === 0 ? (
            <div className="tv-idle-box">
              <h2>ALL COUNTERS AVAILABLE</h2>
              <p>Next ticket numbers will be called shortly. Please hold your token.</p>
            </div>
          ) : (
            <div className="tv-serving-grid">
              {activeServing.map((item) => (
                <div key={item.id} className="tv-serving-counter-card">
                  <div className="tv-card-station-pill">
                    {item.counterNumber || "Counter 1"}
                  </div>
                  <div className="tv-token-giant">
                    {item.serviceName ? item.serviceName.slice(0, 1).toUpperCase() : "T"}-
                    {String(item.tokenNumber).padStart(3, "0")}
                  </div>
                  <div className="tv-service-caption">{item.serviceName}</div>
                  {item.customerName && (
                    <div className="tv-provider-caption">👤 {item.customerName}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Counter Queue Summary Grid: ONLY services for THIS center */}
        <section className="tv-bottom-summary">
          <div className="tv-summary-header">
            <h3>DEPARTMENTS & QUEUE STATUS ({services.length})</h3>
            <span>Dedicated Live Feed · Real-Time Auto Sync (2.5s)</span>
          </div>

          {services.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#9ca3af" }}>
              No active departments configured for this center.
            </div>
          ) : (
            <div className="tv-departments-grid">
              {services.map((srv) => (
                <div key={srv.id} className="tv-dept-card">
                  <div className="tv-dept-top">
                    <span className="tv-dept-name">{srv.name}</span>
                    <span className="tv-waiting-pill">{srv.waitingCount} Waiting</span>
                  </div>
                  <div className="tv-dept-bottom">
                    <span>Current: <b>{srv.currentlyServingToken ? `#${srv.name.slice(0, 1).toUpperCase()}-${String(srv.currentlyServingToken).padStart(3, "0")}` : "Idle"}</b></span>
                    <span>Est. Wait: <b>~{srv.estimatedWaitMinutes} min</b></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer Bar */}
      <footer className="tv-footer">
        <div className="tv-ticker">
          <span className="ticker-badge">NOTICE</span>
          <span className="ticker-text">
            Welcome to {providerTitle}. Please proceed directly to your designated counter station when your token is called.
          </span>
        </div>

        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <button
            onClick={handleSwitchCenter}
            style={{
              background: "transparent",
              border: "1px solid #374151",
              color: "#9ca3af",
              padding: "6px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            Switch Center 🔄
          </button>
          <Link to="/dashboard" className="tv-back-link">
            Workspace Dashboard ↗
          </Link>
        </div>
      </footer>
    </div>
  );
}
