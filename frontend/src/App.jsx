import { Routes, Route, Link, useLocation } from "react-router-dom";
import { ClipboardList, LayoutDashboard } from "lucide-react";
import AppointmentForm from "./pages/AppointmentForm";
import AdminDashboard from "./pages/AdminDashboard";

function NavShell({ children }) {
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith("/admin");
  return (
    <>
      {!isAdmin && (
        <div className="fixed bottom-4 right-4 z-30 sm:bottom-6 sm:right-6">
          <Link
            to="/admin"
            className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-slate-900/30 ring-2 ring-white/10 transition hover:bg-slate-800"
          >
            <LayoutDashboard className="h-4 w-4" />
            Admin
          </Link>
        </div>
      )}
      {isAdmin && (
        <div className="fixed bottom-4 left-4 z-30 sm:bottom-6 sm:left-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg transition hover:bg-slate-50"
          >
            <ClipboardList className="h-4 w-4" />
            Form pasien
          </Link>
        </div>
      )}
      {children}
    </>
  );
}

export default function App() {
  return (
    <NavShell>
      <Routes>
        <Route path="/" element={<AppointmentForm />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </NavShell>
  );
}
