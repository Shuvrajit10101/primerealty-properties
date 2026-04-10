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
    const cleanContent = content
      .replace(/\nLEAD_DATA:\{.*\}/, '')
      .replace(/LEAD_DATA:\{.*\}/, '')
      .trim();

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
    const scoreBadgeBg   = leadScore === 'HOT' ? '#fde8e8' : leadScore === 'WARM' ? '#fef3e2' : '#e8f4fd';

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
