import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {
    const navigate = useNavigate();
    const [role, setRole] = useState("manager"); // "manager", "staff"
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleRegister(e) {
        e.preventDefault();
        setMessage("");
        setIsError(false);
        setLoading(true);

        try {
            const payload = {
                name,
                email,
                password,
                role,
                phone: phone.trim(),
            };

            if (role === "manager") {
                payload.businessName = businessName.trim();
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
                            {role === "manager" && (
                                <>Get ahead <br />of the <span>queue.</span></>
                            )}
                            {role === "staff" && (
                                <>Serve faster. <br />Manage your <span>counter.</span></>
                            )}
                        </h2>

                        <p>
                            {role === "manager" && "Register your service center, create departments, invite staff members, and automate queues with QueueCopilot AI."}
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

                        {/* Role Selector Tabs */}
                        {/* Customer Quick Access Banner */}
                        <div
                            style={{
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                borderRadius: "12px",
                                padding: "14px 16px",
                                marginBottom: "20px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "12px",
                                flexWrap: "wrap",
                            }}
                        >
                            <div style={{ flex: 1, minWidth: "220px" }}>
                                <strong style={{ display: "block", color: "#166534", fontSize: "13.5px", marginBottom: "2px" }}>
                                    🎟️ Are you a Customer waiting for service?
                                </strong>
                                <span style={{ fontSize: "12px", color: "#15803d", lineHeight: "1.4" }}>
                                    Customers don't need an account! Access your live queue directly using your Token Number & Phone OTP.
                                </span>
                            </div>
                            <Link
                                to="/customer"
                                style={{
                                    background: "#16a34a",
                                    color: "#ffffff",
                                    padding: "8px 14px",
                                    borderRadius: "8px",
                                    fontSize: "12.5px",
                                    fontWeight: "700",
                                    textDecoration: "none",
                                    whiteSpace: "nowrap",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                }}
                            >
                                Track Live Token ↗
                            </Link>
                        </div>

                        {/* Role Selector Tabs (Provider & Staff only) */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 1fr)",
                                gap: "8px",
                                background: "#f1f5f9",
                                padding: "6px",
                                borderRadius: "12px",
                                marginBottom: "22px",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => { setRole("manager"); setMessage(""); }}
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
                                onClick={() => { setRole("staff"); setMessage(""); }}
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

                            {/* Phone (Optional for customers) */}
                            {role === "customer" && (
                                <>
                                    <label htmlFor="register-phone">Phone number (optional)</label>
                                    <input
                                        id="register-phone"
                                        type="tel"
                                        placeholder="e.g. +91 98765 43210"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                    />
                                </>
                            )}

                            {/* Business Name (For Manager) */}
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
                                disabled={loading}
                            >
                                {loading
                                    ? "Creating account..."
                                    : role === "customer"
                                        ? "Register as Customer"
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
