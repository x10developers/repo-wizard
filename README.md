<p align="center">
  <img src="./assets/banner.png" alt="Reporeply" width="300">
</p>

# Reporeply

Reporeply is a GitHub App that helps maintain healthy repositories by automatically engaging with inactive issues in a respectful and transparent way.

It detects newly opened issues, provides an initial acknowledgement, and periodically checks for inactivity. If an issue remains inactive beyond a configurable grace period, Reporeply can post reminders or close the issue automatically.

The goal is to reduce maintainer overhead while keeping contributors informed.

---

## ✨ Features

- Automatically comments on newly opened issues
- Daily inactivity scanning via secure cron
- Optional auto-close after a grace period
- Skips bot-created issues to prevent loops
- Uses short-lived GitHub App tokens (no PATs)
- No database required
- Designed for organizations and personal repositories

---

## 🧠 How It Works

1. A user opens an issue
2. GitHub sends a webhook event to Reporeply
3. Reporeply authenticates using a GitHub App installation token
4. A professional acknowledgment comment is posted
5. A daily cron job scans for inactive issues
6. Issues exceeding the inactivity threshold are handled according to rules

---

## 🔐 Security

- Uses GitHub App authentication (JWT + installation tokens)
- Webhook requests are verified using a secret
- Cron endpoint protected via `CRON_SECRET`
- Private keys are never committed to the repository
- Minimal permissions are requested

---

## 📦 Permissions Required

- **Issues**: Read & Write  
- **Metadata**: Read  

No access to code, pull requests, or user data beyond issue metadata.

---

## ⚙️ Configuration

Environment variables:

```env
APP_ID=your_app_id
WEBHOOK_SECRET=your_webhook_secret
GITHUB_PRIVATE_KEY_PATH=/absolute/path/to/private-key.pem
CRON_SECRET=secure_random_string
PORT=3000


## Project Status

🚧 Early development — APIs and internal design may evolve.

## Getting Started

```bash
git clone https://github.com/x10developers/reporeply.git
cd reporeply
```

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START -->
<!-- ALL-CONTRIBUTORS-LIST:END -->
