# LGS Koçu — Ücretsiz & Herkese Açık Web Sitesi Kurulumu

Uygulama 3 parçadan oluşur. Üçü de ücretsiz katmanlarla herkese açık yayınlanabilir.

## 1) Veritabanı — MongoDB Atlas (Ücretsiz M0)
1. https://www.mongodb.com/cloud/atlas/register → ücretsiz hesap aç.
2. "Create" → **M0 (Free)** cluster oluştur (bir bölge seç, örn. Frankfurt).
3. Database Access → bir kullanıcı adı/şifre oluştur.
4. Network Access → "Allow access from anywhere" (0.0.0.0/0).
5. "Connect" → "Drivers" → bağlantı dizesini kopyala:
   `mongodb+srv://KULLANICI:SIFRE@cluster0.xxxx.mongodb.net/lgskocu`

## 2) Backend — Render (Ücretsiz Web Service)
1. https://render.com → GitHub ile giriş yap.
2. Projeyi (bu kod) kendi GitHub deponuza gönderin (Emergent'teki "Save to GitHub" / Publish → GitHub).
3. Render → "New +" → **Web Service** → depoyu seç.
4. Ayarlar:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Environment → şu değişkenleri ekle:
   - `MONGO_URL` = Atlas bağlantı dizesi
   - `DB_NAME` = `lgskocu`
   - `ADMIN_USERNAME` = `admin`
   - `ADMIN_PASSWORD` = `720587`
   - (varsa diğer gizli anahtarlar)
6. Deploy → size `https://lgskocu-api.onrender.com` gibi bir public adres verir.
   NOT: Ücretsiz katman boşta kalınca uyur; ilk istek 20-30 sn gecikebilir.

## 3) Frontend (Web Sitesi) — Netlify veya Vercel (Ücretsiz, Public)
1. Build'den önce backend adresini bağla. `frontend/.env` içinde:
   `EXPO_PUBLIC_BACKEND_URL=https://lgskocu-api.onrender.com`  (kendi Render adresiniz)
2. Statik siteyi üret:
   `cd frontend && yarn install && yarn expo export -p web`
   → `frontend/dist/` klasörü oluşur.
3. **Netlify (en kolay):** https://app.netlify.com → "Add new site" → "Deploy manually" →
   `frontend/dist` klasörünü sürükle-bırak. Size `https://okuladi.netlify.app` adresi verir.
   **Vercel alternatifi:** `vercel` CLI veya panelden `dist` klasörünü yükle.

## Önemli Notlar
- **E-posta/şifre ile giriş** (öğrenci, koç, veli, yönetici) dış barındırmada sorunsuz çalışır.
- **Google ile Giriş** ve **şifre sıfırlama e-postaları** Emergent'in yönettiği servislerdir; Emergent dışı
  barındırmada çalışmayabilir. Okul içi kullanım için e-posta/şifre girişi yeterlidir; Google butonu
  isteğe bağlı gizlenebilir.
- Yönetici paneli: giriş ekranına kullanıcı adı `admin`, şifre `720587` yazılarak açılır.
- Görünüm: masaüstünde ortalanmış, telefon genişliğinde temiz bir sütun olarak gösterilir.
