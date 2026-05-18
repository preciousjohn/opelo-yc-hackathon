# Opelo

**AI-powered business operations manager for solopreneurs and small teams.**

Opelo is your autonomous AI agent that handles customer communications across SMS, phone calls, and email. It makes operational decisions — refunds, pricing, scheduling, sponsorships — based on your business policies, so you can focus on what matters.

## What It Does

- **Conversational AI Agent**: Automatically responds to customer inquiries via SMS, phone, and email
- **Policy-Based Decisions**: Configure rules for refunds, pricing thresholds, booking availability, and more
- **Multi-Channel Support**: Integrates with AgentPhone (SMS/calls) and AgentMail (email)
- **Real-Time Dashboard**: Monitor all conversations, decisions, and actions in one place
- **Smart Escalation**: Knows when to handle things autonomously vs. when to notify you

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini / OpenAI / Anthropic
- **Communications**: AgentPhone (SMS/Voice), AgentMail (Email)
- **Styling**: Tailwind CSS

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Open http://localhost:3000
```

Opelo runs in demo mode without API keys. Add keys to `.env.local` to enable live integrations.

## Environment Variables

```bash
# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI (pick one or more)
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# SMS/Phone (AgentPhone)
AGENTPHONE_API_KEY=
AGENTPHONE_AGENT_ID=
AGENTPHONE_NUMBER_ID=
AGENTPHONE_NUMBER=

# Email (AgentMail)
AGENTMAIL_API_KEY=
AGENTMAIL_INBOX_ID=

# Your Info
OWNER_PHONE_NUMBER=
BUSINESS_OWNER_NAME=
BUSINESS_DESCRIPTION=
```

## Webhooks

After deploying, configure your integrations to send webhooks to:

- **AgentPhone**: `https://your-domain.vercel.app/api/agentphone/webhook`
- **AgentMail**: `https://your-domain.vercel.app/api/agentmail/webhook`

## Testing

```bash
# Test SMS processing
curl -X POST http://localhost:3000/api/agentphone/test

# Test email processing
curl -X POST http://localhost:3000/api/agentmail/test

# Reset demo data
curl -X POST http://localhost:3000/api/seed
```

## Architecture

```
opelo/
├── app/
│   ├── (app)/              # Dashboard routes
│   ├── (marketing)/        # Landing page
│   └── api/                # Webhook endpoints
├── components/             # React components
└── lib/
    ├── ai/                 # AI manager & LLM integrations
    ├── db/                 # Supabase store
    └── integrations/       # AgentPhone, AgentMail, etc.
```

## License

MIT
