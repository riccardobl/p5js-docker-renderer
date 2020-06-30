#!/bin/bash
set -e
source run.config.sh

if [ "$DOCKER_SERVER" = "" ];
then
    npm i
    node main.js
else
    if [ "$DOCKER_SERVER" != "local" ];
    then
        echo "Connect to $DOCKER_SERVER"
        eval "`docker-machine env $DOCKER_SERVER`"
    fi
    docker build   . --tag p5jsrenderer 
    docker run --name="testp5jsr" -it -p8082:8080 --rm \
    p5jsrenderer
fi

