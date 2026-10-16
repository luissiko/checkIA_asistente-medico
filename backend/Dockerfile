FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src ./src
COPY knowledge/corpus.json knowledge/index.json ./knowledge/
ENV NODE_ENV=production
USER node
CMD ["node", "src/server.js"]
