# PrimeRealty Properties — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a luxury real estate agency website "PrimeRealty Properties" with an AI chatbot that qualifies leads and emails them to the agency.

**Architecture:** Express.js serves static files from `/public` and exposes three API routes — `/api/contact` (contact form), `/api/chat` (Claude AI proxy), and `/api/lead` (qualified lead emailer). The frontend is a single-page scrolling site; the chatbot is a floating widget that drives a multi-turn conversation via the Claude API.

**Tech Stack:** Node.js 18+, Express 4, @anthropic-ai/sdk, Nodemailer, express-rate-limit, dotenv, vanilla HTML/CSS/JS, Google Fonts (DM Sans + Playfair Display)

---

## File Map

| File | Create/Modify | Responsibility |
|---|---|---|
| `package.json` | Create | Dependencies + npm scripts |
| `.env` | Create | API keys and config (not committed) |
| `.gitignore` | Create | Exclude .env and node_modules |
| `CLAUDE.md` | Create | Project notes for AI assistants |
| `server.js` | Create | Express app, all 3 routes, email logic |
| `public/index.html` | Create | Full single-page website markup |
| `public/css/style.css` | Create | Navy/gold theme, responsive layout |
| `public/js/chat-widget.js` | Create | Floating chatbot widget + lead capture |

---

### Task 1: Project scaffolding (package.json, .gitignore, .env, CLAUDE.md)

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env`
- Create: `CLAUDE.md`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "primerealty-properties",
  "version": "1.0.0",
  "description": "PrimeRealty Properties — AI-powered real estate website",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@anthropic-ai/sdk": "^0.20.0",
    "nodemailer": "^6.9.7",
    "express-rate-limit": "^7.1.5"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
.env
*.log
```

- [ ] **Step 3: Create .env**

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_gmail_app_password_here
PORT=3001
```

- [ ] **Step 4: Create CLAUDE.md**

```markdown
# PrimeRealty Properties — Apex Automations Portfolio Demo #2

## Project Overview
Luxury real estate website with AI lead-qualification chatbot.

## Stack
- Node.js/Express backend (port 3001)
- Vanilla HTML/CSS/JS frontend
- Anthropic Claude API for chatbot (model: claude-sonnet-4-20250514)
- Nodemailer for email delivery

## API Routes
- POST /api/contact — contact form submission
- POST /api/chat   — AI chatbot proxy
- POST /api/lead   — qualified lead emailer → homechoudhuryapex@gmail.com

## Design
- Colors: #0c1b2a (navy bg), #d4a843 (gold accent), white text
- Fonts: DM Sans + Playfair Display (Google Fonts)

## Running
npm install && node server.js
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors

---

### Task 2: Express server with all API routes (server.js)

**Files:**
- Create: `server.js`

- [ ] **Step 1: Create server.js**

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const Anthropic = require('@anthropic-ai/sdk');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const CHATBOT_SYSTEM_PROMPT = `You are PrimeRealty's intelligent property assistant. Your job is to qualify leads by asking these questions one at a time in a friendly conversational tone:

1) Are you looking to buy, rent, or sell?
2) What type of property? (Apartment/Villa/Plot/Commercial)
3) Preferred location/area?
4) Budget range?
5) Timeline — when do you plan to move?
6) Their name, phone number, and email.

After collecting all info, score the lead:
- HOT: budget >1Cr AND timeline <3 months
- WARM: budget >50L OR timeline <6 months  
- COLD: everything else

Confirm their details and say a senior consultant will call within 2 hours.

When you have collected ALL 6 pieces of information (intent, property type, location, budget, timeline, and contact details), you MUST output a special JSON block at the end of your message in this exact format (on its own line):
LEAD_DATA:{"name":"...","email":"...","phone":"...","propertyType":"...","location":"...","budget":"...","timeline":"...","leadScore":"HOT|WARM|COLD"}

Support both Hindi and English. Be warm, professional, and helpful.`;

// ─── POST /api/chat ────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: CHATBOT_SYSTEM_PROMPT,
      messages: messages
    });

    const content = response.content[0].text;

    // Extract lead data if present
    const leadMatch = content.match(/LEAD_DATA:(\{.*\})/);
    let leadData = null;
    if (leadMatch) {
      try {
        leadData = JSON.parse(leadMatch[1]);
      } catch (e) {
        // ignore parse errors
      }
    }

    // Clean message (remove LEAD_DATA line from display)
    const cleanContent = content.replace(/\nLEAD_DATA:\{.*\}/, '').replace(/LEAD_DATA:\{.*\}/, '').trim();

    res.json({ message: cleanContent, leadData });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat service unavailable' });
  }
});

