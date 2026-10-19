import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(window.location.search);
    const [loginTab, setLoginTab] = useState(() => searchParams.get("tab") === "customer" ? "customer" : "staff");

    // Staff / Manager login state
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Customer OTP login state
    const [customerTokenInput, setCustomerTokenInput] = useState("");
    const [customerPhoneInput, setCustomerPhoneInput] = useState("");
    const [otpStep, setOtpStep] = useState(1);
    const [enteredOtp, setEnteredOtp] = useState("");
    const [tokenPreview, setTokenPreview] = useState(null);
    const [devOtpNotification, setDevOtpNotification] = useState("");
    const [countdown, setCountdown] = useState(0);

    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    // Countdown timer for customer OTP
    useState(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    });

    // 1. Staff / Manager Login
    async function handleStaffLogin(e) {
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
            setMessage(error.message || "Unable to connect to the server.");
        } finally {
            setLoading(false);
        }
    }

    // 2. Customer: Send OTP
    async function handleSendCustomerOtp(e) {
        e.preventDefault();
        setMessage("");
        setIsError(false);
        setDevOtpNotification("");
        setLoading(true);

        try {
            const res = await fetch("http://localhost:5000/api/auth/customer/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tokenNumber: customerTokenInput.trim(),
                    phone: customerPhoneInput.trim(),
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to find token or send OTP.");
            }

            setTokenPreview(data);
            if (data.devOtp) {
                setDevOtpNotification(data.devOtp);
            }
            setMessage(data.message);
            setOtpStep(2);
            setCountdown(45);
        } catch (err) {
            setIsError(true);
            setMessage(err.message);
        } finally {
            setLoading(false);
        }
    }

    // 3. Customer: Verify OTP
    async function handleVerifyCustomerOtp(e) {
        e.preventDefault();
        setMessage("");
        setIsError(false);
        setLoading(true);

        try {
            const res = await fetch("http://localhost:5000/api/auth/customer/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    tokenNumber: customerTokenInput.trim(),
                    phone: customerPhoneInput.trim(),
                    otp: enteredOtp.trim(),
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Invalid OTP code.");
            }

            setMessage("Verification successful! Opening live dashboard...");
            setTimeout(() => {
                navigate("/customer", { replace: true });
            }, 600);
        } catch (err) {
            setIsError(true);
            setMessage(err.message);
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
                            A smarter way to manage queues, track your turn in real time,
                            and eliminate waiting room congestion.
                        </p>

                        <div className="auth-preview">
                            <div className="preview-top">
                                <span className="preview-icon">Q</span>
                                <div>
                                    <strong>Live Token Tracking</strong>
                                    <p>Instant phone OTP access</p>
                                </div>
                                <span className="preview-live">
                                    <span className="status-dot" /> LIVE
                                </span>
                            </div>

                            <div className="preview-stats">
                                <div>
                                    <span>YOUR TOKEN</span>
                                    <strong>B-104</strong>
                                </div>
                                <div>
                                    <span>PEOPLE AHEAD</span>
                                    <strong>02 in Line</strong>
                                </div>
                            </div>

                            <div className="preview-progress">
                                <span style={{ width: "65%" }} />
                            </div>

                            <div className="preview-footer">
                                <span>No registration needed for customers</span>
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

                        <h1>Welcome to QueueLess</h1>
                        <p className="auth-subtitle">
                            Choose your access type to proceed:
                        </p>

                        {/* 2-Tab Switch: Customer Live Token vs Staff & Provider */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "8px",
                                background: "#f1f5f9",
                                padding: "6px",
                                borderRadius: "12px",
                                marginBottom: "20px",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setLoginTab("customer");
                                    setMessage("");
                                    setIsError(false);
                                }}
                                style={{
                                    padding: "10px 8px",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 700,
                                    fontSize: "13px",
                                    cursor: "pointer",
                                    background: loginTab === "customer" ? "#ffffff" : "transparent",
                                    color: loginTab === "customer" ? "#1e293b" : "#64748b",
                                    boxShadow: loginTab === "customer" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                🎟️ Customer Token
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setLoginTab("staff");
                                    setMessage("");
                                    setIsError(false);
                                }}
                                style={{
                                    padding: "10px 8px",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 700,
                                    fontSize: "13px",
                                    cursor: "pointer",
                                    background: loginTab === "staff" ? "#ffffff" : "transparent",
                                    color: loginTab === "staff" ? "#1e293b" : "#64748b",
                                    boxShadow: loginTab === "staff" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                🏢 Provider & Staff
                            </button>
                        </div>

                        {/* ================= TAB 1: CUSTOMER LIVE TOKEN OTP LOGIN ================= */}
                        {loginTab === "customer" && (
                            <div>
                                {devOtpNotification && (
                                    <div
                                        style={{
                                            background: "#ecfdf5",
                                            border: "1px solid #6ee7b7",
                                            borderRadius: "10px",
                                            padding: "12px 14px",
                                            marginBottom: "16px",
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: "10px",
                                        }}
                                    >
                                        <span style={{ fontSize: "20px" }}>📱</span>
                                        <div>
                                            <strong style={{ display: "block", color: "#065f46", fontSize: "12.5px" }}>
                                                SMS Gateway: Instant OTP Code
                                            </strong>
                                            <span style={{ fontSize: "12.5px", color: "#047857" }}>
                                                Your token verification OTP is:{" "}
                                                <b style={{ fontSize: "16px", letterSpacing: "2px", color: "#065f46" }}>
                                                    {devOtpNotification}
                                                </b>
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {otpStep === 1 ? (
                                    <form onSubmit={handleSendCustomerOtp}>
                                        <label htmlFor="cust-token">Unique Token Number</label>
                                        <input
                                            id="cust-token"
                                            type="text"
                                            placeholder="e.g. 104 or B-104"
                                            value={customerTokenInput}
                                            onChange={(e) => setCustomerTokenInput(e.target.value)}
                                            required
                                            autoFocus
                                        />

                                        <label htmlFor="cust-phone">Mobile Number (Given at Counter)</label>
                                        <input
                                            id="cust-phone"
                                            type="tel"
                                            placeholder="e.g. 9876543210"
                                            value={customerPhoneInput}
                                            onChange={(e) => setCustomerPhoneInput(e.target.value)}
                                            required
                                        />

                                        {message && (
                                            <p
                                                role="status"
                                                style={{
                                                    color: isError ? "#dc2626" : "#16a34a",
                                                    marginTop: "12px",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                {message}
                                            </p>
                                        )}

                                        <button
                                            className="auth-primary-btn"
                                            type="submit"
                                            disabled={loading}
                                            style={{ marginTop: "16px" }}
                                        >
                                            {loading ? "Checking Token Record..." : "Track Token 🚀"}
                                        </button>
                                    </form>
                                ) : (
                                    <form onSubmit={handleVerifyCustomerOtp}>
                                        {tokenPreview && (
                                            <div
                                                style={{
                                                    background: "#f1f5f9",
                                                    padding: "10px 14px",
                                                    borderRadius: "10px",
                                                    marginBottom: "16px",
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                <div>
                                                    <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                                                        Matched Token
                                                    </span>
                                                    <b>{tokenPreview.tokenDisplay}</b> ({tokenPreview.serviceName})
                                                </div>
                                                <span style={{ background: "#dbeafe", color: "#1e40af", padding: "4px 8px", borderRadius: "6px", fontWeight: "700" }}>
                                                    {tokenPreview.customerName}
                                                </span>
                                            </div>
                                        )}

                                        <label htmlFor="cust-otp">Enter 6-Digit Verification OTP</label>
                                        <input
                                            id="cust-otp"
                                            type="text"
                                            maxLength={6}
                                            placeholder="• • • • • •"
                                            style={{ letterSpacing: "8px", textAlign: "center", fontSize: "22px", fontWeight: "800" }}
                                            value={enteredOtp}
                                            onChange={(e) => setEnteredOtp(e.target.value)}
                                            required
                                            autoFocus
                                        />

                                        {message && (
                                            <p
                                                role="status"
                                                style={{
                                                    color: isError ? "#dc2626" : "#16a34a",
                                                    marginTop: "12px",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                {message}
                                            </p>
                                        )}

                                        <button
                                            className="auth-primary-btn"
                                            type="submit"
                                            disabled={loading || enteredOtp.trim().length < 4}
                                            style={{ marginTop: "16px" }}
                                        >
                                            {loading ? "Verifying..." : "Verify & Access Live Dashboard 🚀"}
                                        </button>

                                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "13px" }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOtpStep(1);
                                                    setMessage("");
                                                    setDevOtpNotification("");
                                                }}
                                                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontWeight: "600" }}
                                            >
                                                ← Edit Details
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSendCustomerOtp}
                                                style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: "700" }}
                                            >
                                                Resend OTP
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}

                        {/* ================= TAB 2: STAFF & PROVIDER LOGIN ================= */}
                        {loginTab === "staff" && (
                            <form onSubmit={handleStaffLogin}>
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
                        )}

                        <div className="auth-divider">
                            <span>SERVICE PROVIDER ONBOARDING</span>
                        </div>

                        <Link className="auth-secondary-btn" to="/register">
                            Register Service Center or Staff Account <span>↗</span>
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
