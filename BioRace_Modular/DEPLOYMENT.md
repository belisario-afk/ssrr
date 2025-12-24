# Bio-Race TikTok LIVE - Digital Ocean Deployment Guide

## Server Info
- **IP Address:** 165.22.174.250
- **TikTok Username:** @lmohss
- **Game URL:** http://165.22.174.250

---

## 🚀 Quick Deploy Commands

### Step 1: SSH into your Digital Ocean server
```bash
ssh root@165.22.174.250
```

### Step 2: Install Node.js (if not installed)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should show v20.x.x
```

### Step 3: Install PM2 (Process Manager)
```bash
npm install -g pm2
```

### Step 4: Clone/Update the repository
```bash
# First time setup:
cd /var/www
git clone https://github.com/belisario-afk/ssrr.git
cd ssrr/BioRace_Modular

# Or if already cloned, update:
cd /var/www/ssrr
git pull origin main
```

### Step 5: Install server dependencies
```bash
cd /var/www/ssrr/BioRace_Modular/server
npm install
```

### Step 6: Start the server with PM2
```bash
# Start the server
pm2 start server.js --name biorace-tiktok

# Save PM2 config (auto-restart on reboot)
pm2 save
pm2 startup

# View logs
pm2 logs biorace-tiktok

# Restart if needed
pm2 restart biorace-tiktok
```

---

## 📁 File Structure on Server
```
/var/www/ssrr/BioRace_Modular/
├── index.html          # Main game page
├── style.css           # Game styles
├── src/                # JavaScript modules
│   ├── Main.js
│   ├── Config.js
│   ├── GiftSystem.js
│   ├── TikTokConnector.js  # Connects frontend to backend
│   ├── Obstacles.js
│   ├── Player.js
│   └── ...
├── models/             # 3D model files (.glb)
│   ├── swimmer.glb
│   ├── condom.glb
│   ├── cucumber.glb
│   ├── banana.glb
│   ├── iud.glb
│   └── hairbrush.glb
└── server/             # Backend server
    ├── server.js       # TikTok LIVE connector
    └── package.json
```

---

## 🎁 Gift → Obstacle/Effect Mapping

### TikTok Gifts by Tier:

| Tier | TikTok Gift | Diamonds | Game Effect |
|------|-------------|----------|-------------|
| **SMALL** | Rose, Heart, TikTok, Ice Cream | 1-10 | +2 Boost Charges |
| **MEDIUM** | Drama Queen, GG, Doughnut, Perfume | 50-100 | +5 Boost + Spawn Obstacle |
| **LARGE** | Galaxy, Lion, Cap, Disco Ball | 500+ | +8 Boost + Spawn Competitor + Obstacles |
| **EPIC** | Universe, Planet, Rocket, Whale | 1000+ | +15 Boost + All Effects + Power-Up |

### Obstacle Types:

| Key | Model | Effect | Movement |
|-----|-------|--------|----------|
| 1 | condom.glb | **STUN** (2 sec freeze) | Straight |
| 2 | cucumber.glb | **DAMAGE** (50m setback) | Straight |
| 3 | banana.glb | **SLIP** (25m setback) | Straight |
| 4 | iud.glb | **HEAVY DAMAGE** (75m setback) | Floating |
| 5 | hairbrush.glb | **STUN** (1.5 sec) | Floating |
| 6 | - | Fallen Swimmer (decoration) | Physics |
| 7 | - | Power-Up Pill (boost refill) | Spinning |

---

## 🔧 Nginx Configuration (Optional, for HTTPS)

If you want to serve over HTTPS, create `/etc/nginx/sites-available/biorace`:

```nginx
server {
    listen 80;
    server_name 165.22.174.250;
    
    root /var/www/ssrr/BioRace_Modular;
    index index.html;
    
    # Serve static files
    location / {
        try_files $uri $uri/ =404;
    }
    
    # WebSocket proxy for TikTok server
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Then:
```bash
sudo ln -s /etc/nginx/sites-available/biorace /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🧪 Testing

### Test without TikTok:
1. Open http://165.22.174.250 in browser
2. Use keyboard keys to test:
   - **9** = Small gift (Rose)
   - **0** = Epic gift (Universe)
   - **1-7** = Spawn obstacles manually

### Test with TikTok LIVE:
1. Go live on TikTok with @lmohss account
2. Server will auto-connect
3. Have viewers send gifts to see effects!

---

## 🔍 Troubleshooting

### Server not starting?
```bash
# Check logs
pm2 logs biorace-tiktok

# Check if port is in use
sudo lsof -i :3001
sudo lsof -i :80
```

### TikTok not connecting?
- Make sure you're LIVE on TikTok
- Check the username is correct
- Some regions may require VPN

### Models not loading?
- Make sure .glb files are in `/models/` folder
- Check browser console for errors
- File names must match exactly (case-sensitive)

---

## 📞 Commands Reference

```bash
# Start server
pm2 start server.js --name biorace-tiktok

# Stop server
pm2 stop biorace-tiktok

# Restart server
pm2 restart biorace-tiktok

# View logs
pm2 logs biorace-tiktok

# View status
pm2 status

# Delete from PM2
pm2 delete biorace-tiktok
```

---

## 🔄 Updating the Game

```bash
cd /var/www/ssrr
git pull origin main
pm2 restart biorace-tiktok
```

That's it! Your Bio-Race game should now be live at http://165.22.174.250 with full TikTok integration! 🎮
