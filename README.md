# INE Intern Assignment - Product Price Tracker

A high-performance, full-stack web application built for the INE Software Engineer Intern Assignment. It tracks product prices and stock availability from a custom mock store over time, featuring an ultra-fast backend scraper, a resilient PostgreSQL database (Supabase), and a beautiful Neo-Brutalist React dashboard.

## 🚀 Live Demo
- **Frontend Dashboard**: [https://ine-price-tracker1.vercel.app/](https://ine-price-tracker1.vercel.app/)
- **Backend API**: [https://price-tracker-backend-6kew.onrender.com](https://price-tracker-backend-6kew.onrender.com)

## 🛠️ Tech Stack
- **Frontend**: React, Vite, Tailwind CSS (Hosted on Vercel)
- **Backend**: Node.js, Express (Hosted on Render)
- **Database**: Supabase (PostgreSQL)

## ⚙️ Scraping & Scheduling Architecture

### The Anti-Bot Bypass Scraper
The target mock store features a client-side anti-bot puzzle (WASM proof-of-work) to prevent automated fetching. Instead of relying on a slow, memory-heavy headless browser (like Playwright/Puppeteer), this scraper **reverse-engineers the WASM cryptographic challenge** natively in Node.js. 

This allows for incredibly fast, lightweight HTTP fetching that bypasses the anti-bot firewall in milliseconds without crashing the server.

### Automated Cloud Scheduling
Because the backend is hosted on Render's free tier (which sleeps after 15 minutes of inactivity), we use `cron-job.org` to keep the server awake and completely automate the scraping process 24/7:

1. **Keep-Alive Ping (Every 1 minute):**
   - **URL:** `https://price-tracker-backend-6kew.onrender.com/health`
   - **Method:** `GET`
   - **Purpose:** Constantly pings the lightweight health endpoint to ensure the Render server stays awake 24/7, completely preventing 502 wake-up crash errors.

2. **Trigger Scrape (Every 2 hours):**
   - **URL:** `https://price-tracker-backend-6kew.onrender.com/api/products/scrape-all`
   - **Method:** `GET`
   - **Purpose:** Instantly triggers a background scrape for all tracked products.
   - **Safety:** The backend uses a specialized sequential queue with a strict 1500ms delay between product scrapes to completely avoid `429 Too Many Requests` IP bans from the mock store during bulk operations.

## 💻 Local Setup Instructions

### 1. Database (Supabase)
Create a new Supabase project and run the provided SQL scripts (if any) to generate the `products`, `scrape_logs`, and `price_history` tables.

### 2. Environment Variables
Create a `.env` file in the `backend/` directory:
```env
PORT=3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

Create a `.env` file in the `frontend/` directory:
```env
VITE_API_URL=http://localhost:3000
```

### 3. Run Locally
**Start the backend:**
```bash
cd backend
npm install
npm run dev
```

**Start the frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🎥 Headed Mode Recording (Grading Requirement)
The grading rubric requests a screen recording of the scraper running in a "headed" browser. Because our primary scraper is highly optimized and runs completely headlessly via raw HTTP/WASM execution, we have provided a secondary fallback script specifically for this grading requirement.

To run the headed Playwright script and record your video:
```bash
cd backend
npm run scrape:headed
```
This will open a visible Chromium window, navigate to a product, bypass the anti-bot challenge by simulating human mouse movements, extract the price, and log it to the terminal.
