FROM node:20-alpine AS frontend-build
WORKDIR /usr/src/app/frontend

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html ./
COPY postcss.config.js tailwind.config.ts tsconfig.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM node:20-alpine AS backend-build
WORKDIR /usr/src/app

COPY services/website-service/package.json services/website-service/package-lock.json ./
RUN npm ci --omit=dev

COPY services/website-service/ ./
COPY --from=frontend-build /usr/src/app/frontend/dist ./public

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "app.js"]
