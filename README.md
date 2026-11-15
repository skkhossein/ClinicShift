# ClinicShift

سامانه مدیریت و پذیرش درخواست شیفت برای مراکز درمانی؛ رابط فارسی و راست‌چین با تم ترکیبی.

## قابلیت‌های نسخه آغازین

- تعریف شیفت‌های روز جمعه در دو نوبت صبح و بعدازظهر
- ظرفیت مستقل و قابل تنظیم برای هر شیفت
- ثبت درخواست متقاضی با وضعیت اولیه «در انتظار بررسی»
- تأیید یا رد درخواست فقط از پنل مدیر
- جلوگیری از ثبت درخواست تکراری و عبور از ظرفیت
- صف اعلان و ارسال نتیجه به یک گروه و یک کانال بله
- endpoint سلامت سرویس در `/api/health`
- استقرار خودکار با GitHub Actions پس از Push به شاخه `main`

## فناوری

React، TypeScript، Vite، Tailwind CSS، Cloudflare Workers، Cloudflare D1 و Wrangler.

## اجرای محلی در ویندوز

Node.js 22 را نصب کنید، سپس در PowerShell:

```powershell
git clone https://github.com/skkhossein/ClinicShift.git
cd ClinicShift
npm install
Copy-Item .dev.vars.example .dev.vars
npm run dev
```

فایل `.dev.vars` را با مقادیر آزمایشی و محرمانه خود تکمیل کنید. این فایل در Git ثبت نمی‌شود.

## راه‌اندازی Cloudflare

1. در Cloudflare یک D1 Database با نام دقیق `clinicshift-db` بسازید.
2. شناسه واقعی دیتابیس را به جای `REPLACE_WITH_D1_DATABASE_ID` در `wrangler.jsonc` قرار دهید.
3. Secrets مربوط به Worker را تنظیم کنید:
   - `ADMIN_API_TOKEN`
   - `BALE_BOT_TOKEN`
   - `BALE_GROUP_CHAT_ID`
   - `BALE_CHANNEL_CHAT_ID`
4. در GitHub → Settings → Secrets and variables → Actions این دو Secret را اضافه کنید:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
5. پس از آماده شدن D1 و Secretها، Push به `main` باعث اجرای workflow می‌شود.

اجرای دستی migration:

```bash
npx wrangler d1 migrations apply clinicshift-db --remote
```

## API

- `GET /api/health` — وضعیت Worker و اتصال D1
- `GET /api/shifts` — شیفت‌های فعال و ظرفیت باقی‌مانده
- `POST /api/requests` — ثبت درخواست عمومی
- `GET /api/admin/requests` — فهرست درخواست‌ها (نیازمند Bearer token)
- `POST /api/admin/shifts` — تعریف شیفت جمعه (نیازمند Bearer token)
- `PATCH /api/admin/requests/:id` — تأیید یا رد درخواست (نیازمند Bearer token)

## اعلان‌های بله

Worker پیام‌های ثبت درخواست و نتیجه بررسی را در صف D1 قرار می‌دهد. Cron هر پنج دقیقه صف را بررسی و پیام را به هر دو مقصد تعیین‌شده ارسال می‌کند. برای ارسال، ربات باید در گروه و کانال دسترسی لازم داشته باشد.

## نکات امنیتی و وضعیت

- هیچ توکن یا رمز واقعی در مخزن قرار ندهید.
- توکن مدیر فقط در درخواست‌های مدیریتی به‌صورت Bearer ارسال می‌شود.
- درخواست‌ها تا زمان تصمیم مدیر در حالت pending باقی می‌مانند و ظرفیت را رزرو می‌کنند.
- این نسخه اسکلت اولیه است؛ پیش از بهره‌برداری واقعی باید دسترسی مدیر، تنظیمات مقصد بله، تست بار/همزمانی، سیاست نگهداری داده و الزامات امنیتی سازمان بررسی شوند.
- تقویم در رابط فارسی نمایش شمسی دارد؛ تاریخ ورودی مدیر در نسخه اولیه میلادی است و فقط جمعه بودن آن اعتبارسنجی می‌شود.
