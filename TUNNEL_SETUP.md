# Expose Health Portal with a Free Tunnel

Run your app on your machine and give anyone a link (e.g. in your region) with **no code changes**. Use either **Cloudflare Tunnel** (stable URL) or **ngrok** (quick, URL may change).

---

## 1. MongoDB Atlas (so the app works when others use the link)

Your app needs a database that’s reachable from the internet. A free tunnel only exposes your Node server; MongoDB should be in the cloud.

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up (free).
2. Create a **free M0 cluster** (e.g. in a region near you).
3. **Database Access** → Add user (username + password). Note the password.
4. **Network Access** → Add IP: `0.0.0.0/0` (allow from anywhere) or add your IP and the tunnel provider’s IPs if you prefer.
5. **Connect** → Drivers → copy the connection string. It looks like:
   ```text
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/health-portal?retryWrites=true&w=majority
   ```
6. In your project `.env`, set:
   ```env
   MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/health-portal?retryWrites=true&w=majority
   ```
   Replace `USER` and `PASSWORD` with your Atlas user and password (URL-encode special characters in the password).

---

## 2. Start your app

```bash
cd /path/to/health-portal-api
node server.js
```

Leave this running. It should listen on `http://localhost:3000` and connect to Atlas.

---

## Option A: Cloudflare Tunnel (recommended – free, stable URL)

1. **Install cloudflared**
   - **macOS (Homebrew):** `brew install cloudflared`
   - **Windows:** Download from [developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation)
   - **Linux:** See same page for package/install commands.

2. **Log in (one time)**  
   In a new terminal:
   ```bash
   cloudflared tunnel login
   ```
   A browser window opens; pick your Cloudflare account (free sign-up if needed).

3. **Create a tunnel**
   ```bash
   cloudflared tunnel create health-portal
   ```
   Note the tunnel ID (e.g. from `~/.cloudflared/<tunnel-id>.json`).

4. **Create config file**  
   Create or edit `~/.cloudflared/config.yml` (macOS/Linux) or `%USERPROFILE%\.cloudflared\config.yml` (Windows):
   ```yaml
   tunnel: <TUNNEL-ID-FROM-STEP-3>
   credentials-file: /Users/YOUR_USERNAME/.cloudflared/<TUNNEL-ID>.json

   ingress:
     - hostname: health-portal.YOUR-SUBDOMAIN.cfargotunnel.com
       service: http://localhost:3000
     - service: http_status:404
   ```
   Replace `<TUNNEL-ID>`, `YOUR_USERNAME`, and choose a hostname. Or use a quick tunnel (see below) without a config file.

5. **Route hostname to tunnel (optional)**  
   In Cloudflare Zero Trust dashboard: **Networks** → **Tunnels** → your tunnel → **Public Hostname** → add `health-portal.yourdomain.com` (or the `*.cfargotunnel.com` hostname) pointing to `http://localhost:3000`.

6. **Run the tunnel**
   ```bash
   cloudflared tunnel run health-portal
   ```
   Keep this running. Your app is now reachable at the URL you configured (e.g. `https://health-portal.YOUR-SUBDOMAIN.cfargotunnel.com`).

**Quick tunnel (no config file):**  
```bash
cloudflared tunnel --url http://localhost:3000
```  
You get a temporary `https://xxx-xxx-xxx.trycloudflare.com` URL for this session. Good for testing.

---

## Option B: ngrok (quick, URL may change on free tier)

1. **Install ngrok**  
   [ngrok.com/download](https://ngrok.com/download) or `brew install ngrok` (macOS).

2. **Start your app** (if not already): `node server.js`

3. **Expose port 3000**
   ```bash
   ngrok http 3000
   ```

4. Copy the **HTTPS** URL (e.g. `https://abc123.ngrok-free.app`). Share this link; anyone can open it. The URL may change each time you restart ngrok on the free tier.

---

## 3. Optional: Set public URL for emails

If you send emails (e.g. set-password links), set the public URL so links point to the tunnel URL, not localhost:

In `.env`:

```env
FRONTEND_URL=https://health-portal.YOUR-SUBDOMAIN.cfargotunnel.com
```

or

```env
FRONTEND_URL=https://abc123.ngrok-free.app
```

Then restart `node server.js`.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Create MongoDB Atlas free cluster, get connection string, set `MONGODB_URI` in `.env`. |
| 2 | Run `node server.js` on your machine. |
| 3 | Run **Cloudflare Tunnel** or **ngrok** to expose `http://localhost:3000`. |
| 4 | Share the HTTPS URL; anyone in your region (or anywhere) can open it. |

No code changes are required; the app stays on your PC and is as fast as your machine and network.
