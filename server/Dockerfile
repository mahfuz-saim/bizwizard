FROM node:20-alpine AS base

WORKDIR /app

COPY package-lock.json package.json /app/

RUN npm install  

COPY . /app

RUN npm run prisma:generate
RUN npm run build 

EXPOSE 5000

#CMD ["node", "dist/server.js"]  # Adjust if your entry point is elsewhere

CMD node dist/server.js

