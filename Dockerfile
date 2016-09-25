FROM node:6
RUN mkdir -p /app
COPY package.json /app/package.json
COPY Gruntfile.js /app/Gruntfile.js
COPY tslint.json /app/tslint.json

WORKDIR /app
RUN npm install
COPY /app /app/app
COPY /typings /app/typings
RUN node_modules/grunt-cli/bin/grunt

# Define default command.
CMD ["node", "node_modules/supervisor/lib/cli-wrapper.js", "--watch", "/app/dist", "dist/server.js"]