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
- استقرار خودکار با GitHub Actions پس از Push به شاخه `main` (پس از فعال‌سازی صریح)

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

دیتابیس تولیدی این پروژه از قبل با نام دقیق `clinicshift-prod` ساخته شده است. شناسه آن در `wrangler.jsonc` ثبت شده است؛ نیازی به ساخت دیتابیس دیگری نیست.

1. Binding با نام `DB` در `wrangler.jsonc` به دیتابیس `clinicshift-prod` متصل است.
2. ساختار اولیه دیتابیس در داشبورد Cloudflare ایجاد شده است. فایل `migrations/0001_init.sql` از `IF NOT EXISTS` استفاده می‌کند تا بتوان آن را با Wrangler برای ثبت تاریخچه migration نیز اعمال کرد. پیش از اجرای workflow، باید مطمئن شوید همین نسخه فایل روی همین دیتابیس اعمال می‌شود.
3. Secrets مربوط به Worker را در تنظیمات Worker تنظیم کنید:
   - `ADMIN_API_TOKEN`
   - `BALE_BOT_TOKEN`
   - `BALE_GROUP_CHAT_ID`
   - `BALE_CHANNEL_CHAT_ID`
4. در GitHub → Settings → Secrets and variables → Actions این دو Secret را اضافه کنید:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
5. فقط پس از تکمیل و بررسی موارد بالا، در Settings → Secrets and variables → Actions → Variables متغیر `CLOUDFLARE_DEPLOY_ENABLED=true` را بسازید. تا قبل از آن، workflow به‌صورت امن Skip می‌شود.

API Token کلودفلر باید حداقل مجوزهای لازم برای استقرار Workers و اعمال D1 migrations را داشته باشد. توکن را در مخزن یا گفتگو قرار ندهید.

اجرای دستی migration:

```bash
npx wrangler d1 migrations apply clinicshift-prod --remote
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
