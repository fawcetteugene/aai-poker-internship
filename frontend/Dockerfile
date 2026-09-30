FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS runtime
WORKDIR /app
ENV NODE_ENV=development NEXT_TELEMETRY_DISABLED=1 API_INTERNAL_URL=http://backend:8000 HOSTNAME=0.0.0.0 PORT=3000
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--turbopack"]
