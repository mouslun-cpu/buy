FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY web/package.json web/package.json
COPY worker/package.json worker/package.json
RUN npm ci

COPY shared shared
COPY web web
RUN npm run build:web

FROM node:24-alpine

WORKDIR /app
RUN npm install --global serve@14.2.4
COPY --from=build /app/web/out ./
CMD ["sh", "-c", "serve -s /app -l ${PORT:-8080}"]
