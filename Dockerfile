FROM node:lts AS build
ARG BASE_HREF="/"

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build -- --base-href $BASE_HREF

FROM nginx:alpine

COPY --from=build /app/dist/ucdl-simulation/ /usr/share/nginx/html
EXPOSE 80
