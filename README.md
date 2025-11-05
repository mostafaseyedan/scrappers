# Recon: Data Intelligence Platform

Recon is a data intelligence platform designed to scrape, analyze, and manage public procurement data. It provides a web interface for searching, filtering, and managing solicitations, as well as an AI-powered chat assistant for interacting with the data.

## Architecture

The project is a full-stack Next.js application with a sophisticated architecture that includes a web scraper, a backend API, a frontend application, and an AI-powered chat assistant.

### Frontend

The frontend is a Next.js application located in the `app` directory. It uses:

*   **React** for building the user interface.
*   **Tailwind CSS** and **Shadcn UI** for styling and UI components.
*   **CSS Modules** for component-level styling.

### Backend

The backend is composed of several components:

*   **Next.js API Routes:** The `app/api` directory contains the backend API routes that handle requests from the frontend.
*   **Firebase Functions:** The `functions` directory contains a separate Node.js project for Firebase Cloud Functions. These functions are used for backend tasks, including scheduled jobs and serverless web scraping with Playwright.
*   **Scraping Scripts:** The `scripts` directory contains standalone web scraping scripts that can be executed manually.

### Data Storage

*   **Firestore:** The primary database for storing scraped solicitation data.
*   **Algolia:** Used for providing advanced search capabilities.

### AI & Scraping

*   **Hyperbrowser:** An AI-powered web scraping agent that uses a large language model (GPT-4) to understand natural language commands and automate browser actions. This makes the scrapers more flexible and easier to maintain.
*   **Genkit:** A framework for building AI-powered features, used here for the chat assistant and other AI tasks.

## Deployment

The application is deployed on Google Cloud:

*   **Firebase Hosting:** The frontend is served by Firebase Hosting at [https://reconrfp.cendien.com](https://reconrfp.cendien.com).
*   **Cloud Run:** The Next.js backend is a Cloud Run service named `recon`, managed by Firebase App Hosting.
*   **Project ID:** The Google Cloud project ID is `rfpscraper-dc3d8`.

## Getting Started (Local Development)

1.  **Install dependencies:**
    ```bash
    pnpm i
    ```

2.  **Set up environment variables:**
    Create a `.env` file in the root of the project and populate it with the necessary environment variables. You can use the `.env.example` file as a template.

3.  **Run the development server:**
    ```bash
    pnpm run serve
    ```
    The application will be available at [http://localhost:3000](http://localhost:3000).

## Backend Automation

The project uses Firebase Functions to automate several backend processes:

*   **Scheduled Scraping:** A daily scheduled function in `functions/src/schedulers/daily.ts` triggers the web scraping process for a list of vendors every weekday at 11 PM (America/Chicago time). This function uses Playwright to run the scraping tasks in a serverless environment.
*   **Firestore Triggers:** The project uses Firestore triggers to automatically perform actions in response to database events. For example, the `functions/src/firestore/makeUppercase.ts` trigger automatically converts a field to uppercase when a new document is created in a specific collection.

## Browserbase Integration

The project integrates with Browserbase through the `@hyperbrowser/agent` library, which is an AI-powered web scraping agent. The scraping scripts in the `scripts/scrapers` directory use this agent to scrape data from various websites.

The agent is initialized in the `scripts/utils.ts` file, where it is configured to use a local browser and the GPT-4 language model. The scrapers then use natural language prompts to instruct the agent to perform scraping tasks, such as navigating to a specific URL, extracting data from a table, and paginating through results.

## Environment Variables

The project uses a number of environment variables to configure the application for different environments. These variables are stored in a `.env` file in the root of the project.

### Backend (Cloud Run)

*   `BIDDIRECT_USER`
*   `BIDDIRECT_PASS`
*   `COOKIE_KEY`
*   `COOKIE_SECRET_CURRENT`
*   `COOKIE_SECRET_PREVIOUS`
*   `ELASTIC_NODE`
*   `ELASTIC_API_KEY`
*   `FIREBASE_PROJECT_ID`
*   `FIREBASE_CLIENT_EMAIL`
*   `FIREBASE_API_KEY`
*   `FIREBASE_PRIVATE_KEY`
*   `FIREBASE_STORAGE_BUCKET`
*   `GEMINI_KEY`
*   `HYPERBROWSER_API_KEY`
*   `OPENAI_API_KEY`
*   `PUBLICPURCHASE_USER`
*   `PUBLICPURCHASE_PASS`
*   `VENDORREGISTRY_USER`
*   `VENDORREGISTRY_PASS`

### Frontend (Next.js)

*   `NEXT_PUBLIC_ELASTIC_API_KEY`
*   `NEXT_PUBLIC_FIREBASE_API_KEY`
*   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
*   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
*   `NEXT_PUBLIC_FIREBASE_BUCKET`
*   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
*   `NEXT_PUBLIC_FIREBASE_APP_ID`
*   `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

## Scraper Scripts

The following scraper scripts are located in the `scripts/scrapers` directory:

*   `biddirect.ts`
*   `instantmarkets.ts`
*   `publicpurchase.ts`
*   `vendorregistry.ts`

## Analysis & Review

### What's Done Right (Strengths)

*   **AI-Powered Scraping:** The use of Hyperbrowser for natural language-based scraping is a major strength, making the scrapers more flexible and easier to maintain.
*   **Modern Tech Stack:** The project uses a modern and powerful tech stack (Next.js, Firebase, Algolia, Genkit).
*   **Clean Architecture:** The separation of concerns between the frontend, backend, and scraping scripts is well-done.
*   **Good Security Practices:** The use of Google Secret Manager for storing API keys is a good security practice.
*   **AI Chat Assistant:** The AI-powered chat assistant is a powerful feature for interacting with the data.

### Room for Improvement

*   **Code Duplication:** There is significant code duplication in the data models (`app/models.ts`, `app/models2.ts`, `app/models2Server.ts`, `functions/src/models.ts`, `functions/src/models2.ts`). The model definitions should be consolidated into a single source of truth.
*   **Lack of Testing:** There is no automated testing suite in the project. Adding unit tests, integration tests, and end-to-end tests would significantly improve the code quality and reduce the risk of regressions.
*   **Error Handling:** While there is some error handling, it could be more robust and consistent across the application.
*   **Hardcoded Values:** Some parts of the code, especially the scraper scripts, contain hardcoded values that should be moved to configuration files to improve maintainability.

### Known Issues

*   **Outdated `README.md`:** The previous `README.md` was outdated and inaccurate. This file has been updated to reflect the current state of the project.
*   **Scraper Breakage:** The web scrapers are dependent on the structure of external websites. They are prone to breaking if the websites change. This is an inherent risk with web scraping, but it's important to be aware of it.