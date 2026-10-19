import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "../App.css";

function App() {
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    return (
        <div className="app">
            <nav className="navbar">
                <a className="logo" href="/">
                    <span className="logo-icon">Q</span>
                    QueueLess
                </a>

                <div className="nav-links">
                    <a href="#how-it-works">How it works</a>
                    <Link to="/customer" style={{ fontWeight: "700", color: "#2563eb" }}>Track Live Token 🎟️</Link>
                </div>

                <div className="nav-actions">
                    <Link className="btn btn-outline" to="/login">
                        Log in
                    </Link>

                    <Link className="btn btn-primary" to="/register">
                        Get started
                    </Link>
                </div>
            </nav>

            <main>
                <section className="hero">
                    <div className="hero-content">
                        <div className="eyebrow">
                            <span className="status-dot"></span>
                            YOUR TIME MATTERS
                        </div>

                        <h1>
                            Less waiting.
                            <br />
                            <span>More living.</span>
                        </h1>

                        <p className="hero-description">
                            Skip the uncertainty of long queues. Find a service,
                            get your token, and know when it is your turn.
                        </p>

                        <form
                            className="search-box"
                            onSubmit={(event) => {
                                event.preventDefault();
                                navigate("/customer");
                            }}
                        >
                            <span className="search-icon">⌕</span>

                            <input
                                type="text"
                                placeholder="Search hospitals, banks, service centres..."
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />

                            <button className="btn btn-primary" type="submit">
                                Find services
                            </button>
                        </form>

                        <div className="hero-note">
                            <span>✓</span> Book online or get a walk-in token
                            <span>✓</span> Track your waiting time
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="visual-glow"></div>

                        <div className="queue-card">
                            <div className="queue-card-header">
                                <div>
                                    <p className="muted-label">YOUR QUEUE STATUS</p>
                                    <h3>Service centre</h3>
                                </div>
                                <span className="live-badge">
                                    <span className="status-dot"></span>
                                    LIVE
                                </span>
                            </div>

                            <div className="token-panel">
                                <div>
                                    <p className="muted-label">YOUR TOKEN</p>
                                    <div className="token-number">A-024</div>
                                </div>
                                <div className="position">
                                    <strong>04</strong>
                                    <span>people ahead</span>
                                </div>
                            </div>

                            <div className="wait-panel">
                                <div>
                                    <p className="muted-label">ESTIMATED WAIT</p>
                                    <h2>~20 min</h2>
                                </div>
                                <div className="clock-icon">◷</div>
                            </div>

                            <div className="progress-track">
                                <div className="progress-fill"></div>
                            </div>

                            <div className="queue-footer">
                                <span>Queue progress</span>
                                <strong>60%</strong>
                            </div>

                            <div className="next-up">
                                <span className="check-icon">✓</span>
                                <div>
                                    <strong>You're all set!</strong>
                                    <p>We'll keep you updated.</p>
                                </div>
                            </div>
                        </div>

                        <div className="floating-card">
                            <span className="floating-icon">✦</span>
                            <div>
                                <strong>Smart estimates</strong>
                                <p>Make your wait predictable</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="trust-strip" id="services">
                    <p>ONE PLATFORM. MULTIPLE SERVICES.</p>
                    <div className="service-types">
                        <span>✚ Healthcare</span>
                        <span>▤ Banking</span>
                        <span>⌂ Government services</span>
                        <span>▣ Service centres</span>
                    </div>
                </section>

                <section className="how-section" id="how-it-works">
                    <div className="section-heading">
                        <span className="eyebrow">SIMPLE BY DESIGN</span>
                        <h2>Your time, back in your hands.</h2>
                        <p>Three simple steps to a better queue experience.</p>
                    </div>

                    <div className="steps-grid">
                        <article className="step-card">
                            <span className="step-number">01</span>
                            <h3>Find your service</h3>
                            <p>Discover a centre and choose the service you need.</p>
                        </article>

                        <article className="step-card">
                            <span className="step-number">02</span>
                            <h3>Get your token</h3>
                            <p>Join the queue online or receive a walk-in token.</p>
                        </article>

                        <article className="step-card">
                            <span className="step-number">03</span>
                            <h3>Track your turn</h3>
                            <p>Follow your queue position and estimated waiting time.</p>
                        </article>
                    </div>
                </section>
            </main>

            <footer className="footer">
                <a className="logo" href="/">
                    <span className="logo-icon">Q</span>
                    QueueLess
                </a>
                <p>Less waiting. More living.</p>
                <span>© {new Date().getFullYear()} QueueLess</span>
            </footer>
        </div>
    );
}

export default App;
