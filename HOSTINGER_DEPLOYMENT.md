# 🚀 BeamShare Hostinger Production Deployment Guide

This guide provides step-by-step instructions to deploy **BeamShare** on **Hostinger VPS** or **Hostinger Node.js Web Hosting**.

BeamShare operates with **Zero Database / Zero Cloud Storage**. All code and file transfers flow 100% peer-to-peer (P2P) between browsers via WebRTC DataChannels. The Node.js server serves only as a lightweight signaling handshake layer.

---

## 📋 Architecture Overview

- **Frontend & App Router**: Next.js 16 (App Router + React + Tailwind CSS + CodeMirror 6)
- **Signaling Server**: Node.js + Express + Socket.io (`server.js`)
- **P2P Transport**: WebRTC DataChannels (PeerJS + STUN/TURN fallback)
- **Process Management**: PM2
- **Reverse Proxy & SSL**: Nginx + Let's Encrypt Certbot

---

## 🛠️ Step 1: Environment Variables Setup

Create a `.env.production` file in your root project directory:

```env
# Google AdSense Client ID (Optional - replace with your ca-pub-xxxxxxxxxxxxxx)
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-1234567890123456

# URL of your Signaling Server (Your domain or VPS IP)
NEXT_PUBLIC_SIGNALING_URL=https://your-domain.com

# Port for the Node.js signaling socket process
SIGNALING_PORT=3001
PORT=3000
NODE_ENV=production
```

---

## 📦 Step 2: Option A — Deployment on Hostinger VPS (Recommended)

### 1. Connect to VPS via SSH
```bash
ssh root@<YOUR_HOSTINGER_VPS_IP>
```

### 2. Install Node.js, PM2, and Nginx
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git certbot python3-certbot-nginx
sudo npm install -g pm2
```

### 3. Clone Repository & Install Dependencies
```bash
cd /var/www
git clone https://github.com/your-username/beamshare.git
cd beamshare

npm install --production=false
npm run build
```

### 4. Start Application Processes with PM2

We run two lightweight PM2 processes:
1. `beamshare-web` — Next.js Standalone Server (Port 3000)
2. `beamshare-signaling` — Socket.io Signaling Server (Port 3001)

Create an `ecosystem.config.js` file:

```javascript
module.exports = {
  apps: [
    {
      name: 'beamshare-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'beamshare-signaling',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        SIGNALING_PORT: 3001
      }
    }
  ]
};
```

Start & save PM2 processes:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🌐 Step 3: Nginx Reverse Proxy Setup (with WebSockets & SSL)

Create an Nginx server block at `/etc/nginx/sites-available/beamshare`:

```nginx
server {
    server_name your-domain.com www.your-domain.com;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # 1. Next.js Web App
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Socket.io WebRTC Signaling Endpoint
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site & test Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/beamshare /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Enable Free SSL with Certbot:
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## ⚡ Step 4: Option B — Deployment on Hostinger Shared Node.js Web Hosting

If using Hostinger's **hPanel Node.js Selector**:

1. Log into Hostinger hPanel -> **Node.js App Selector**.
2. Select Node.js Version: **20.x**.
3. Application Root: `public_html` (or `beamshare`).
4. Application Startup File: `server.js` (or integrated server).
5. Add Environment Variables in hPanel:
   - `NODE_ENV=production`
   - `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxx`
   - `NEXT_PUBLIC_SIGNALING_URL=https://your-domain.com`
6. Click **Run NPM Install** and **Build**.

---

## 🔍 Step 5: Verification & Health Checks

1. Access your site at `https://your-domain.com`
2. Test room creation: Click **Create New Room** (generates slug e.g. `swift-falcon-48`).
3. Open the link in a second browser window or device to verify:
   - Status badge turns green: **"Connected with 1 peer"**.
   - Type code in left editor — observe instant bi-directional typing sync.
   - Drag & drop an image or PDF in right panel — verify live progress bar and 1-click download.
4. Verify health endpoint: `https://your-domain.com/health` (returns `{"status":"ok"}`).

---

### 🎉 Congratulations! Your BeamShare zero-database P2P platform is live on Hostinger!
