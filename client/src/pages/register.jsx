import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(window.location.search);
    const [role, setRole] = useState(() => {
        const r = searchParams.get("role");
        if (r === "staff" || r === "manager") return r;
        return "customer";
    });
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    // OTP Verification State for Customer Registration
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [devOtpNotification, setDevOtpNotification] = useState("");
    const [countdown, setCountdown] = useState(0);
    const [otpLoading, setOtpLoading] = useState(false);

    // Countdown Timer for Resend OTP
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    function handleRoleChange(newRole) {
        setRole(newRole);
        setMessage("");
        setIsError(false);
        if (newRole !== "customer") {
            setOtpSent(false);
            setOtpVerified(false);
            setOtpCode("");
            setDevOtpNotification("");
            setCountdown(0);
        }
    }

    async function handleSendOtp() {
        const cleanDigits = phone.replace(/\D/g, "");
        if (cleanDigits.length < 10) {
            setMessage("Please enter a valid 10-digit mobile number.");
            setIsError(true);
            return;
        }

        setMessage("");
        setIsError(false);
        setDevOtpNotification("");
        setOtpLoading(true);

        try {
            const res = await fetch("http://localhost:5000/api/auth/register/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: cleanDigits.slice(-10) }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Failed to send OTP.");
            }

            setOtpSent(true);
            if (data.devOtp) {
                setDevOtpNotification(data.devOtp);
            }
            setMessage(data.message || "OTP sent successfully to your mobile number.");
            setCountdown(45);
        } catch (err) {
            setIsError(true);
            setMessage(err.message);
        } finally {
            setOtpLoading(false);
        }
    }

    async function handleVerifyOtp() {
        const cleanDigits = phone.replace(/\D/g, "");
        const cleanOtp = otpCode.trim();

        if (!cleanOtp || cleanOtp.length < 6) {
            setMessage("Please enter the complete 6-digit OTP code.");
            setIsError(true);
            return;
        }

        setMessage("");
        setIsError(false);
        setOtpLoading(true);

        try {
            const res = await fetch("http://localhost:5000/api/auth/register/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: cleanDigits.slice(-10),
                    otp: cleanOtp,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Invalid OTP code.");
            }

            setOtpVerified(true);
            setMessage(data.message || "Mobile number verified successfully! ✅");
        } catch (err) {
            setIsError(true);
            setMessage(err.message);
        } finally {
            setOtpLoading(false);
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        setMessage("");
        setIsError(false);

        if (role === "customer") {
            const cleanDigits = phone.replace(/\D/g, "");
            if (cleanDigits.length < 10) {
                setMessage("A valid 10-digit mobile number is required.");
                setIsError(true);
                return;
            }
            if (!otpVerified) {
                setMessage("Please verify your mobile phone number with OTP first.");
                setIsError(true);
                return;
            }
        }

        setLoading(true);

        try {
            const cleanPhone = phone.replace(/\D/g, "").slice(-10);
            const payload = {
                name,
                email,
                password,
                role,
                phone: cleanPhone,
            };

            if (role === "customer") {
                payload.otp = otpCode.trim();
            } else if (role === "manager") {
                payload.businessName = businessName.trim();
                payload.address = address.trim();
                payload.city = city.trim();
            } else if (role === "staff") {
                payload.inviteCode = inviteCode.trim().toUpperCase();
            }

            const response = await fetch(
                "http://localhost:5000/api/auth/register",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Registration failed.");
            }

            setMessage(data.message || "Account created successfully! Redirecting to login...");
            setName("");
            setEmail("");
            setPassword("");
            setPhone("");
            setOtpCode("");
            setOtpSent(false);
            setOtpVerified(false);
            setDevOtpNotification("");
            setBusinessName("");
            setInviteCode("");

            setTimeout(() => {
                navigate("/login");
            }, 2000);
        } catch (error) {
            setIsError(true);
            setMessage(
                error instanceof TypeError
                    ? "Cannot connect to the server. Make sure the backend is running."
                    : error.message
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-page">
            <div className="auth-shell">
                <section className="auth-visual register-visual">
                    <Link className="logo auth-brand" to="/">
                        <span className="logo-icon">Q</span>
                        QueueLess
                    </Link>

                    <div className="auth-visual-content">
                        <span className="auth-kicker">
                            <span className="status-dot" /> A BETTER WAY TO WAIT
                        </span>

                        <h2>
                            {role === "customer" && (
                                <>Skip the wait. <br />Book & track <span>tokens.</span></>
                            )}
                            {role === "manager" && (
                                <>Get ahead <br />of the <span>queue.</span></>
                            )}
                            {role === "staff" && (
                                <>Serve faster. <br />Manage your <span>counter.</span></>
                            )}
                        </h2>

                        <p>
                            {role === "customer" && "Create an account to explore service providers, see real-time queue lengths and center locations, and book tokens online."}
                            {role === "manager" && "Register your service center, specify location, onboard staff counters with unique invite codes, and oversee queues."}
                            {role === "staff" && "Join your organization with your staff invite code and manage your live assigned counter smoothly."}
                        </p>

                        <div className="benefit-list">
                            <div>
                                <span className="benefit-check">✓</span>
                                <div>
                                    <strong>Instant Token Access</strong>
                                    <p>Live position updates & accurate estimated wait time.</p>
                                </div>
                            </div>

                            <div>
                                <span className="benefit-check">✓</span>
                                <div>
                                    <strong>Smart Counter Management</strong>
                                    <p>Unique staff codes ensure secure counter assignment.</p>
                                </div>
                            </div>

                            <div>
                                <span className="benefit-check">✓</span>
                                <div>
                                    <strong>Multi-Role Ecosystem</strong>
                                    <p>Seamless coordination between Head, Staff, and Customers.</p>
                                </div>
                            </div>
                        </div>

                        <div className="register-quote">
                            <span>✦</span>
                            <p>Less waiting. More living.</p>
                        </div>
                    </div>

                    <p className="auth-visual-footer">
                        © 2026 QueueLess
                    </p>
                </section>

                <section className="auth-form-side">
                    <div className="auth-form-wrap">
                        <Link className="auth-mobile-brand logo" to="/">
                            <span className="logo-icon">Q</span>
                            QueueLess
                        </Link>

                        <span className="auth-step">JOIN QUEUELESS</span>
                        <h1>Create an account</h1>
                        <p className="auth-subtitle">
                            Choose how you would like to join QueueLess:
                        </p>

                        {/* Customer Quick Token Access Notice */}
                        <div
                            style={{
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                borderRadius: "12px",
                                padding: "12px 16px",
                                marginBottom: "18px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "10px",
                                flexWrap: "wrap",
                            }}
                        >
                            <span style={{ fontSize: "12.5px", color: "#166534" }}>
                                🎟️ Have a token slip from a counter? You can track it directly without creating an account!
                            </span>
                            <Link
                                to="/customer"
                                style={{
                                    background: "#16a34a",
                                    color: "#ffffff",
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    fontWeight: "700",
                                    textDecoration: "none",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Track Token ↗
                            </Link>
                        </div>

                        {/* Role Selector Tabs (3 Roles) */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, 1fr)",
                                gap: "8px",
                                background: "#f1f5f9",
                                padding: "6px",
                                borderRadius: "12px",
                                marginBottom: "22px",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => handleRoleChange("customer")}
                                style={{
                                    padding: "10px 6px",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    fontSize: "13px",
                                    cursor: "pointer",
                                    background: role === "customer" ? "#ffffff" : "transparent",
                                    color: role === "customer" ? "#1e293b" : "#64748b",
                                    boxShadow: role === "customer" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                👤 Customer
                            </button>

                            <button
                                type="button"
                                onClick={() => handleRoleChange("manager")}
                                style={{
                                    padding: "10px 6px",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    fontSize: "13px",
                                    cursor: "pointer",
                                    background: role === "manager" ? "#ffffff" : "transparent",
                                    color: role === "manager" ? "#1e293b" : "#64748b",
                                    boxShadow: role === "manager" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                🏢 Provider Head
                            </button>

                            <button
                                type="button"
                                onClick={() => handleRoleChange("staff")}
                                style={{
                                    padding: "10px 6px",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    fontSize: "13px",
                                    cursor: "pointer",
                                    background: role === "staff" ? "#ffffff" : "transparent",
                                    color: role === "staff" ? "#1e293b" : "#64748b",
                                    boxShadow: role === "staff" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                🧑‍💼 Staff Member
                            </button>
                        </div>

                        {role === "staff" && (
                            <div
                                style={{
                                    background: "#eff6ff",
                                    border: "1px solid #bfdbfe",
                                    color: "#1e40af",
                                    padding: "12px 14px",
                                    borderRadius: "10px",
                                    fontSize: "13px",
                                    marginBottom: "18px",
                                    lineHeight: "1.4",
                                }}
                            >
                                ℹ️ <strong>Staff Registration:</strong> You need an invite code generated by your Service Provider Head.
                            </div>
                        )}

                        <form onSubmit={handleRegister}>
                            {/* Full Name */}
                            <label htmlFor="register-name">Full name</label>
                            <input
                                id="register-name"
                                type="text"
                                placeholder="Enter your full name"
                                autoComplete="name"
                                minLength={2}
                                maxLength={80}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />

                            {/* Email */}
                            <label htmlFor="register-email">Email address</label>
                            <input
                                id="register-email"
                                type="email"
                                placeholder="you@example.com"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            {/* Customer Phone + OTP Verification */}
                            {role === "customer" && (
                                <div style={{ marginBottom: "18px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                        <label htmlFor="register-phone" style={{ margin: 0, fontWeight: "600" }}>
                                            Mobile Number <span style={{ color: "#dc2626" }}>*</span>
                                        </label>
                                        {otpVerified && (
                                            <span style={{ fontSize: "12.5px", color: "#16a34a", fontWeight: "700" }}>
                                                ✓ Verified
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <div style={{ position: "relative", flex: 1 }}>
                                            <span style={{
                                                position: "absolute",
                                                left: "12px",
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                fontSize: "13px",
                                                color: "#64748b",
                                                fontWeight: "600",
                                                pointerEvents: "none",
                                            }}>
                                                +91
                                            </span>
                                            <input
                                                id="register-phone"
                                                type="tel"
                                                placeholder="9876543210"
                                                maxLength={10}
                                                disabled={otpVerified}
                                                value={phone}
                                                onChange={(e) => {
                                                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                    setPhone(digits);
                                                    if (otpVerified) {
                                                        setOtpVerified(false);
                                                        setOtpSent(false);
                                                        setOtpCode("");
                                                        setDevOtpNotification("");
                                                    }
                                                }}
                                                style={{
                                                    paddingLeft: "44px",
                                                    letterSpacing: "1px",
                                                    fontWeight: "600",
                                                    background: otpVerified ? "#f0fdf4" : undefined,
                                                    borderColor: otpVerified ? "#86efac" : undefined,
                                                }}
                                                required
                                            />
                                        </div>

                                        {!otpVerified ? (
                                            <button
                                                type="button"
                                                onClick={handleSendOtp}
                                                disabled={phone.length !== 10 || otpLoading || countdown > 0}
                                                style={{
                                                    padding: "0 14px",
                                                    borderRadius: "10px",
                                                    border: "1px solid #cbd5e1",
                                                    background: phone.length === 10 && countdown === 0 ? "#2563eb" : "#f1f5f9",
                                                    color: phone.length === 10 && countdown === 0 ? "#ffffff" : "#94a3b8",
                                                    fontWeight: "600",
                                                    fontSize: "12.5px",
                                                    cursor: phone.length === 10 && countdown === 0 ? "pointer" : "not-allowed",
                                                    whiteSpace: "nowrap",
                                                    transition: "all 0.2s ease",
                                                }}
                                            >
                                                {otpLoading
                                                    ? "Sending..."
                                                    : countdown > 0
                                                        ? `Resend (${countdown}s)`
                                                        : otpSent
                                                            ? "Resend OTP"
                                                            : "Send OTP"}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOtpVerified(false);
                                                    setOtpSent(false);
                                                    setOtpCode("");
                                                    setDevOtpNotification("");
                                                    setCountdown(0);
                                                }}
                                                style={{
                                                    padding: "0 12px",
                                                    borderRadius: "10px",
                                                    border: "1px solid #e2e8f0",
                                                    background: "#ffffff",
                                                    color: "#64748b",
                                                    fontSize: "12px",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                Change
                                            </button>
                                        )}
                                    </div>

                                    {/* Dev OTP preview banner */}
                                    {devOtpNotification && !otpVerified && (
                                        <div
                                            style={{
                                                background: "#ecfdf5",
                                                border: "1px solid #6ee7b7",
                                                borderRadius: "10px",
                                                padding: "10px 14px",
                                                marginTop: "10px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "10px",
                                            }}
                                        >
                                            <span style={{ fontSize: "18px" }}>📱</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: "12px", color: "#065f46", fontWeight: "600" }}>
                                                    SMS Gateway: Verification OTP
                                                </div>
                                                <div style={{ fontSize: "12px", color: "#047857" }}>
                                                    Your verification code is:{" "}
                                                    <b style={{ fontSize: "15px", letterSpacing: "2px", color: "#065f46" }}>
                                                        {devOtpNotification}
                                                    </b>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* OTP Input section */}
                                    {otpSent && !otpVerified && (
                                        <div style={{ marginTop: "12px" }}>
                                            <label htmlFor="register-otp" style={{ fontSize: "12.5px", color: "#475569" }}>
                                                Enter 6-Digit Verification Code
                                            </label>
                                            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                                <input
                                                    id="register-otp"
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="e.g. 123456"
                                                    maxLength={6}
                                                    value={otpCode}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                                                        setOtpCode(val);
                                                    }}
                                                    style={{
                                                        letterSpacing: "4px",
                                                        fontWeight: "700",
                                                        fontSize: "16px",
                                                        textAlign: "center",
                                                        flex: 1,
                                                    }}
                                                    autoFocus
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleVerifyOtp}
                                                    disabled={otpCode.length !== 6 || otpLoading}
                                                    style={{
                                                        padding: "0 18px",
                                                        borderRadius: "10px",
                                                        border: "none",
                                                        background: otpCode.length === 6 ? "#16a34a" : "#cbd5e1",
                                                        color: "#ffffff",
                                                        fontWeight: "700",
                                                        fontSize: "13px",
                                                        cursor: otpCode.length === 6 ? "pointer" : "not-allowed",
                                                        transition: "all 0.2s ease",
                                                    }}
                                                >
                                                    {otpLoading ? "Verifying..." : "Verify OTP ✓"}
                                                </button>
                                            </div>
                                            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                                                Code valid for 5 minutes. One mobile number can only be used by one customer.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Business Name and Location (For Manager) */}
                            {role === "manager" && (
                                <>
                                    <label htmlFor="register-business">Service Center / Business name</label>
                                    <input
                                        id="register-business"
                                        type="text"
                                        placeholder="e.g. City Health Clinic or Downtown Bank"
                                        value={businessName}
                                        onChange={(e) => setBusinessName(e.target.value)}
                                        required
                                    />

                                    <label htmlFor="register-address">Center Location / Street Address</label>
                                    <input
                                        id="register-address"
                                        type="text"
                                        placeholder="e.g. 14 MG Road, Near Metro Station"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                    />

                                    <label htmlFor="register-city">City / State</label>
                                    <input
                                        id="register-city"
                                        type="text"
                                        placeholder="e.g. New Delhi"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                    />
                                </>
                            )}

                            {/* Staff Unique Invite Code (For Staff) */}
                            {role === "staff" && (
                                <>
                                    <label htmlFor="register-invite">Unique Staff Invite Code</label>
                                    <input
                                        id="register-invite"
                                        type="text"
                                        placeholder="e.g. QL-A9K3P2"
                                        style={{ letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                        required
                                    />
                                    <span style={{ fontSize: "11px", color: "#64748b", marginTop: "-6px", marginBottom: "14px", display: "block" }}>
                                        Provided by your Service Provider Head when assigning you to a counter.
                                    </span>
                                </>
                            )}

                            {/* Password */}
                            <label htmlFor="register-password">Create password</label>
                            <div className="password-wrap">
                                <input
                                    id="register-password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                    minLength={8}
                                    maxLength={72}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+"
                                    title="Password must contain an uppercase letter, lowercase letter, number, and special character."
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

                            <p className="auth-password-hint">
                                At least 8 characters, with uppercase, lowercase, number, and special character.
                            </p>

                            {message && (
                                <p
                                    role="status"
                                    style={{
                                        color: isError ? "#dc2626" : "#15803d",
                                        background: isError ? "#fef2f2" : "#f0fdf4",
                                        border: `1px solid ${isError ? "#fecaca" : "#bbf7d0"}`,
                                        padding: "10px 14px",
                                        borderRadius: "8px",
                                        fontSize: "13px",
                                        marginBottom: "16px",
                                    }}
                                >
                                    {message}
                                </p>
                            )}

                            <button
                                className="auth-primary-btn"
                                type="submit"
                                disabled={loading || (role === "customer" && !otpVerified)}
                                style={{
                                    opacity: role === "customer" && !otpVerified ? 0.7 : 1,
                                    cursor: role === "customer" && !otpVerified ? "not-allowed" : "pointer",
                                }}
                            >
                                {loading
                                    ? "Creating account..."
                                    : role === "customer"
                                        ? (otpVerified ? "Register as Customer" : "Verify Mobile OTP to Continue")
                                        : role === "manager"
                                            ? "Register as Service Provider Head"
                                            : "Register as Counter Staff"}
                                {!loading && <span> →</span>}
                            </button>
                        </form>

                        <div className="auth-divider">
                            <span>ALREADY HAVE AN ACCOUNT?</span>
                        </div>

                        <Link className="auth-secondary-btn" to="/login">
                            Log in instead <span>↗</span>
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

export default Register;
