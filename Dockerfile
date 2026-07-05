# ---- Base Stage ----
FROM node:20-alpine AS base
WORKDIR /app
# node:20-alpine already ships a pinned node + npm; no `npm i -g npm@latest` (non-reproducible,
# reaches the network on every build) and no corepack/yarn.

# ---- Dependencies Stage ----
FROM base AS deps
# Copy package manifests
COPY package.json package-lock.json ./
# Install ALL dependencies (including dev deps needed by `npm run build`) from the lockfile.
RUN npm ci

# ---- Build Stage ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Real-auth frontend config, baked at build time. Vite inlines every VITE_* var into the
# client bundle during `vite build`, so these MUST be present HERE (not at container runtime)
# or the SPA ships the mock-admin demo pointed at a placeholder Supabase URL. Empty defaults
# preserve the current demo behavior when the build args are not supplied (e.g. plain
# `docker build .` or CI). Cloud Build passes real values via --build-arg (see cloudbuild.yaml).
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_REQUIRE_AUTH=""
ARG VITE_GOOGLE_MAPS_PLATFORM_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_REQUIRE_AUTH=$VITE_REQUIRE_AUTH \
    VITE_GOOGLE_MAPS_PLATFORM_KEY=$VITE_GOOGLE_MAPS_PLATFORM_KEY

# Run the vite+esbuild build pipeline (vite build -> dist/, esbuild -> dist/server.cjs)
RUN npm run build

# ---- Production Stage ----
FROM base AS runner
ENV NODE_ENV=production
# Hardcode port 3000 to match Cloud Run constraints
ENV PORT=3000

# Install puppeteer runtime deps for alpine (Chromium + fonts). node/npm come from the base
# image, so no `nodejs`/`yarn` here.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# Tell Puppeteer to skip installing Chrome and use system Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install ONLY production dependencies from the lockfile (reproducible; helmet + undici now
# live in `dependencies`, so `--omit=dev` is safe). Done before copying dist for layer caching.
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

# Copy the built frontend bundle + server bundle
COPY --from=builder /app/dist ./dist

# Switch to non-root user
USER appuser

EXPOSE 3000

# L13 — container health check hitting the unauthenticated liveness route. Uses node (already
# the runtime — no curl/wget dependency) to GET /healthz and exit non-zero on any non-200.
# Note: Cloud Run ignores Docker HEALTHCHECK and uses its own probes (see cloudbuild.yaml);
# this keeps `docker run` / other orchestrators (Compose, Swarm, K8s) able to detect health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["npm", "run", "start"]
