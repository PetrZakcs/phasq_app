# PhasQ Production Deployment Guide

This document contains step-by-step instructions to connect the PhasQ Tactical Sat-Console to production services (Supabase, Google Earth Engine, OpenAI) and deploy it to a production subdomain (e.g., `app.phasq.com`).

---

## Step 1: Set Up Production Supabase

1. **Create a Supabase Project**:
   - Go to [Supabase Console](https://supabase.com) and create a new project.
   - Note your **API URL** and **Anon Key** from the *Project Settings > API* tab.

2. **Initialize Database Tables & RLS Policies**:
   - Open the **SQL Editor** in your Supabase dashboard.
   - Click "New Query".
   - Copy the contents of the database migration file: [20260609000000_init_schema.sql](file:///Users/petrzak/Desktop/phasq_app/supabase/migrations/20260609000000_init_schema.sql).
   - Paste the SQL into the editor and click **Run**. This will create the `profiles`, `aoi`, `analyses`, `sentinel_scenes`, and `audit_log` tables with proper foreign keys and Row Level Security (RLS) policies.

3. **Configure Authentication**:
   - In Supabase, navigate to *Authentication > Providers* and verify that **Email/Password** sign-in is enabled.
   - (Optional) Configure Google OAuth or other providers if needed.
   - Adjust the email confirmation settings if you want to allow users to log in instantly without waiting for a confirmation email.

---

## Step 2: Obtain Google Earth Engine (GEE) Credentials

To fetch real satellite telemetry (Copernicus Sentinel-1 and Sentinel-2 data), the app needs authorization to Google Earth Engine:

1. **Create a Google Cloud Project**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com).
   - Enable the **Google Earth Engine API** for your project.

2. **Create a Service Account**:
   - Go to *IAM & Admin > Service Accounts*.
   - Create a new service account (e.g., `phasq-gee-client`).
   - Assign the **Earth Engine Resource Viewer** (or *Earth Engine Admin*) role to this account.

3. **Generate Private Key JSON**:
   - Select the newly created Service Account, click the **Keys** tab, and select **Add Key > Create New Key (JSON)**.
   - Save the downloaded JSON file. You will need:
     * `client_email` (Service Account Email)
     * `private_key` (The RSA private key block)
     * `project_id` (Google Cloud Project ID)

---

## Step 3: Production Environment Variables

When deploying the app to your hosting provider, you must configure the following Environment Variables in the provider's dashboard (e.g., Vercel):

### Core App Settings
- `NEXT_PUBLIC_APP_URL` = `https://app.phasq.com` (Your production URL)
- `NEXT_PUBLIC_MAIN_SITE_URL` = `https://www.phasq.com`

### Supabase Settings
- `NEXT_PUBLIC_SUPABASE_URL` = `https://your-production-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-supabase-production-anon-key`
- `SUPABASE_SERVICE_ROLE_KEY` = `your-supabase-production-service-role-key`

### AI Orchestrator Settings
- `OPENAI_API_KEY` = `your-openai-api-key-for-prompt-orchestration`

### Google Earth Engine Credentials
- `NEXT_PUBLIC_USE_MOCK_GEE` = `false` *(Critical: Change to false to enable live sat telemetry)*
- `GEE_SERVICE_ACCOUNT_EMAIL` = `your-service-account-email@your-project-id.iam.gserviceaccount.com`
- `GEE_PROJECT_ID` = `your-gee-project-id`
- `GEE_PRIVATE_KEY` = `"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"` *(Ensure the private key includes the escaped newlines `\n` and is wrapped in quotes)*

### Mapbox Settings
- `NEXT_PUBLIC_MAPBOX_TOKEN` = `your-production-mapbox-token` *(Used to render base maps on the dashboard)*

---

## Step 4: Deploy Next.js to Vercel

Vercel is the recommended hosting platform for Next.js applications and makes custom subdomains simple:

1. **Push Code to Git**:
   - Initialize a Git repository in the project folder and push the code to a private GitHub, GitLab, or Bitbucket repository.

2. **Import Project to Vercel**:
   - Log in to [Vercel](https://vercel.com).
   - Click **Add New > Project** and import your Git repository.

3. **Configure Settings**:
   - In the Build & Development Settings, ensure the framework preset is set to **Next.js**.
   - Expand the **Environment Variables** section and copy-paste all variables from **Step 3**.
   - Click **Deploy**.

4. **Add Custom Subdomain (`app.phasq.com`)**:
   - Once deployed, go to the project settings in Vercel under the **Domains** tab.
   - Add `app.phasq.com` (or your preferred subdomain).
   - Vercel will give you a **CNAME record** to add to your DNS configuration (e.g., in Cloudflare, GoDaddy, or your domain registrar).
   - Add the CNAME record in your registrar's DNS settings:
     * **Type**: `CNAME`
     * **Name**: `app`
     * **Target**: `cname.vercel-dns.com`
   - Vercel will automatically provision a free SSL certificate once DNS propagation completes.
