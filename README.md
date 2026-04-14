# xCSG Value Measurement Tracker

A web application for tracking and measuring the value of xCSG (AI-augmented consulting) deliverables against traditional methods. Built for Alira Health.

Internal users create projects and share assessment links with experts. Experts complete a structured survey comparing xCSG vs legacy approaches. The system computes performance metrics and displays them on a portfolio dashboard.

## Deployment

### Requirements

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/piergiuliol/xCSG-Value-Tracker.git
cd xCSG-Value-Tracker
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set a secure secret key:

```bash
SECRET_KEY=<paste output of: openssl rand -hex 32>
```

### 3. Start the application

```bash
docker compose up -d --build
```

The app is running at `http://localhost:8765`.

### Stopping and restarting

```bash
docker compose down          # stop
docker compose up -d         # start
docker compose logs -f       # view logs
```

## Default Accounts

| Username | Password | Role | Permissions |
| -------- | -------- | ---- | ----------- |
| admin | AliraAdmin2026! | Admin | Full access: users, categories, projects, delete |
| pmo | AliraPMO2026! | Analyst | Create and edit projects |
| viewer | AliraView2026! | Viewer | Read-only |

**Change all passwords after first login** via Settings > Change Password.

## User Management

Admins manage users via **Settings > Users**:

- **Add users** with username, email, password, and role
- **Change roles** inline (admin, analyst, viewer)
- **Reset passwords** — generates a random password, shown once with a Copy button
- **Delete users** (cannot delete your own account)

All users can change their own password via **Settings > Change Password**.

## Production Server

### Deploy to a Linux VPS

```bash
ssh root@your-server

# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone and start
git clone https://github.com/piergiuliol/xCSG-Value-Tracker.git /opt/tracker
cd /opt/tracker
echo "SECRET_KEY=$(openssl rand -hex 32)" > .env
docker compose up -d --build
```

### HTTPS with Caddy (recommended)

```bash
apt install caddy
```

Edit `/etc/caddy/Caddyfile`:

```
tracker.yourdomain.com {
    reverse_proxy localhost:8765
}
```

```bash
systemctl restart caddy
```

Caddy auto-provisions SSL certificates from Let's Encrypt.

### Backups

```bash
# Daily 2 AM backup — add to crontab with: crontab -e
0 2 * * * docker cp tracker-tracker-1:/app/data/tracker.db /opt/backups/tracker-$(date +\%Y\%m\%d).db
```

### Updating

```bash
cd /opt/tracker
git pull
docker compose up -d --build
```

## License

Confidential. Alira Health internal use only.
