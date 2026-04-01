FROM node:20

WORKDIR /fe-norvik

COPY norvik/package.json norvik/package-lock.json ./

RUN npm ci

COPY norvik/ .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]