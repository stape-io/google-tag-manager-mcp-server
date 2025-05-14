[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/stape-io-google-tag-manager-mcp-server-badge.png)](https://mseep.ai/app/stape-io-google-tag-manager-mcp-server)

# MCP Server for Google Tag Manager

This is a MCP server that provides an interface to the Google Tag Manager API.

## Prerequisites

- Node.js (v16 or higher)
- Google Cloud Platform account
- Service account credentials for Google Tag Manager API

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a service account in Google Cloud Console and download the JSON key file
4. Set env file with your service account key path:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=./path/to/your/service-account-key.json
   ```
