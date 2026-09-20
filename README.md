# INE Product Price Tracker

A full-stack product price tracking application built for the INE Software Engineer Intern assignment.

The application allows users to search for products from INE's hosted mock store, track one or more products, and monitor their price and stock over time. The application stores successful scrape results as historical data and records scrape outcomes in a separate log.

The main focus of the implementation was scraper reliability because the mock store has dynamically loaded content, delayed responses, and occasional failures.

## Live Application

Frontend:
https://frontend-git-main-devanshi-srivastavas-projects.vercel.app/

Backend:
https://ine-product-price-tracker-1aog.onrender.com/

GitHub:
https://github.com/Day-waah/ine-product-price-tracker

Mock Store:
https://demo.inelabteamdev.com/

## Features

### Product Search
- Search products by full or partial product name.
- Case-insensitive search is supported.
- Products are retrieved from the mock store catalog.

### Product Tracking
- Users can track products from the search results.
- Tracked products are persisted in Supabase.
- Multiple products can be tracked at the same time.

### Current Price and Stock
- Shows the latest successfully scraped price.
- Shows the latest available stock.
- Provides a manual "Scrape Now" option for testing.

### Price History
- Successful scrape results are stored with timestamps.
- The dashboard shows historical price and stock information.
- Price history is available as both a graph and a table.

### Scrape Logs
- Each tracked product has its own scrape history.
- Logs contain timestamp, status, attempts, price, stock, and error information.
- Failures are recorded instead of silently ignored.

### Reliable Scraping
The scraper:
- Uses Playwright for browser-based interaction.
- Handles the mock store's dynamically revealed price.
- Waits for required elements and content.
- Retries failed scrapes up to three times.
- Validates extracted price and stock values.
- Does not store fake price/stock values when scraping fails.
- Continues processing other products when one product fails.

### Scheduled Scraping
- cron-job.org triggers the scheduled scrape every 2 hours.
- The backend retrieves all active tracked products.
- Each active product is scraped sequentially.
- Successful results are saved to price history.
- Failed products are recorded in scrape logs.

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- CSS

### Backend
- Node.js
- Express
- Playwright
- CORS
- dotenv

### Database
- Supabase
- PostgreSQL

### Hosting and Scheduling
- Vercel - frontend
- Render - backend
- cron-job.org - external scheduler

## Architecture

```text
                    React Frontend
                         |
                       Vercel
                         |
                         v
                Node.js / Express
                     on Render
                         |
              +----------+----------+
              |                     |
              v                     v
         Playwright             Supabase
              |               PostgreSQL
              v
       INE Mock Store

cron-job.org
      |
      | every 2 hours
      v
POST /api/scrape/scrape-all
      |
      v
Render Backend
      |
      v
Scrape all active tracked products