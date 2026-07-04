FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY backend ./backend
COPY frontend ./frontend

RUN cd frontend \
  && npm run build \
  && rm -rf ../backend/public \
  && mkdir -p ../backend/public \
  && cp -r dist/. ../backend/public/

FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data

COPY --from=build /app/backend ./backend

EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "backend/src/server.js"]