// ─── POST /api/contact ────────────────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, propertyInterest, budget } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'name, email, phone required' });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'homechoudhuryapex@gmail.com',
      subject: `New Contact Form Submission — ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
          <div style="background: #0c1b2a; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #d4a843; margin: 0; font-size: 24px;">PrimeRealty Properties</h1>
            <p style="color: #fff; margin: 5px 0 0;">New Contact Form Submission</p>
          </div>
          <div style="background: #fff; padding: 20px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold; color: #0c1b2a; width: 40%;">Name:</td><td style="padding: 8px;">${name}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #0c1b2a;">Email:</td><td style="padding: 8px;">${email}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #0c1b2a;">Phone:</td><td style="padding: 8px;">${phone}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #0c1b2a;">Property Interest:</td><td style="padding: 8px;">${propertyInterest || 'Not specified'}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #0c1b2a;">Budget:</td><td style="padding: 8px;">${budget || 'Not specified'}</td></tr>
            </table>
          </div>
          <p style="text-align: center; color: #888; font-size: 12px; margin-top: 15px;">Sent from PrimeRealty Properties website</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Contact form: ${name} <${email}>`);
    res.json({ success: true, message: 'Thank you! We will contact you within 2 hours.' });
  } catch (err) {
    console.error('Contact email error:', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ─── POST /api/lead ───────────────────────────────────────────────────────────
app.post('/api/lead', async (req, res) => {
  try {
    const { name, email, phone, propertyType, location, budget, timeline, leadScore } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone required' });
    }

    const scoreBadgeColor = leadScore === 'HOT' ? '#e74c3c' : leadScore === 'WARM' ? '#f39c12' : '#3498db';
    const scoreBadgeBg = leadScore === 'HOT' ? '#fde8e8' : leadScore === 'WARM' ? '#fef3e2' : '#e8f4fd';

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'homechoudhuryapex@gmail.com',
      subject: `🏠 ${leadScore || 'NEW'} Lead: ${name} — PrimeRealty Chatbot`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
          <div style="background: #0c1b2a; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #d4a843; margin: 0; font-size: 24px;">PrimeRealty Properties</h1>
            <p style="color: #fff; margin: 5px 0 0;">AI Chatbot — Qualified Lead</p>
          </div>
          <div style="background: #fff; padding: 20px; border-radius: 0 0 8px 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="display: inline-block; background: ${scoreBadgeBg}; color: ${scoreBadgeColor}; border: 2px solid ${scoreBadgeColor}; padding: 8px 24px; border-radius: 20px; font-size: 22px; font-weight: bold; letter-spacing: 2px;">
                ${leadScore || 'UNSCORED'} LEAD
              </span>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 10px 8px; font-weight: bold; color: #0c1b2a; width: 40%; border-bottom: 1px solid #eee;">Name:</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${name}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 10px 8px; font-weight: bold; color: #0c1b2a; border-bottom: 1px solid #eee;">Phone:</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${phone}</td></tr>
              <tr><td style="padding: 10px 8px; font-weight: bold; color: #0c1b2a; border-bottom: 1px solid #eee;">Email:</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${email || 'Not provided'}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 10px 8px; font-weight: bold; color: #0c1b2a; border-bottom: 1px solid #eee;">Property Type:</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${propertyType || 'Not specified'}</td></tr>
              <tr><td style="padding: 10px 8px; font-weight: bold; color: #0c1b2a; border-bottom: 1px solid #eee;">Location:</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${location || 'Not specified'}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 10px 8px; font-weight: bold; color: #0c1b2a; border-bottom: 1px solid #eee;">Budget:</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${budget || 'Not specified'}</td></tr>
              <tr><td style="padding: 10px 8px; font-weight: bold; color: #0c1b2a;">Timeline:</td><td style="padding: 10px 8px;">${timeline || 'Not specified'}</td></tr>
            </table>
            <div style="margin-top: 20px; padding: 15px; background: #f0f7ff; border-left: 4px solid #d4a843; border-radius: 4px;">
              <p style="margin: 0; color: #0c1b2a; font-size: 14px;"><strong>Action Required:</strong> Contact this lead within 2 hours as promised by the chatbot.</p>
            </div>
          </div>
          <p style="text-align: center; color: #888; font-size: 12px; margin-top: 15px;">Generated by PrimeRealty AI Chatbot | Apex Automations</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`LEAD [${leadScore}]: ${name} | ${phone} | Budget: ${budget}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Lead email error:', err.message);
    res.status(500).json({ error: 'Failed to process lead' });
  }
});

// ─── Catch-all → index.html ───────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ PrimeRealty server running on port ${PORT}`);
  console.log(`   http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Verify server starts (before frontend is built)**

Run: `node server.js`
Expected output contains: `PrimeRealty server running on port 3001`
Then Ctrl+C to stop.

---

### Task 3: CSS stylesheet (public/css/style.css)

**Files:**
- Create: `public/css/style.css`

- [ ] **Step 1: Create style.css**

```css
/* ── Reset & Variables ─────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --navy: #0c1b2a;
  --navy-light: #142236;
  --navy-card: #0f2236;
  --gold: #d4a843;
  --gold-light: #e8c06a;
  --gold-dark: #b8902e;
  --white: #ffffff;
  --text-muted: #a0b0c0;
  --text-light: #e0e8f0;
  --border: rgba(212,168,67,0.2);
  --shadow: 0 8px 32px rgba(0,0,0,0.4);
  --radius: 12px;
}

html { scroll-behavior: smooth; }

body {
  font-family: 'DM Sans', sans-serif;
  background: var(--navy);
  color: var(--white);
  line-height: 1.6;
  overflow-x: hidden;
}

h1, h2, h3 { font-family: 'Playfair Display', serif; line-height: 1.2; }

a { color: var(--gold); text-decoration: none; }
a:hover { color: var(--gold-light); }

img { max-width: 100%; }

.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }

/* ── Buttons ───────────────────────────────────────────── */
.btn-primary {
  display: inline-block;
  background: var(--gold);
  color: var(--navy);
  padding: 14px 32px;
  border-radius: 6px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  font-size: 1rem;
  border: none;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
  letter-spacing: 0.5px;
}
.btn-primary:hover { background: var(--gold-light); transform: translateY(-2px); color: var(--navy); }

.btn-outline {
  display: inline-block;
  background: transparent;
  color: var(--gold);
  padding: 12px 28px;
  border-radius: 6px;
  font-weight: 600;
  border: 2px solid var(--gold);
  cursor: pointer;
  transition: all 0.2s;
}
.btn-outline:hover { background: var(--gold); color: var(--navy); }

/* ── Navigation ────────────────────────────────────────── */
.navbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 1000;
  padding: 16px 0;
  background: rgba(12, 27, 42, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  transition: padding 0.3s;
}
.navbar .container { display: flex; align-items: center; justify-content: space-between; }

.nav-logo {
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gold);
}
.nav-logo span { color: var(--white); font-weight: 400; }

.nav-links { display: flex; gap: 28px; list-style: none; }
.nav-links a { color: var(--text-light); font-weight: 500; font-size: 0.95rem; transition: color 0.2s; }
.nav-links a:hover { color: var(--gold); }

.nav-cta { display: flex; align-items: center; gap: 12px; }

.hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; background: none; border: none; padding: 4px; }
.hamburger span { display: block; width: 24px; height: 2px; background: var(--white); transition: all 0.3s; }

/* ── Hero ──────────────────────────────────────────────── */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  position: relative;
  padding-top: 80px;
  background: linear-gradient(135deg, #0c1b2a 0%, #0f2236 40%, #162d44 100%);
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 700px; height: 700px;
  background: radial-gradient(circle, rgba(212,168,67,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero-content { position: relative; z-index: 1; max-width: 650px; }

.hero-badge {
  display: inline-block;
  background: rgba(212,168,67,0.15);
  border: 1px solid rgba(212,168,67,0.4);
  color: var(--gold);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 20px;
}

.hero h1 {
  font-size: clamp(2.2rem, 5vw, 3.8rem);
  font-weight: 700;
  margin-bottom: 20px;
  color: var(--white);
}
.hero h1 em { font-style: normal; color: var(--gold); }

.hero p {
  font-size: 1.1rem;
  color: var(--text-muted);
  margin-bottom: 36px;
  max-width: 500px;
}

.hero-cta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 48px; }

.hero-stats { display: flex; gap: 40px; padding-top: 32px; border-top: 1px solid var(--border); }
.stat-item { text-align: left; }
.stat-number { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 700; color: var(--gold); display: block; }
.stat-label { color: var(--text-muted); font-size: 0.85rem; }

/* ── Section Common ────────────────────────────────────── */
section { padding: 80px 0; }

.section-header { text-align: center; margin-bottom: 56px; }
.section-tag {
  display: inline-block;
  background: rgba(212,168,67,0.1);
  color: var(--gold);
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.section-header h2 { font-size: clamp(1.8rem, 3vw, 2.5rem); margin-bottom: 14px; color: var(--white); }
.section-header p { color: var(--text-muted); max-width: 540px; margin: 0 auto; font-size: 1.05rem; }

/* ── Properties ────────────────────────────────────────── */
.properties { background: var(--navy-light); }

.properties-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 28px;
}

.property-card {
  background: var(--navy-card);
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--border);
  transition: transform 0.3s, box-shadow 0.3s;
}
.property-card:hover { transform: translateY(-6px); box-shadow: var(--shadow); }

.property-image {
  height: 210px;
  position: relative;
  overflow: hidden;
}
.property-badge {
  position: absolute;
  top: 14px; left: 14px;
  background: var(--gold);
  color: var(--navy);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.property-badge.featured { background: #e74c3c; color: #fff; }

.property-info { padding: 20px; }
.property-price {
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem;
  color: var(--gold);
  font-weight: 700;
  margin-bottom: 6px;
}
.property-name { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
.property-location { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
.property-location::before { content: '📍'; font-size: 0.85rem; }
.property-meta { display: flex; gap: 16px; padding-top: 14px; border-top: 1px solid var(--border); }
.meta-item { color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
.meta-item span:first-child { color: var(--gold); font-weight: 600; }

/* ── About ─────────────────────────────────────────────── */
.about .container { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }

.about-visual {
  height: 480px;
  border-radius: var(--radius);
  background: linear-gradient(135deg, #1a3a5c 0%, #0f2236 50%, #162d44 100%);
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}
.about-visual-inner { text-align: center; }
.about-visual-icon { font-size: 5rem; margin-bottom: 16px; }
.about-visual-text { font-family: 'Playfair Display', serif; font-size: 1.5rem; color: var(--gold); }
.about-visual-sub { color: var(--text-muted); font-size: 0.9rem; margin-top: 6px; }

.about-visual::before {
  content: '';
  position: absolute;
  top: -30%;
  left: -30%;
  width: 300px; height: 300px;
  background: radial-gradient(circle, rgba(212,168,67,0.1) 0%, transparent 70%);
  pointer-events: none;
}

.about-content .section-header { text-align: left; margin-bottom: 24px; }

.about-content p { color: var(--text-muted); margin-bottom: 20px; line-height: 1.8; }

.about-features { list-style: none; margin: 24px 0; }
.about-features li { padding: 8px 0; color: var(--text-light); display: flex; align-items: center; gap: 10px; }
.about-features li::before { content: '✦'; color: var(--gold); font-size: 0.7rem; }

.about-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 28px; }
.about-stat-card {
  background: var(--navy-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.about-stat-card .number { font-family: 'Playfair Display', serif; font-size: 1.8rem; color: var(--gold); font-weight: 700; }
.about-stat-card .label { color: var(--text-muted); font-size: 0.8rem; }

/* ── Services ──────────────────────────────────────────── */
.services { background: var(--navy-light); }

.services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; }

.service-card {
  background: var(--navy-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px 24px;
  text-align: center;
  transition: border-color 0.3s, transform 0.3s;
  cursor: default;
}
.service-card:hover { border-color: var(--gold); transform: translateY(-4px); }
.service-icon { font-size: 2.5rem; margin-bottom: 16px; }
.service-card h3 { font-size: 1.05rem; margin-bottom: 10px; font-family: 'DM Sans', sans-serif; font-weight: 600; }
.service-card p { color: var(--text-muted); font-size: 0.88rem; line-height: 1.6; }

/* ── Testimonials ──────────────────────────────────────── */
.testimonials-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 28px; }

.testimonial-card {
  background: var(--navy-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px;
  position: relative;
}
.testimonial-card::before { content: '"'; position: absolute; top: 16px; right: 24px; font-size: 4rem; color: rgba(212,168,67,0.15); font-family: 'Playfair Display', serif; line-height: 1; }

.testimonial-stars { color: var(--gold); font-size: 0.9rem; margin-bottom: 14px; letter-spacing: 2px; }
.testimonial-text { color: var(--text-light); font-size: 0.95rem; line-height: 1.7; margin-bottom: 20px; }
.testimonial-author { display: flex; align-items: center; gap: 12px; }
.author-avatar {
  width: 46px; height: 46px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 1.1rem;
  color: var(--navy);
  background: var(--gold);
  flex-shrink: 0;
}
.author-name { font-weight: 600; font-size: 0.95rem; }
.author-detail { color: var(--text-muted); font-size: 0.8rem; }

/* ── Contact ───────────────────────────────────────────── */
.contact { background: var(--navy-light); }
.contact .container { display: grid; grid-template-columns: 1fr 1.5fr; gap: 64px; align-items: start; }

.contact-info h2 { font-size: 2rem; margin-bottom: 16px; }
.contact-info p { color: var(--text-muted); margin-bottom: 32px; line-height: 1.7; }
.contact-detail { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; }
.contact-detail-icon { background: rgba(212,168,67,0.1); border: 1px solid var(--border); width: 44px; height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
.contact-detail h4 { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 2px; font-family: 'DM Sans', sans-serif; font-weight: 500; }
.contact-detail p { color: var(--text-light); font-size: 0.95rem; margin: 0; }

.contact-form {
  background: var(--navy-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 36px;
}
.contact-form h3 { font-size: 1.4rem; margin-bottom: 24px; font-family: 'Playfair Display', serif; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { margin-bottom: 18px; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 7px; color: var(--text-light); }
.form-group input,
.form-group select {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  padding: 11px 14px;
  color: var(--white);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}
.form-group input:focus,
.form-group select:focus { outline: none; border-color: var(--gold); }
.form-group select option { background: var(--navy); color: var(--white); }
.form-group input::placeholder { color: rgba(255,255,255,0.3); }

#form-message { margin-top: 14px; padding: 10px 14px; border-radius: 6px; font-size: 0.9rem; display: none; }
#form-message.success { background: rgba(46,213,115,0.1); border: 1px solid rgba(46,213,115,0.3); color: #2ed573; display: block; }
#form-message.error { background: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.3); color: #e74c3c; display: block; }

/* ── Footer ────────────────────────────────────────────── */
footer { background: #080f18; padding: 60px 0 24px; border-top: 1px solid var(--border); }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 48px; margin-bottom: 48px; }
.footer-brand .logo { font-family: 'Playfair Display', serif; font-size: 1.4rem; color: var(--gold); margin-bottom: 12px; }
.footer-brand p { color: var(--text-muted); font-size: 0.9rem; line-height: 1.7; max-width: 280px; }
.social-links { display: flex; gap: 10px; margin-top: 20px; }
.social-link { width: 38px; height: 38px; background: var(--navy-light); border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; transition: background 0.2s, border-color 0.2s; color: var(--text-muted); }
.social-link:hover { background: rgba(212,168,67,0.1); border-color: var(--gold); color: var(--gold); }
.footer-col h4 { font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 700; color: var(--white); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 18px; }
.footer-col ul { list-style: none; }
.footer-col ul li { margin-bottom: 10px; }
.footer-col ul li a { color: var(--text-muted); font-size: 0.9rem; transition: color 0.2s; }
.footer-col ul li a:hover { color: var(--gold); }
.footer-contact-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; color: var(--text-muted); font-size: 0.88rem; }
.footer-contact-item span:first-child { color: var(--gold); flex-shrink: 0; margin-top: 2px; }
.footer-bottom { border-top: 1px solid var(--border); padding-top: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.footer-bottom p { color: var(--text-muted); font-size: 0.85rem; }
.footer-bottom a { color: var(--gold); }

/* ── WhatsApp FAB ──────────────────────────────────────── */
.whatsapp-fab {
  position: fixed;
  bottom: 96px;
  right: 24px;
  z-index: 998;
  width: 54px; height: 54px;
  background: #25d366;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(37, 211, 102, 0.4);
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  font-size: 1.5rem;
  color: white;
}
.whatsapp-fab:hover { transform: scale(1.1); box-shadow: 0 6px 24px rgba(37,211,102,0.6); color: white; }

/* ── Chat Widget ───────────────────────────────────────── */
.chat-toggle {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999;
  width: 58px; height: 58px;
  background: var(--gold);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(212,168,67,0.5);
  transition: transform 0.2s, box-shadow 0.2s;
  font-size: 1.5rem;
  color: var(--navy);
}
.chat-toggle:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(212,168,67,0.7); }

.chat-window {
  position: fixed;
  bottom: 96px;
  right: 24px;
  z-index: 999;
  width: 360px;
  max-height: 520px;
  background: var(--navy-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0;
  transform: translateY(20px) scale(0.95);
  pointer-events: none;
  transition: opacity 0.25s, transform 0.25s;
}
.chat-window.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }

.chat-header {
  background: linear-gradient(135deg, var(--navy) 0%, #142236 100%);
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
}
.chat-avatar { width: 40px; height: 40px; background: var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
.chat-header-text .name { font-weight: 700; font-size: 0.95rem; }
.chat-header-text .status { font-size: 0.78rem; color: #2ed573; display: flex; align-items: center; gap: 4px; }
.chat-header-text .status::before { content: '●'; font-size: 0.6rem; }
.chat-close { margin-left: auto; background: none; border: none; color: var(--text-muted); font-size: 1.3rem; cursor: pointer; line-height: 1; padding: 2px 6px; border-radius: 4px; }
.chat-close:hover { color: var(--white); background: rgba(255,255,255,0.1); }

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.chat-messages::-webkit-scrollbar { width: 4px; }
.chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.msg {
  max-width: 82%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 0.88rem;
  line-height: 1.5;
  animation: msgIn 0.2s ease;
}
@keyframes msgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.msg.bot { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); align-self: flex-start; color: var(--text-light); border-radius: 4px 12px 12px 12px; }
.msg.user { background: var(--gold); color: var(--navy); align-self: flex-end; font-weight: 500; border-radius: 12px 4px 12px 12px; }

.typing-indicator { display: flex; align-items: center; gap: 4px; padding: 10px 14px; background: rgba(255,255,255,0.06); border-radius: 4px 12px 12px 12px; align-self: flex-start; border: 1px solid rgba(255,255,255,0.08); }
.typing-dot { width: 7px; height: 7px; background: var(--text-muted); border-radius: 50%; animation: typingBounce 1s ease-in-out infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }

.chat-input-area {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  background: var(--navy);
}
#chat-input {
  flex: 1;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 9px 13px;
  color: var(--white);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.2s;
}
#chat-input:focus { border-color: var(--gold); }
#chat-input::placeholder { color: rgba(255,255,255,0.3); }
#chat-send {
  width: 38px; height: 38px;
  background: var(--gold);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--navy);
  font-size: 1rem;
  transition: background 0.2s;
  flex-shrink: 0;
}
#chat-send:hover { background: var(--gold-light); }
#chat-send:disabled { background: rgba(212,168,67,0.3); cursor: not-allowed; }

/* ── Responsive ────────────────────────────────────────── */
@media (max-width: 900px) {
  .nav-links { display: none; }
  .hamburger { display: flex; }
  .nav-links.mobile-open {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 100%; left: 0; right: 0;
    background: rgba(12,27,42,0.98);
    padding: 16px 24px;
    gap: 16px;
    border-bottom: 1px solid var(--border);
  }
  .about .container { grid-template-columns: 1fr; }
  .about-visual { height: 280px; }
  .contact .container { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 600px) {
  section { padding: 56px 0; }
  .hero-stats { gap: 24px; }
  .properties-grid { grid-template-columns: 1fr; }
  .services-grid { grid-template-columns: 1fr 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
  .footer-bottom { flex-direction: column; text-align: center; }
  .form-row { grid-template-columns: 1fr; }
  .chat-window { width: calc(100vw - 24px); right: 12px; bottom: 88px; }
  .about-stats { grid-template-columns: 1fr 1fr; }
}
```

---

### Task 4: HTML markup (public/index.html)

**Files:**
- Create: `public/index.html`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PrimeRealty Properties — Find Your Dream Property</title>
  <meta name="description" content="PrimeRealty Properties — Luxury real estate in India. Buy, sell, or rent premium properties. Trusted by 500+ families since 2015." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>

<!-- ── Navigation ─────────────────────────────────────── -->
<nav class="navbar" id="navbar">
  <div class="container">
    <div class="nav-logo">Prime<span>Realty</span></div>
    <ul class="nav-links" id="navLinks">
      <li><a href="#properties">Properties</a></li>
      <li><a href="#about">About</a></li>
      <li><a href="#services">Services</a></li>
      <li><a href="#testimonials">Testimonials</a></li>
      <li><a href="#contact">Contact</a></li>
    </ul>
    <div class="nav-cta">
      <a href="tel:+917087642005" class="btn-primary" style="padding:10px 20px;font-size:0.88rem;">📞 Call Now</a>
      <button class="hamburger" id="hamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</nav>

<!-- ── Hero ───────────────────────────────────────────── -->
<section class="hero" id="home">
  <div class="container">
    <div class="hero-content">
      <div class="hero-badge">✦ Premium Real Estate Since 2015</div>
      <h1>Find Your <em>Dream</em><br/>Property</h1>
      <p>Discover luxury apartments, villas, and commercial spaces across India's most sought-after locations. Expert guidance from search to keys.</p>
      <div class="hero-cta">
        <a href="#properties" class="btn-primary">Browse Properties</a>
        <a href="#contact" class="btn-outline">Get Free Consultation</a>
      </div>
      <div class="hero-stats">
        <div class="stat-item">
          <span class="stat-number">500+</span>
          <span class="stat-label">Happy Families</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">10+</span>
          <span class="stat-label">Years of Trust</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">₹200Cr+</span>
          <span class="stat-label">Properties Sold</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── Properties ─────────────────────────────────────── -->
<section class="properties" id="properties">
  <div class="container">
    <div class="section-header">
      <div class="section-tag">Our Listings</div>
      <h2>Featured Properties</h2>
      <p>Handpicked premium properties in prime locations — ready to move in or invest.</p>
    </div>
    <div class="properties-grid">

      <!-- Card 1: 2BHK Apartment -->
      <div class="property-card">
        <div class="property-image" style="background: linear-gradient(135deg, #1a4a6e 0%, #0d2e47 100%);">
          <div class="property-badge">Ready to Move</div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.6;font-size:4rem;">🏢</div>
        </div>
        <div class="property-info">
          <div class="property-price">₹45 Lakhs</div>
          <div class="property-name">Serene Heights 2BHK</div>
          <div class="property-location">Wakad, Pune</div>
          <div class="property-meta">
            <div class="meta-item"><span>2</span> BHK</div>
            <div class="meta-item"><span>875</span> sqft</div>
            <div class="meta-item"><span>3rd</span> Floor</div>
          </div>
        </div>
      </div>

      <!-- Card 2: 3BHK Apartment -->
      <div class="property-card">
        <div class="property-image" style="background: linear-gradient(135deg, #2d4a1e 0%, #1a3010 100%);">
          <div class="property-badge featured">Hot Deal</div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.6;font-size:4rem;">🏠</div>
        </div>
        <div class="property-info">
          <div class="property-price">₹78 Lakhs</div>
          <div class="property-name">Green Valley 3BHK</div>
          <div class="property-location">Baner, Pune</div>
          <div class="property-meta">
            <div class="meta-item"><span>3</span> BHK</div>
            <div class="meta-item"><span>1,250</span> sqft</div>
            <div class="meta-item"><span>7th</span> Floor</div>
          </div>
        </div>
      </div>

      <!-- Card 3: Villa -->
      <div class="property-card">
        <div class="property-image" style="background: linear-gradient(135deg, #4a2d1e 0%, #2e1a0f 100%);">
          <div class="property-badge">Premium</div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.6;font-size:4rem;">🏡</div>
        </div>
        <div class="property-info">
          <div class="property-price">₹1.35 Crores</div>
          <div class="property-name">Royal Palm Villa</div>
          <div class="property-location">Kharadi, Pune</div>
          <div class="property-meta">
            <div class="meta-item"><span>4</span> BHK</div>
            <div class="meta-item"><span>2,800</span> sqft</div>
            <div class="meta-item"><span>Private</span> Garden</div>
          </div>
        </div>
      </div>

      <!-- Card 4: Penthouse -->
      <div class="property-card">
        <div class="property-image" style="background: linear-gradient(135deg, #3a1e4a 0%, #220f30 100%);">
          <div class="property-badge featured">Exclusive</div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.6;font-size:4rem;">🏙️</div>
        </div>
        <div class="property-info">
          <div class="property-price">₹2.5 Crores</div>
          <div class="property-name">Sky Crown Penthouse</div>
          <div class="property-location">Koregaon Park, Pune</div>
          <div class="property-meta">
            <div class="meta-item"><span>5</span> BHK</div>
            <div class="meta-item"><span>4,200</span> sqft</div>
            <div class="meta-item"><span>Top</span> Floor</div>
          </div>
        </div>
      </div>

      <!-- Card 5: Commercial -->
      <div class="property-card">
        <div class="property-image" style="background: linear-gradient(135deg, #1e3a4a 0%, #0f2230 100%);">
          <div class="property-badge">Commercial</div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.6;font-size:4rem;">🏗️</div>
        </div>
        <div class="property-info">
          <div class="property-price">₹95 Lakhs</div>
          <div class="property-name">TechPark Office Space</div>
          <div class="property-location">Hinjewadi, Pune</div>
          <div class="property-meta">
            <div class="meta-item"><span>—</span> BHK</div>
            <div class="meta-item"><span>1,600</span> sqft</div>
            <div class="meta-item"><span>IT</span> Zone</div>
          </div>
        </div>
      </div>

      <!-- Card 6: Plot -->
      <div class="property-card">
        <div class="property-image" style="background: linear-gradient(135deg, #2a3a1e 0%, #18220f 100%);">
          <div class="property-badge">Investment</div>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.6;font-size:4rem;">🌄</div>
        </div>
        <div class="property-info">
          <div class="property-price">₹62 Lakhs</div>
          <div class="property-name">Sunrise Plot — 2400 sqft</div>
          <div class="property-location">Talegaon, Pune</div>
          <div class="property-meta">
            <div class="meta-item"><span>—</span> BHK</div>
            <div class="meta-item"><span>2,400</span> sqft</div>
            <div class="meta-item"><span>RERA</span> Approved</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- ── About ───────────────────────────────────────────── -->
<section class="about" id="about">
  <div class="container">
    <div class="about-visual">
      <div class="about-visual-inner">
        <div class="about-visual-icon">🏛️</div>
        <div class="about-visual-text">PrimeRealty Properties</div>
        <div class="about-visual-sub">Est. 2015 · Pune, India</div>
      </div>
    </div>
    <div class="about-content">
      <div class="section-header">
        <div class="section-tag">Our Story</div>
        <h2>Trusted by 500+ Families Since 2015</h2>
      </div>
      <p>PrimeRealty Properties was founded with a single mission: to make premium real estate accessible, transparent, and stress-free for every family. Over a decade, we've guided hundreds of homebuyers through one of the most important decisions of their lives.</p>
      <p>Our team of certified consultants brings deep market knowledge, honest guidance, and a personal touch that sets us apart from the rest. Whether you're buying your first home or expanding your portfolio, we're with you every step of the way.</p>
      <ul class="about-features">
        <li>RERA registered and fully compliant</li>
        <li>Zero hidden charges — full transparency</li>
        <li>Dedicated relationship manager for every client</li>
        <li>Post-sale support and documentation assistance</li>
        <li>Home loan tie-ups with 12+ banks at best rates</li>
      </ul>
      <div class="about-stats">
        <div class="about-stat-card"><div class="number">500+</div><div class="label">Happy Families</div></div>
        <div class="about-stat-card"><div class="number">10+</div><div class="label">Years Experience</div></div>
        <div class="about-stat-card"><div class="number">₹200Cr+</div><div class="label">Properties Sold</div></div>
        <div class="about-stat-card"><div class="number">4.9★</div><div class="label">Google Rating</div></div>
      </div>
    </div>
  </div>
</section>

<!-- ── Services ────────────────────────────────────────── -->
<section class="services" id="services">
  <div class="container">
    <div class="section-header">
      <div class="section-tag">What We Do</div>
      <h2>Our Services</h2>
      <p>End-to-end real estate services tailored to your needs — from finding the perfect home to managing your investment.</p>
    </div>
    <div class="services-grid">
      <div class="service-card">
        <div class="service-icon">🏠</div>
        <h3>Property Buying</h3>
        <p>Find your perfect home from our curated listings. Site visits, legal checks, and negotiation — all handled for you.</p>
      </div>
      <div class="service-card">
        <div class="service-icon">💰</div>
        <h3>Property Selling</h3>
        <p>Get the best price for your property. We handle marketing, buyer screening, and documentation seamlessly.</p>
      </div>
      <div class="service-card">
        <div class="service-icon">🔑</div>
        <h3>Property Renting</h3>
        <p>Find quality tenants or the perfect rental property. Agreements, background checks, and handover managed end-to-end.</p>
      </div>
      <div class="service-card">
        <div class="service-icon">📋</div>
        <h3>Property Management</h3>
        <p>Hands-off property ownership. We manage maintenance, tenant relations, and monthly collections for your portfolio.</p>
      </div>
      <div class="service-card">
        <div class="service-icon">🏦</div>
        <h3>Home Loans</h3>
        <p>Access loans from 12+ bank partners at the lowest interest rates. Quick approval, minimal documentation.</p>
      </div>
    </div>
  </div>
</section>

<!-- ── Testimonials ────────────────────────────────────── -->
<section class="testimonials" id="testimonials">
  <div class="container">
    <div class="section-header">
      <div class="section-tag">Happy Clients</div>
      <h2>What Our Clients Say</h2>
      <p>Real stories from families who found their dream property with PrimeRealty.</p>
    </div>
    <div class="testimonials-grid">
      <div class="testimonial-card">
        <div class="testimonial-stars">★★★★★</div>
        <p class="testimonial-text">"PrimeRealty made our home-buying journey completely stress-free. Our consultant Rohan was available 24/7 and helped us get a 3BHK in Baner at ₹12L below market rate. Highly recommend!"</p>
        <div class="testimonial-author">
          <div class="author-avatar">RK</div>
          <div>
            <div class="author-name">Rahul Kulkarni</div>
            <div class="author-detail">Bought 3BHK in Baner, Pune</div>
          </div>
        </div>
      </div>
      <div class="testimonial-card">
        <div class="testimonial-stars">★★★★★</div>
        <p class="testimonial-text">"I was skeptical at first, but PrimeRealty's team was transparent about every detail. No hidden charges, no surprises. Got a beautiful villa in Kharadi within 3 weeks of starting our search!"</p>
        <div class="testimonial-author">
          <div class="author-avatar">PS</div>
          <div>
            <div class="author-name">Priya Sharma</div>
            <div class="author-detail">Bought Villa in Kharadi, Pune</div>
          </div>
        </div>
      </div>
      <div class="testimonial-card">
        <div class="testimonial-stars">★★★★★</div>
        <p class="testimonial-text">"As an NRI investor, managing property from abroad was always a headache. PrimeRealty's property management service has been a game-changer — monthly reports, on-time rents, zero hassle."</p>
        <div class="testimonial-author">
          <div class="author-avatar">AM</div>
          <div>
            <div class="author-name">Arjun Mehta</div>
            <div class="author-detail">NRI Investor · Property Management Client</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── Contact ─────────────────────────────────────────── -->
<section class="contact" id="contact">
  <div class="container">
    <div class="contact-info">
      <div class="section-tag">Get In Touch</div>
      <h2>Let's Find Your<br/>Perfect Property</h2>
      <p>Fill out the form and a senior property consultant will call you within 2 hours. Or reach us directly — we're available 7 days a week.</p>
      <div class="contact-detail">
        <div class="contact-detail-icon">📍</div>
        <div>
          <h4>Office Address</h4>
          <p>304, Pallavi Heights, FC Road,<br/>Pune — 411004, Maharashtra</p>
        </div>
      </div>
      <div class="contact-detail">
        <div class="contact-detail-icon">📞</div>
        <div>
          <h4>Phone / WhatsApp</h4>
          <p>+91 70876 42005</p>
        </div>
      </div>
      <div class="contact-detail">
        <div class="contact-detail-icon">✉️</div>
        <div>
          <h4>Email</h4>
          <p>info@primerealty.in</p>
        </div>
      </div>
    </div>
    <div class="contact-form">
      <h3>Send Us a Message</h3>
      <form id="contactForm">
        <div class="form-row">
          <div class="form-group">
            <label for="fname">Your Name *</label>
            <input type="text" id="fname" name="name" placeholder="Rahul Sharma" required />
          </div>
          <div class="form-group">
            <label for="femail">Email Address *</label>
            <input type="email" id="femail" name="email" placeholder="rahul@email.com" required />
          </div>
        </div>
        <div class="form-group">
          <label for="fphone">Phone Number *</label>
          <input type="tel" id="fphone" name="phone" placeholder="+91 98765 43210" required />
        </div>
        <div class="form-group">
          <label for="finterest">Property Interest</label>
          <select id="finterest" name="propertyInterest">
            <option value="">Select property type</option>
            <option>2BHK Apartment</option>
            <option>3BHK Apartment</option>
            <option>Villa / Bungalow</option>
            <option>Penthouse</option>
            <option>Commercial Space</option>
            <option>Plot / Land</option>
          </select>
        </div>
        <div class="form-group">
          <label for="fbudget">Budget Range</label>
          <select id="fbudget" name="budget">
            <option value="">Select budget range</option>
            <option>Under ₹50 Lakhs</option>
            <option>₹50L – ₹1 Crore</option>
            <option>₹1 Crore – ₹2 Crore</option>
            <option>₹2 Crore+</option>
          </select>
        </div>
        <button type="submit" class="btn-primary" style="width:100%;margin-top:4px;">Send Message →</button>
        <div id="form-message"></div>
      </form>
    </div>
  </div>
</section>

<!-- ── Footer ──────────────────────────────────────────── -->
<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="logo">PrimeRealty Properties</div>
        <p>Helping families find their dream homes since 2015. RERA registered. Trusted. Transparent.</p>
        <div class="social-links">
          <a href="#" class="social-link" aria-label="Facebook">f</a>
          <a href="#" class="social-link" aria-label="Instagram">in</a>
          <a href="#" class="social-link" aria-label="Twitter">𝕏</a>
          <a href="#" class="social-link" aria-label="YouTube">▶</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Quick Links</h4>
        <ul>
          <li><a href="#home">Home</a></li>
          <li><a href="#properties">Properties</a></li>
          <li><a href="#about">About Us</a></li>
          <li><a href="#services">Services</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Services</h4>
        <ul>
          <li><a href="#">Buy Property</a></li>
          <li><a href="#">Sell Property</a></li>
          <li><a href="#">Rent Property</a></li>
          <li><a href="#">Property Management</a></li>
          <li><a href="#">Home Loans</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Contact</h4>
        <div class="footer-contact-item"><span>📍</span><span>304 Pallavi Heights, FC Road, Pune 411004</span></div>
        <div class="footer-contact-item"><span>📞</span><span>+91 70876 42005</span></div>
        <div class="footer-contact-item"><span>✉️</span><span>info@primerealty.in</span></div>
        <div class="footer-contact-item"><span>🕐</span><span>Mon–Sun: 9 AM – 8 PM</span></div>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2025 PrimeRealty Properties. All rights reserved.</p>
      <p>Built by <a href="#">Apex Automations</a> · Portfolio Demo #2</p>
    </div>
  </div>
</footer>

<!-- ── WhatsApp FAB ────────────────────────────────────── -->
<a href="https://wa.me/917087642005" class="whatsapp-fab" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">💬</a>

<!-- ── Chat Widget ─────────────────────────────────────── -->
<button class="chat-toggle" id="chatToggle" aria-label="Open chat">💬</button>
<div class="chat-window" id="chatWindow">
  <div class="chat-header">
    <div class="chat-avatar">🏠</div>
    <div class="chat-header-text">
      <div class="name">PrimeRealty Assistant</div>
      <div class="status">Online · Typically replies instantly</div>
    </div>
    <button class="chat-close" id="chatClose" aria-label="Close chat">✕</button>
  </div>
  <div class="chat-messages" id="chatMessages"></div>
  <div class="chat-input-area">
    <input type="text" id="chat-input" placeholder="Type your message..." autocomplete="off" />
    <button id="chat-send" aria-label="Send message">➤</button>
  </div>
</div>

<script src="/js/chat-widget.js"></script>
<script>
  // Hamburger menu
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  hamburger.addEventListener('click', () => navLinks.classList.toggle('mobile-open'));

  // Contact form
  document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const msg = document.getElementById('form-message');
    btn.textContent = 'Sending…';
    btn.disabled = true;
    msg.className = '';
    msg.style.display = 'none';
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (res.ok) {
        msg.textContent = json.message || 'Message sent! We\'ll call you within 2 hours.';
        msg.className = 'success';
        e.target.reset();
      } else {
        throw new Error(json.error || 'Failed');
      }
    } catch (err) {
      msg.textContent = 'Something went wrong. Please call us directly.';
      msg.className = 'error';
    }
    msg.style.display = 'block';
    btn.textContent = 'Send Message →';
    btn.disabled = false;
  });
</script>
</body>
</html>
```

---

### Task 5: Chat widget JavaScript (public/js/chat-widget.js)

**Files:**
- Create: `public/js/chat-widget.js`

- [ ] **Step 1: Create chat-widget.js**

```javascript
(function () {
  const toggle = document.getElementById('chatToggle');
  const window_ = document.getElementById('chatWindow');
  const closeBtn = document.getElementById('chatClose');
  const messagesEl = document.getElementById('chatMessages');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  let conversationHistory = [];
  let isOpen = false;

  // ── Open / Close ──────────────────────────────────────
  function openChat() {
    isOpen = true;
    window_.classList.add('open');
    toggle.innerHTML = '✕';
    input.focus();
    if (messagesEl.children.length === 0) {
      addBotMessage("Namaste! 🙏 Welcome to PrimeRealty Properties! I'm your personal property assistant.\n\nAre you looking to **buy**, **rent**, or **sell** a property?");
    }
  }

  function closeChat() {
    isOpen = false;
    window_.classList.remove('open');
    toggle.innerHTML = '💬';
  }

  toggle.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);

  // ── Render ────────────────────────────────────────────
  function addBotMessage(text) {
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
    messagesEl.appendChild(el);
    scrollBottom();
  }

  function addUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollBottom();
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typing';
    el.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    messagesEl.appendChild(el);
    scrollBottom();
    return el;
  }

  function removeTyping() {
    const el = document.getElementById('typing');
    if (el) el.remove();
  }

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Send message ──────────────────────────────────────
  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    sendBtn.disabled = true;
    addUserMessage(text);

    conversationHistory.push({ role: 'user', content: text });

    const typing = showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory })
      });

      const data = await res.json();
      removeTyping();

      if (!res.ok) throw new Error(data.error || 'Error');

      const botText = data.message;
      conversationHistory.push({ role: 'assistant', content: botText });
      addBotMessage(botText);

      // If lead data collected, POST to /api/lead
      if (data.leadData) {
        try {
          await fetch('/api/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.leadData)
          });
        } catch (e) {
          // silently fail — user experience unaffected
        }
      }

    } catch (err) {
      removeTyping();
      addBotMessage('Sorry, I\'m having trouble connecting. Please try again or call us at +91 70876 42005. 🙏');
    }

    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
})();
```

---

### Task 6: Final verification — npm install and server start

**Files:**
- No changes

- [ ] **Step 1: Run npm install**

```bash
npm install
```
Expected: All 6 packages installed, no errors.

- [ ] **Step 2: Start the server**

```bash
node server.js
```
Expected output:
```
✅ PrimeRealty server running on port 3001
   http://localhost:3001
```

- [ ] **Step 3: Smoke-test the API**

In a separate terminal:
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```
Expected: JSON response with `"message"` field containing bot greeting.

- [ ] **Step 4: Open in browser**

Navigate to: `http://localhost:3001`
Verify: Website loads with navy/gold theme, all 6 property cards visible, chat widget appears bottom-right.

---

## Self-Review

**Spec coverage:**
- ✅ Hero section with CTA
- ✅ 6 property cards (2BHK ₹45L → Penthouse ₹2.5Cr + commercial + plot)
- ✅ About section: "Trusted by 500+ Families Since 2015"
- ✅ 5 Services
- ✅ 3 Testimonials
- ✅ Contact form → POST /api/contact
- ✅ WhatsApp FAB → wa.me/917087642005
- ✅ Footer with address, phone, email, social links
- ✅ Dark navy + gold theme, DM Sans + Playfair Display
- ✅ Fully responsive
- ✅ Chat widget: floating gold button, opens window, sends to /api/chat
- ✅ Claude API: claude-sonnet-4-20250514, system prompt with 6-step qualification
- ✅ Lead scoring: HOT/WARM/COLD
- ✅ LEAD_DATA extraction → POST /api/lead
- ✅ Email to homechoudhuryapex@gmail.com with color-coded badge
- ✅ Typing indicator
- ✅ Hindi + English support (in system prompt)
- ✅ Port 3001
- ✅ .env with all required vars
- ✅ .gitignore excludes .env and node_modules
- ✅ express-rate-limit applied

**Placeholder scan:** None found — all code is complete.

**Type consistency:** All function names, API routes, and field names are consistent across tasks.
