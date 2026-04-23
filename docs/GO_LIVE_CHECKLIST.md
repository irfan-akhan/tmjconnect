# TMJConnect — Go-Live Checklist

Everything needed before the first patient touches the production system.

---

## 1. Accounts & Credentials

| # | Account | Action | BAA Required | Status |
|---|---------|--------|:---:|:---:|
| 1 | **Apple Developer Program** | Enroll org ($99/yr). D-U-N-S verification takes 48h. Need for TestFlight + App Store. | No | [ ] |
| 2 | **Google Play Console** | Create account ($25 one-time). Need for Internal Testing + Play Store. | No | [ ] |
| 3 | **Expo / EAS** | Free account at expo.dev. Set `projectId` in `app.json`. | No | [ ] |
| 4 | **Firebase** | Create project → enable Cloud Messaging → download service account JSON. | Yes (Google Cloud BAA) | [ ] |
| 5 | **Resend** | Create account → verify sending domain → get API key. | Yes | [ ] |
| 6 | **Twilio** | Create account → buy US phone number → get Account SID + Auth Token. | Yes | [ ] |
| 7 | **Sentry** | Create project → get DSN → configure PII scrubbing. | Yes | [ ] |
| 8 | **Hosting (DigitalOcean / AWS)** | Provision VPS or ECS. DigitalOcean has BAA available. | Yes | [ ] |
| 9 | **Domain** | Own `tmjconnect.com` (or chosen domain). Access DNS management. | No | [ ] |
| 10 | **Cloudflare** (optional) | DNS + CDN + DDoS protection. Free tier sufficient for pilot. | No | [ ] |

### BAA Links

- **Resend:** Contact sales@resend.com for BAA
- **Twilio:** [twilio.com/legal/baa](https://www.twilio.com/legal/baa) (self-serve for Flex/Engage)
- **Sentry:** [sentry.io/legal/baa](https://sentry.io/legal/baa/) (Business plan required)
- **Google Cloud (Firebase):** [cloud.google.com/terms/hipaa-baa](https://cloud.google.com/terms/hipaa-baa) (amend existing agreement)
- **DigitalOcean:** [digitalocean.com/legal/baa](https://www.digitalocean.com/legal/baa) (available on request)
- **AWS:** [aws.amazon.com/compliance/hipaa-eligible-services-reference](https://aws.amazon.com/compliance/hipaa-eligible-services-reference/) (BAA via AWS Artifact)

---

## 2. Secrets to Generate

Generate each with: `openssl rand -hex 64`

| Secret | Env Var | Min Length |
|--------|---------|-----------|
| JWT signing key | `JWT_SECRET` | 64 chars |
| Refresh token signing key | `JWT_REFRESH_SECRET` | 64 chars |
| MFA encryption key | `MFA_ENCRYPTION_KEY` | 64 chars |
| Backup encryption passphrase | (stored in file, not env) | 32+ chars |

**Do not reuse dev secrets in production.** Generate fresh values for each environment.

---

## 3. Infrastructure Setup

### VPS (Pilot — DigitalOcean)

```bash
# 1. Create droplet: Ubuntu 24.04, 2 vCPU, 4GB RAM, 80GB SSD
# 2. Enable backups in DO dashboard
# 3. SSH in and run:

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Enable firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Enable disk encryption (if not using DO encrypted volumes)
# See: https://www.digitalocean.com/community/tutorials/how-to-use-luks-encryption
```

### SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot
sudo certbot certonly --standalone -d api.tmjconnect.com -d tmjconnect.com

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

### DNS Records

| Type | Name | Value |
|------|------|-------|
| A | `tmjconnect.com` | VPS IP |
| A | `api.tmjconnect.com` | VPS IP |
| A | `provider.tmjconnect.com` | VPS IP |
| A | `admin.tmjconnect.com` | VPS IP |
| CNAME | `www` | `tmjconnect.com` |

### Firebase Setup

```bash
# 1. Go to console.firebase.google.com
# 2. Create project "TMJConnect"
# 3. Enable Cloud Messaging
# 4. Project Settings → Service Accounts → Generate new private key
# 5. Save JSON as firebase-service-account.json
# 6. Set env vars:
#    FIREBASE_PROJECT_ID=tmjconnect-xxxxx
#    FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@tmjconnect-xxxxx.iam.gserviceaccount.com
#    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

---

## 4. Deploy

```bash
# Clone repo on VPS
git clone https://github.com/your-org/tmjconnect.git /opt/tmjconnect
cd /opt/tmjconnect

# Create production .env
cp apps/api/.env.example apps/api/.env
# Edit with production values (DB, secrets, service keys)

# Build and start
docker compose -f docker/docker-compose.yml up -d

# Run migrations
docker compose -f docker/docker-compose.yml exec api npm run db:migrate

# Verify
curl https://api.tmjconnect.com/api/v1/health
```

---

## 5. Backup Setup

```bash
# Create passphrase file
echo "$(openssl rand -hex 32)" > /opt/tmjconnect/.backup_passphrase
chmod 600 /opt/tmjconnect/.backup_passphrase

# Copy backup script
chmod +x /opt/tmjconnect/scripts/backup.sh

# Schedule daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/tmjconnect/scripts/backup.sh >> /var/log/tmjconnect-backup.log 2>&1") | crontab -

# Run first backup
/opt/tmjconnect/scripts/backup.sh

# Run restore drill
/opt/tmjconnect/scripts/restore-drill.sh
```

---

## 6. Mobile App Release

### Android (Google Play Internal Testing)

```bash
cd apps/mobile
eas build --platform android --profile preview  # produces .aab
eas submit --platform android                    # uploads to Play Console
```

### iOS (TestFlight)

```bash
eas build --platform ios --profile preview       # produces .ipa
eas submit --platform ios                        # uploads to App Store Connect
```

**Note:** iOS health apps go through manual review (3-7 days, not the usual 24h).

---

## 7. Pre-Launch Verification

- [ ] Register → verify email → accept ToS → complete onboarding → reach dashboard
- [ ] Log symptom → view in calendar → view in history list
- [ ] Provider links patient → assigns exercise → patient sees it
- [ ] Patient marks exercise complete → dashboard stats update
- [ ] Patient submits urgent report → provider gets SMS + push + email
- [ ] Provider responds to report → patient sees response
- [ ] PDF progress report generates and opens share sheet
- [ ] Insights page shows charts after ≥3 days of logging
- [ ] App lock triggers after 60s in background
- [ ] Offline: airplane mode → log symptom → reconnect → verify synced
- [ ] Password reset email received and flow works
- [ ] Provider 15-min timeout enforced
- [ ] Backup script produces encrypted file, restore drill passes
- [ ] Swagger UI accessible at /docs
- [ ] All environment variables set (no stub warnings in API logs)

---

## 8. Legal Documents

- [ ] Terms of Service reviewed by legal counsel (template at `apps/landing/src/pages/Terms.tsx`)
- [ ] Privacy Policy reviewed by legal counsel (template at `apps/landing/src/pages/Privacy.tsx`)
- [ ] Emergency disclaimer reviewed by medical founder (in `apps/mobile/app/emergency.tsx` and `app/report-submit.tsx`)
- [ ] HIPAA breach notification procedure documented
- [ ] Incident response contacts listed
- [ ] All BAAs signed and filed

---

## 9. Post-Launch (Week 1)

- [ ] Monitor Sentry for errors
- [ ] Check API response times (should be <200ms p95)
- [ ] Verify backup ran successfully (check log + file)
- [ ] Run restore drill
- [ ] Onboard 3-5 pilot providers
- [ ] Collect initial feedback
