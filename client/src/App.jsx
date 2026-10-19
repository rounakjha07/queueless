import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/home";
import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./pages/dashboard";
import StaffPortal from "./pages/staffPortal";
import CustomerPortal from "./pages/customerPortal";
import DisplayBoard from "./pages/displayBoard";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/staff-portal"
          element={<StaffPortal />}
        />

        <Route
          path="/customer"
          element={<CustomerPortal />}
        />

        <Route
          path="/display"
          element={<DisplayBoard />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;