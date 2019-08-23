FROM node:10.16.3
COPY /package.json /package-lock.json /dev.settings /app/
WORKDIR /app
RUN npm ci
RUN apt-get update
RUN apt-get install -y mongodb-clients
EXPOSE 80
CMD ggNext/dev-start.sh
