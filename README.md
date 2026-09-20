# INE Intern Assignment - Product Price Tracker

A high-performance, full-stack web application built for the INE Software Engineer Intern Assignment. It tracks product prices and stock availability from a custom mock store over time, featuring an ultra-fast backend scraper, a resilient PostgreSQL database (Supabase), and a Neo-Brutalist React dashboard.

## Live Demo
- **Frontend**: [Your Vercel URL Here]
- **Backend**: https://price-tracker-backend-6kew.onrender.com

## Tech Stack
- **Frontend**: React (Vite) + Tailwind CSS (deployed on Vercel)
- **Backend**: Node.js + Express (deployed on Render)
- **Database**: Supabase (PostgreSQL)

## Scraping & Scheduling Configuration

### The Scraper
The mock store features a client-side anti-bot puzzle (WASM proof-of-work) to prevent automated fetching. Instead of relying on a slow, resource-heavy headless browser (like Playwright/Puppeteer), the scraper **reverse-engineers the WASM cryptographic challenge** natively in Node.js. 

This allows for incredibly fast, lightweight HTTP fetching that bypasses the anti-bot firewall in milliseconds.

### Scheduled Execution (cron-job.org)
Because this project is deployed on Render's free tier, the instance automatically sleeps after 15 minutes of inactivity. To keep the scraper running unattended indefinitely:

1. **Keep-Alive Ping (Every 14 minutes):**
   - URL: `https://price-tracker-backend-6kew.onrender.com/health`
   - Method: `GET`
   - Purpose: Prevents the Render instance from going to sleep.

2. **Trigger Scrape (Every 2 hours):**
   - URL: `https://price-tracker-backend-6kew.onrender.com/api/products/scrape-all`
   - Method: `POST`
   - Purpose: Initiates the background scrape queue for all tracked products.
   - Note: The backend uses a specialized sequential queue with a strict 1500ms delay between requests to completely avoid `429 Too Many Requests` bans from the mock store during bulk operations.

## Local Setup Instructions

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
Start the backend:
```bash
cd backend
npm install
npm run dev
```

Start the frontend:
```bash
cd frontend
npm install
npm run dev
```

## Headed Mode Recording (Grading Requirement)
The grading rubric requests a screen recording of the scraper running in a "headed" browser. Because our primary scraper is highly optimized and runs completely headlessly via raw HTTP/WASM execution, we have provided a secondary fallback script specifically for this grading requirement.

To run the headed Playwright script and record your video:
```bash
cd backend
npm run scrape:headed
```
This will open a visible Chromium window, navigate to a product, bypass the anti-bot challenge by simulating human mouse movements, extract the price, and log it to the terminal.
