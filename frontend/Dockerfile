# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build-time configuration. Vite bakes these VITE_* values into the static
# JS bundle right now, during `docker build` — nothing set later at container
# runtime (docker-compose `environment:`, etc.) can change them. Default to
# PROD so a build that forgot to pass these still fails safe (real Entra
# login) instead of silently shipping the DEV auth bypass.
ARG VITE_ZOELIBRARYAPP_ENV_TYPE=PROD
ARG VITE_ZOELIBRARYAPP_AZURE_CLIENT_ID
ARG VITE_ZOELIBRARYAPP_AZURE_TENANT_ID
ARG VITE_ZOELIBRARYAPP_AZURE_REDIRECT_URI
ARG VITE_ZOELIBRARYAPP_AZURE_POST_LOGOUT_REDIRECT_URI
ENV VITE_ZOELIBRARYAPP_ENV_TYPE=$VITE_ZOELIBRARYAPP_ENV_TYPE \
    VITE_ZOELIBRARYAPP_AZURE_CLIENT_ID=$VITE_ZOELIBRARYAPP_AZURE_CLIENT_ID \
    VITE_ZOELIBRARYAPP_AZURE_TENANT_ID=$VITE_ZOELIBRARYAPP_AZURE_TENANT_ID \
    VITE_ZOELIBRARYAPP_AZURE_REDIRECT_URI=$VITE_ZOELIBRARYAPP_AZURE_REDIRECT_URI \
    VITE_ZOELIBRARYAPP_AZURE_POST_LOGOUT_REDIRECT_URI=$VITE_ZOELIBRARYAPP_AZURE_POST_LOGOUT_REDIRECT_URI

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
