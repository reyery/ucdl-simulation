FROM node:lts AS build

WORKDIR /app
COPY . .

RUN npm ci
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist/ucdl-simulation/ /usr/share/nginx/html
EXPOSE 80
