# Fokolik - Futbol Bahis Simülasyonu ⚽

Fokolik, gerçek zamanlı maç verilerini kullanarak sanal paralarla (coin) futbol bahsi yapabileceğiniz eğlenceli ve interaktif bir bahis simülasyonu projesidir. Proje hiçbir şekilde gerçek para içermez; sadece eğlence amaçlı canlı skor takibi ve oran analizi sunar.

## 🚀 Projenin Özellikleri

- **Sanal Para ile Bahis:** Kullanıcılara başlangıçta verilen coin'ler üzerinden kupon oluşturma.
- **Canlı Bülten ve Oranlar:** Yaklaşan ve canlı oynanan maçları güncel iddaa oranlarıyla listeleme.
- **Canlı Maç Takibi:** Oynanan maçların skor ve dakika bilgilerinin anlık güncellenmesi ve kupon panelinde (Footer) parlama (flash) efektleriyle sunulması.
- **Akıllı UI/UX:** Kuponları bir sepet gibi sağ alt köşede yüzer (floating) widget şeklinde yönetme, canlı maçlarda otomatik pasifleşen oran butonları, esnek sekme (tab) yapısı.

## 🛠️ Kullanılan Teknolojiler

**Frontend:**
- [React](https://reactjs.org/) & [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/) (İkonlar)

**Backend:**
- [FastAPI](https://fastapi.tiangolo.com/) (Hızlı, modern API Geliştirme)
- [SQLAlchemy](https://www.sqlalchemy.org/) & [Alembic](https://alembic.sqlalchemy.org/) (Veritabanı yönetimi ve ORM)
- [SQLite](https://www.sqlite.org/) (Hafif ve yerel veritabanı)
- [HTTPX](https://www.python-httpx.org/) (Asenkron ve senkron dış API çağrıları)

---

## 💻 Kurulum ve Çalıştırma (Local Environment)

Projeyi yerel bilgisayarınızda çalıştırmak için **Frontend**, **Backend** ve arka planda çalışan **Worker** (işçi) script'lerini ayrı ayrı ayağa kaldırmanız gerekir.

### 1. Backend Kurulumu ve Başlatılması

Öncelikle bir terminal açın ve `backend` klasörüne gidin:
```bash
cd backend
```

Gerekli paketleri kurun (Eğer sanal ortam kullanıyorsanız önce `.venv`'i aktifleştirin):
```bash
pip install -r requirements.txt
```

Veritabanını oluşturun / güncelleyin:
```bash
alembic upgrade head
```

Backend'i (API ve Arka plan işçilerini) tek komutla başlatmak için:
```bash
python run_all.py
```
*(Bu komut FastAPI sunucusunu, oran çekiciyi ve canlı skor çekiciyi tek bir yöneticide başlatır.)*

### 2. Frontend Kurulumu ve Başlatılması

Yeni bir terminal açın ve `frontend` klasörüne gidin:
```bash
cd frontend
```

Gerekli node modüllerini kurun:
```bash
npm install
```

Geliştirme (development) sunucusunu başlatın:
```bash
npm run dev
```

*(Uygulamaya genellikle http://localhost:5173 adresinden erişebilirsiniz.)*

---

## 🌍 Production (Canlı) Ortama Taşıma

Fokolik'in backend'ini canlı (production) bir sunucuya taşımak için yereldeki yapıdan farklı olarak güvenlik, performans ve süreklilik sağlayacak araçlara ihtiyaç vardır:

### Windows VPS (NSSM ile) Kurulumu
Projeyi bir Windows VPS'de çalıştırıyorsanız, arka plan servislerini kesintisiz yönetmek için **NSSM (Non-Sucking Service Manager)** kullanabilirsiniz.

1. Komut satırını Yönetici olarak açın.
2. Servisi kurmak için şu komutu çalıştırın:
   ```bash
   nssm install Fokolik_Backend "C:\Tam\Yol\Fokolik\backend\.venv\Scripts\python.exe" "run_all.py"
   nssm set Fokolik_Backend AppDirectory "C:\Tam\Yol\Fokolik\backend"
   ```
3. `run_all.py` dosyası API, Worker ve Live Worker süreçlerini sizin yerinize tek bir servis altında yönetecek ve çökerse otomatik yeniden başlatacaktır.

### Linux / Genel Kurulum
1. **Uvicorn yerine Gunicorn Kullanımı:** 
   Canlı ortamda FastAPI uygulamasını daha performanslı çalıştırmak için `uvicorn` tek başına yeterli değildir, Uvicorn worker'ları ile birlikte `gunicorn` kullanmanız gerekir:
   ```bash
   gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
   ```
2. **Reverse Proxy (Nginx / Caddy):**
   Gelen HTTP isteklerini karşılamak ve SSL (HTTPS) sertifikası sağlamak için sunucunuza Nginx kurmalı ve 80/443 portlarından gelen istekleri Gunicorn'un çalıştığı 8000 portuna yönlendirmelisiniz (Proxy Pass).
3. **Veritabanı Tercihi:**
   Şu an proje SQLite kullanmaktadır. Küçük çaplı projeler için yeterli olsa da, yüksek trafikli canlı ortamlar için SQLite yerine **PostgreSQL** kullanılması tavsiye edilir. SQLAlchemy modeli kullanıldığı için geçiş sadece bağlantı URL'ini (database URL) değiştirerek çok kolay bir şekilde yapılabilir.

---

## 📂 Proje Yapısı

```
Fokolik/
├── backend/
│   ├── alembic/              # Veritabanı migrasyon (versioning) ayarları
│   ├── app/
│   │   ├── main.py           # FastAPI uygulaması ve endpointleri
│   │   ├── models.py         # SQLAlchemy veritabanı modelleri
│   │   └── database.py       # Veritabanı bağlantı ayarları
│   ├── scraper/              # Dışarıdan oran ve canlı skor çeken modüller
│   ├── worker.py             # Bülteni periyodik güncelleyen arka plan servisi
│   └── live_worker.py        # Canlı skorları periyodik güncelleyen arka plan servisi
│
└── frontend/
    ├── src/
    │   ├── App.jsx           # Ana React bileşeni (UI, Kuponlar, Bülten)
    │   ├── index.css         # Global stiller ve Tailwind konfigürasyonu
    │   └── main.jsx          # React uygulamasını başlatan kök dosya
    ├── package.json
    └── tailwind.config.js
```

## 📜 Uyarı

Bu sistem tamamen eğitim ve simülasyon amaçlı oluşturulmuş olup içerisinde gerçek para akışı barındırmamaktadır. Sadece bahis dinamiğini simüle etmek ve arayüz/yazılım yeteneklerini göstermek maksadıyla tasarlanmıştır.
