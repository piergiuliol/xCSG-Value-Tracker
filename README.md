# xCSG Value Measurement Tracker

A web application for tracking and measuring the value of xCSG (AI-augmented consulting) deliverables against traditional methods. Built for Alira Health.

## What It Does

The tracker measures whether the xCSG approach produces better consulting deliverables more efficiently than legacy methods. It does this through:

1. **Project creation** — Internal users log projects with timeline, team size, and legacy comparables
2. **Expert assessment** — The expert who completed the deliverable fills a structured survey (Sections A-G + L) comparing xCSG vs traditional approaches
3. **Automated metrics** — The system computes ratios across six dimensions (speed, quality, value gain, machine-first, senior-led, knowledge)
4. **Portfolio dashboard** — Charts, KPIs, category breakdowns, scaling gates, and trend analysis across all projects

## Key Metrics

| Metric | What it measures |
| ------ | ---------------- |
| Delivery Speed | Legacy person-days / xCSG person-days |
| Output Quality | xCSG quality score / legacy quality score |
| xCSG Value Gain | Quality per person-day: xCSG vs legacy |
| Machine-First Gain | Knowledge synthesis breadth, xCSG vs legacy |
| Senior-Led Gain | Expert involvement depth, xCSG vs legacy |
| Knowledge Gain | Proprietary data/reuse/moat, xCSG vs legacy |

All ratios: >1x means xCSG outperforms legacy.

## Quick Start

### Local Development

```bash
# Install dependencies and start the server
./launch.sh
# Open http://localhost:8765
```

### Docker

```bash
docker-compose up --build
# Open http://localhost:8765
```

### Default Users

| Username | Role | Permissions |
| -------- | ---- | ----------- |
| admin | Admin | Full access: users, categories, projects, delete |
| pmo | Analyst | Create and edit projects, no delete or user management |
| viewer | Viewer | Read-only access to dashboard, projects, and reports |

**Change all passwords after first login** via Settings > Change Password.

## Production Deployment

### 1. Get a server

Any Linux VPS: DigitalOcean ($6/mo), AWS Lightsail, Hetzner, etc.

### 2. Deploy

```bash
ssh root@your-server

# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone and start
git clone https://github.com/piergiuliol/xCSG-Value-Tracker.git /opt/tracker
cd /opt/tracker

# Set a secure secret key
echo "SECRET_KEY=$(openssl rand -hex 32)" > .env

# Start
docker-compose up -d --build
```

The app is now live at `http://your-server-ip:8765`.

### 3. HTTPS (recommended)

```bash
apt install caddy

# Edit /etc/caddy/Caddyfile:
# tracker.yourdomain.com {
#     reverse_proxy localhost:8765
# }

systemctl restart caddy
```

Caddy auto-provisions SSL certificates from Let's Encrypt.

### 4. Backups

```bash
# Add to crontab (daily 2 AM backup)
crontab -e
0 2 * * * docker cp tracker-tracker-1:/app/data/tracker.db /opt/backups/tracker-$(date +\%Y\%m\%d).db
```

## Architecture

```
backend/
  schema.py      # Single source of truth: fields, scores, metrics, sections
  app.py         # FastAPI routes + static file serving
  auth.py        # JWT authentication (PBKDF2-SHA256)
  metrics.py     # All metric computations (imports from schema.py)
  database.py    # SQLite with WAL mode
  models.py      # Pydantic request/response models
frontend/
  index.html     # SPA shell (login, app, expert views)
  app.js         # Vanilla JS — routing, forms, charts (ECharts)
  styles.css     # Alira Health brand system
```

**No frameworks.** Vanilla HTML/JS/CSS frontend. FastAPI + SQLite backend.

All field definitions, scoring weights, and metric labels are defined once in `backend/schema.py`. The frontend loads them via `/api/schema` at startup.

## Expert Assessment Flow

1. Admin/analyst creates a project and gets a shareable expert link
2. Expert opens the link (no login required)
3. Expert fills Sections B-G (xCSG performance) and Section L (legacy estimates)
4. On submit, the system computes flywheel scores and shows results with explanations
5. Project status becomes "complete" and metrics appear on the dashboard

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLite, PyJWT
- **Frontend**: Vanilla JavaScript, ECharts 5.6
- **Deployment**: Docker, docker-compose
- **Tests**: Playwright (E2E)

## Running Tests

```bash
# Core test suite (7 tests, ~30s)
npx playwright test tests/e2e-full.spec.ts --headed --timeout 600000

# Realistic test suite (11 tests, ~2m — creates 20 projects with varied surveys)
npx playwright test tests/e2e-realistic.spec.ts --headed --timeout 600000

# Backend QC
python tests/test_v2_qc.py
```

## License

Confidential. Alira Health internal use only.
