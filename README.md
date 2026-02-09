# Slock - Financial Command Center

A multi-asset portfolio tracker and analysis tool built with Next.js, Supabase, and real-time broker integrations.

## Features

- **Multi-Broker Integration**: Connect IOL (InvertirOnline) for Argentine stocks/CEDEARs and Binance for crypto
- **Auto-Sync**: Automatically syncs portfolio holdings and transactions on login
- **Real-Time Prices**: Live prices via Yahoo Finance API
- **AI-Powered Insights**: Upload PPI market reports for Claude-powered analysis
- **Historical Charts**: Asset detail modal with sparkline charts and period P&L
- **Mobile Responsive**: Optimized for desktop and mobile viewing
- **Automated Reports**: Daily email summaries and price alerts via Supabase Edge Functions

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL via Supabase
- **ORM**: Drizzle ORM
- **State**: Zustand + TanStack Query
- **Auth**: Supabase Auth
- **Automation**: Supabase Edge Functions + pg_cron
- **Email**: Resend API

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_postgres_connection_string
ANTHROPIC_API_KEY=your_claude_api_key
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── assets/        # Asset CRUD
│   │   ├── transactions/  # Transaction recording
│   │   ├── iol/           # IOL broker integration
│   │   ├── binance/       # Binance integration
│   │   ├── prices/        # Yahoo Finance historical
│   │   └── insights/      # AI analysis
│   ├── auth/              # Login & callback
│   ├── settings/          # Broker connections
│   └── insights/          # PDF upload & analysis
├── components/            # React components
├── hooks/                 # TanStack Query hooks
├── services/              # External API clients (IOL, Binance, Yahoo)
├── db/                    # Drizzle schema
├── lib/                   # Utils, constants, validators
└── stores/                # Zustand stores

supabase/
├── functions/             # Edge Functions
│   ├── daily-report/      # Daily email at market close
│   ├── price-alerts/      # Price threshold notifications
│   ├── portfolio-snapshot/# Historical tracking
│   └── on-transaction/    # DB trigger handler
└── migrations/            # SQL migrations
```

## Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `daily-report` | pg_cron 17:00 ART | Email portfolio summary |
| `price-alerts` | pg_cron every 15 min | Check price thresholds |
| `portfolio-snapshot` | pg_cron market close | Save historical state |
| `on-transaction` | DB trigger | Process new transactions |

Deploy via Supabase Dashboard > Edge Functions.

## Database Setup

Run migrations in Supabase SQL Editor (see `supabase/migrations/`).

## Deployment

Deployed on Vercel with automatic deployments from `main` branch.

```bash
npm run build
git push origin main
```

## License

Private project.
