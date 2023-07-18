FROM node:lts AS build
ARG BASE_HREF="/"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist/ucdl-simulation/ /usr/share/nginx/html
EXPOSE 80
