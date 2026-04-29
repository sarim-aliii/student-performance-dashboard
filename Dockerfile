FROM node:20-alpine

WORKDIR /app

# Copy package files and install ALL dependencies (including Vite)
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port
EXPOSE 3000

# THE MAGIC FIX: 
# We move the build command to the startup script. 
# When Render runs this CMD, it has already injected your Environment Variables.
# Vite will now build with your actual Firebase keys, and then instantly start the server!
CMD ["sh", "-c", "npm run build && npm run start"]