import QueueActivityChart from "./components/queueActivityChart";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { playChime } from "../utils/audioChime";
import "./dashboard.css";

function Dashboard() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeNav, setActiveNav] = useState("Overview");
    const [theme, setTheme] = useState(() => localStorage.getItem("queueless-theme") || "light");
    const navigate = useNavigate();

    // Queues and Stats
    const [queueData, setQueueData] = useState([]);
    const [stats, setStats] = useState({
        totalCustomers: 0,
        waiting: 0,
        serving: 0,
        completed: 0,
        cancelled: 0,
        averageWaitTime: 0,
    });
    const [allTimeStats, setAllTimeStats] = useState({
        totalCustomers: 0,
        waiting: 0,
        serving: 0,
        completed: 0,
        cancelled: 0,
        averageWaitTime: 0,
    });

    const [queueLoading, setQueueLoading] = useState(true);
    const [queueError, setQueueError] = useState("");
    const [queueStatusFilter, setQueueStatusFilter] = useState("all");

    // Add customer walk-in modal
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [serviceName, setServiceName] = useState("");
    const [addingCustomer, setAddingCustomer] = useState(false);

    // Services state
    const [services, setServices] = useState([]);
    const [newServiceName, setNewServiceName] = useState("");
    const [serviceLoading, setServiceLoading] = useState(false);
    const [serviceMessage, setServiceMessage] = useState("");

    // Customers search & pagination
    const [customerSearch, setCustomerSearch] = useState("");

    // Staff Management state
    const [staffList, setStaffList] = useState([]);
    const [pendingInvites, setPendingInvites] = useState([]);
    const [inviteStaffName, setInviteStaffName] = useState("");
    const [inviteStaffEmail, setInviteStaffEmail] = useState("");
    const [inviteServiceName, setInviteServiceName] = useState("");
    const [inviteCounter, setInviteCounter] = useState("Counter 1");
    const [staffLoading, setStaffLoading] = useState(false);
    const [staffMessage, setStaffMessage] = useState("");
    const [lastGeneratedCode, setLastGeneratedCode] = useState("");
    const [callingNextLoading, setCallingNextLoading] = useState(false);

    useEffect(() => {
        localStorage.setItem("queueless-theme", theme);
    }, [theme]);

    async function fetchQueue() {
        try {
            setQueueError("");
            const response = await fetch("http://localhost:5000/api/queue", {
                credentials: "include",
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to load queue");
            }
            setQueueData(data.queues || []);
        } catch (err) {
            setQueueError(err.message || "Unable to load queue");
        } finally {
            setQueueLoading(false);
        }
    }

    async function fetchStats() {
        try {
            const response = await fetch("http://localhost:5000/api/queue/stats", {
                credentials: "include",
            });
            const data = await response.json();
            if (response.ok) {
                if (data.stats) setStats(data.stats);
                if (data.allTimeStats) setAllTimeStats(data.allTimeStats);
            }
        } catch (err) {
            console.error("Stats error:", err.message);
        }
    }

    async function fetchServices() {
        try {
            const response = await fetch("http://localhost:5000/api/services", {
                credentials: "include",
            });
            const data = await response.json();
            if (response.ok) {
                const serviceNames = (data.services || []).map((service) => service.name);
                setServices(serviceNames);
                setServiceName((current) => serviceNames.includes(current) ? current : (serviceNames[0] || ""));
                setInviteServiceName((current) => serviceNames.includes(current) ? current : (serviceNames[0] || ""));
            }
        } catch (err) {
            console.error("Fetch services error:", err.message);
        }
    }

    async function fetchStaff() {
        try {
            const response = await fetch("http://localhost:5000/api/staff", {
                credentials: "include",
            });
            const data = await response.json();
            if (response.ok) {
                setStaffList(data.staff || []);
                setPendingInvites(data.pendingInvites || []);
            }
        } catch (err) {
            console.error("Fetch staff error:", err);
        }
    }

    // Authenticate manager
    useEffect(() => {
        async function fetchUser() {
            try {
                const response = await fetch("http://localhost:5000/api/auth/me", {
                    credentials: "include",
                });
                const data = await response.json();
                if (!response.ok) {
                    navigate("/login", { replace: true });
                    return;
                }
                if (data.user?.role !== "manager") {
                    if (data.user?.role === "staff") {
                        navigate("/staff-portal", { replace: true });
                    } else {
                        navigate("/customer", { replace: true });
                    }
                    return;
                }
                setUser(data.user);
            } catch {
                setError("Unable to connect to the server.");
            } finally {
                setLoading(false);
            }
        }
        fetchUser();
    }, [navigate]);

    // Initial load + Real-time auto-refresh polling every 8s
    useEffect(() => {
        if (!user) return;
        fetchQueue();
        fetchStats();
        fetchServices();
        fetchStaff();

        const interval = setInterval(() => {
            fetchQueue();
            fetchStats();
            fetchStaff();
        }, 8000);

        return () => clearInterval(interval);
    }, [user]);

    // Add Service
    async function handleAddService(event) {
        event.preventDefault();
        const name = newServiceName.trim();
        if (!name) return;
        setServiceLoading(true);
        setServiceMessage("");
        try {
            const response = await fetch("http://localhost:5000/api/services", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to add service");
            setNewServiceName("");
            setServiceMessage("Service added successfully!");
            await fetchServices();
        } catch (err) {
            setServiceMessage(err.message || "Unable to add service");
        } finally {
            setServiceLoading(false);
        }
    }

    // Delete Service
    async function handleDeleteService(name) {
        if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
        try {
            const response = await fetch("http://localhost:5000/api/services", {
                credentials: "include",
            });
            const data = await response.json();
            const service = (data.services || []).find((item) => item.name === name);
            if (!service) throw new Error("Service not found");

            const deleteResponse = await fetch(`http://localhost:5000/api/services/${service._id}`, {
                method: "DELETE",
                credentials: "include",
            });
            const deleteData = await deleteResponse.json();
            if (!deleteResponse.ok) throw new Error(deleteData.message || "Failed to delete service");
            setServiceMessage("Service deleted successfully!");
            await fetchServices();
        } catch (err) {
            setServiceMessage(err.message || "Unable to delete service");
        }
    }

    // Add Customer Token
    async function handleAddCustomer(event) {
        event.preventDefault();
        if (!customerName.trim() || !serviceName.trim()) return;
        setAddingCustomer(true);
        setQueueError("");
        try {
            const response = await fetch("http://localhost:5000/api/queue", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName: customerName.trim(),
                    customerPhone: customerPhone.trim(),
                    serviceName,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to add customer");
            setCustomerName("");
            setCustomerPhone("");
            setShowAddCustomer(false);
            await fetchQueue();
            await fetchStats();
        } catch (err) {
            setQueueError(err.message || "Unable to add customer");
        } finally {
            setAddingCustomer(false);
        }
    }

    // Status Change
    async function handleStatusChange(id, status) {
        try {
            const response = await fetch(`http://localhost:5000/api/queue/${id}/status`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Failed to update status");
            await fetchQueue();
            await fetchStats();
        } catch (err) {
            setQueueError(err.message || "Unable to update status");
        }
    }

    // Call Next Customer (with chime sound!)
    async function handleCallNext(selectedService) {
        const srv = selectedService || serviceName || services[0];
        if (!srv) {
            alert("Please create or select a service first.");
            return;
        }
        setCallingNextLoading(true);
        try {
            const res = await fetch("http://localhost:5000/api/queue/call-next", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serviceName: srv }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.message || "No waiting customers in this queue.");
                return;
            }
            playChime();
            await fetchQueue();
            await fetchStats();
        } catch (err) {
            alert("Failed to call next customer.");
        } finally {
            setCallingNextLoading(false);
        }
    }

    // Generate Staff Invite Code
    async function handleGenerateStaffInvite(e) {
        e.preventDefault();
        if (!inviteServiceName) {
            alert("Please select an assigned service for this staff member.");
            return;
        }
        setStaffLoading(true);
        setStaffMessage("");
        try {
            const res = await fetch("http://localhost:5000/api/staff/invite", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    staffName: inviteStaffName.trim(),
                    staffEmail: inviteStaffEmail.trim(),
                    serviceName: inviteServiceName,
                    counterNumber: inviteCounter.trim() || "Counter 1",
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to generate invite.");
            setLastGeneratedCode(data.invite.code);
            setStaffMessage(data.message);
            setInviteStaffName("");
            setInviteStaffEmail("");
            await fetchStaff();
        } catch (err) {
            setStaffMessage(err.message);
        } finally {
            setStaffLoading(false);
        }
    }

    // Revoke Pending Invite
    async function handleRevokeInvite(id) {
        if (!window.confirm("Are you sure you want to revoke this staff invite code?")) return;
        try {
            const res = await fetch(`http://localhost:5000/api/staff/invite/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) await fetchStaff();
        } catch (err) {
            console.error(err);
        }
    }

    // Remove Staff Member
    async function handleRemoveStaff(id, name) {
        if (!window.confirm(`Are you sure you want to remove staff member "${name}"?`)) return;
        try {
            const res = await fetch(`http://localhost:5000/api/staff/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) await fetchStaff();
        } catch (err) {
            console.error(err);
        }
    }

    async function handleLogout() {
        try {
            await fetch("http://localhost:5000/api/auth/logout", {
                method: "POST",
                credentials: "include",
            });
            navigate("/login", { replace: true });
        } catch {
            setError("Unable to log out.");
        }
    }

    if (loading) {
        return (
            <main className="qd-state">
                <div className="qd-loader" />
                <p>Preparing Service Provider Workspace...</p>
            </main>
        );
    }

    if (error || !user) {
        return (
            <main className="qd-state">
                <div className="qd-state-card">
                    <h2>{error || "Unable to load your account."}</h2>
                    <button onClick={() => navigate("/login")}>Go to login</button>
                </div>
            </main>
        );
    }

    const displayName = user.businessName || user.name || "Provider Head";

    // Date calculations (IST)
    const istDateFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const todayIST = istDateFormatter.format(new Date());

    const todayQueueData = queueData.filter((item) => {
        if (!item.createdAt) return false;
        return istDateFormatter.format(new Date(item.createdAt)) === todayIST;
    });

    const filteredCustomers = queueData.filter((item) => {
        const matchesSearch = item.customerName?.toLowerCase().includes(customerSearch.trim().toLowerCase()) ||
            item.serviceName?.toLowerCase().includes(customerSearch.trim().toLowerCase());
        const matchesStatus = queueStatusFilter === "all" || item.status === queueStatusFilter;
        return matchesSearch && matchesStatus;
    });

    const serviceNamesForToday = [
        ...services,
        ...new Set(todayQueueData.map((item) => item.serviceName).filter((name) => name && !services.includes(name))),
    ];

    const serviceBreakdown = serviceNamesForToday.map((service) => ({
        name: service,
        count: todayQueueData.filter((item) => item.serviceName === service).length,
    }));

    const chartColors = [
        "#786cf6", "#5fa9f2", "#f3b65e", "#10b981", "#f43f5e",
        "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#8b5cf6",
    ];

    const totalServiceCustomers = serviceBreakdown.reduce((total, srv) => total + srv.count, 0);

    let currentPercentage = 0;
    const donutSegments = serviceBreakdown
        .map((service, index) => ({ ...service, index }))
        .filter((service) => service.count > 0)
        .map((service) => {
            const start = currentPercentage;
            currentPercentage += (service.count / totalServiceCustomers) * 100;
            return `${chartColors[service.index % chartColors.length]} ${start}% ${currentPercentage}%`;
        });

    const donutGradient = totalServiceCustomers === 0 ? "#e9edf4" : `conic-gradient(${donutSegments.join(", ")})`;

    const recentActivity = [...todayQueueData].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    ).slice(0, 5);

    const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

    const navItems = [
        { label: "Overview", icon: "◫" },
        { label: "Live Queue", icon: "≋" },
        { label: "Staff & Counters", icon: "🧑‍💼" },
        { label: "Customers", icon: "♙" },
        { label: "Services", icon: "▦" },
    ];

    return (
        <div className={`qd-app ${theme === "dark" ? "qd-dark" : ""}`}>
            {/* Sidebar */}
            <aside className="qd-sidebar">
                <button className="qd-brand" onClick={() => setActiveNav("Overview")}>
                    <span className="qd-brand-mark">Q</span>
                    <span>Queue<span className="qd-brand-light">Less</span></span>
                </button>

                <div className="qd-workspace-label">WORKSPACE</div>

                <nav className="qd-nav">
                    {navItems.map((item) => (
                        <button
                            key={item.label}
                            className={`qd-nav-item ${activeNav === item.label ? "active" : ""}`}
                            onClick={() => setActiveNav(item.label)}
                        >
                            <span className="qd-nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                            {item.label === "Live Queue" && stats.waiting > 0 && <span className="qd-live-dot" />}
                        </button>
                    ))}
                </nav>

                <div className="qd-sidebar-bottom">
                    <button className="qd-nav-item" onClick={handleLogout}>
                        <span className="qd-nav-icon">🚪</span>
                        Log out
                    </button>

                    <div className="qd-sidebar-user">
                        <div className="qd-avatar">{initials}</div>
                        <div className="qd-user-info">
                            <strong>{displayName}</strong>
                            <small>Service Provider Head</small>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <main className="qd-main">
                <header className="qd-topbar">
                    <div>
                        <div className="qd-breadcrumb">Workspace <span>/</span> {activeNav}</div>
                        <div className="qd-page-title">{activeNav}</div>
                    </div>

                    <div className="qd-topbar-actions">
                        <div className="qd-status-pill"><span /> System Active</div>
                        <button
                            className="qd-icon-button qd-theme-toggle"
                            onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
                            title="Toggle theme"
                        >
                            {theme === "dark" ? "☀" : "☾"}
                        </button>
                        <div className="qd-top-avatar">{initials}</div>
                    </div>
                </header>

                <div className="qd-content">
                    {/* Welcome Banner */}
                    <section className="qd-welcome-row">
                        <div>
                            <p className="qd-eyebrow">SERVICE PROVIDER HEAD PORTAL</p>
                            <h1>{displayName} <span>✦</span></h1>
                            <p className="qd-subtitle">Oversee counters, staff members, and live customer flow.</p>
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                className="qd-outline-button"
                                style={{ background: "#786cf6", color: "white", borderColor: "#786cf6" }}
                                onClick={() => handleCallNext()}
                                disabled={callingNextLoading || stats.waiting === 0}
                            >
                                ⚡ Call Next Customer
                            </button>
                            <button
                                className="qd-outline-button"
                                onClick={() => setShowAddCustomer(true)}
                            >
                                + Generate Token
                            </button>
                        </div>
                    </section>

                    {/* Add Customer Walk-in Modal */}
                    {showAddCustomer && (
                        <div className="qd-add-customer-form" style={{ marginBottom: "24px" }}>
                            <h3>Generate Token for Walk-in Customer</h3>
                            <form onSubmit={handleAddCustomer} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                <input
                                    type="text"
                                    placeholder="Customer name"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required
                                />
                                <input
                                    type="tel"
                                    placeholder="Phone (optional)"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                />
                                <select
                                    value={serviceName}
                                    onChange={(e) => setServiceName(e.target.value)}
                                    required
                                    disabled={services.length === 0}
                                >
                                    <option value="" disabled>Select service</option>
                                    {services.map((srv) => (
                                        <option key={srv} value={srv}>{srv}</option>
                                    ))}
                                </select>
                                <button type="submit" disabled={addingCustomer || services.length === 0}>
                                    {addingCustomer ? "Generating..." : "Issue Token"}
                                </button>
                                <button type="button" onClick={() => setShowAddCustomer(false)}>
                                    Cancel
                                </button>
                            </form>
                        </div>
                    )}

                    {/* ================= VIEW 1: OVERVIEW ================= */}
                    {activeNav === "Overview" && (
                        <>
                            {/* KPI Cards */}
                            <section className="qd-stats-grid">
                                <article className="qd-stat-card">
                                    <div className="qd-stat-top">
                                        <span>Customers Today</span>
                                        <span className="qd-stat-icon purple">♙</span>
                                    </div>
                                    <div className="qd-stat-number">{stats.totalCustomers}</div>
                                    <div className="qd-stat-foot"><span>Tokens issued today</span></div>
                                </article>

                                <article className="qd-stat-card">
                                    <div className="qd-stat-top">
                                        <span>Currently Waiting</span>
                                        <span className="qd-stat-icon orange">◷</span>
                                    </div>
                                    <div className="qd-stat-number">{stats.waiting}</div>
                                    <div className="qd-stat-foot"><span>Awaiting their turn</span></div>
                                </article>

                                <article className="qd-stat-card">
                                    <div className="qd-stat-top">
                                        <span>Average Wait</span>
                                        <span className="qd-stat-icon blue">◴</span>
                                    </div>
                                    <div className="qd-stat-number">{stats.averageWaitTime} <small>min</small></div>
                                    <div className="qd-stat-foot"><span>Estimated active wait</span></div>
                                </article>

                                <article className="qd-stat-card">
                                    <div className="qd-stat-top">
                                        <span>Active Staff</span>
                                        <span className="qd-stat-icon green">🧑‍💼</span>
                                    </div>
                                    <div className="qd-stat-number">{staffList.length}</div>
                                    <div className="qd-stat-foot"><span>Counters operational</span></div>
                                </article>
                            </section>

                            {/* Charts */}
                            <section className="qd-analytics-grid">
                                <article className="qd-panel qd-chart-panel">
                                    <div className="qd-panel-heading">
                                        <div>
                                            <h2>Queue Activity by Service</h2>
                                            <p>Traffic distribution across counters</p>
                                        </div>
                                    </div>
                                    <QueueActivityChart data={serviceBreakdown} />
                                </article>

                                <article className="qd-panel qd-service-panel">
                                    <div className="qd-panel-heading">
                                        <div>
                                            <h2>Service Breakdown</h2>
                                            <p>Volume per service category</p>
                                        </div>
                                    </div>

                                    <div className="qd-donut-wrap">
                                        <div className="qd-donut" style={{ background: donutGradient }}>
                                            <div>
                                                <strong>{totalServiceCustomers}</strong>
                                                <span>Total visits</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="qd-service-legend">
                                        {serviceBreakdown.length === 0 ? (
                                            <p>No services added yet.</p>
                                        ) : (
                                            serviceBreakdown.map((service, index) => (
                                                <div key={service.name}>
                                                    <span className="legend-dot" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                                                    {service.name}
                                                    <strong>{service.count}</strong>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </article>
                            </section>

                            {/* Recent Activity */}
                            <section className="qd-panel qd-activity-panel">
                                <div className="qd-panel-heading">
                                    <div>
                                        <h2>Recent Updates</h2>
                                        <p>Real-time queue transactions today</p>
                                    </div>
                                </div>

                                <div className="qd-activity-list">
                                    {recentActivity.length === 0 ? (
                                        <p>No transactions yet. Generate a token or invite staff to get started.</p>
                                    ) : (
                                        recentActivity.map((item) => (
                                            <div className="qd-activity-item" key={item._id}>
                                                <span className={`qd-activity-icon ${item.status === "completed" ? "green" : item.status === "cancelled" ? "orange" : "purple"}`}>
                                                    {item.status === "completed" ? "✓" : item.status === "cancelled" ? "✕" : "⚡"}
                                                </span>
                                                <div>
                                                    <strong>
                                                        Token {item.serviceName?.slice(0, 1).toUpperCase()}-{String(item.tokenNumber).padStart(3, "0")} is {item.status}
                                                    </strong>
                                                    <p>{item.customerName} · {item.serviceName} {item.counterNumber ? `· ${item.counterNumber}` : ""}</p>
                                                </div>
                                                <span className="qd-activity-time">
                                                    {new Date(item.updatedAt || item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </>
                    )}

                    {/* ================= VIEW 2: LIVE QUEUE ================= */}
                    {activeNav === "Live Queue" && (
                        <section className="qd-panel qd-queue-panel">
                            <div className="qd-panel-heading">
                                <div>
                                    <div className="qd-heading-with-live">
                                        <h2>Live Queue Control Board</h2>
                                        <span className="qd-live-badge"><i /> LIVE</span>
                                    </div>
                                    <p>Real-time customer status at all service counters</p>
                                </div>

                                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                    <button
                                        className="qd-outline-button"
                                        style={{ background: "#786cf6", color: "white" }}
                                        onClick={() => handleCallNext()}
                                        disabled={callingNextLoading || stats.waiting === 0}
                                    >
                                        ⚡ Call Next Customer
                                    </button>
                                    <button
                                        className="qd-outline-button"
                                        onClick={() => { fetchQueue(); fetchStats(); }}
                                    >
                                        ↻ Refresh Queue
                                    </button>
                                </div>
                            </div>

                            {/* Status Filter Buttons */}
                            <div style={{ display: "flex", gap: "8px", margin: "16px 0", flexWrap: "wrap" }}>
                                {["all", "waiting", "serving", "completed", "cancelled"].map((st) => (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => setQueueStatusFilter(st)}
                                        style={{
                                            padding: "6px 14px",
                                            borderRadius: "20px",
                                            border: "1px solid #e2e8f0",
                                            background: queueStatusFilter === st ? "#786cf6" : "#f1f5f9",
                                            color: queueStatusFilter === st ? "white" : "#475569",
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            textTransform: "capitalize",
                                        }}
                                    >
                                        {st} ({st === "all" ? queueData.length : queueData.filter((q) => q.status === st).length})
                                    </button>
                                ))}
                            </div>

                            <div className="qd-customer-search">
                                <input
                                    type="search"
                                    placeholder="Search customer or service..."
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                />
                            </div>

                            <div className="qd-table-wrap">
                                <table className="qd-table">
                                    <thead>
                                        <tr>
                                            <th>Token</th>
                                            <th>Customer</th>
                                            <th>Service</th>
                                            <th>Counter</th>
                                            <th>Wait Time</th>
                                            <th>Status & Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {queueLoading ? (
                                            <tr><td colSpan="6">Loading live queue...</td></tr>
                                        ) : filteredCustomers.length === 0 ? (
                                            <tr><td colSpan="6">No queue entries matching filter.</td></tr>
                                        ) : (
                                            filteredCustomers.map((item) => (
                                                <tr key={item._id}>
                                                    <td>
                                                        <span className="qd-token">
                                                            {item.serviceName.slice(0, 1).toUpperCase()}-{String(item.tokenNumber).padStart(3, "0")}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="qd-customer">
                                                            <strong>{item.customerName}</strong>
                                                            {item.customerPhone && <small style={{ color: "#64748b" }}> ({item.customerPhone})</small>}
                                                        </div>
                                                    </td>
                                                    <td>{item.serviceName}</td>
                                                    <td>{item.counterNumber || "-"}</td>
                                                    <td>{item.estimatedWaitMinutes} min</td>
                                                    <td>
                                                        <span className={`qd-queue-status ${item.status}`}>
                                                            <i /> {item.status.toUpperCase()}
                                                        </span>

                                                        <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                                                            {item.status === "waiting" && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStatusChange(item._id, "serving")}
                                                                >
                                                                    Serve
                                                                </button>
                                                            )}
                                                            {item.status === "serving" && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStatusChange(item._id, "completed")}
                                                                >
                                                                    ✓ Done
                                                                </button>
                                                            )}
                                                            {(item.status === "waiting" || item.status === "serving") && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStatusChange(item._id, "cancelled")}
                                                                >
                                                                    ✕ Cancel
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* ================= VIEW 3: STAFF & COUNTERS ================= */}
                    {activeNav === "Staff & Counters" && (
                        <section className="qd-panel">
                            <div className="qd-panel-heading">
                                <div>
                                    <h2>Staff & Counter Management</h2>
                                    <p>Assign service staff members to counters using unique invite codes</p>
                                </div>
                            </div>

                            {/* Staff Invite Generator Form */}
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", marginBottom: "28px" }}>
                                <h3 style={{ margin: "0 0 12px", fontSize: "16px" }}>Invite & Assign Staff Member</h3>
                                {staffMessage && (
                                    <p style={{ color: staffMessage.includes("success") ? "#15803d" : "#dc2626", fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>
                                        {staffMessage}
                                    </p>
                                )}
                                <form onSubmit={handleGenerateStaffInvite} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                                    <div>
                                        <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Staff Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Rahul Sharma"
                                            value={inviteStaffName}
                                            onChange={(e) => setInviteStaffName(e.target.value)}
                                            style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Staff Email</label>
                                        <input
                                            type="email"
                                            placeholder="staff@example.com"
                                            value={inviteStaffEmail}
                                            onChange={(e) => setInviteStaffEmail(e.target.value)}
                                            style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Assigned Service</label>
                                        <select
                                            value={inviteServiceName}
                                            onChange={(e) => setInviteServiceName(e.target.value)}
                                            style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                                            required
                                            disabled={services.length === 0}
                                        >
                                            <option value="" disabled>Select service</option>
                                            {services.map((srv) => (
                                                <option key={srv} value={srv}>{srv}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>Counter Station</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Counter 1"
                                            value={inviteCounter}
                                            onChange={(e) => setInviteCounter(e.target.value)}
                                            style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                                            required
                                        />
                                    </div>

                                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                                        <button
                                            type="submit"
                                            style={{ width: "100%", height: "38px", background: "#786cf6", color: "white", border: "none", borderRadius: "8px", fontWeight: 700 }}
                                            disabled={staffLoading || services.length === 0}
                                        >
                                            {staffLoading ? "Generating..." : "Generate Staff Code"}
                                        </button>
                                    </div>
                                </form>

                                {lastGeneratedCode && (
                                    <div style={{ marginTop: "16px", background: "#f0fdf4", border: "1px solid #86efac", padding: "14px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div>
                                            <strong style={{ color: "#15803d", display: "block" }}>UNIQUE STAFF INVITE CODE GENERATED:</strong>
                                            <span style={{ fontSize: "24px", fontWeight: 900, color: "#166534", letterSpacing: "2px" }}>{lastGeneratedCode}</span>
                                            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#15803d" }}>
                                                Share this code with your staff member. They will enter this code on the registration page to register as Counter Staff.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(lastGeneratedCode);
                                                alert(`Code ${lastGeneratedCode} copied to clipboard!`);
                                            }}
                                            style={{ background: "#15803d", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
                                        >
                                            Copy Code
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Active Staff List */}
                            <h3 style={{ fontSize: "18px", marginBottom: "12px" }}>Active Staff Members ({staffList.length})</h3>
                            <div className="qd-table-wrap" style={{ marginBottom: "28px" }}>
                                <table className="qd-table">
                                    <thead>
                                        <tr>
                                            <th>Staff Member</th>
                                            <th>Email</th>
                                            <th>Assigned Service</th>
                                            <th>Counter</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffList.length === 0 ? (
                                            <tr><td colSpan="5">No registered staff members yet. Generate an invite code above.</td></tr>
                                        ) : (
                                            staffList.map((st) => (
                                                <tr key={st._id}>
                                                    <td><strong>{st.name}</strong></td>
                                                    <td>{st.email}</td>
                                                    <td><span className="qd-token" style={{ background: "#ede9fe", color: "#6d28d9" }}>{st.assignedService}</span></td>
                                                    <td>{st.counterNumber || "Counter 1"}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                                                            onClick={() => handleRemoveStaff(st._id, st.name)}
                                                        >
                                                            Remove Staff
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pending Unused Invites */}
                            {pendingInvites.length > 0 && (
                                <>
                                    <h3 style={{ fontSize: "18px", marginBottom: "12px" }}>Pending Invite Codes ({pendingInvites.length})</h3>
                                    <div className="qd-table-wrap">
                                        <table className="qd-table">
                                            <thead>
                                                <tr>
                                                    <th>Invite Code</th>
                                                    <th>Staff Name / Email</th>
                                                    <th>Assigned Service</th>
                                                    <th>Counter</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pendingInvites.map((inv) => (
                                                    <tr key={inv._id}>
                                                        <td>
                                                            <strong style={{ letterSpacing: "1px", color: "#2563eb" }}>{inv.code}</strong>
                                                        </td>
                                                        <td>{inv.staffName || inv.staffEmail || "Unassigned"}</td>
                                                        <td>{inv.serviceName}</td>
                                                        <td>{inv.counterNumber}</td>
                                                        <td>
                                                            <button
                                                                type="button"
                                                                style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                                                                onClick={() => handleRevokeInvite(inv._id)}
                                                            >
                                                                Revoke Code
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </section>
                    )}

                    {/* ================= VIEW 4: CUSTOMERS DIRECTORY ================= */}
                    {activeNav === "Customers" && (
                        <section className="qd-panel">
                            <div className="qd-panel-heading">
                                <div>
                                    <h2>Customer Directory & History</h2>
                                    <p>Comprehensive record of all customers who queued at your service centre</p>
                                </div>
                            </div>

                            <div className="qd-customer-search">
                                <input
                                    type="search"
                                    placeholder="Search by customer name or phone..."
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                />
                            </div>

                            <div className="qd-table-wrap">
                                <table className="qd-table">
                                    <thead>
                                        <tr>
                                            <th>Token</th>
                                            <th>Customer Name</th>
                                            <th>Phone</th>
                                            <th>Service</th>
                                            <th>Issued At</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCustomers.length === 0 ? (
                                            <tr><td colSpan="6">No customers found.</td></tr>
                                        ) : (
                                            filteredCustomers.map((item) => (
                                                <tr key={item._id}>
                                                    <td>
                                                        <span className="qd-token">
                                                            {item.serviceName.slice(0, 1).toUpperCase()}-{String(item.tokenNumber).padStart(3, "0")}
                                                        </span>
                                                    </td>
                                                    <td><strong>{item.customerName}</strong></td>
                                                    <td>{item.customerPhone || "-"}</td>
                                                    <td>{item.serviceName}</td>
                                                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                                                    <td>
                                                        <span className={`qd-queue-status ${item.status}`}>
                                                            {item.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* ================= VIEW 5: SERVICES MANAGEMENT ================= */}
                    {activeNav === "Services" && (
                        <section className="qd-panel">
                            <div className="qd-panel-heading">
                                <div>
                                    <h2>Service Categories & Desks</h2>
                                    <p>Configure which services are available for queue booking</p>
                                </div>
                            </div>

                            <form className="qd-add-customer-form" onSubmit={handleAddService} style={{ marginBottom: "24px" }}>
                                <input
                                    type="text"
                                    value={newServiceName}
                                    onChange={(e) => setNewServiceName(e.target.value)}
                                    placeholder="Enter new service name (e.g. Account Opening, Cash Deposit)"
                                    maxLength={100}
                                    required
                                />
                                <button type="submit" disabled={serviceLoading}>
                                    {serviceLoading ? "Adding..." : "+ Add Service"}
                                </button>
                            </form>

                            {serviceMessage && (
                                <p style={{ color: serviceMessage.includes("success") ? "#15803d" : "#dc2626", marginBottom: "16px" }}>
                                    {serviceMessage}
                                </p>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                                {services.map((srv) => {
                                    const waitingCount = todayQueueData.filter((q) => q.serviceName === srv && q.status === "waiting").length;
                                    const totalCount = todayQueueData.filter((q) => q.serviceName === srv).length;
                                    return (
                                        <div key={srv} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px", display: "flex", flexDirection: "column" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                                                <h3 style={{ margin: 0, fontSize: "16px", color: "#1e293b" }}>{srv}</h3>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteService(srv)}
                                                    style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                            <div style={{ display: "flex", gap: "12px", marginTop: "auto", fontSize: "13px", color: "#64748b" }}>
                                                <span>⏳ <b>{waitingCount}</b> waiting</span>
                                                <span>📊 <b>{totalCount}</b> visits today</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    <footer className="qd-footer">
                        <span>© 2026 QueueLess · Less waiting. More living.</span>
                    </footer>
                </div>
            </main>
        </div>
    );
}

export default Dashboard;
