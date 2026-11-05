# Nginx API Gateway Dockerfile
FROM nginx:alpine

# Copy custom Nginx gateway configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8000

CMD ["nginx", "-g", "daemon off;"]
