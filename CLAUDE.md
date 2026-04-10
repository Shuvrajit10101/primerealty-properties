# PrimeRealty Properties — Apex Automations Portfolio Demo #2

## Project Overview
Luxury real estate website with AI lead-qualification chatbot.

## Stack
- Node.js/Express backend (port 3001)
- Vanilla HTML/CSS/JS frontend
- Anthropic Claude API for chatbot (model: claude-sonnet-4-20250514)
- Nodemailer for email delivery

## API Routes
- POST /api/contact  — contact form submission
- POST /api/chat     — AI chatbot proxy
- POST /api/lead     — qualified lead emailer → homechoudhuryapex@gmail.com

## Design
- Colors: #0c1b2a (navy bg), #d4a843 (gold accent), white text
- Fonts: DM Sans + Playfair Display (Google Fonts)

## Running
npm install && node server.js
Server starts on port 3001: http://localhost:3001

## Lead Scoring
- HOT:  budget >1Cr AND timeline <3 months
- WARM: budget >50L OR timeline <6 months
- COLD: everything else
