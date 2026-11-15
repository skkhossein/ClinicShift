import { useCallback, useEffect, useState } from "react";

type Shift = { id: number; shift_date: string; period: "morning" | "afternoon"; capacity: number; booked: number; is_open: number };
type RequestItem = { id: number; full_name: string; mobile: string; note: string | null; status: "pending" | "approved" | "rejected"; shift_date: string; period: "morning" | "afternoon"; created_at: string };
const periodName = (p: string) => p === "morning" ? "صبح" : "بعدازظهر";
const dateName = (value: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "full" }).format(new Date(value + "T12:00:00"));
const statusName = (s: string) => s === "pending" ? "در انتظار بررسی" : s === "approved" ? "پذیرفته‌شده" : "ردشده";

export default function App() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [adminReady, setAdminReady] = useState(false);
  const [form, setForm] = useState({ shiftId: "", fullName: "", mobile: "", note: "" });
  const [newShift, setNewShift] = useState({ shift_date: "", period: "morning", capacity: "5" });

  const loadShifts = useCallback(async () => {
    try {
      const response = await fetch("/api/shifts");
      const data = await response.json() as { shifts?: Shift[]; error?: string };
      if (!response.ok) throw new Error(data.error || "دریافت شیفت‌ها ناموفق بود");
      setShifts(data.shifts || []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "خطا در ارتباط با سرور"); }
  }, []);

  const loadRequests = useCallback(async () => {
    if (!adminReady || !adminToken) return;
    const response = await fetch("/api/admin/requests", { headers: { Authorization: `Bearer ${adminToken}` } });
    const data = await response.json() as { requests?: RequestItem[]; error?: string };
    if (!response.ok) throw new Error(data.error || "دریافت درخواست‌ها ناموفق بود");
    setRequests(data.requests || []);
  }, [adminReady, adminToken]);

  useEffect(() => { void loadShifts(); }, [loadShifts]);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, shiftId: Number(form.shiftId) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "ثبت درخواست انجام نشد");
      setNotice("درخواست شما ثبت شد و پس از بررسی مدیر نتیجه اعلام می‌شود.");
      setForm({ shiftId: "", fullName: "", mobile: "", note: "" });
      await loadShifts();
    } catch (error) { setNotice(error instanceof Error ? error.message : "خطای نامشخص"); }
    finally { setBusy(false); }
  }

  async function loginAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try { await loadRequests(); setAdminReady(true); setNotice("ورود به پنل مدیریت انجام شد."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "ورود ناموفق بود"); }
    finally { setBusy(false); }
  }

  async function decide(id: number, status: "approved" | "rejected") {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "ثبت تصمیم ناموفق بود");
      await loadRequests(); await loadShifts(); setNotice("وضعیت درخواست به‌روزرسانی شد.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "خطای نامشخص"); }
    finally { setBusy(false); }
  }

  async function createShift(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/admin/shifts", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ ...newShift, capacity: Number(newShift.capacity) }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "ایجاد شیفت ناموفق بود");
      await loadShifts(); setNotice("شیفت جدید ایجاد شد.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "خطای نامشخص"); }
    finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">C</span><span>Clinic<span className="brand-accent">Shift</span><small>سامانه مدیریت شیفت</small></span></a><button className="admin-link" onClick={() => setAdminOpen(!adminOpen)}> <span>⌘</span> پنل مدیریت</button></header>
    <section className="hero"><div className="hero-copy"><span className="eyebrow">سامانه هوشمند پذیرش شیفت</span><h1>شیفت مناسب خودت را<br/><em>انتخاب کن.</em></h1><p>درخواست شیفت‌های روز جمعه را ثبت کن؛ پس از بررسی و تأیید مدیر، نتیجه به شما اطلاع داده می‌شود.</p><a className="hero-cta" href="#available">مشاهده شیفت‌ها <span>←</span></a></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="calendar-card"><div className="calendar-top">CLINICSHIFT <span>●</span></div><div className="calendar-month">جمعه‌های پیش رو</div><div className="calendar-days"><b>ش</b><b>ی</b><b>د</b><b>س</b><b>چ</b><b>پ</b><b>ج</b>{["۲۵","۲۶","۲۷","۲۸","۲۹","۳۰","۱"].map((d,i)=><span className={i===6?"selected":""} key={i}>{d}</span>)}</div><div className="calendar-foot"><i/> برنامه‌ریزی ساده، پذیرش شفاف</div></div><div className="floating-pill">✦ ظرفیت قابل تنظیم</div></div></section>
    <section className="stats"><div><strong>{shifts.length.toLocaleString("fa-IR")}</strong><span>شیفت قابل انتخاب</span></div><div><strong>۲</strong><span>نوبت در روز جمعه</span></div><div><strong>۱۰۰٪</strong><span>بررسی با تأیید مدیر</span></div></section>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
    <section className="content-grid" id="available"><div className="section-heading"><div><span className="eyebrow">برنامه هفتگی</span><h2>شیفت‌های فعال</h2></div><span className="live-dot">به‌روز</span></div>
      <div className="shift-list">{shifts.length === 0 ? <div className="empty-state"><span>◷</span><h3>هنوز شیفتی تعریف نشده</h3><p>برای شروع، مدیر باید تاریخ و ظرفیت شیفت‌ها را در پنل مدیریت ثبت کند.</p></div> : shifts.map(shift => <article className="shift-card" key={shift.id}><div className="shift-date"><span>{periodName(shift.period)}</span><strong>{dateName(shift.shift_date)}</strong></div><div className="capacity"><div className="capacity-label"><span>ظرفیت باقی‌مانده</span><b>{Math.max(0, shift.capacity - shift.booked).toLocaleString("fa-IR")} از {shift.capacity.toLocaleString("fa-IR")}</b></div><div className="progress"><i style={{ width: `${Math.min(100, shift.booked / shift.capacity * 100)}%` }}/></div></div><button className="choose-button" disabled={!shift.is_open || shift.booked >= shift.capacity} onClick={() => { setForm(v => ({ ...v, shiftId: String(shift.id) })); document.getElementById("request-form")?.scrollIntoView({ behavior: "smooth" }); }}>{shift.booked >= shift.capacity ? "تکمیل ظرفیت" : "درخواست شیفت"}</button></article>)}</div>
    </section>
    <section className="request-panel" id="request-form"><div className="section-heading"><div><span className="eyebrow">فرم متقاضی</span><h2>ثبت درخواست شیفت</h2></div><span className="form-icon">↗</span></div><form onSubmit={submitRequest} className="request-form"><label>نام و نام خانوادگی<input required minLength={3} maxLength={100} placeholder="نام کامل خود را وارد کنید" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })}/></label><label>شماره همراه<input required inputMode="tel" pattern="09[0-9]{9}" placeholder="09123456789" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })}/></label><label className="wide">شیفت مورد نظر<select required value={form.shiftId} onChange={e => setForm({ ...form, shiftId: e.target.value })}><option value="">انتخاب شیفت</option>{shifts.filter(s => s.is_open && s.booked < s.capacity).map(s => <option key={s.id} value={s.id}>{dateName(s.shift_date)} - {periodName(s.period)}</option>)}</select></label><label className="wide">توضیحات (اختیاری)<textarea rows={3} maxLength={500} placeholder="اگر توضیحی دارید بنویسید..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}/></label><button className="submit-button wide" disabled={busy || !shifts.length}>{busy ? "لطفاً صبر کنید..." : "ثبت درخواست و ارسال برای بررسی"}</button><p className="form-hint wide">ثبت درخواست به معنی پذیرش قطعی نیست و پس از تأیید مدیر نهایی می‌شود.</p></form></section>
    {adminOpen && <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">دسترسی مدیر</span><h2>مدیریت درخواست‌ها</h2></div><button className="close-button" onClick={() => { setAdminOpen(false); setAdminReady(false); setAdminToken(""); }}>بستن ×</button></div>{!adminReady ? <form className="admin-login" onSubmit={loginAdmin}><label>توکن دسترسی مدیر<input type="password" required value={adminToken} onChange={e => setAdminToken(e.target.value)} placeholder="توکن امن مدیر"/></label><button className="submit-button" disabled={busy}>ورود</button></form> : <><form className="new-shift-form" onSubmit={createShift}><h3>تعریف شیفت جمعه</h3><label>تاریخ میلادی<input type="date" required value={newShift.shift_date} onChange={e => setNewShift({ ...newShift, shift_date: e.target.value })}/></label><label>نوبت<select value={newShift.period} onChange={e => setNewShift({ ...newShift, period: e.target.value })}><option value="morning">صبح</option><option value="afternoon">بعدازظهر</option></select></label><label>ظرفیت<input type="number" min="1" max="500" required value={newShift.capacity} onChange={e => setNewShift({ ...newShift, capacity: e.target.value })}/></label><button className="submit-button" disabled={busy}>افزودن شیفت</button></form><div className="request-table"><h3>درخواست‌های ثبت‌شده</h3>{requests.length === 0 ? <p className="muted">درخواستی ثبت نشده است.</p> : requests.map(item => <article className="request-row" key={item.id}><div><strong>{item.full_name}</strong><span>{item.mobile} · {dateName(item.shift_date)} · {periodName(item.period)}</span>{item.note && <small>{item.note}</small>}</div><div className="row-actions"><span className={`status status-${item.status}`}>{statusName(item.status)}</span>{item.status === "pending" && <><button onClick={() => decide(item.id, "approved")} disabled={busy}>تأیید</button><button className="reject" onClick={() => decide(item.id, "rejected")} disabled={busy}>رد</button></>}</div></article>)}</div></>}</section>}
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark">C</span><span>Clinic<span className="brand-accent">Shift</span></span></a><span>طراحی‌شده برای مدیریت شفاف شیفت‌ها</span><span>© 2026 ClinicShift</span></footer>
  </main>;
}