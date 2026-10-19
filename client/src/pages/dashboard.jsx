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
    const [timeRange, setTimeRange] = useState("today"); // "today" | "all"
    const [theme, setTheme] = useState(() => localStorage.getItem("queueless-theme") || "dark");
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
    const [queueStatusFilter, setQueueStatusFilter] = useState("all");
    const [selectedServiceFilter, setSelectedServiceFilter] = useState("all");

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

    // Customers search
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
    const [seedingLoading, setSeedingLoading] = useState(false);

    // AI Copilot state
    const [aiInsights, setAiInsights] = useState(null);
    const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
    const [openAiKey, setOpenAiKey] = useState(() => localStorage.getItem("queueless-openai-key") || "");
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [keyInput, setKeyInput] = useState(() => localStorage.getItem("queueless-openai-key") || "");
    const [aiMessages, setAiMessages] = useState([
        {
            sender: "assistant",
            text: "Hello! I am **QueueCopilot AI**.\n\nI continuously monitor your live waiting hall, detect queue bottlenecks, forecast wait times, and can automatically execute dispatch tasks.\n\nAsk me any question or tell me what task you want to execute!",
            action: null,
            provider: null,
        },
    ]);
    const [aiInput, setAiInput] = useState("");
    const [aiChatLoading, setAiChatLoading] = useState(false);

    useEffect(() => {
        localStorage.setItem("queueless-theme", theme);
    }, [theme]);

    async function fetchQueue() {
        try {
            const response = await fetch("http://localhost:5000/api/queue", {
                credentials: "include",
            });
            const data = await response.json();
            if (response.ok) {
                setQueueData(data.queues || []);
            }
        } catch (err) {
            console.error("Queue fetch error:", err);
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
            console.error("Stats error:", err);
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
            console.error("Fetch services error:", err);
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

    async function fetchAiInsights() {
        setAiInsightsLoading(true);
        try {
            const res = await fetch("http://localhost:5000/api/ai/insights", {
                credentials: "include",
            });
            const data = await res.json();
            if (res.ok && data.insights) {
                setAiInsights(data.insights);
            }
        } catch (err) {
            console.error("AI Insights error:", err);
        } finally {
            setAiInsightsLoading(false);
        }
    }

    // Authenticate manager or staff
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
                if (data.user?.role === "customer") {
                    navigate("/customer", { replace: true });
                    return;
                }
                if (data.user?.role !== "manager" && data.user?.role !== "staff") {
                    navigate("/login", { replace: true });
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

    // Initial load + Real-time auto-refresh polling every 6s
    useEffect(() => {
        if (!user) return;
        fetchQueue();
        fetchStats();
        fetchServices();
        if (user.role === "manager") {
            fetchStaff();
        }
        fetchAiInsights();

        const interval = setInterval(() => {
            fetchQueue();
            fetchStats();
            if (user.role === "manager") {
                fetchStaff();
            }
        }, 6000);

        return () => clearInterval(interval);
    }, [user]);

    // AI Chat & Automation
    async function handleSendAiChat(customPrompt) {
        const promptToSend = (typeof customPrompt === "string" ? customPrompt : aiInput).trim();
        if (!promptToSend) return;

        setAiMessages((prev) => [...prev, { sender: "user", text: promptToSend }]);
        setAiInput("");
        setAiChatLoading(true);

        try {
            const headers = { "Content-Type": "application/json" };
            if (openAiKey) {
                headers["x-openai-key"] = openAiKey;
            }

            const res = await fetch("http://localhost:5000/api/ai/chat", {
                method: "POST",
                credentials: "include",
                headers,
                body: JSON.stringify({ message: promptToSend, apiKey: openAiKey }),
            });
            const data = await res.json();
            if (res.ok) {
                setAiMessages((prev) => [
                    ...prev,
                    {
                        sender: "assistant",
                        text: data.reply || "Task processed.",
                        action: data.action || null,
                        provider: data.provider || null,
                    },
                ]);
            } else {
                setAiMessages((prev) => [
                    ...prev,
                    { sender: "assistant", text: data.message || "Failed to process request." },
                ]);
            }
        } catch {
            setAiMessages((prev) => [
                ...prev,
                { sender: "assistant", text: "Error communicating with AI Copilot." },
            ]);
        } finally {
            setAiChatLoading(false);
        }
    }

    async function handleExecuteAiAction(action) {
        if (!action) return;

        if (action.type === "call_next") {
            await handleCallNext(action.serviceName);
            setAiMessages((prev) => [
                ...prev,
                { sender: "assistant", text: `⚡ Executed: Next ticket called for "${action.serviceName || "active queue"}". Web chime sounded!` },
            ]);
        } else if (action.type === "complete_token") {
            await handleStatusChange(action.tokenId, "completed");
            setAiMessages((prev) => [
                ...prev,
                { sender: "assistant", text: `✓ Executed: Token marked as completed successfully.` },
            ]);
        } else if (action.type === "seed_demo") {
            await handleSeedDemoData();
            setAiMessages((prev) => [
                ...prev,
                { sender: "assistant", text: `🚀 Executed: Realistic demo dataset loaded! Charts and metrics populated.` },
            ]);
        }
    }

    // Seed Demo Sample Data
    async function handleSeedDemoData() {
        setSeedingLoading(true);
        try {
            const res = await fetch("http://localhost:5000/api/queue/seed-demo", {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();
            if (res.ok) {
                await fetchQueue();
                await fetchStats();
                await fetchServices();
                if (user?.role === "manager") await fetchStaff();
                await fetchAiInsights();
            } else {
                alert(data.message || "Failed to load demo data.");
            }
        } catch (err) {
            console.error("Seed error:", err);
        } finally {
            setSeedingLoading(false);
        }
    }

    // Add Service (Managers only)
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

    // Delete Service (Managers only)
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
            alert(err.message || "Unable to add customer");
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
            alert(err.message || "Unable to update status");
        }
    }

    // Call Next Customer (with chime sound!)
    async function handleCallNext(customService) {
        const srv = customService || (user?.role === "staff" ? user.assignedService : null) || serviceName || services[0];
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
        } catch {
            alert("Failed to call next customer.");
        } finally {
            setCallingNextLoading(false);
        }
    }

    // Generate Staff Invite Code (Managers only)
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

    // CSV Exporter for Customer Records
    function handleExportCsv() {
        if (filteredCustomers.length === 0) {
            alert("No customer data to export.");
            return;
        }
        const headers = ["Token Number", "Customer Name", "Phone", "Department", "Station", "Estimated Wait (min)", "Status", "Timestamp"];
        const rows = filteredCustomers.map((c) => [
            `"${c.serviceName ? c.serviceName.slice(0, 1).toUpperCase() : "T"}-${String(c.tokenNumber).padStart(3, "0")}"`,
            `"${c.customerName || ""}"`,
            `"${c.customerPhone || ""}"`,
            `"${c.serviceName || ""}"`,
            `"${c.counterNumber || "Counter 1"}"`,
            c.estimatedWaitMinutes || 0,
            c.status || "waiting",
            `"${new Date(c.createdAt).toLocaleString()}"`,
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `QueueLess_CustomerDirectory_${timeRange}_${todayIST}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (loading) {
        return (
            <main className="qd-state">
                <div className="qd-loader-modern" />
                <p>Loading Modern Workspace...</p>
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

    const isStaff = user.role === "staff";
    const displayName = user.businessName || user.name || (isStaff ? "Staff Member" : "Provider Head");

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

    // Active dataset based on TimeRange (Today vs All-Time Total)
    const activeDataset = timeRange === "today" ? todayQueueData : queueData;
    const activeStats = timeRange === "today" ? stats : allTimeStats;

    const filteredCustomers = activeDataset.filter((item) => {
        const matchesSearch = item.customerName?.toLowerCase().includes(customerSearch.trim().toLowerCase()) ||
            item.serviceName?.toLowerCase().includes(customerSearch.trim().toLowerCase());
        const matchesStatus = queueStatusFilter === "all" || item.status === queueStatusFilter;
        const matchesService = selectedServiceFilter === "all" || item.serviceName === selectedServiceFilter;
        return matchesSearch && matchesStatus && matchesService;
    });

    // Service Breakdown for active time range
    const activeServiceNames = [
        ...services,
        ...new Set(activeDataset.map((item) => item.serviceName).filter((name) => name && !services.includes(name))),
    ];

    const serviceBreakdown = activeServiceNames.map((service) => ({
        name: service,
        count: activeDataset.filter((item) => item.serviceName === service).length,
    }));

    const chartColors = [
        "#6366f1", "#38bdf8", "#10b981", "#f59e0b", "#ec4899",
        "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", "#14b8a6",
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

    const donutGradient = totalServiceCustomers === 0 ? "conic-gradient(#334155 0% 100%)" : `conic-gradient(${donutSegments.join(", ")})`;

    const recentActivity = [...activeDataset].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    ).slice(0, 6);

    const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

    // Staff cannot see the Staff & Counters navigation
    const navItems = [
        { label: "Overview", icon: "📊" },
        { label: "Live Queue", icon: "⚡" },
        ...(isStaff ? [] : [{ label: "Staff & Counters", icon: "🧑‍💼" }]),
        { label: "Customers", icon: "👥" },
        { label: "Services", icon: "🏢" },
        { label: "AI Copilot 🤖", icon: "✨" },
    ];

    const isWorkspaceEmpty = queueData.length === 0 && services.length === 0;

    return (
        <div className={`qd-modern-app ${theme === "dark" ? "qd-dark" : "qd-light"}`}>
            {/* Sidebar */}
            <aside className="qd-sidebar-modern">
                <div className="qd-sidebar-top">
                    <button className="qd-brand-modern" onClick={() => setActiveNav("Overview")}>
                        <div className="qd-brand-glow-icon">Q</div>
                        <div className="qd-brand-names">
                            <span className="qd-brand-main">QueueLess</span>
                            <span className="qd-brand-badge">SaaS Hub</span>
                        </div>
                    </button>

                    <div className="qd-nav-divider-label">NAVIGATION</div>

                    <nav className="qd-nav-modern">
                        {navItems.map((item) => (
                            <button
                                key={item.label}
                                className={`qd-nav-btn ${activeNav === item.label ? "is-active" : ""}`}
                                onClick={() => setActiveNav(item.label)}
                            >
                                <span className="qd-nav-emoji">{item.icon}</span>
                                <span className="qd-nav-label-text">{item.label}</span>
                                {item.label === "Live Queue" && stats.waiting > 0 && (
                                    <span className="qd-pulsing-badge">{stats.waiting}</span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="qd-sidebar-bottom-modern">
                    <div className="qd-user-profile-widget">
                        <div className="qd-user-avatar-modern">{initials}</div>
                        <div className="qd-user-details-modern">
                            <strong>{displayName}</strong>
                            <span>{isStaff ? "Staff Operator" : "Service Provider Head"}</span>
                            {isStaff && (
                                <span className="staff-badge-tag">
                                    📍 {user.assignedService || "General"} · {user.counterNumber || "Counter 1"}
                                </span>
                            )}
                        </div>
                    </div>

                    <button className="qd-signout-btn" onClick={handleLogout}>
                        <span>🚪</span> Log out
                    </button>
                </div>
            </aside>

            {/* Main Canvas */}
            <main className="qd-main-canvas">
                {/* Modern Top Header Bar */}
                <header className="qd-top-header">
                    <div className="qd-header-left">
                        <div className="qd-crumb-trail">
                            <span>Workspace</span>
                            <span className="crumb-arrow">/</span>
                            <span className="crumb-current">{activeNav}</span>
                        </div>
                        <h1 className="qd-header-title">{activeNav}</h1>
                    </div>

                    {/* Right side Header Controls */}
                    <div className="qd-header-right">
                        {/* Waiting Room TV Display Board Link */}
                        <a
                            href="/display"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="qd-tv-link-btn"
                            title="Open airport/bank style Waiting Room TV Display Board in a new window"
                        >
                            📺 Live TV Board ↗
                        </a>

                        {/* Today vs All-Time Total Range Switcher */}
                        <div className="qd-range-segmented" title="Switch between Today and All-Time cumulative metrics">
                            <button
                                className={`segmented-btn ${timeRange === "today" ? "selected" : ""}`}
                                onClick={() => setTimeRange("today")}
                            >
                                📅 Today
                            </button>
                            <button
                                className={`segmented-btn ${timeRange === "all" ? "selected" : ""}`}
                                onClick={() => setTimeRange("all")}
                            >
                                🌐 All-Time Total
                            </button>
                        </div>

                        {/* Theme Toggle */}
                        <button
                            className="qd-glass-icon-btn"
                            onClick={() => setTheme((c) => (c === "light" ? "dark" : "light"))}
                            title="Toggle Light / Dark mode"
                        >
                            {theme === "dark" ? "☀️" : "🌙"}
                        </button>

                        {/* Fast Call Next Customer */}
                        <button
                            className="qd-cta-primary-btn"
                            onClick={() => handleCallNext()}
                            disabled={callingNextLoading || stats.waiting === 0}
                            title="Call next waiting customer"
                        >
                            ⚡ Call Next
                        </button>

                        {/* Add Walk-in Token */}
                        <button
                            className="qd-cta-glass-btn"
                            onClick={() => setShowAddCustomer(true)}
                        >
                            + Issue Token
                        </button>
                    </div>
                </header>

                <div className="qd-body-content">
                    {/* Zero State / Demo Seeder Banner */}
                    {isWorkspaceEmpty && (
                        <div className="qd-demo-banner">
                            <div className="demo-banner-content">
                                <span className="demo-sparkle">✨</span>
                                <div>
                                    <h4>Empty Workspace? Preview QueueLess with Sample Data</h4>
                                    <p>Click below to generate realistic demo services, queues, and past transactions to see charts and total analytics.</p>
                                </div>
                            </div>
                            <button
                                className="demo-load-btn"
                                onClick={handleSeedDemoData}
                                disabled={seedingLoading}
                            >
                                {seedingLoading ? "Loading..." : "Load Demo Dataset 🚀"}
                            </button>
                        </div>
                    )}

                    {/* Add Walk-in Modal Form */}
                    {showAddCustomer && (
                        <div className="qd-modal-card">
                            <div className="modal-header">
                                <h3>Generate Token for Walk-in Customer</h3>
                                <button className="modal-close" onClick={() => setShowAddCustomer(false)}>✕</button>
                            </div>
                            <form onSubmit={handleAddCustomer} className="modal-form-grid">
                                <input
                                    type="text"
                                    placeholder="Customer Full Name"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required
                                />
                                <input
                                    type="tel"
                                    placeholder="Phone Number (optional)"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                />
                                <select
                                    value={serviceName}
                                    onChange={(e) => setServiceName(e.target.value)}
                                    required
                                    disabled={services.length === 0}
                                >
                                    <option value="" disabled>Select Department / Service</option>
                                    {services.map((srv) => (
                                        <option key={srv} value={srv}>{srv}</option>
                                    ))}
                                </select>
                                <button type="submit" className="submit-token-btn" disabled={addingCustomer || services.length === 0}>
                                    {addingCustomer ? "Issuing..." : "Generate Token Now →"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Configure ChatGPT / Gemini API Key Modal */}
                    {showKeyModal && (
                        <div className="qd-modal-card" style={{ maxWidth: "560px" }}>
                            <div className="modal-header">
                                <h3>⚡ Connect Live AI (ChatGPT or Google Gemini)</h3>
                                <button className="modal-close" onClick={() => setShowKeyModal(false)}>✕</button>
                            </div>
                            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 16px", lineHeight: "1.5" }}>
                                Enter your <b>OpenAI API Key</b> (<code>sk-proj-...</code>) or <b>Google Gemini Key</b> (<code>AIzaSy...</code>) below. QueueCopilot will use live generative AI to answer any question, execute tasks, and optimize queues.
                            </p>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const clean = keyInput.trim();
                                    localStorage.setItem("queueless-openai-key", clean);
                                    setOpenAiKey(clean);
                                    setShowKeyModal(false);
                                    alert(clean ? "Live AI Key saved! Active AI is now powering your assistant." : "API key cleared. Built-in engine will be used.");
                                }}
                                className="modal-form-grid"
                            >
                                <input
                                    type="password"
                                    placeholder="Paste sk-proj-... (OpenAI) or AIzaSy... (Gemini)"
                                    value={keyInput}
                                    onChange={(e) => setKeyInput(e.target.value)}
                                    required={!openAiKey}
                                />
                                <div style={{ display: "flex", gap: "10px" }}>
                                    <button type="submit" className="submit-token-btn" style={{ flex: 1 }}>
                                        Save & Activate ChatGPT 🚀
                                    </button>
                                    {openAiKey && (
                                        <button
                                            type="button"
                                            className="modal-close"
                                            style={{ background: "#ef444422", color: "#ef4444", borderRadius: "10px", padding: "0 16px", fontSize: "12px", fontWeight: "700" }}
                                            onClick={() => {
                                                localStorage.removeItem("queueless-openai-key");
                                                setOpenAiKey("");
                                                setKeyInput("");
                                                setShowKeyModal(false);
                                            }}
                                        >
                                            Remove Key
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ================= VIEW 1: OVERVIEW ================= */}
                    {activeNav === "Overview" && (
                        <>
                            {/* KPI Metrics Row */}
                            <section className="qd-kpi-modern-grid">
                                <article className="qd-kpi-card purple-glow">
                                    <div className="kpi-card-header">
                                        <span className="kpi-title">{timeRange === "today" ? "Customers Today" : "Total Customers (All-Time)"}</span>
                                        <span className="kpi-icon-pill">👥</span>
                                    </div>
                                    <div className="kpi-number-display">{activeStats.totalCustomers}</div>
                                    <div className="kpi-subtext">
                                        <span>{timeRange === "today" ? "Issued today across counters" : "Cumulative total since launch"}</span>
                                    </div>
                                </article>

                                <article className="qd-kpi-card amber-glow">
                                    <div className="kpi-card-header">
                                        <span className="kpi-title">{timeRange === "today" ? "Waiting in Queue" : "Total Waiting"}</span>
                                        <span className="kpi-icon-pill">⏳</span>
                                    </div>
                                    <div className="kpi-number-display">{activeStats.waiting}</div>
                                    <div className="kpi-subtext">
                                        <span>Currently in line awaiting turn</span>
                                    </div>
                                </article>

                                <article className="qd-kpi-card green-glow">
                                    <div className="kpi-card-header">
                                        <span className="kpi-title">{timeRange === "today" ? "Completed Today" : "Total Completed"}</span>
                                        <span className="kpi-icon-pill">✓</span>
                                    </div>
                                    <div className="kpi-number-display">{activeStats.completed}</div>
                                    <div className="kpi-subtext">
                                        <span>Successfully served customers</span>
                                    </div>
                                </article>

                                <article className="qd-kpi-card blue-glow">
                                    <div className="kpi-card-header">
                                        <span className="kpi-title">Average Wait Time</span>
                                        <span className="kpi-icon-pill">⚡</span>
                                    </div>
                                    <div className="kpi-number-display">{activeStats.averageWaitTime} <small>min</small></div>
                                    <div className="kpi-subtext">
                                        <span>Active wait calculation</span>
                                    </div>
                                </article>
                            </section>

                            {/* Analytics Visual Grid */}
                            <section className="qd-analytics-modern-grid">
                                {/* Bar Chart Panel */}
                                <article className="qd-modern-panel">
                                    <div className="panel-title-bar">
                                        <div>
                                            <h3>{timeRange === "today" ? "Today's Queue Activity" : "All-Time Queue Activity by Service"}</h3>
                                            <p>Volume distribution across departments</p>
                                        </div>
                                        <span className="panel-badge-indicator">
                                            {timeRange === "today" ? "LIVE TODAY" : "ALL-TIME CUMULATIVE"}
                                        </span>
                                    </div>
                                    <QueueActivityChart data={serviceBreakdown} />
                                </article>

                                {/* Donut Performance Panel */}
                                <article className="qd-modern-panel">
                                    <div className="panel-title-bar">
                                        <div>
                                            <h3>{timeRange === "today" ? "Service Breakdown (Today)" : "Service Breakdown (Total)"}</h3>
                                            <p>Traffic ratio per counter</p>
                                        </div>
                                    </div>

                                    <div className="donut-center-wrap">
                                        <div className="modern-donut" style={{ background: donutGradient }}>
                                            <div className="donut-inner-hole">
                                                <strong>{totalServiceCustomers}</strong>
                                                <span>Visits</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="modern-legend-list">
                                        {serviceBreakdown.length === 0 ? (
                                            <p className="empty-legend-text">No services added yet.</p>
                                        ) : (
                                            serviceBreakdown.map((service, index) => (
                                                <div key={service.name} className="legend-row">
                                                    <div className="legend-name-wrap">
                                                        <span className="dot" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                                                        <span>{service.name}</span>
                                                    </div>
                                                    <strong>{service.count}</strong>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </article>
                            </section>

                            {/* Recent Activity Feed */}
                            <section className="qd-modern-panel">
                                <div className="panel-title-bar">
                                    <div>
                                        <h3>Recent Queue Updates</h3>
                                        <p>{timeRange === "today" ? "Transactions created today" : "Latest updates across all queues"}</p>
                                    </div>
                                </div>

                                <div className="modern-activity-feed">
                                    {recentActivity.length === 0 ? (
                                        <div className="empty-feed">
                                            <span>☕</span>
                                            <p>No transactions yet. Generate a token or click "Load Demo Dataset" above!</p>
                                        </div>
                                    ) : (
                                        recentActivity.map((item) => (
                                            <div key={item._id} className="feed-item">
                                                <div className={`status-icon-dot ${item.status}`}>
                                                    {item.status === "completed" ? "✓" : item.status === "serving" ? "⚡" : item.status === "cancelled" ? "✕" : "⏳"}
                                                </div>
                                                <div className="feed-info">
                                                    <strong>Token #{item.serviceName?.slice(0, 1).toUpperCase()}-{String(item.tokenNumber).padStart(3, "0")} is {item.status.toUpperCase()}</strong>
                                                    <p>{item.customerName} · {item.serviceName} {item.counterNumber ? `· ${item.counterNumber}` : ""}</p>
                                                </div>
                                                <span className="feed-time">
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
                        <section className="qd-modern-panel">
                            <div className="panel-title-bar">
                                <div>
                                    <div className="title-with-pill">
                                        <h3>Live Queue Desk</h3>
                                        <span className="live-pulsing-pill"><span className="pulse-dot" /> LIVE</span>
                                    </div>
                                    <p>Managing queue for {timeRange === "today" ? "Today" : "All-Time"}</p>
                                </div>

                                <div className="panel-actions">
                                    <button
                                        className="qd-cta-primary-btn"
                                        onClick={() => handleCallNext()}
                                        disabled={callingNextLoading || stats.waiting === 0}
                                    >
                                        ⚡ Call Next Customer
                                    </button>
                                    <button
                                        className="qd-glass-icon-btn"
                                        onClick={() => { fetchQueue(); fetchStats(); }}
                                        title="Refresh"
                                    >
                                        🔄
                                    </button>
                                </div>
                            </div>

                            {/* Filter Bar */}
                            <div className="queue-filter-bar">
                                <div className="filter-chips">
                                    {["all", "waiting", "serving", "completed", "cancelled"].map((st) => (
                                        <button
                                            key={st}
                                            className={`chip-btn ${queueStatusFilter === st ? "active-chip" : ""}`}
                                            onClick={() => setQueueStatusFilter(st)}
                                        >
                                            {st.toUpperCase()} ({st === "all" ? activeDataset.length : activeDataset.filter((q) => q.status === st).length})
                                        </button>
                                    ))}
                                </div>

                                <div className="queue-search-input">
                                    <span>🔍</span>
                                    <input
                                        type="search"
                                        placeholder="Search customer or service..."
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Table */}
                            <div className="modern-table-container">
                                <table className="modern-table">
                                    <thead>
                                        <tr>
                                            <th>Token</th>
                                            <th>Customer Name</th>
                                            <th>Department / Service</th>
                                            <th>Station</th>
                                            <th>Wait Time</th>
                                            <th>Status & Quick Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {queueLoading ? (
                                            <tr><td colSpan="6" className="table-state-cell">Loading queues...</td></tr>
                                        ) : filteredCustomers.length === 0 ? (
                                            <tr><td colSpan="6" className="table-state-cell">No queue records matching your filter.</td></tr>
                                        ) : (
                                            filteredCustomers.map((item) => (
                                                <tr key={item._id}>
                                                    <td>
                                                        <span className="modern-token-badge">
                                                            {item.serviceName.slice(0, 1).toUpperCase()}-{String(item.tokenNumber).padStart(3, "0")}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <strong className="customer-cell-name">{item.customerName}</strong>
                                                        {item.customerPhone && <span className="customer-cell-phone">{item.customerPhone}</span>}
                                                    </td>
                                                    <td>{item.serviceName}</td>
                                                    <td>{item.counterNumber || "-"}</td>
                                                    <td>{item.estimatedWaitMinutes} min</td>
                                                    <td>
                                                        <div className="status-action-cell">
                                                            <span className={`status-pill-badge ${item.status}`}>
                                                                {item.status.toUpperCase()}
                                                            </span>

                                                            <div className="inline-action-btns">
                                                                {item.status === "waiting" && (
                                                                    <button
                                                                        className="mini-btn serve-btn"
                                                                        onClick={() => handleStatusChange(item._id, "serving")}
                                                                    >
                                                                        Serve ↗
                                                                    </button>
                                                                )}
                                                                {item.status === "serving" && (
                                                                    <button
                                                                        className="mini-btn done-btn"
                                                                        onClick={() => handleStatusChange(item._id, "completed")}
                                                                    >
                                                                        ✓ Done
                                                                    </button>
                                                                )}
                                                                {(item.status === "waiting" || item.status === "serving") && (
                                                                    <button
                                                                        className="mini-btn cancel-btn"
                                                                        onClick={() => handleStatusChange(item._id, "cancelled")}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                )}
                                                            </div>
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

                    {/* ================= VIEW 3: STAFF & COUNTERS (MANAGERS ONLY) ================= */}
                    {activeNav === "Staff & Counters" && !isStaff && (
                        <section className="qd-modern-panel">
                            <div className="panel-title-bar">
                                <div>
                                    <h3>Staff Members & Counter Stations</h3>
                                    <p>Invite service staff and assign them to dedicated counters using unique invite codes</p>
                                </div>
                            </div>

                            {/* Staff Invite Box */}
                            <div className="staff-invite-card-modern">
                                <h4>Generate Unique Staff Invite Code</h4>
                                {staffMessage && (
                                    <p className={`staff-alert ${staffMessage.includes("success") ? "success" : "error"}`}>
                                        {staffMessage}
                                    </p>
                                )}
                                <form onSubmit={handleGenerateStaffInvite} className="staff-invite-form-grid">
                                    <input
                                        type="text"
                                        placeholder="Staff Name"
                                        value={inviteStaffName}
                                        onChange={(e) => setInviteStaffName(e.target.value)}
                                        required
                                    />
                                    <input
                                        type="email"
                                        placeholder="Staff Email"
                                        value={inviteStaffEmail}
                                        onChange={(e) => setInviteStaffEmail(e.target.value)}
                                        required
                                    />
                                    <select
                                        value={inviteServiceName}
                                        onChange={(e) => setInviteServiceName(e.target.value)}
                                        required
                                        disabled={services.length === 0}
                                    >
                                        <option value="" disabled>Select Assigned Service</option>
                                        {services.map((srv) => (
                                            <option key={srv} value={srv}>{srv}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Station (e.g. Counter 1)"
                                        value={inviteCounter}
                                        onChange={(e) => setInviteCounter(e.target.value)}
                                        required
                                    />
                                    <button type="submit" className="generate-code-btn" disabled={staffLoading || services.length === 0}>
                                        {staffLoading ? "Generating..." : "Generate Code 🔑"}
                                    </button>
                                </form>

                                {lastGeneratedCode && (
                                    <div className="code-success-callout">
                                        <div>
                                            <span className="code-label">ACTIVE INVITE CODE</span>
                                            <strong className="code-display">{lastGeneratedCode}</strong>
                                            <p>Share this code with your staff member. They will enter this code on the register screen to link to their assigned counter.</p>
                                        </div>
                                        <button
                                            className="copy-code-btn"
                                            onClick={() => {
                                                navigator.clipboard.writeText(lastGeneratedCode);
                                                alert(`Copied ${lastGeneratedCode} to clipboard!`);
                                            }}
                                        >
                                            Copy Code 📋
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Active Staff Table */}
                            <h4 className="section-sub-heading">Active Staff Members ({staffList.length})</h4>
                            <div className="modern-table-container">
                                <table className="modern-table">
                                    <thead>
                                        <tr>
                                            <th>Staff Member</th>
                                            <th>Email</th>
                                            <th>Assigned Department</th>
                                            <th>Station</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffList.length === 0 ? (
                                            <tr><td colSpan="5" className="table-state-cell">No staff members registered yet. Generate an invite code above.</td></tr>
                                        ) : (
                                            staffList.map((st) => (
                                                <tr key={st._id}>
                                                    <td><strong>{st.name}</strong></td>
                                                    <td>{st.email}</td>
                                                    <td><span className="service-pill-tag">{st.assignedService}</span></td>
                                                    <td><strong>{st.counterNumber || "Counter 1"}</strong></td>
                                                    <td>
                                                        <button
                                                            className="table-delete-btn"
                                                            onClick={() => handleRemoveStaff(st._id, st.name)}
                                                        >
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pending Invites */}
                            {pendingInvites.length > 0 && (
                                <>
                                    <h4 className="section-sub-heading" style={{ marginTop: "28px" }}>Pending Unused Invites ({pendingInvites.length})</h4>
                                    <div className="modern-table-container">
                                        <table className="modern-table">
                                            <thead>
                                                <tr>
                                                    <th>Invite Code</th>
                                                    <th>Staff Name / Email</th>
                                                    <th>Assigned Department</th>
                                                    <th>Station</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pendingInvites.map((inv) => (
                                                    <tr key={inv._id}>
                                                        <td><strong className="inv-code-text">{inv.code}</strong></td>
                                                        <td>{inv.staffName || inv.staffEmail || "Unassigned"}</td>
                                                        <td>{inv.serviceName}</td>
                                                        <td>{inv.counterNumber}</td>
                                                        <td>
                                                            <button
                                                                className="table-delete-btn"
                                                                onClick={() => handleRevokeInvite(inv._id)}
                                                            >
                                                                Revoke
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

                    {/* ================= VIEW 4: CUSTOMERS ================= */}
                    {activeNav === "Customers" && (
                        <section className="qd-modern-panel">
                            <div className="panel-title-bar">
                                <div>
                                    <h3>Customer Directory</h3>
                                    <p>History of all customers who queued at your service center</p>
                                </div>
                                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                    <button className="qd-export-csv-btn" onClick={handleExportCsv} title="Download customer database as CSV">
                                        📥 Export CSV
                                    </button>
                                    <div className="queue-search-input">
                                        <span>🔍</span>
                                        <input
                                            type="search"
                                            placeholder="Search customer name..."
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modern-table-container">
                                <table className="modern-table">
                                    <thead>
                                        <tr>
                                            <th>Token</th>
                                            <th>Customer Name</th>
                                            <th>Phone</th>
                                            <th>Department</th>
                                            <th>Issued At</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCustomers.length === 0 ? (
                                            <tr><td colSpan="6" className="table-state-cell">No customers found.</td></tr>
                                        ) : (
                                            filteredCustomers.map((item) => (
                                                <tr key={item._id}>
                                                    <td>
                                                        <span className="modern-token-badge">
                                                            {item.serviceName.slice(0, 1).toUpperCase()}-{String(item.tokenNumber).padStart(3, "0")}
                                                        </span>
                                                    </td>
                                                    <td><strong>{item.customerName}</strong></td>
                                                    <td>{item.customerPhone || "-"}</td>
                                                    <td>{item.serviceName}</td>
                                                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                                                    <td>
                                                        <span className={`status-pill-badge ${item.status}`}>
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

                    {/* ================= VIEW 5: SERVICES ================= */}
                    {activeNav === "Services" && (
                        <section className="qd-modern-panel">
                            <div className="panel-title-bar">
                                <div>
                                    <h3>Service Categories & Counters</h3>
                                    <p>Configure which departments and desks are active for queue management</p>
                                </div>
                            </div>

                            {!isStaff && (
                                <form className="add-service-modern-form" onSubmit={handleAddService}>
                                    <input
                                        type="text"
                                        value={newServiceName}
                                        onChange={(e) => setNewServiceName(e.target.value)}
                                        placeholder="Enter new service name (e.g. Account Opening, Cash Deposit)"
                                        maxLength={100}
                                        required
                                    />
                                    <button type="submit" disabled={serviceLoading}>
                                        {serviceLoading ? "Adding..." : "+ Create Service"}
                                    </button>
                                </form>
                            )}

                            {serviceMessage && (
                                <p className={`service-msg ${serviceMessage.includes("success") ? "success" : "error"}`}>
                                    {serviceMessage}
                                </p>
                            )}

                            <div className="services-modern-grid">
                                {services.map((srv) => {
                                    const waitingCount = activeDataset.filter((q) => q.serviceName === srv && q.status === "waiting").length;
                                    const totalCount = activeDataset.filter((q) => q.serviceName === srv).length;
                                    return (
                                        <div key={srv} className="service-card-modern">
                                            <div className="service-card-top">
                                                <h4>{srv}</h4>
                                                {!isStaff && (
                                                    <button
                                                        className="delete-srv-btn"
                                                        onClick={() => handleDeleteService(srv)}
                                                        title="Delete Service"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                            <div className="service-metrics-row">
                                                <div className="srv-stat">
                                                    <span>Waiting</span>
                                                    <strong className="amber-text">{waitingCount}</strong>
                                                </div>
                                                <div className="srv-stat">
                                                    <span>{timeRange === "today" ? "Today's Visits" : "Total Visits"}</span>
                                                    <strong>{totalCount}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* ================= VIEW 6: AI COPILOT & AUTOMATION ================= */}
                    {activeNav === "AI Copilot 🤖" && (
                        <div className="ai-copilot-panel">
                            {/* AI Insights Header & Cards */}
                            <div className="ai-header-badge-row">
                                <div>
                                    <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: "800" }}>
                                        QueueCopilot Autonomous Intelligence
                                    </h3>
                                    <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)" }}>
                                        Real-time operational optimization, bottleneck detection, and predictive dispatching
                                    </p>
                                </div>
                                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                                    <button
                                        className="ai-key-config-btn"
                                        onClick={() => setShowKeyModal(true)}
                                        title="Configure ChatGPT / OpenAI API Key"
                                    >
                                        🔑 {openAiKey ? "ChatGPT (GPT-4o-mini) Connected ✓" : "Connect ChatGPT API"}
                                    </button>
                                    <span className="ai-intelligence-pill">
                                        <span className="ai-online-dot" /> Autonomous Agent Active
                                    </span>
                                </div>
                            </div>

                            {/* 3 AI Analytics Cards */}
                            <div className="ai-cards-grid">
                                <article className="ai-card">
                                    <div className="ai-card-glow-line" />
                                    <div className="ai-card-top">
                                        <span className="ai-card-title">System Efficiency</span>
                                        <span className="ai-card-icon">⚡</span>
                                    </div>
                                    <div className="ai-score-row">
                                        <span className="ai-score-big">{aiInsights?.efficiencyScore || 95}%</span>
                                        <span className="ai-score-label">OPTIMAL</span>
                                    </div>
                                    <p className="ai-card-desc">
                                        Calculated from live throughput and customer clearance velocity.
                                    </p>
                                </article>

                                <article className="ai-card">
                                    <div className="ai-card-glow-line" />
                                    <div className="ai-card-top">
                                        <span className="ai-card-title">Bottleneck Audit</span>
                                        <span className="ai-card-icon">🔍</span>
                                    </div>
                                    {aiInsights?.maxWaitersInBottleneck >= 2 ? (
                                        <>
                                            <span className="ai-alert-badge warning">
                                                High Load in "{aiInsights?.bottleneckService}"
                                            </span>
                                            <p className="ai-card-desc">
                                                {aiInsights?.maxWaitersInBottleneck} customer(s) are waiting for this department.
                                            </p>
                                            <button
                                                className="ai-auto-call-btn"
                                                onClick={() => handleCallNext(aiInsights?.bottleneckService)}
                                            >
                                                ⚡ Auto-Call in {aiInsights?.bottleneckService}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="ai-alert-badge optimal">No Bottlenecks Detected</span>
                                            <p className="ai-card-desc">
                                                All counters are operating smoothly without queue congestion.
                                            </p>
                                        </>
                                    )}
                                </article>

                                <article className="ai-card">
                                    <div className="ai-card-glow-line" />
                                    <div className="ai-card-top">
                                        <span className="ai-card-title">Traffic Forecast</span>
                                        <span className="ai-card-icon">📈</span>
                                    </div>
                                    <div className="ai-score-row">
                                        <span className="ai-score-big">~{aiInsights?.projectedNextHourLoad || 3}</span>
                                        <span className="ai-score-label" style={{ color: "#38bdf8" }}>arr/hr</span>
                                    </div>
                                    <p className="ai-card-desc">
                                        Anticipated customer arrivals in the next hour based on queue trends.
                                    </p>
                                </article>
                            </div>

                            {/* Copilot Chat & Automation Engine */}
                            <div className="ai-chat-terminal">
                                <div className="ai-chat-header">
                                    <div className="ai-chat-header-title">
                                        <span>🤖</span>
                                        <span>Interactive QueueCopilot Assistant</span>
                                    </div>
                                    <span style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "monospace" }}>
                                        NATURAL LANGUAGE ENGINE
                                    </span>
                                </div>

                                <div className="ai-chat-messages-container">
                                    {aiMessages.map((msg, index) => (
                                        <div key={index} className={`chat-bubble-wrap ${msg.sender}`}>
                                            <div className="ai-bubble-avatar">
                                                {msg.sender === "assistant" ? "🤖" : "👤"}
                                            </div>
                                            <div className="chat-bubble-content">
                                                {msg.provider && (
                                                    <span style={{ fontSize: "10.5px", color: "#38bdf8", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                                                        ⚡ {msg.provider}
                                                    </span>
                                                )}
                                                <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                                                {msg.action && (
                                                    <div className="chat-action-widget">
                                                        <span style={{ fontSize: "12px", color: "var(--text-main)" }}>
                                                            Suggested Action: <b>{msg.action.label}</b>
                                                        </span>
                                                        <button
                                                            className="chat-action-btn"
                                                            onClick={() => handleExecuteAiAction(msg.action)}
                                                        >
                                                            {msg.action.label}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {aiChatLoading && (
                                        <div className="chat-bubble-wrap assistant">
                                            <div className="ai-bubble-avatar">🤖</div>
                                            <div className="chat-bubble-content">
                                                <span>Thinking and analyzing live queue telemetry...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Suggested Prompts */}
                                <div className="chat-suggested-prompts">
                                    <button
                                        className="suggested-prompt-chip"
                                        onClick={() => handleSendAiChat("Where is the biggest queue bottleneck right now?")}
                                    >
                                        🔍 Queue Bottlenecks
                                    </button>
                                    <button
                                        className="suggested-prompt-chip"
                                        onClick={() => handleSendAiChat("Who should be called next to the counter?")}
                                    >
                                        ⚡ Call Next Customer
                                    </button>
                                    <button
                                        className="suggested-prompt-chip"
                                        onClick={() => handleSendAiChat("Give me today's performance summary report")}
                                    >
                                        📊 Daily Summary
                                    </button>
                                    <button
                                        className="suggested-prompt-chip"
                                        onClick={() => handleSendAiChat("What is the projected wait time and peak hour forecast?")}
                                    >
                                        ⏱️ Wait Time Forecast
                                    </button>
                                    <button
                                        className="suggested-prompt-chip"
                                        onClick={() => handleSendAiChat("Show active staff members and their stations")}
                                    >
                                        🧑‍💼 Staff Stations
                                    </button>
                                </div>

                                {/* Chat Input Row */}
                                <form
                                    className="ai-chat-input-row"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSendAiChat();
                                    }}
                                >
                                    <input
                                        type="text"
                                        placeholder="Ask a question or command (e.g. 'Call next in General', 'Summary', 'Bottleneck')..."
                                        value={aiInput}
                                        onChange={(e) => setAiInput(e.target.value)}
                                    />
                                    <button type="submit" className="ai-send-btn" disabled={aiChatLoading || !aiInput.trim()}>
                                        Send →
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    <footer className="qd-modern-footer">
                        <span>© 2026 QueueLess · High-Performance Smart Queue System · Hackathon Edition</span>
                    </footer>
                </div>
            </main>
        </div>
    );
}

export default Dashboard;
