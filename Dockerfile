FROM node:10.16.3
COPY /package.json /package-lock.json /dev.settings /app/
WORKDIR /app
RUN npm ci
RUN curl -o mongo.tgz https://downloads.mongodb.org/linux/mongodb-shell-linux-x86_64-debian92-4.2.0.tgz
RUN tar xvzf mongo.tgz
RUN mv mongodb-linux-x86_64-debian92-4.2.0 mongoshell
EXPOSE 80
CMD ggNext/dev-start.sh
