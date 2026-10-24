import { API_BASE } from "../config/api.js";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(window.location.search);
    const [loginTab, setLoginTab] = useState(() => {
        const t = searchParams.get("tab");
        if (t === "provider" || t === "manager") return "provider";
        if (t === "customer") return "customer";
        if (t === "token" || t === "otp") return "token";
        return "staff"; // Default to Staff Sign In
    });

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

    // 1. Registered Email & Password Login (Customer, Manager, Staff)
    async function handleEmailPasswordLogin(e) {
        e.preventDefault();
        setMessage("");
        setIsError(false);
        setLoading(true);

        try {
            const portalType = loginTab === "customer" ? "customer" : "staff_provider";
            const response = await fetch(
                `${API_BASE}/api/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({ email: email.trim(), password, portalType }),
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
            const res = await fetch(`${API_BASE}/api/auth/customer/send-otp`, {
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
            const res = await fetch(`${API_BASE}/api/auth/customer/verify-otp`, {
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

                        {/* 4-Tab Switch: Staff Sign In vs Provider vs Customer vs Token OTP */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                                gap: "6px",
                                background: "#f1f5f9",
                                padding: "6px",
                                borderRadius: "12px",
                                marginBottom: "22px",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setLoginTab("staff");
                                    setMessage("");
                                    setIsError(false);
                                }}
                                style={{
                                    padding: "9px 6px",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 700,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    background: loginTab === "staff" ? "#ffffff" : "transparent",
                                    color: loginTab === "staff" ? "#2563eb" : "#64748b",
                                    boxShadow: loginTab === "staff" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                🧑‍💼 Staff Sign In
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setLoginTab("provider");
                                    setMessage("");
                                    setIsError(false);
                                }}
                                style={{
                                    padding: "9px 6px",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 700,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    background: loginTab === "provider" ? "#ffffff" : "transparent",
                                    color: loginTab === "provider" ? "#1e293b" : "#64748b",
                                    boxShadow: loginTab === "provider" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                🏢 Provider Head
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setLoginTab("customer");
                                    setMessage("");
                                    setIsError(false);
                                }}
                                style={{
                                    padding: "9px 6px",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 700,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    background: loginTab === "customer" ? "#ffffff" : "transparent",
                                    color: loginTab === "customer" ? "#1e293b" : "#64748b",
                                    boxShadow: loginTab === "customer" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                👤 Customer
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setLoginTab("token");
                                    setMessage("");
                                    setIsError(false);
                                }}
                                style={{
                                    padding: "9px 6px",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 700,
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    background: loginTab === "token" ? "#ffffff" : "transparent",
                                    color: loginTab === "token" ? "#1e293b" : "#64748b",
                                    boxShadow: loginTab === "token" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                🎟️ Token (OTP)
                            </button>
                        </div>

                        {/* ================= TAB 1: REGISTERED CUSTOMER LOGIN ================= */}
                        {loginTab === "customer" && (
                            <form onSubmit={handleEmailPasswordLogin}>
                                <div style={{ marginBottom: "16px", padding: "10px 14px", background: "#eff6ff", borderRadius: "10px", border: "1px solid #bfdbfe", fontSize: "12.5px", color: "#1e40af" }}>
                                    👤 <b>Customer Account Login:</b> Enter your registered email and password to access your bookings and explore services.
                                </div>

                                <label htmlFor="cust-email">Email address</label>
                                <input
                                    id="cust-email"
                                    type="email"
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />

                                <div className="auth-label-row">
                                    <label htmlFor="cust-password">Password</label>
                                </div>

                                <div className="password-wrap">
                                    <input
                                        id="cust-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your account password"
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
                                    {loading ? "Logging in..." : "Log in as Customer 🚀"}
                                </button>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "12.5px" }}>
                                    <Link to="/register" style={{ color: "#2563eb", fontWeight: "700", textDecoration: "none" }}>
                                        Create Customer Account ↗
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLoginTab("token");
                                            setMessage("");
                                            setIsError(false);
                                        }}
                                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline", fontSize: "12.5px" }}
                                    >
                                        Walk-in Token (OTP) →
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* ================= TAB 2: WALK-IN TOKEN OTP LOGIN ================= */}
                        {loginTab === "token" && (
                            <div>
                                <div style={{ marginBottom: "16px", padding: "10px 14px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12.5px", color: "#475569" }}>
                                    🎟️ <b>Walk-in Token Access:</b> Enter the Token Number and Mobile number given at the counter to track live wait time (No password needed).
                                </div>

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

                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "12.5px" }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setLoginTab("customer");
                                                    setMessage("");
                                                    setIsError(false);
                                                }}
                                                style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: "700" }}
                                            >
                                                ← Login with Password
                                            </button>
                                            <Link to="/register" style={{ color: "#64748b", textDecoration: "none" }}>
                                                Register Account ↗
                                            </Link>
                                        </div>
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

                        {/* ================= TAB 3: STAFF SIGN IN ================= */}
                        {loginTab === "staff" && (
                            <form onSubmit={handleEmailPasswordLogin}>
                                <div style={{ marginBottom: "16px", padding: "12px 14px", background: "#eff6ff", borderRadius: "10px", border: "1px solid #bfdbfe", fontSize: "13px", color: "#1e40af" }}>
                                    🧑‍💼 <b>Staff Member Sign In:</b> Log in to your allotted counter station to call tokens, serve waiting customers, and manage counter status.
                                </div>

                                <label htmlFor="staff-login-email">Staff Email address</label>
                                <input
                                    id="staff-login-email"
                                    type="email"
                                    placeholder="staff@example.com"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />

                                <div className="auth-label-row">
                                    <label htmlFor="staff-login-password">Password</label>
                                </div>

                                <div className="password-wrap">
                                    <input
                                        id="staff-login-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your staff password"
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
                                    {loading ? "Signing in..." : "Sign In to Staff Desk 🧑‍💼"}
                                </button>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "12.5px" }}>
                                    <Link to="/register?role=staff" style={{ color: "#2563eb", fontWeight: "700", textDecoration: "none" }}>
                                        Have Invite Code? Register Staff ↗
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLoginTab("provider");
                                            setMessage("");
                                            setIsError(false);
                                        }}
                                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline", fontSize: "12.5px" }}
                                    >
                                        Provider Head Login →
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* ================= TAB 4: SERVICE PROVIDER HEAD LOGIN ================= */}
                        {loginTab === "provider" && (
                            <form onSubmit={handleEmailPasswordLogin}>
                                <div style={{ marginBottom: "16px", padding: "12px 14px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "13px", color: "#334155" }}>
                                    🏢 <b>Service Provider Head Login:</b> Access manager controls, counter assignments, staff invite codes, and center analytics.
                                </div>

                                <label htmlFor="provider-login-email">Provider Email address</label>
                                <input
                                    id="provider-login-email"
                                    type="email"
                                    placeholder="manager@example.com"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />

                                <div className="auth-label-row">
                                    <label htmlFor="provider-login-password">Password</label>
                                </div>

                                <div className="password-wrap">
                                    <input
                                        id="provider-login-password"
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
                                    {loading ? "Logging in..." : "Log In as Service Provider 🏢"}
                                </button>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "12.5px" }}>
                                    <Link to="/register?role=manager" style={{ color: "#2563eb", fontWeight: "700", textDecoration: "none" }}>
                                        Register Service Center ↗
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLoginTab("staff");
                                            setMessage("");
                                            setIsError(false);
                                        }}
                                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline", fontSize: "12.5px" }}
                                    >
                                        Staff Member Sign In →
                                    </button>
                                </div>
                            </form>
                        )}

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
