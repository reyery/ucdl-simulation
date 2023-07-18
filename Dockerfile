FROM node:lts AS build

WORKDIR /app
COPY . .

RUN npm ci --legacy-peer-deps
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist/ucdl-simulation/ /usr/share/nginx/html
EXPOSE 80
