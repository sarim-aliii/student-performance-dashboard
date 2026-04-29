# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Declare ARGs to pull Render Environment Variables during the build phase
ARG VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY

ARG VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN

ARG VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID

ARG VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET

ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID

ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

# 2. Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# 3. Copy the rest of the app
COPY . .

# 4. Build the Vite app (Vite will now see the variables and bake them in!)
RUN npm run build

# --- Stage 2: Production ---
FROM node:20-alpine

WORKDIR /app

# 5. Install ONLY production dependencies to save RAM
COPY package*.json ./
RUN npm install --omit=dev

# 6. Copy the compiled frontend and necessary server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/firebaseConfig.ts ./
COPY --from=builder /app/firebase-blueprint.json ./

EXPOSE 3000

# 7. Start the server (No building here, so it won't run out of RAM!)
CMD ["npm", "run", "start"]