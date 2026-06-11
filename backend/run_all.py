import subprocess
import sys
import time
import signal
import os

# Başlatılacak alt süreçleri (process) tutacağımız liste
processes = []

def terminate_processes(signum, frame):
    """
    Sistemden bir kapatma sinyali (NSSM'in servisi durdurması veya CTRL+C) geldiğinde
    tüm alt süreçleri temiz bir şekilde kapatır.
    """
    print("\n[YONETICI] Kapatma sinyali alindi. Tum servisler durduruluyor...", flush=True)
    for p in processes:
        if p.poll() is None: # Eğer süreç hala çalışıyorsa
            p.terminate()
            p.wait()
    print("[YONETICI] Tum servisler basariyla durduruldu.")
    sys.exit(0)

# Kapatma sinyallerini dinle
signal.signal(signal.SIGINT, terminate_processes)  # Ctrl+C
signal.signal(signal.SIGTERM, terminate_processes) # NSSM Stop/Kill
if os.name == 'nt':
    signal.signal(signal.SIGBREAK, terminate_processes) # Windows Ctrl+Break

def main():
    print("===================================================", flush=True)
    print("[YONETICI] Fokolik Backend Servisleri Baslatiliyor...", flush=True)
    print("===================================================", flush=True)
    
    # Sanal ortam (venv) içerisindeki çalıştırılabilir dosyaların yolları
    python_exe = os.path.join(".venv", "Scripts", "python.exe")
    uvicorn_exe = os.path.join(".venv", "Scripts", "uvicorn.exe")

    # Eğer sanal ortam yoksa uyar ve çık
    if not os.path.exists(python_exe):
        print(f"[HATA] {python_exe} bulunamadi. Lutfen sanal ortamin (.venv) kurulu oldugundan emin olun.")
        sys.exit(1)

    # Önce veritabanı migrasyonlarını otomatik olarak çalıştır
    print("[YONETICI] Veritabani migrasyonlari kontrol ediliyor...", flush=True)
    alembic_exe = os.path.join(".venv", "Scripts", "alembic.exe")
    subprocess.run([alembic_exe, "upgrade", "head"], check=False)

    # Başlatılacak komutlar
    commands = [
        [uvicorn_exe, "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
        [python_exe, "worker.py"],
        [python_exe, "live_worker.py"]
    ]

    # Komutları arka planda başlat
    for cmd in commands:
        print(f"[YONETICI] Baslatiliyor: {' '.join(cmd)}", flush=True)
        # Süreci başlat ve listeye ekle
        p = subprocess.Popen(cmd)
        processes.append(p)

    print("[YONETICI] Tum servisler calisiyor. Bekleniyor...", flush=True)

    # Ana betiği ayakta tut ve süreçlerin çöküp çökmediğini kontrol et
    try:
        while True:
            for p in processes:
                if p.poll() is not None:
                    # Süreçlerden biri kendi kendine kapandıysa (Çöktüyse)
                    print(f"[HATA] Beklenmeyen bir sekilde servislerden biri coktu (Kodu: {p.returncode}).", flush=True)
                    print("[YONETICI] NSSM'in sistemi yeniden baslatabilmesi icin tum servisler kapatiliyor...", flush=True)
                    # Hepsini kapatıp ana betiği de hata koduyla sonlandırıyoruz
                    # Böylece NSSM servisin çöktüğünü anlayıp hepsini sıfırdan "Restart" yapacak
                    terminate_processes(None, None)
            time.sleep(5)
    except KeyboardInterrupt:
        terminate_processes(None, None)

if __name__ == "__main__":
    main()
