# TrimBook — Salon management & booking

Three-role platform: **Super Admin**, **Salon Owner**, **Customer**.

## Flow

1. Salon owner registers → creates salon profile, staff & services → submits listing
2. Super Admin accepts/rejects listing (only approved salons are public)
3. Customer books → request goes **PENDING** to salon owner
4. Salon owner accepts → **CONFIRMED** (or rejects → cancelled + customer notified)

## Quick start

```bash
cd salon-booking
npm install
npm run db:setup
npm run dev
```

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@salon.com | admin123 |
| Salon Owner | owner@salon.com | owner123 |
| Customer | customer@example.com | customer123 |

Also seeded: `owner2@salon.com` / `owner123` with **Glow Studio** pending approval.

## Dashboards

- `/admin` — listing approvals, platform stats, all bookings
- `/owner` — salon profile, staff/services, accept/reject appointments
- `/salons` — customer browse & request appointments

