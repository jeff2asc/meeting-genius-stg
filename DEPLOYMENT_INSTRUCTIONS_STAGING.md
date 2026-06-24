# 🚀 Meeting Genius — Staging Server Deployment Instructions

This document provides configuration details, database credentials, and standard workflows for managing the **Staging Server** (`mgstaging.meetinggenius.ca`).

---

## 🔗 Server Info & URLs

| Service | Staging URL | Internal Port | Description |
| :--- | :--- | :--- | :--- |
| **Web Application** | [https://mgstaging.meetinggenius.ca](https://mgstaging.meetinggenius.ca) | `3000` | The Next.js web application |
| **Supabase Gateway (Kong)** | [https://mgstaging.meetinggenius.ca/supabase/](https://mgstaging.meetinggenius.ca/supabase/) | `8000` | API Gateway proxying REST, Auth, and Storage |
| **Supabase Studio** | `http://127.0.0.1:8000` *(Internal only)* | `8000` | Database dashboard |

---

## 🔑 Database & Supabase Credentials

Staging Supabase runs in a Docker environment on the server. The credentials are:

* **Postgres Database URL (Direct):** `postgresql://postgres:Jeffrey%2540Supabase2026%2521@127.0.0.1:5432/postgres` (Using port `5432` mapped through Supavisor session mode pooler)
* **Postgres Username:** `postgres`
* **Postgres Password:** `Jeffrey@Supabase2026!` (Url encoded: `Jeffrey%40Supabase2026%21`)
* **Supabase Studio Dashboard Username:** `supabase`
* **Supabase Studio Dashboard Password:** `Jeffrey@Admin2026!`

---

## 🔄 Deployment Workflow (How to Deploy Code Updates)

Whenever you push new code to your staging GitHub repository (`https://github.com/jeff2asc/meeting-genius-stg`), follow these steps in your PuTTY terminal:

### 1. Switch to the `pm2` user (Security Best Practice)
Never run git pulls or Next.js builds as `root`. Switch to the `pm2` user:
```bash
su - pm2
```

### 2. Pull the Latest Code
```bash
cd /opt/meetinggenius/app
git pull origin main
```

### 3. Build the Application
```bash
npm run build
```
*(Note: If dependencies have changed, run `npm install --legacy-peer-deps` first.)*

### 4. Restart the Application via PM2
```bash
pm2 restart meeting-genius
```

---

## 🛠️ Managing Services (Run as `root` or `pm2`)

### Web App Logs & Process Management (Run as `pm2` user)
* **Check application logs:**
  ```bash
  pm2 logs
  ```
* **Check application status:**
  ```bash
  pm2 status
  ```
* **Restart the app:**
  ```bash
  pm2 restart meeting-genius
  ```

### Supabase Docker Containers (Run as `root` user)
The Supabase Docker config is located at `/root/supabase/docker`.
* **Restart Supabase:**
  ```bash
  cd /root/supabase/docker && docker compose restart
  ```
* **Stop Supabase:**
  ```bash
  cd /root/supabase/docker && docker compose down
  ```
* **Start Supabase:**
  ```bash
  cd /root/supabase/docker && docker compose up -d
  ```
* **Check Supabase container logs:**
  ```bash
  docker ps
  docker logs <container-name>
  ```

### Web Server (Run as `root` user)
* **Restart Nginx:**
  ```bash
  systemctl restart nginx
  ```
* **Check Nginx status:**
  ```bash
  systemctl status nginx
  ```
* **Check Nginx error logs:**
  ```bash
  tail -f /var/log/nginx/error.log
  ```
