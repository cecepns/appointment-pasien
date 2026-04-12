import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  Phone,
  MapPin,
  Calendar,
  Eye,
  X,
  Filter,
  Stethoscope,
  Image as ImageIcon,
  PenLine,
  Search,
  ChevronLeft,
  ChevronRight,
  KeyRound,
} from "lucide-react";
import { fetchJson, apiUrl } from "../lib/api";

const PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 1000;

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Dikonfirmasi" },
  { value: "cancelled", label: "Dibatalkan" },
  { value: "completed", label: "Selesai" },
];

const STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-900 ring-amber-200",
  confirmed: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  cancelled: "bg-slate-200 text-slate-800 ring-slate-300",
  completed: "bg-brand-100 text-brand-900 ring-brand-200",
};

function tokenStorageKey() {
  return "appointment_admin_token";
}

function usernameStorageKey() {
  return "appointment_admin_username";
}

function formatDt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminDashboard() {
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenStorageKey()) || "");
  const [adminUsername, setAdminUsername] = useState(
    () => sessionStorage.getItem(usernameStorageKey()) || ""
  );
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [stats, setStats] = useState(null);
  const [list, setList] = useState([]);
  const [listMeta, setListMeta] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    limit: PER_PAGE,
  });
  const [filter, setFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [err, setErr] = useState("");
  const [detail, setDetail] = useState(null);

  const authHeaders = useMemo(
    () =>
      token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    [token]
  );

  useEffect(() => {
    const id = setTimeout(() => {
      const next = searchInput.trim();
      setDebouncedSearch((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const s = await fetchJson(`/api/appointments/stats`, { headers: authHeaders });
      setStats(s);
    } catch (e) {
      if (e.status === 401) {
        sessionStorage.removeItem(tokenStorageKey());
        sessionStorage.removeItem(usernameStorageKey());
        setToken("");
        setAdminUsername("");
        setErr("Sesi habis, silakan login lagi.");
      } else setErr(e.message || "Gagal memuat statistik");
    }
  }, [token, authHeaders]);

  const fetchList = useCallback(
    async (signal) => {
      if (!token) return;
      setListLoading(true);
      setErr("");
      try {
        const params = new URLSearchParams();
        if (filter) params.set("status", filter);
        if (debouncedSearch) params.set("search", debouncedSearch);
        params.set("page", String(page));
        params.set("limit", String(PER_PAGE));
        const data = await fetchJson(`/api/appointments?${params.toString()}`, {
          headers: authHeaders,
          ...(signal ? { signal } : {}),
        });
        setList(data.data || []);
        setListMeta({
          total: data.total ?? 0,
          totalPages: data.totalPages ?? 0,
          page: data.page ?? page,
          limit: data.limit ?? PER_PAGE,
        });
      } catch (e) {
        if (e.name === "AbortError") return;
        if (e.status === 401) {
          sessionStorage.removeItem(tokenStorageKey());
          sessionStorage.removeItem(usernameStorageKey());
          setToken("");
          setAdminUsername("");
          setErr("Sesi habis, silakan login lagi.");
        } else setErr(e.message || "Gagal memuat daftar");
      } finally {
        if (!signal || !signal.aborted) setListLoading(false);
      }
    },
    [token, authHeaders, filter, debouncedSearch, page]
  );

  useEffect(() => {
    if (!token) return;
    fetchStats();
  }, [token, fetchStats]);

  useEffect(() => {
    if (!token) return;
    const ac = new AbortController();
    fetchList(ac.signal);
    return () => ac.abort();
  }, [token, fetchList]);

  const login = async (e) => {
    e.preventDefault();
    const u = usernameInput.trim();
    const p = passwordInput;
    if (!u || !p) return;
    setLoginSubmitting(true);
    setErr("");
    try {
      const data = await fetchJson("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      sessionStorage.setItem(tokenStorageKey(), data.token);
      sessionStorage.setItem(usernameStorageKey(), data.username || u);
      setToken(data.token);
      setAdminUsername(data.username || u);
      setUsernameInput("");
      setPasswordInput("");
    } catch (err) {
      setErr(err.message || "Login gagal");
    } finally {
      setLoginSubmitting(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(tokenStorageKey());
    sessionStorage.removeItem(usernameStorageKey());
    setToken("");
    setAdminUsername("");
    setList([]);
    setStats(null);
    setDetail(null);
    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
    setFilter("");
    setShowPwdModal(false);
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    setPwdMsg("");
    if (pwdNew.length < 8) {
      setPwdMsg("Password baru minimal 8 karakter.");
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdMsg("Konfirmasi password tidak sama.");
      return;
    }
    setPwdSubmitting(true);
    try {
      await fetchJson("/api/admin/password", {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: pwdCurrent,
          new_password: pwdNew,
        }),
      });
      setPwdMsg("Password berhasil diubah.");
      setPwdCurrent("");
      setPwdNew("");
      setPwdConfirm("");
      setTimeout(() => {
        setShowPwdModal(false);
        setPwdMsg("");
      }, 1200);
    } catch (err) {
      setPwdMsg(err.message || "Gagal mengubah password");
    } finally {
      setPwdSubmitting(false);
    }
  };

  const openDetail = async (id) => {
    setErr("");
    try {
      const row = await fetchJson(`/api/appointments/${id}`, { headers: authHeaders });
      setDetail(row);
    } catch (e) {
      if (e.status === 401) {
        sessionStorage.removeItem(tokenStorageKey());
        sessionStorage.removeItem(usernameStorageKey());
        setToken("");
        setAdminUsername("");
        setErr("Sesi habis, silakan login lagi.");
      } else setErr(e.message || "Gagal memuat detail");
    }
  };

  const updateStatus = async (id, status) => {
    setErr("");
    try {
      await fetchJson(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchStats();
      await fetchList(undefined);
      if (detail?.id === id) setDetail({ ...detail, status });
    } catch (e) {
      if (e.status === 401) {
        sessionStorage.removeItem(tokenStorageKey());
        sessionStorage.removeItem(usernameStorageKey());
        setToken("");
        setAdminUsername("");
        setDetail(null);
        setErr("Sesi habis, silakan login lagi.");
      } else setErr(e.message || "Gagal update status");
    }
  };

  const { total, totalPages, page: currentPage, limit } = listMeta;
  const fromRow = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const toRow = Math.min(currentPage * limit, total);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-300">
              <LayoutDashboard className="h-8 w-8" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold">Admin dashboard</h1>
            <p className="mt-2 text-sm text-slate-400">Login dengan akun admin (database).</p>
          </div>
          <form onSubmit={login} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
            <label className="block text-sm font-medium text-slate-300">Username</label>
            <input
              type="text"
              autoComplete="username"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-brand-500/30 focus:border-brand-500 focus:ring-4"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="admin"
            />
            <label className="mt-4 block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none ring-brand-500/30 focus:border-brand-500 focus:ring-4"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
            />
            {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
            <button
              type="submit"
              disabled={loginSubmitting}
              className="mt-6 w-full rounded-xl bg-brand-500 py-3 font-semibold text-slate-950 hover:bg-brand-400 disabled:opacity-60"
            >
              {loginSubmitting ? "Memproses…" : "Masuk"}
            </button>
            <p className="mt-4 text-center text-xs text-slate-500">
              Default setelah migrasi: user <span className="text-slate-400">admin</span> / pass{" "}
              <span className="text-slate-400">admin123</span> — segera ganti.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-semibold text-slate-900 sm:text-xl">
                Appointment pasien
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                {adminUsername ? `Masuk sebagai ${adminUsername}` : "Ringkasan & manajemen booking"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPwdMsg("");
                setPwdCurrent("");
                setPwdNew("");
                setPwdConfirm("");
                setShowPwdModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <KeyRound className="h-4 w-4" />
              <span className="hidden sm:inline">Password</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Total", value: stats.total, tone: "from-slate-800 to-slate-700" },
              { label: "Pending", value: stats.pending, tone: "from-amber-500 to-amber-600" },
              { label: "Dikonfirmasi", value: stats.confirmed, tone: "from-emerald-500 to-emerald-600" },
              { label: "Selesai", value: stats.completed, tone: "from-brand-500 to-brand-600" },
              { label: "Batal", value: stats.cancelled, tone: "from-slate-500 to-slate-600" },
            ].map((c) => (
              <div
                key={c.label}
                className={`rounded-2xl bg-gradient-to-br ${c.tone} p-4 text-white shadow-lg sm:p-5`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-white/80">{c.label}</p>
                <p className="mt-1 font-display text-2xl font-bold sm:text-3xl">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full flex-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Cari (nama, telepon, alamat, treatment, alergi)
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ketik lalu tunggu 1 detik…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none ring-slate-400/20 focus:border-slate-400 focus:ring-4"
              />
            </div>
            {searchInput.trim() !== debouncedSearch && (
              <p className="mt-1 text-xs text-slate-500">Pencarian dikirim ke server setelah jeda 1 detik.</p>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end lg:w-auto lg:min-w-[220px]">
            <div className="flex items-center gap-2 text-slate-600 sm:sr-only">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Status</span>
            </div>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm lg:min-w-[12rem]"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        )}

        <div className="mt-6">
          {listLoading ? (
            <p className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-500">
              Memuat data…
            </p>
          ) : list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-slate-500">
              {debouncedSearch || filter
                ? "Tidak ada hasil untuk filter / pencarian ini."
                : "Belum ada data appointment."}
            </p>
          ) : (
            <div className="space-y-3">
              {list.map((row) => (
                <article
                  key={row.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg font-semibold text-slate-900">
                          {row.full_name}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_BADGE[row.status] || "bg-slate-100 text-slate-800"}`}
                        >
                          {row.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-brand-600" />
                          {formatDt(row.appointment_datetime)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-4 w-4 text-brand-600" />
                          {row.phone_number}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-500">
                        <MapPin className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                        {row.homecare_address}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-stretch sm:flex-col">
                      <button
                        type="button"
                        onClick={() => openDetail(row.id)}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:min-w-[7rem]"
                      >
                        <Eye className="h-4 w-4" />
                        Detail
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!listLoading && total > 0 && (
            <div className="mt-6 flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:px-5">
              <p>
                Menampilkan <span className="font-semibold text-slate-900">{fromRow}</span>–
                <span className="font-semibold text-slate-900">{toRow}</span> dari{" "}
                <span className="font-semibold text-slate-900">{total}</span>
              </p>
              <div className="flex items-center justify-center gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </button>
                <span className="min-w-[5rem] text-center text-slate-500">
                  {currentPage} / {Math.max(1, totalPages)}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Berikutnya
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {showPwdModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Tutup"
            onClick={() => !pwdSubmitting && setShowPwdModal(false)}
          />
          <div className="relative z-[60] w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <h2 className="font-display text-lg font-semibold text-slate-900">Ganti password</h2>
              <button
                type="button"
                disabled={pwdSubmitting}
                onClick={() => setShowPwdModal(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitPasswordChange} className="mt-4 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Password saat ini</span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-400/20"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Password baru (min. 8 karakter)</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-400/20"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Ulangi password baru</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-400/20"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                />
              </label>
              {pwdMsg && (
                <p
                  className={`text-sm ${pwdMsg.includes("berhasil") ? "text-emerald-600" : "text-red-600"}`}
                >
                  {pwdMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={pwdSubmitting}
                className="w-full rounded-xl bg-slate-900 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {pwdSubmitting ? "Menyimpan…" : "Simpan password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Tutup"
            onClick={() => setDetail(null)}
          />
          <div className="relative z-50 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Detail #{detail.id}</h2>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Status</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["pending", "confirmed", "cancelled", "completed"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateStatus(detail.id, s)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                        detail.status === s
                          ? STATUS_BADGE[s]
                          : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Nama" value={detail.full_name} />
              <Field label="Jam & tanggal" value={formatDt(detail.appointment_datetime)} />
              <Field label="Alamat homecare" value={detail.homecare_address} />
              <Field label="Riwayat alergi" value={detail.allergy_history || "—"} />
              <Field label="Nomor aktif" value={detail.phone_number} />
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Treatment</p>
                <p className="mt-1 flex items-start gap-2 text-sm text-slate-800">
                  <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {detail.treatment}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
                    <PenLine className="h-3.5 w-3.5" />
                    Tanda tangan
                  </p>
                  {detail.signature_path ? (
                    <a
                      href={apiUrl(`/uploads/${detail.signature_path}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={apiUrl(`/uploads/${detail.signature_path}`)}
                        alt="Signature"
                        className="max-h-48 w-full object-contain"
                      />
                    </a>
                  ) : (
                    <p className="text-sm text-slate-500">—</p>
                  )}
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Bukti transfer
                  </p>
                  {detail.transfer_proof_path ? (
                    <a
                      href={apiUrl(`/uploads/${detail.transfer_proof_path}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={apiUrl(`/uploads/${detail.transfer_proof_path}`)}
                        alt="Bukti"
                        className="max-h-48 w-full object-contain"
                      />
                    </a>
                  ) : (
                    <p className="text-sm text-slate-500">Belum diunggah</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-400">Dibuat: {formatDt(detail.created_at)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  );
}
