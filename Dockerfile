# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package management files first for better caching
COPY package*.json ./
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the Vite application (this will likely output to a /dist folder)
RUN npm run build

# --- Stage 2: Production ---
# --- Stage 2: Production ---
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies (skips massive packages like Vite and TypeScript)
RUN npm install --omit=dev

# Copy the built assets and server file
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./

EXPOSE 3000

CMD ["npm", "run", "start"]