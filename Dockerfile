FROM node:20-slim

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Expose the port the app runs on
ENV PORT=8080
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/index.js"]