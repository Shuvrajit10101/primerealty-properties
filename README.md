# PrimeRealty Properties

Single-page marketing site for a luxury real-estate agency, served by a small
Express app, plus a floating chat widget that runs a lead-qualification
conversation through the Claude API and emails the resulting lead. The repo's
`CLAUDE.md` describes it as "Apex Automations Portfolio Demo #2", so it is a
portfolio demo rather than a live client site.

## Stack

- Node.js / Express 4 — serves `public/` statically and hosts three API routes
- Vanilla HTML / CSS / JS frontend, no build step; DM Sans + Playfair Display via Google Fonts
- `@anthropic-ai/sdk` — chatbot calls model `claude-sonnet-4-20250514`
- Nodemailer (Gmail transport) — contact and lead notification emails
- `express-rate-limit` — 50 requests per 15 minutes on `/api/*`
- `dotenv`, `cors`

## API routes

- `POST /api/chat` — proxies the conversation to Claude, pulls a `LEAD_DATA:{...}`
  JSON block out of the reply and strips it from the text shown to the visitor
- `POST /api/contact` — contact form (name, email, phone required) → HTML email
- `POST /api/lead` — qualified lead (name, phone required) → email badged HOT / WARM / COLD
- `GET *` — falls through to `public/index.html`

Scoring rules live in the chatbot system prompt in `server.js`: HOT = budget
over 1Cr and timeline under 3 months, WARM = budget over 50L or timeline under
6 months, COLD otherwise.

## Running it

```bash
npm install
npm start      # node server.js — listens on $PORT, default 3001
```

`server.js` reads `ANTHROPIC_API_KEY`, `EMAIL_USER`, `EMAIL_PASS` and `PORT`
from the environment; `.env` is gitignored. The notification recipient address
is currently hardcoded in `server.js`.

## Structure

- `server.js` — Express app, all three routes, the HTML email templates
- `public/index.html` — the whole site: hero, featured properties, about,
  services, testimonials, contact form, chat widget markup
- `public/css/style.css` — navy `#0c1b2a` / gold `#d4a843` theme
- `public/js/chat-widget.js` — chat widget, conversation history, lead POST
- `docs/superpowers/plans/` — the implementation plan the project was built from
- `CLAUDE.md` — short project notes
