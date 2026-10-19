
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
function Login() {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleLogin(e) {
        e.preventDefault();

        setMessage("");
        setIsError(false);
        setLoading(true);
        try {
            const response = await fetch(
                "http://localhost:5000/api/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({ email, password }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Login failed.");
            }

            setMessage(`Welcome, ${data.user.name}! Login successful.`);
            setEmail("");
            setPassword("");

            if (data.user.role === "customer") {
                navigate("/customer", { replace: true });
            } else {
                navigate("/dashboard", { replace: true });
            }

        } catch (error) {
            setIsError(true);
            setMessage(
                error.message || "Unable to connect to the server."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-page">
            <div className="auth-shell">
                <section className="auth-visual">
                    <Link className="logo auth-brand" to="/">
                        <span className="logo-icon">Q</span>
                        QueueLess
                    </Link>

                    <div className="auth-visual-content">
                        <span className="auth-kicker">
                            <span className="status-dot" /> YOUR TIME MATTERS
                        </span>

                        <h2>
                            Your time is
                            <br />
                            <span>too valuable</span>
                            <br />
                            to wait.
                        </h2>

                        <p>
                            A smarter way to manage queues, track your turn,
                            and make every minute count.
                        </p>

                        <div className="auth-preview">
                            <div className="preview-top">
                                <span className="preview-icon">Q</span>
                                <div>
                                    <strong>Your queue, simplified</strong>
                                    <p>Everything in one place</p>
                                </div>
                                <span className="preview-live">
                                    <span className="status-dot" /> LIVE
                                </span>
                            </div>

                            <div className="preview-stats">
                                <div>
                                    <span>YOUR TOKEN</span>
                                    <strong>A-024</strong>
                                </div>
                                <div>
                                    <span>ESTIMATED WAIT</span>
                                    <strong>20 min</strong>
                                </div>
                            </div>

                            <div className="preview-progress">
                                <span />
                            </div>

                            <div className="preview-footer">
                                <span>You're making progress</span>
                                <span>✦ Smart queue</span>
                            </div>
                        </div>
                    </div>

                    <p className="auth-visual-footer">
                        Less waiting. More living. © {new Date().getFullYear()} QueueLess
                    </p>
                </section>

                <section className="auth-form-side">
                    <div className="auth-form-wrap">
                        <Link className="auth-mobile-brand logo" to="/">
                            <span className="logo-icon">Q</span>
                            QueueLess
                        </Link>

                        <h1>Good to see you.</h1>
                        <p className="auth-subtitle">
                            Sign in to manage your service centre or access your assigned staff account.
                        </p>

                        <form onSubmit={handleLogin}>
                            <label htmlFor="login-email">Email address</label>
                            <input
                                id="login-email"
                                type="email"
                                placeholder="you@example.com"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            <div className="auth-label-row">
                                <label htmlFor="login-password">Password</label>
                            </div>

                            <div className="password-wrap">
                                <input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />

                                <button
                                    className="password-toggle"
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>

                            {message && (
                                <p
                                    role="status"
                                    style={{
                                        color: isError ? "#dc2626" : "#16a34a",
                                        marginTop: "12px",
                                    }}
                                >
                                    {message}
                                </p>
                            )}

                            <button
                                className="auth-primary-btn"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? "Logging in..." : "Log in"} <span>→</span>
                            </button>
                        </form>

                        <div className="auth-divider">
                            <span>NEW TO QUEUELESS?</span>
                        </div>

                        <Link className="auth-secondary-btn" to="/register">
                            Create an account <span>↗</span>
                        </Link>

                        <Link className="auth-back-link" to="/">
                            ← Back to homepage
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}

export default Login;
