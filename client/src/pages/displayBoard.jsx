import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { playChime } from "../utils/audioChime";
import "./displayBoard.css";

export default function DisplayBoard() {
  const [queues, setQueues] = useState([]);
  const [services, setServices] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const lastServingIdRef = useRef(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live board data
  async function fetchLiveBoard() {
    try {
      const res = await fetch("http://localhost:5000/api/queue/explore");
      const data = await res.json();
      if (res.ok) {
        setServices(data.services || []);
      }

      // Also fetch public token stream if available, or explore list
    } catch (err) {
      console.error("Board fetch error:", err);
    }
  }

  useEffect(() => {
    fetchLiveBoard();
    const interval = setInterval(fetchLiveBoard, 4000);
    return () => clearInterval(interval);
  }, []);

  // Filter currently serving across all counters
  const activeServing = services.filter((s) => s.currentlyServingToken);

  return (
    <div className="tv-board-app">
      {/* Top Banner */}
      <header className="tv-header">
        <div className="tv-brand">
          <span className="tv-logo-box">Q</span>
          <div>
            <h1>QueueLess <span>Live Board</span></h1>
            <p>Smart Waiting Hall Display · Real-Time Counter Calling</p>
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

      {/* Main Content: Huge Now Serving Section */}
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
                    {item.currentlyServingCounter || "Counter 1"}
                  </div>
                  <div className="tv-token-giant">
                    {item.name.slice(0, 1).toUpperCase()}-
                    {String(item.currentlyServingToken).padStart(3, "0")}
                  </div>
                  <div className="tv-service-caption">{item.name}</div>
                  <div className="tv-provider-caption">🏢 {item.providerName}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Counter Queue Summary Grid */}
        <section className="tv-bottom-summary">
          <div className="tv-summary-header">
            <h3>DEPARTMENTS & QUEUE STATUS</h3>
            <span>Auto-synced live every 4 seconds</span>
          </div>

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
        </section>
      </main>

      {/* Footer Bar */}
      <footer className="tv-footer">
        <div className="tv-ticker">
          <span className="ticker-badge">NOTICE</span>
          <span className="ticker-text">
            Welcome to QueueLess. Please proceed to the designated counter when your token number is displayed and called.
          </span>
        </div>
        <Link to="/dashboard" className="tv-back-link">
          Workspace Dashboard ↗
        </Link>
      </footer>
    </div>
  );
}
