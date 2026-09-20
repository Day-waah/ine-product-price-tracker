# Design Note – INE Product Price Tracker

## 1. Overview

The main goal of this project was to build a product price tracker that can keep working even when the target website is slow, dynamic, or temporarily fails.

The INE mock store was intentionally difficult to scrape, so most of my effort went into making the scraper reliable rather than only focusing on the UI.

## 2. Why I Used Playwright

I first considered using normal HTTP requests and HTML parsing, but the mock store does not show the price directly when the page first loads.

The price is revealed only after interacting with the price area, so I used Playwright to handle the browser interaction.

The scraper opens the product page, performs the required interaction, waits for the price to appear, extracts the price and stock, and validates the values before saving them.

## 3. Scraping and Retry Handling

The scraper can fail because the page is slow or a required element does not appear in time.

To handle this, I retry the scrape up to three times.

The flow is:

Attempt 1 → Retry if failed  
Attempt 2 → Retry if failed  
Attempt 3 → Success or final failure

If the scrape succeeds, the price and stock are stored in the price history.

If all attempts fail, I do not store incorrect data. Instead, I record the failure and the error message in the scrape logs.

The batch also continues with the remaining products if one product fails.

## 4. Dynamic Price Problem

One of the first problems I faced was that a simple Playwright hover was not reliable enough to trigger the price reveal.

I changed this to a more controlled mouse movement into the price area and then waited for the price to become available.

This worked more reliably with the behavior of the mock store.

## 5. Product Search

The mock store did not provide the exact search functionality needed for the application, so I used its catalog API for product discovery.

The backend loads the catalog, handles temporary rate limits with retries, removes duplicate products, and then performs full or partial product-name matching.

This allows users to search using terms such as "bulb" instead of needing the complete product name.

## 6. Database Design

I kept the database structure simple and separated the responsibilities into three tables.

### tracked_products

Stores the products that users have chosen to track.

### price_history

Stores the successful price and stock values along with the time they were scraped.

### scrape_logs

Stores the outcome of scraping, including status, attempts, timestamps, and errors.

This makes it easy to show both the product history and what happened during each scrape.

## 7. Scheduled Scraping

I used cron-job.org as an external scheduler instead of keeping a scheduler running inside the Node.js backend.

This was important because the backend is deployed on free-tier infrastructure and may go idle.

cron-job.org calls the following endpoint every two hours:

POST /api/scrape/scrape-all

The endpoint is protected using the X-Cron-Secret header.

The endpoint returns a small 202 Accepted response quickly, while the backend continues processing the active tracked products.

## 8. Deployment

The final architecture is:

React frontend → Vercel  
Node.js + Express + Playwright → Render  
Supabase PostgreSQL → Database  
cron-job.org → External scheduler

The frontend communicates with the backend through the Render API, and the backend handles the scraper and database operations.

## 9. Problems I Faced During Development

### Express route order

Initially, the /:trackedProductId route was defined before /scrape-all.

Because of this, Express treated "scrape-all" as a product ID and the request failed when Supabase expected a UUID.

I fixed this by placing the specific /scrape-all route before the parameterized route.

### Playwright on Render

The scraper worked locally but initially failed on Render because Playwright installed the browser in one location while the runtime looked for it somewhere else.

I fixed this by using PLAYWRIGHT_BROWSERS_PATH=0 during the Playwright installation and also in the Render runtime environment.

### cron-job.org response size

The first version of the scheduled endpoint returned the full scrape result.

cron-job.org rejected this because the response was too large.

I changed the endpoint so that it quickly returns 202 Accepted and the scraping continues in the background.

### Failure testing

I created a temporary invalid tracked product to test what happens when a product completely fails.

The test showed that the failed product was logged correctly while the other products continued to scrape successfully.

The temporary test product was then marked inactive so it would not be included in future scheduled runs.

## 10. Trade-offs

Using Playwright is heavier than using a simple HTTP request, but it was necessary because the price on the mock store depended on browser interaction.

I also chose to scrape products sequentially instead of in parallel. This is slower, but it is easier to control and reduces the chance of sending too many requests to the mock store at the same time.

## 11. AI-Assisted Development

I used AI tools during development, but I tested the generated code instead of using it blindly.

Some of the first approaches did not work correctly. For example, the first hover implementation was unreliable, the /scrape-all route had a route-order issue, the first Render Playwright setup had a browser-path problem, and the first cron endpoint returned too much data.

I identified these issues through testing and runtime errors and then corrected the affected parts of the application.

## 12. Final Result

The final application supports:

- full and partial product search
- product tracking
- multiple tracked products
- current price and stock
- price history graph and table
- scrape logs
- retries and failure handling
- batch continuation when one product fails
- scheduled scraping every two hours
- Vercel frontend deployment
- Render backend deployment
- Supabase data storage
- cron-job.org scheduling

The main focus throughout the project was making the scraper reliable and making sure failures were handled honestly instead of storing incorrect data.