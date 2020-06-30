FROM ubuntu:20.04
RUN apt update -y
RUN apt install -y  curl dirmngr apt-transport-https lsb-release ca-certificates   software-properties-common

RUN curl -sL https://deb.nodesource.com/setup_10.x -o nodesource_setup.sh 
RUN apt update
RUN apt install -y  build-essential nodejs npm

RUN node -v



RUN add-apt-repository -y ppa:oibaf/graphics-drivers && \
apt-get update && \
apt-get upgrade -y &&\
apt-get install -y mesa-utils llvm-dev xvfb pulseaudio pulseaudio-utils &&\
sed -i 's/; exit-idle-time = 20/exit-idle-time = -1/' /etc/pulse/daemon.conf 

ENV DISPLAY=:99
ENV MESA_LOADER_DRIVER_OVERRIDE=llvmpipe
ENV DISPLAY_RESOLUTION=1400x900x24


RUN apt install -y gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 \
libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils  libgbm-dev

RUN useradd --uid  1000 --system --no-create-home  nonroot


RUN mkdir -p /app
RUN chown -Rvf 1000:1000 /app
RUN chmod -Rvf 777 /app

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production
COPY *.js ./
COPY renderer ./renderer
ADD renderer/*.html ./renderer
ADD renderer/*.js ./renderer
RUN mkdir -p ./workdir

RUN chown -Rf nonroot:nonroot /app

RUN ls -l .
USER nonroot


CMD [ "node", "main.js" ]