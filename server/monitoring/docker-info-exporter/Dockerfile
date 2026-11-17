# docker-info-exporter: container id → compose service names for Prometheus (see index.js)
FROM node:22-alpine
WORKDIR /app
COPY index.js ./
EXPOSE 9417
CMD ["node", "index.js"]
