FROM node:20-slim

WORKDIR /app

# Copy package files first
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies without running postinstall
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build explicitly with verbose output
RUN npx tsc --project tsconfig.json && chmod 755 dist/app.js

EXPOSE 8080
CMD ["node", "dist/app.js"]
