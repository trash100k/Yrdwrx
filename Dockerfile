# ---- Base Stage ----
FROM node:20-alpine AS base
WORKDIR /app
# Enable corepack for modern package management if needed, but we'll stick to npm for safety
RUN npm i -g npm@latest

# ---- Dependencies Stage ----
FROM base AS deps
# Copy package manifests
COPY package.json package-lock.json ./
# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# ---- Build Stage ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Run the vite+esbuild build pipeline
RUN npm run build

# ---- Production Stage ----
FROM base AS runner
ENV NODE_ENV=production
# Hardcode port 3000 to match Cloud Run constraints
ENV PORT=3000

# Install puppeteer dependencies for alpine
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn

# Tell Puppeteer to skip installing Chrome and use system Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Only copy what's absolutely necessary
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Install ONLY production dependencies to keep image small
RUN npm install --omit=dev

# Switch back to non-root user
USER appuser

EXPOSE 3000
CMD ["npm", "run", "start"]
