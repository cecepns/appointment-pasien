import { useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { id } from "date-fns/locale";
import {
  CalendarClock,
  Home,
  Phone,
  Stethoscope,
  AlertTriangle,
  User,
  Send,
  CheckCircle2,
  ImagePlus,
  Banknote,
} from "lucide-react";
import SignaturePad from "../components/SignaturePad";
import { apiUrl } from "../lib/api";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("id", id);

const NOTES = [
  "Usahakan datang tepat waktu karena jika terlambat akan mengganggu jadwal selanjutnya (jika di tempat kami).",
  "Untuk cancel, DP akan hangus; jika tidak cancel, DP dipotong dengan total treatment.",
  "Jika reschedule minimal H-1; jika di luar H-1, DP akan hangus.",
  "Jika sudah isi format, sudah ada persetujuan untuk treatment dan tidak ada paksaan terhadap kedua pihak — harap kirim bukti transfer.",
];

function formatLocalDatetimeForMysql(date) {
  const d = new Date(date);
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:00`;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-900 outline-none ring-slate-400/20 transition focus:border-slate-400 focus:bg-white focus:ring-4";

const pickerInputClass = `${inputClass} cursor-pointer`;

export default function AppointmentForm() {
  const [form, setForm] = useState({
    full_name: "",
    homecare_address: "",
    allergy_history: "",
    phone_number: "",
    treatment: "",
  });
  const [appointmentDate, setAppointmentDate] = useState(null);
  const [signatureBlob, setSignatureBlob] = useState(null);
  const [transferFile, setTransferFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!appointmentDate) {
      setError("Mohon pilih tanggal dan jam appointment.");
      return;
    }
    if (!signatureBlob) {
      setError("Mohon tanda tangan persetujuan treatment di bawah.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("full_name", form.full_name.trim());
      fd.append("appointment_datetime", formatLocalDatetimeForMysql(appointmentDate));
      fd.append("homecare_address", form.homecare_address.trim());
      fd.append("allergy_history", form.allergy_history.trim());
      fd.append("phone_number", form.phone_number.trim());
      fd.append("treatment", form.treatment.trim());
      fd.append("signature", signatureBlob, "signature.png");
      if (transferFile) fd.append("transfer_proof", transferFile);

      const res = await fetch(apiUrl("/api/appointments"), {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal mengirim");
      setDone(true);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold text-slate-900">
            Terima kasih
          </h1>
          <p className="mt-3 text-slate-600">
            Data appointment Anda telah kami terima. Silakan kirim bukti transfer melalui kontak
            klinik jika belum dilampirkan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-50">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Form appointment
            </p>
            <h1 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
              Pasien & persetujuan treatment
            </h1>
          </div>
          <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 sm:block">
            Homecare & klinik
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
        <form onSubmit={onSubmit} className="space-y-8">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="font-display text-lg font-semibold text-slate-900">Data pasien</h2>
            <p className="mt-1 text-sm text-slate-500">
              Lengkapi informasi berikut dengan jujur agar tim medis dapat melayani dengan aman.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <User className="h-4 w-4 text-slate-500" />
                  Nama
                </span>
                <input
                  required
                  className={inputClass}
                  value={form.full_name}
                  onChange={(e) => setField("full_name", e.target.value)}
                  placeholder="Nama lengkap"
                />
              </label>

              <label className="sm:col-span-2 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <CalendarClock className="h-4 w-4 text-slate-500" />
                  Jam & tanggal
                </span>
                <DatePicker
                  selected={appointmentDate}
                  onChange={(date) => {
                    setAppointmentDate(date);
                    setError("");
                  }}
                  showTimeSelect
                  timeIntervals={15}
                  timeCaption="Jam"
                  dateFormat="d MMMM yyyy HH:mm"
                  locale="id"
                  minDate={new Date()}
                  placeholderText="Klik untuk pilih tanggal & jam"
                  wrapperClassName="w-full block"
                  className={pickerInputClass}
                  calendarClassName="!font-sans"
                  popperClassName="z-[100]"
                  autoComplete="off"
                />
              </label>

              <label className="sm:col-span-2 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Home className="h-4 w-4 text-slate-500" />
                  Homecare
                </span>
                <span className="mb-1.5 block text-xs text-slate-500">
                  Harap diisi alamat lengkap beserta tower jika ada / sharelok.
                </span>
                <textarea
                  required
                  rows={3}
                  className={inputClass}
                  value={form.homecare_address}
                  onChange={(e) => setField("homecare_address", e.target.value)}
                  placeholder="Alamat lengkap, tower, patokan, sharelok..."
                />
              </label>

              <label className="sm:col-span-2 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Riwayat alergi
                </span>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={form.allergy_history}
                  onChange={(e) => setField("allergy_history", e.target.value)}
                  placeholder="Contoh: tidak ada / obat tertentu / lateks..."
                />
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Phone className="h-4 w-4 text-slate-500" />
                  Nomor yang aktif
                </span>
                <input
                  required
                  type="tel"
                  className={inputClass}
                  value={form.phone_number}
                  onChange={(e) => setField("phone_number", e.target.value)}
                  placeholder="WhatsApp / telepon"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Stethoscope className="h-4 w-4 text-slate-500" />
                  Treatment
                </span>
                <textarea
                  required
                  rows={3}
                  className={inputClass}
                  value={form.treatment}
                  onChange={(e) => setField("treatment", e.target.value)}
                  placeholder="Jenis treatment yang diinginkan"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Banknote className="h-5 w-5 shrink-0 text-slate-600" />
              <div>
                <p className="font-semibold text-slate-900">Rp. 300.000 — DP minimal</p>
                <p className="text-sm text-slate-600">Transfer ke rekening BCA (sesuai instruksi klinik).</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold text-amber-950">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Catatan penting
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-950/90">
              {NOTES.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Surat persetujuan treatment
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Dengan menandatangani di bawah, saya menyatakan persetujuan untuk treatment yang
              dijelaskan dan memahami tidak ada paksaan dari kedua pihak.
            </p>
            <div className="mt-5">
              <SignaturePad onChange={setSignatureBlob} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="font-display text-lg font-semibold text-slate-900">Bukti transfer (opsional)</h2>
            <p className="mt-1 text-sm text-slate-500">
              Unggah screenshot bukti transfer. Anda juga dapat mengirimnya nanti melalui chat
              resmi klinik.
            </p>
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 transition hover:border-slate-300 hover:bg-slate-100/50">
              <ImagePlus className="h-10 w-10 text-slate-400" />
              <span className="mt-2 text-sm font-medium text-slate-700">
                {transferFile ? transferFile.name : "Klik untuk memilih gambar"}
              </span>
              <span className="text-xs text-slate-500">JPEG, PNG, WebP — maks. 8MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => setTransferFile(e.target.files?.[0] || null)}
              />
            </label>
          </section>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              "Mengirim..."
            ) : (
              <>
                <Send className="h-5 w-5" />
                Kirim appointment
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-400">
          Data Anda digunakan untuk keperluan medis dan administrasi appointment sesuai kebijakan
          klinik.
        </p>
      </main>
    </div>
  );
}
