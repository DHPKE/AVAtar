# AVAtar — Deployment Guide
> LAN-Server auf Ubuntu 22.04 LTS · Einzelner Prozess · Kein Internet-Zwang

---

## Voraussetzungen

```bash
# Node.js 20 LTS installieren
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Version prüfen
node --version   # v20.x.x
npm --version    # 10.x.x
```

---

## 1. Projekt einrichten

```bash
# Ins gewünschte Verzeichnis wechseln
sudo mkdir -p /opt/avatar
sudo chown $USER:$USER /opt/avatar
cd /opt/avatar

# Repository klonen (oder Dateien kopieren)
git clone https://github.com/DHPKE/AVAtar.git .
```

---

## 2. Backend einrichten

```bash
cd /opt/avatar/backend
npm install --omit=dev

# Umgebungsvariablen konfigurieren
cp .env.example .env
nano .env
```

**Wichtige `.env`-Werte für Produktion:**

```env
NODE_ENV=production
PORT=3000

# Langen Zufallsstring generieren:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<langer_zufallsstring_hier_eintragen>
JWT_EXPIRES_IN=8h

DB_PATH=/opt/avatar/data/avatar.db

ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@ihrefirma.at
ADMIN_PASSWORD=<sicheres_startpasswort>

UPLOADS_DIR=/opt/avatar/data/uploads

# E-Mail (optional)
SMTP_HOST=mail.ihrefirma.at
SMTP_PORT=587
SMTP_USER=avatar@ihrefirma.at
SMTP_PASS=<smtp_passwort>
SMTP_FROM=avatar@ihrefirma.at
NOTIFY_EMAIL=lager@ihrefirma.at
```

```bash
# Datenbank- und Upload-Verzeichnisse anlegen
mkdir -p /opt/avatar/data/uploads
```

---

## 3. Frontend bauen

```bash
cd /opt/avatar/frontend
npm install
npm run build
# → Ausgabe landet in /opt/avatar/backend/public/
```

---

## 4. Smoke-Test (manuell starten)

```bash
cd /opt/avatar/backend
node src/index.js
```

Öffne im Browser: **http://localhost:3000**  
Login mit den konfigurierten Admin-Zugangsdaten.  
**Passwort sofort nach dem ersten Login ändern!**

`Ctrl+C` zum Beenden, dann weiter mit Schritt 5.

---

## 5. Systemd-Service einrichten

```bash
sudo nano /etc/systemd/system/avatar.service
```

```ini
[Unit]
Description=AVAtar Lagerverwaltung
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/avatar/backend
ExecStart=/usr/bin/node /opt/avatar/backend/src/index.js
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=avatar
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Service aktivieren und starten
sudo systemctl daemon-reload
sudo systemctl enable avatar
sudo systemctl start avatar

# Status prüfen
sudo systemctl status avatar

# Logs ansehen
sudo journalctl -u avatar -f
```

---

## 6. Nginx als Reverse Proxy (empfohlen)

Nginx übernimmt TLS-Terminierung, Kompression und statische-File-Caching.

```bash
sudo apt-get install -y nginx
sudo nano /etc/nginx/sites-available/avatar
```

```nginx
server {
    listen 80;
    server_name avatar.local 192.168.1.100;   # LAN-IP oder Hostname anpassen

    # Uploads direkt ausliefern
    location /uploads/ {
        alias /opt/avatar/data/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Alles andere → Node.js
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_cache_bypass $http_upgrade;

        # Für Datei-Uploads (Artikelbilder)
        client_max_body_size 10m;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/avatar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Erreichbar auf dem LAN unter: **http://192.168.1.100** (IP anpassen)

---

## 7. Updates einspielen

```bash
cd /opt/avatar

# Code aktualisieren
git pull

# Backend-Dependencies
cd backend && npm install --omit=dev && cd ..

# Frontend neu bauen
cd frontend && npm install && npm run build && cd ..

# Service neu starten
sudo systemctl restart avatar
```

---

## 8. Backup

Die gesamten Nutzdaten liegen in `/opt/avatar/data/`:

```bash
# Tägliches Backup-Script (cron)
#!/bin/bash
BACKUP_DIR=/backup/avatar
DATE=$(date +%Y-%m-%d)
mkdir -p $BACKUP_DIR
cp /opt/avatar/data/avatar.db $BACKUP_DIR/avatar-$DATE.db
find $BACKUP_DIR -name "*.db" -mtime +30 -delete   # 30 Tage aufbewahren
```

```bash
# Cron-Job einrichten (täglich 02:00 Uhr)
crontab -e
# 0 2 * * * /opt/avatar/scripts/backup.sh
```

---

## 9. Häufige Probleme

| Problem | Lösung |
|---|---|
| Port 3000 bereits belegt | `PORT=3001` in `.env` und nginx anpassen |
| „SQLITE_IOERR" beim Start | Dateiberechtigungen prüfen: `chown -R ubuntu:ubuntu /opt/avatar/data` |
| JWT_SECRET-Fehler in Produktion | `JWT_SECRET` in `.env` setzen (kein Default-Wert erlaubt) |
| Frontend lädt nicht (404) | `npm run build` im frontend-Verzeichnis ausführen |
| E-Mail wird nicht gesendet | SMTP-Verbindung in AVAtar Einstellungen testen |

---

## Struktur im Betrieb

```
/opt/avatar/
├── backend/
│   ├── public/          ← gebautes Frontend (von npm run build)
│   ├── src/             ← Backend-Quellcode
│   └── .env             ← Konfiguration (nie committen!)
├── frontend/            ← Frontend-Quellcode (nur für Builds nötig)
└── data/
    ├── avatar.db        ← SQLite-Datenbank (= alle Daten)
    └── uploads/         ← Artikelbilder
```

> **Backup = `/opt/avatar/data/`** — das ist alles, was zählt.
