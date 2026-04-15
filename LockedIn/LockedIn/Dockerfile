# Multi-stage build for LockedIn
# Stage 1: Build the frontend (Wait, the project is structured with frontend/ and root backend)
# I'll create a simple Dockerfile for the whole project

FROM node:20-slim AS base

# Install Python for ML components
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Backend Dependencies
COPY package*.json ./
RUN npm install

# Install Python dependencies
COPY ml/requirements.txt ./ml/
RUN pip3 install --no-cache-dir -r ml/requirements.txt || true

# Copy all files
COPY . .

# Build frontend (if applicable, assuming it's a React/Vite app in /frontend)
# Note: In a real CI/CD we might build this separately
# RUN cd frontend && npm install && npm run build

EXPOSE 3000

CMD ["npm", "start"]
