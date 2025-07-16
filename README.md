# MCP Server for Google Tag Manager

This is a MCP server that provides an HTTP interface to the Google Tag Manager API. It can be run locally or deployed to Google Cloud Platform.

## Prerequisites

- Node.js (v16 or higher)
- Google Cloud Platform account
- Authentication credentials (Service Account OR OAuth2)

## Local Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up authentication (choose one method):

### Option A: Service Account Authentication (Recommended for server-to-server)

1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Create a `.env` file based on `.env.example`:
   ```
   GTM_SERVICE_ACCOUNT_KEY_PATH=./path/to/your/service-account-key.json
   PORT=3000
   ```

### Option B: OAuth2 Authentication (Required for n8n/Claude Desktop)

1. Create OAuth2 credentials in Google Cloud Console:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add `http://localhost:3000/auth/callback` to "Authorized redirect URIs"

2. Create a `.env` file with OAuth2 credentials:
   ```
   GTM_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GTM_CLIENT_SECRET=your-client-secret
   GTM_REDIRECT_URI=http://localhost:3000/auth/callback
   PORT=3000
   ```

3. Complete OAuth2 authorization:
   - Start the server: `npm run dev`
   - Visit: `http://localhost:3000/auth`
   - Authorize with Google and copy the tokens
   - Add tokens to your `.env` file:
     ```
     GTM_ACCESS_TOKEN=your-access-token
     GTM_REFRESH_TOKEN=your-refresh-token
     ```

4. Start the server:
   ```bash
   npm run dev
   ```

5. The server will be available at:
   - Health check: http://localhost:3000/health
   - MCP endpoint: http://localhost:3000/mcp
   - OAuth2 status: http://localhost:3000/auth/status

## GCP Deployment

### Option 1: Manual Deployment

1. Build the Docker image:
   ```bash
   docker build -t gcr.io/[YOUR_PROJECT_ID]/google-tag-manager-mcp-server .
   ```

2. Push the image to Google Container Registry:
   ```bash
   docker push gcr.io/[YOUR_PROJECT_ID]/google-tag-manager-mcp-server
   ```

3. Deploy to Cloud Run:
   ```bash
   gcloud run deploy google-tag-manager-mcp-server \
     --image gcr.io/[YOUR_PROJECT_ID]/google-tag-manager-mcp-server \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

### Option 2: Automated Deployment with Cloud Build

1. Enable the Cloud Build and Cloud Run APIs in your GCP project

2. Set up a trigger in Cloud Build to build and deploy from your repository

3. The included `cloudbuild.yaml` file will:
   - Build the Docker image
   - Push it to Container Registry
   - Deploy it to Cloud Run

### Environment Variables in GCP

When deploying to GCP, you need to set the following environment variables:

1. In Cloud Run console, go to your service and click "Edit & Deploy New Revision"
2. Under "Container", expand "Variables & Secrets"
3. Add the following environment variables:
   - `GOOGLE_APPLICATION_CREDENTIALS`: Set to `/app/key.json` (this will be the path in the container)
   - `CLAUDE_API_KEY`: Your Claude API key (if needed)

4. Under "Secrets", create a secret containing your service account key JSON
5. Mount this secret as a volume at `/app/key.json`

## API Endpoints

- `GET /health`: Health check endpoint
- `POST /mcp`: MCP protocol endpoint for Google Tag Manager API interactions
