# Multi-stage Dockerfile for Softbits AdminIT (Admin Console)
# Frontend-only build - backend is handled by softbits-bridge
# Build context should be the parent 'softbits' directory

# ==============================================
# Stage 1: Build React client
# ==============================================
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy shared tailwind tokens, components, and hooks (referenced in tailwind.config.js and vite aliases)
COPY softbits-shared/tailwind-tokens.js /app/softbits-shared/tailwind-tokens.js
COPY softbits-shared/components/ /app/softbits-shared/components/
COPY softbits-shared/hooks/ /app/softbits-shared/hooks/

# Copy client package files
COPY softbits-admin/package*.json ./

# Install client dependencies
RUN npm install

# Copy client source
COPY softbits-admin/src/ ./src/
COPY softbits-admin/public/ ./public/
COPY softbits-admin/index.html softbits-admin/vite.config.ts softbits-admin/tsconfig.json softbits-admin/tsconfig.node.json softbits-admin/tailwind.config.js softbits-admin/postcss.config.js ./

# Build the React application
RUN npm run build

# ==============================================
# Stage 2: Production runtime (nginx only)
# ==============================================
FROM nginx:alpine

ARG SOFTBITS_VERSION=dev
LABEL org.opencontainers.image.title="softbits-admin" \
      org.opencontainers.image.version="${SOFTBITS_VERSION}" \
      org.opencontainers.image.vendor="GreenBITS" \
      org.opencontainers.image.source="https://github.com/greenbits/softbits"

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy built React client to nginx html directory
COPY --from=client-builder /app/client/dist /usr/share/nginx/html

# Copy nginx configuration as template (envsubst will resolve INTERNAL_SERVICE_SECRET)
COPY softbits-admin/docker/nginx.conf /etc/nginx/templates/default.conf.template

# Create required nginx directories
RUN mkdir -p /var/log/nginx /run/nginx

# Expose port (nginx serves on 3080)
EXPOSE 3080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3080/nginx-health || exit 1

# envsubst only INTERNAL_SERVICE_SECRET, then start nginx
ENV INTERNAL_SERVICE_SECRET=""
CMD ["/bin/sh", "-c", "envsubst '$INTERNAL_SERVICE_SECRET' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
