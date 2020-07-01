# P5js Docker Renderer

![Build](https://github.com/riccardobl/p5js-docker-renderer/workflows/Build/badge.svg) ![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/riccardoblb/p5js-docker-renderer)

A docker image that uses nodejs puppeteer and mesa software rendering to render p5js sketches into pngs.

It provides both HTTP and CLI interface.

## Command Line

```console
docker run -v$PWD:$PWD -w$PWD -it --rm riccardoblb/p5js-docker-renderer --help
```
Note: only the current directory ( $PWD ) will be accessible by the container.

## Http
Start the webservice
```console
docker run -p8080:8080  --restart=always --name="p5jsrenderer" --tmpfs /tmp --read-only -d riccardoblb/p5js-docker-renderer 
```

### Usage

http://localhost:8080/**!** *JAVASCRIPT CODE*  **!.png**

JAVASCRIPT CODE can be :

- Plain js code

- Js code encoded in base64 

    - Note: must be prefixed with `b64:` (eg. b64:ENCODED JAVASCRIPT CODE) 

- An url to a js file 
    - Note: must be prefixed with `url:` (eg.  url:http://example/sketch.js) 

- An url to a js file encoded in base64
    - Note: the url must be prefixed with `url:`  and the encoded result must be prefixed with `b64:` (eg. b64:base64(url:http://example/sketch.js))

`!.png` can be replaced with `!.json` to get the logs.

### A simple webui is available at [webui/index.html](webui/index.html)