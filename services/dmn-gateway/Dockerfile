FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production

COPY dist/ dist/
COPY server.js .
COPY launch.js .

EXPOSE 8080
CMD ["node", "launch.js"]
