export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_API_TOKEN?: string;
  BALE_BOT_TOKEN?: string;
  BALE_GROUP_CHAT_ID?: string;
  BALE_CHANNEL_CHAT_ID?: string;
  APP_NAME?: string;
  TIME_ZONE?: string;
}
type Period = "morning" | "afternoon";
type RequestStatus = "pending" | "approved" | "rejected";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const validDate = (s: unknown): s is string => { if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s + "T00:00:00Z"); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s; };
const periodLabel = (p: string) => p === "morning" ? "صبح" : "بعدازظهر";
function isAdmin(request: Request, env: Env) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(env.ADMIN_API_TOKEN && token && token === env.ADMIN_API_TOKEN);
}
async function queueNotice(env: Env, message: string) {
  await env.DB.prepare("INSERT INTO notification_outbox (message) VALUES (?)").bind(message).run();
}
async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/health") {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      return json({ ok: true, service: env.APP_NAME || "ClinicShift", database: "connected", timestamp: new Date().toISOString() });
    } catch { return json({ ok: false, service: "ClinicShift", database: "unavailable" }, 503); }
  }
  if (request.method === "GET" && path === "/api/shifts") {
    const result = await env.DB.prepare(`SELECT s.id, s.shift_date, s.period, s.capacity, s.is_open,
      COUNT(r.id) AS booked
      FROM shifts s LEFT JOIN shift_requests r ON r.shift_id = s.id AND r.status IN ('pending','approved')
      WHERE s.is_open = 1 AND s.shift_date >= date('now')
      GROUP BY s.id ORDER BY s.shift_date, CASE s.period WHEN 'morning' THEN 0 ELSE 1 END`).all();
    return json({ shifts: result.results });
  }
  if (request.method === "POST" && path === "/api/requests") {
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return fail("بدنه درخواست معتبر نیست."); }
    const shiftId = Number(body.shiftId);
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const mobile = typeof body.mobile === "string" ? body.mobile.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    if (!Number.isInteger(shiftId) || shiftId < 1 || fullName.length < 3 || fullName.length > 100 || !/^09\d{9}$/.test(mobile)) return fail("اطلاعات نامعتبر است؛ نام، شماره همراه و شیفت را بررسی کنید.");
    const shift = await env.DB.prepare("SELECT id, shift_date, period, capacity, is_open FROM shifts WHERE id = ?").bind(shiftId).first<{id:number;shift_date:string;period:Period;capacity:number;is_open:number}>();
    if (!shift || !shift.is_open || !validDate(shift.shift_date)) return fail("این شیفت در دسترس نیست.", 404);
    const booked = await env.DB.prepare("SELECT COUNT(*) AS total FROM shift_requests WHERE shift_id = ? AND status IN ('pending','approved')").bind(shiftId).first<{total:number}>();
    if ((booked?.total || 0) >= shift.capacity) return fail("ظرفیت این شیفت تکمیل شده است.", 409);
    try {
      const result = await env.DB.prepare("INSERT INTO shift_requests (shift_id, full_name, mobile, note) VALUES (?, ?, ?, ?)").bind(shiftId, fullName, mobile, note || null).run();
      try {
        await queueNotice(env, `درخواست جدید شیفت\nنام: ${fullName}\nهمراه: ${mobile}\nتاریخ: ${shift.shift_date}\nنوبت: ${periodLabel(shift.period)}\nوضعیت: در انتظار تأیید مدیر\nکد درخواست: ${result.meta.last_row_id}`);
      } catch { /* Keep the accepted request even if the notification queue is temporarily unavailable. */ }
      return json({ ok: true, id: result.meta.last_row_id, status: "pending" }, 201);
    } catch (error) {
      const message = String(error);
      if (message.includes("SHIFT_FULL")) return fail("ظرفیت این شیفت تکمیل شده است.", 409);
      if (message.includes("idx_one_active_request_per_person_shift") || message.includes("UNIQUE constraint failed")) return fail("برای این شیفت قبلاً درخواست فعال ثبت کرده‌اید.", 409);
      return fail("ثبت درخواست انجام نشد.", 500);
    }
  }
  if (path.startsWith("/api/admin/")) {
    if (!isAdmin(request, env)) return fail("دسترسی غیرمجاز است.", 401);
    if (request.method === "GET" && path === "/api/admin/requests") {
      const result = await env.DB.prepare(`SELECT r.id, r.full_name, r.mobile, r.note, r.status, r.created_at,
        s.shift_date, s.period FROM shift_requests r JOIN shifts s ON s.id = r.shift_id
        ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, r.created_at DESC LIMIT 300`).all();
      return json({ requests: result.results });
    }
    if (request.method === "POST" && path === "/api/admin/shifts") {
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; } catch { return fail("بدنه درخواست معتبر نیست."); }
      const shiftDate = body.shift_date;
      const period = body.period;
      const capacity = Number(body.capacity);
      if (!validDate(shiftDate) || new Date(shiftDate + "T00:00:00Z").getUTCDay() !== 5) return fail("تاریخ باید یک جمعه معتبر باشد.");
      if (period !== "morning" && period !== "afternoon") return fail("نوبت انتخاب‌شده معتبر نیست.");
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return fail("ظرفیت باید بین ۱ تا ۵۰۰ باشد.");
      try {
        const result = await env.DB.prepare("INSERT INTO shifts (shift_date, period, capacity) VALUES (?, ?, ?)").bind(shiftDate, period, capacity).run();
        return json({ ok: true, id: result.meta.last_row_id }, 201);
      } catch { return fail("برای این تاریخ و نوبت، شیفتی از قبل ثبت شده یا داده‌ها نامعتبرند.", 409); }
    }
    const match = path.match(/^\/api\/admin\/requests\/(\d+)$/);
    if (request.method === "PATCH" && match) {
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; } catch { return fail("بدنه درخواست معتبر نیست."); }
      const status = body.status as RequestStatus;
      if (!["approved", "rejected"].includes(status)) return fail("وضعیت انتخاب‌شده معتبر نیست.");
      const id = Number(match[1]);
      const item = await env.DB.prepare(`SELECT r.id, r.full_name, r.mobile, r.status, s.shift_date, s.period
        FROM shift_requests r JOIN shifts s ON s.id = r.shift_id WHERE r.id = ?`).bind(id).first<{id:number;full_name:string;mobile:string;status:RequestStatus;shift_date:string;period:Period}>();
      if (!item) return fail("درخواست پیدا نشد.", 404);
      if (item.status !== "pending") return fail("این درخواست قبلاً بررسی شده است.", 409);
      await env.DB.prepare("UPDATE shift_requests SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = 'pending'").bind(status, id).run();
      await queueNotice(env, `نتیجه بررسی درخواست شیفت\nنام: ${item.full_name}\nهمراه: ${item.mobile}\nتاریخ: ${item.shift_date}\nنوبت: ${periodLabel(item.period)}\nنتیجه: ${status === "approved" ? "تأیید شد" : "رد شد"}\nکد درخواست: ${id}`);
      return json({ ok: true, status });
    }
  }
  return fail("مسیر پیدا نشد.", 404);
}
async function sendPendingNotifications(env: Env) {
  if (!env.BALE_BOT_TOKEN || !env.BALE_GROUP_CHAT_ID || !env.BALE_CHANNEL_CHAT_ID) return;
  const rows = await env.DB.prepare("SELECT id, message, attempts FROM notification_outbox WHERE status = 'pending' ORDER BY id LIMIT 20").all<{id:number;message:string;attempts:number}>();
  const chats = [env.BALE_GROUP_CHAT_ID, env.BALE_CHANNEL_CHAT_ID];
  for (const row of rows.results) {
    let delivered = true;
    let lastError = "";
    for (const chatId of chats) {
      try {
        const response = await fetch(`https://tapi.bale.ai/bot${env.BALE_BOT_TOKEN}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: row.message })
        });
        const data = await response.json() as { ok?: boolean; description?: string };
        if (!response.ok || !data.ok) { delivered = false; lastError = data.description || `HTTP ${response.status}`; }
      } catch (error) { delivered = false; lastError = String(error); }
    }
    await env.DB.prepare("UPDATE notification_outbox SET status = ?, attempts = attempts + 1, last_error = ?, sent_at = CASE WHEN ? = 'sent' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE sent_at END WHERE id = ?")
      .bind(delivered ? "sent" : "pending", lastError || null, delivered ? "sent" : "pending", row.id).run();
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": url.origin, "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" } });
      try { return await api(request, env); } catch { return fail("خطای داخلی سرویس.", 500); }
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sendPendingNotifications(env));
  }
};