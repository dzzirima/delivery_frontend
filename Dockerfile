# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Angular bakes these in at build time (see scripts/set-env.js)
ARG API_URL=https://api.fantracker.net/delivery/v1
ARG WS_URL=https://api.fantracker.net/delivery
ARG GOOGLE_API_KEY
ENV API_URL=$API_URL \
    WS_URL=$WS_URL \
    GOOGLE_API_KEY=$GOOGLE_API_KEY \
    NODE_ENV=production

RUN npm run build -- --configuration production

# ---- Runtime stage ----
FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/thi/browser /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
