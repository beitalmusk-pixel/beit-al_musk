# دليل الأمان وحماية سلاسل التوريد | BEIT AL-MUSK Security & Supply Chain Guide
**مشروع بيت المسك الملكي (BEIT AL-MUSK E-Commerce Platform)**  
*الإصدار: 2.2 • تاريخ التحديث: نوفمبر 2026 • الفئة: معايير الحماية والتشفير والامتثال*

---

## الفهرس العام (Table of Contents)
1. [المقدمة والملخص التنفيذي (Executive Summary)](#1-المقدمة-والملخص-التنفيذي)
2. [تثبيت إصدارات مكتبات الـ CDN والتحقق من النزاهة SRI (Supply Chain Security & SRI)](#2-تثبيت-إصدارات-مكتبات-الـ-cdn-والتحقق-من-النزاهة-sri)
3. [سياسة أمان المحتوى: الفرق بين ترويسة Meta وترويسة HTTP Response](#3-سياسة-أمان-المحتوى-الفرق-بين-ترويسة-meta-وترويسة-http-response)
4. [قيود استضافة GitHub Pages وحلول الحماية المتبعة (GitHub Pages Constraints & Solutions)](#4-قيود-استضافة-github-pages-وحلو-الحماية-المتبعة)
5. [دليل إعدادات الترويسات الأمنية لمختلف المنصات (Production Deployment Configurations)](#5-دليل-إعدادات-الترويسات-الأمنية-لمختلف-المنصات)
   - [Cloudflare Pages (`_headers`)](#أ-منصة-cloudflare-pages)
   - [Netlify (`netlify.toml`)](#ب-منصة-netlify)
   - [Vercel (`vercel.json`)](#ج-منصة-vercel)
   - [Cloudflare Rules / Transform Rules مع GitHub Pages](#د-استخدام-cloudflare-مع-github-pages)
   - [خوادم Nginx](#هـ-خوادم-nginx-reverse-proxy)
   - [خوادم Apache (`.htaccess`)](#و-خوادم-apache-htaccess)
6. [إجراءات الصيانة وتحديث التبعيات مستقبلاً (Maintenance & Upgrades)](#6-إجراءات-الصيانة-وتحديث-التبعيات-مستقبلاً)

---

## 1. المقدمة والملخص التنفيذي

تعتمد منصة **بيت المسك (BEIT AL-MUSK)** على معمارية العميل السحابي (Client-Side Cloud Architecture) فائقة الأداء، والمصممة للعمل بكفاءة تامة على استضافات الويب الثابتة (Static Hosts) مثل **GitHub Pages**، مع التزامن الفوري مع قواعد بيانات PostgreSQL السحابية (Supabase) و Firebase.

لضمان أعلى درجات الأمان للمستخدمين والمديرين، وتوفير حماية كاملة ضد هجمات **XSS (Cross-Site Scripting)**، و**Clickjacking**، وهجمات **Supply Chain Attacks** (اختراق سلاسل التوريد البرمجية)، تم تطبيق:
1. **تثبيت إصدارات CDN بدقة متناهية (Exact Dependency Pinning)** مع حذف كافة وسوم `@latest` أو النطاقات العائمة.
2. **تشفير التحقق من نزاهة الموارد الفرعية (Subresource Integrity - SRI)** باستخدام دوال التجزئة الرياضية `SHA-384`.
3. **تطبيق سياسة أمان المحتوى (Content Security Policy - CSP)** عبر وسم `<meta>` المتوافق مع GitHub Pages.
4. **حماية مضمنة ضد الاختطاف بالنقر (Anti-Clickjacking Defense)** تعمل على مستوى المتصفح حتى في غياب ترويسات HTTP للخادم.
5. **ملفات إعدادات ترويسات HTTP كاملة** للمنصات السحابية المتقدمة (`netlify.toml` و `vercel.json` و `_headers`).

---

## 2. تثبيت إصدارات مكتبات الـ CDN والتحقق من النزاهة SRI

### أ. مخاطر استخدام `@latest` أو الإصدارات العائمة
عند استدعاء مكتبة مثل `https://unpkg.com/lucide@latest` أو `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`:
- **خطر التغييرات الجذرية المفسدة (Breaking Changes):** قد يطلق مطورو المكتبة تحديثاً كبيراً يغير توقيع الدوال أو بنية الـ DOM، مما يعطل المتجر فجأة للمستخدمين.
- **خطر هجمات سلاسل التوريد (Supply Chain Attacks):** في حال تم اختراق حساب المطور على npm، يمكن للمهاجم رفع إصدار خبيث يحمل تروجان لسرقة جلسات الدخول أو بطاقات الائتمان، وسيتم تنزيله فوراً وتشغيله في متصفح عملائك دون علمك.

### ب. جدول المكتبات المثبتة ورموز الـ SRI (SHA-384 Integrity Hashes)
تم تثبيت كافة المكتبات الخارجية في صفحتي المتجر الرئيسي (`index.html`) وبوابة الإدارة (`admin.html`):

| المكتبة البرمجية | الإصدار المثبت | رابط الـ CDN الدقيق | قيمة التجزئة المشفرة (SRI Hash) |
| :--- | :--- | :--- | :--- |
| **Lucide Icons** | `0.468.0` | `https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js` | `sha384-uTYyvsSSUZeaPhb5RbKlQa0zY/WpX/QHfvg2mczXyBQOpkWPEDy9lczyp+w7SKXu` |
| **Supabase JS Client** | `2.47.10` | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.min.js` | `sha384-z4iWwfGok6nwo14qorcgp9QHDhY0q4kM3S2mWKmdxg/N9+jiyxlx6oqp6vHl3t8V` |
| **Three.js (3D Engine)** | `r128` | `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` | `sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu` |
| **GSAP (Animations)** | `3.12.2` | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js` | `sha384-d+vyQ0dYcymoP8ndq2hW7FGC50nqGdXUEgoOUGxbbkAJwZqL7h+jKN0GGgn9hFDS` |
| **Canvas Confetti** | `1.6.0` | `https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js` | `sha384-HAH79XdRvHr6axVGh4xQWVCp14kcd32bNk4Xu0sHDHtFQ42n6BAM8ykvB47dGz6D` |
| **Firebase App Compat** | `10.8.0` | `https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js` | `sha384-4gq9w/AGf72FXdNQ3Kn3EqWP7633NbCMjpYHt8YCZyXf23o2opcuAr4cif41tLrC` |
| **Firebase Firestore Compat**| `10.8.0` | `https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js` | `sha384-Qgqc/HETq5lqJnRDqWnV1AZGw3pgMYNUVaqLLN1W/55XuWK94epwbCQrOvdoh1Zo` |
| **Firebase Auth Compat** | `10.8.0` | `https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js` | `sha384-xtdq4MQqPj1dB5DQsuw9O7dh4kHhMP/Wp5u8O1jiaWiou13ZfJIgiccjtVK2pBhL` |

> [!IMPORTANT]
> **شرط `crossorigin="anonymous"`:**  
> لكي يقوم المتصفح بالتحقق من الـ SRI Hash لمورد خارجي مستضاف على دومين مختلف، يُشترط تزويد الوسم بخاصية `crossorigin="anonymous"`. تقوم شبكات الـ CDN العالمية المعتمدة (cdnjs, jsdelivr, unpkg, gstatic) بإرسال ترويسة `Access-Control-Allow-Origin: *`، مما يتيح للمتصفح مقارنة البايتات المحملة بالـ Hash بأمان.

---

## 3. سياسة أمان المحتوى: الفرق بين ترويسة Meta وترويسة HTTP Response

### أ. الترويسة عبر خادم الويب (Server HTTP Response Header)
ترسل كجزء من ترويسات بروتوكول HTTP قبل جسم الصفحة:
```http
HTTP/2 200 OK
Content-Type: text/html; charset=UTF-8
Content-Security-Policy: default-src 'self'; script-src 'self' ...
X-Frame-Options: SAMEORIGIN
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
- **المزايا:** تدعم 100% من معايير CSP Level 3، بما في ذلك `frame-ancestors`، `report-uri` / `report-to`، و `sandbox`.

### ب. الترويسة عبر وسوم الـ HTML (`<meta http-equiv="...">`)
تُكتب داخل وسم `<head>` في ملف الـ HTML:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' ...">
```

### ج. جدول مقارنة الفروق التقنية والمعايير (W3C CSP Level 2 & 3)

| الخاصية / التوجيه | HTTP Response Header | `<meta http-equiv="CSP">` | ملاحظات تقنية |
| :--- | :---: | :---: | :--- |
| `default-src`, `script-src`, `style-src` | ✅ مدعوم | ✅ مدعوم | يعمل بكفاءة تامة لحصر مصادر السكربتات والستايلات |
| `img-src`, `font-src`, `connect-src` | ✅ مدعوم | ✅ مدعوم | يقيد اتصالات الـ API وتحميل الصور والخطوط |
| `object-src`, `base-uri` | ✅ مدعوم | ✅ مدعوم | يمنع الثغرات المعتمدة على تغيير الدومين الأساسي |
| `frame-ancestors` (حماية تضمين iframe) | ✅ مدعوم | ❌ **ممنوع وفق المعيار** | تتجاهله المتصفحات عمداً داخل `<meta>` وتُصدر تحذيراً |
| `report-uri` / `report-to` | ✅ مدعوم | ❌ غير مدعوم | لا يمكن إرسال تقارير الانتهاك عبر وسم الـ meta |
| دعم الاستضافات الثابتة (GitHub Pages) | ❌ غير متاح | ✅ **متاح ويعمل فوراً** | الحل الأمثل للمشاريع المستضافة على خوادم لا تسمح بتعديل HTTP |

---

## 4. قيود استضافة GitHub Pages وحلول الحماية المتبعة

### أ. لماذا لا تستطيع GitHub Pages إرسال ترويسات HTTP مخصصة؟
**GitHub Pages** هي منصة استضافة ملفات ثابتة خلف شبكة CDN خاصة بـ Fastly/GitHub. لا تدعم GitHub Pages ملفات إعدادات خوادم مثل:
- `.htaccess` (الخاصة بـ Apache)
- `nginx.conf` (الخاصة بـ Nginx)
- `_headers` (الخاصة بـ Cloudflare Pages و Netlify)
- `netlify.toml` أو `vercel.json`

لذا، فإن أي محاولة لوضع ترويسة HTTP مخصصة عبر ملفات المشروع على GitHub Pages لن يكون لها أي تأثير على ترويسات خادم الويب الفعلي.

### ب. الحل المبتكر المطبق في بيت المسك
لتحقيق أعلى مستوى أمان على GitHub Pages:
1. **وسم CSP Meta محكم ومضبوط:**
   ```html
   <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.whatsapp.com https://wa.me https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; media-src 'self' data: blob:; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self';">
   ```
2. **وسم حماية تحويل المراجع (Referrer Policy):**
   ```html
   <meta name="referrer" content="strict-origin-when-cross-origin">
   ```
3. **وسم منع تخمين أنواع الملفات (Nosniff):**
   ```html
   <meta http-equiv="X-Content-Type-Options" content="nosniff">
   ```
4. **سكربت حماية متقدم ضد الـ Clickjacking (Anti-Clickjacking Frame-Busting Defense):**
   نظراً لأن وسم `<meta>` لا يستطيع تفعيل `frame-ancestors 'none'` وفق معيار W3C، تم تضمين تقنية حماية معتمدة من منظمة **OWASP**:
   ```html
   <!-- حماية المتصفح من هجمات الاختطاف بالنقر عند العمل على GitHub Pages -->
   <style id="antiClickjack">body{display:none !important;}</style>
   <script>
     if (self === top) {
       var antiClickjack = document.getElementById("antiClickjack");
       if (antiClickjack) antiClickjack.parentNode.removeChild(antiClickjack);
     } else {
       top.location = self.location;
     }
   </script>
   ```
   **آلية العمل:**
   - إذا تم تحميل المتجر في النافذة العادية (`self === top`)، يتم إزالة كود الإخفاء فوراً ويظهر الموقع في أجزاء من الألف من الثانية.
   - إذا حاول موقع خبيث تضمين المتجر أو لوحة تحكم الإدارة داخل `<iframe>`، تظل الصفحة مخفية تماماً (`display: none !important;`) ويجبر المتصفح على كسر الإطار فوراً (`top.location = self.location;`).

---

## 5. دليل إعدادات الترويسات الأمنية لمختلف المنصات

عند رغبة الإدارة بنقل الموقع أو توجيهه عبر مزود استضافة يدعم ترويسات HTTP الكاملة، تتوفر الإعدادات الجاهزة والمحدثة مباشرة في مستودع المشروع:

### أ. منصة Cloudflare Pages
تم تجهيز ملف `_headers` في جذر المشروع بالمحتوى التالي:
```http
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.whatsapp.com https://wa.me https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; media-src 'self' data: blob:; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';
```

### ب. منصة Netlify
تم تجهيز ملف `netlify.toml` في جذر المشروع:
```toml
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.whatsapp.com https://wa.me https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; media-src 'self' data: blob:; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';"
```

### ج. منصة Vercel
تم تجهيز ملف `vercel.json` في جذر المشروع:
```json
{
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.whatsapp.com https://wa.me https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; media-src 'self' data: blob:; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';" }
      ]
    }
  ]
}
```

### د. استخدام Cloudflare مع GitHub Pages
إذا كان المتجر مربوطاً بنطاق مخصص (Custom Domain مثل `beitalmusk.com`) عبر Cloudflare Proxy (السحابة البرتقالية):
1. توجه إلى لوحة تحكم Cloudflare.
2. اختر **Rules** -> **Transform Rules** -> **Modify Response Header**.
3. أضف القواعد التالية:
   - **Header Name:** `Content-Security-Policy`  
     **Value:** `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.whatsapp.com https://wa.me https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; frame-ancestors 'none';`
   - **Header Name:** `X-Frame-Options` -> **Value:** `SAMEORIGIN`
   - **Header Name:** `X-Content-Type-Options` -> **Value:** `nosniff`
   - **Header Name:** `Strict-Transport-Security` -> **Value:** `max-age=31536000; includeSubDomains; preload`
ستقوم شبكة Cloudflare بحقن هذه الترويسات تلقائياً في كل استجابة مرسلة من GitHub Pages.

### هـ. خوادم Nginx (Reverse Proxy)
```nginx
server {
    listen 443 ssl http2;
    server_name beitalmusk.com;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.whatsapp.com https://wa.me https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; frame-ancestors 'none'; base-uri 'self';" always;

    root /var/www/perfume-store;
    index index.html;
}
```

### و. خوادم Apache (`.htaccess`)
```apache
<IfModule mod_headers.c>
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.whatsapp.com https://wa.me https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; frame-ancestors 'none'; base-uri 'self';"
</IfModule>
```

---

## 6. إجراءات الصيانة وتحديث التبعيات مستقبلاً

عند الحاجة لتحديث أي مكتبة (مثلاً تحديث Lucide إلى إصدار جديد مستقبلاً):

1. **لا تستخدم `@latest` إطلاقاً.**
2. استخرج رابط الإصدار الدقيق (مثال: `https://unpkg.com/lucide@0.470.0/dist/umd/lucide.min.js`).
3. احسب قيمة الـ SRI SHA-384 باستخدام PowerShell:
   ```powershell
   $res = Invoke-WebRequest -Uri "https://unpkg.com/lucide@0.470.0/dist/umd/lucide.min.js" -UseBasicParsing
   $bytes = $res.RawContentStream.ToArray()
   $sha = [System.Security.Cryptography.SHA384]::Create().ComputeHash($bytes)
   $sri = "sha384-" + [Convert]::ToBase64String($sha)
   Write-Output $sri
   ```
4. حدّث الوسم في `index.html` و `admin.html`:
   ```html
   <script src="https://unpkg.com/lucide@0.470.0/dist/umd/lucide.min.js" integrity="sha384-..." crossorigin="anonymous"></script>
   ```
5. اختبر المتجر محلياً وتأكد من عدم ظهور أخطاء `Failed to find a valid digest in the 'integrity' attribute` في كونسول المتصفح.

---
**تم إعداد هذا التوثيق الأمني المعتمد لضمان استقرار وحماية متجر بيت المسك الملكي.**
