const Fs = require("fs");
const Renderer = require("./Renderer.js");
const RenderQueue = require("./RenderQueue.js");
const beautify = require('js-beautify').js;
const fetch = require('node-fetch');
const Http = require("http");
const atob = require("atob");

const Settings = {
    WORKDIR: "./workdir",
    RENDERERDIR: "./renderer",
    PORT: 8080,
    TIMEOUT:5000
}

for (let k in Settings) {
    if (process.env[k]) {
        console.log("Set", k, "from env vars");
        Settings[k] = process.env[k];
    }
}

function getArgs(){
    const argv = {};
    for (let i=0;i<process.argv.length;i++) {
        const arg = process.argv[i];
        let k = arg;
        let v = true;

        if (process.argv[i+1]&&!process.argv[i+1].startsWith("-")) {
            v = process.argv[i+1]
        }
        
        
        if(k.startsWith("--"))k=k.substring(2);
        else if(k.startsWith("-"))k=k.substring(1);

        console.log(k, "=", v);
        argv[k] = v;

    }
    return argv;
}

async function get(url){
    return await fetch(url)  
        .then(res => res.text()) ;
}


async function parseCode(code,noUrl){
    if (code.startsWith("b64:")) {
        code = atob(code.substring(4));
    }
    if (!noUrl&&code.startsWith("url:")) {
        try{
            
            code=await get(code.substring(4));
            code=await parseCode(code,true);
        }catch(e){
            console.error(e);
        }
    }
    code=beautify(code, { indent_size: 4, space_in_empty_paren: true });
    return code;
}

async function processCliReq(renderer,queue,argv){
    if( argv["help"]){
        console.info("Usage: nodejs main.js [args]");
        console.info("  Args:");
        console.info("      --sketch CODE");
        console.info("      --sketch b64:B64_CODE");
        console.info("      --sketch url:REMOTE_CODE");
        console.info("      --sketch FILE.js");

        return;
    }
    let outfile = argv["out"];
    if (!outfile) outfile = "out.png";

    let timeout = argv["timeout"];
    if (!timeout) timeout = 5000;


    let code=argv["sketch"];
    if(code&&code.endsWith(".js")&&Fs.existsSync(code)&&argv["sketch"]){
        try {
             code = Fs.readFileSync(code, "utf8");
        }catch(e){
            console.error(e);
        }
    }
    if(!code)return;
    
    code=await parseCode(code);

    console.log("Render", code, "in", outfile, "with timeout", timeout);
    
    renderer.start();
    queue.start();

    const promise = new Promise(function (resolve, reject) {
        queue.enqueue(
            code,
            timeout,
            (data, log, error) => {
                if (!error) {
                    resolve(data);
                } else {
                    reject(error);
                }
            }
        );
    });

    try{
        const data = await promise;
        console.log("Write", outfile);
        Fs.writeFileSync(outfile, data);
    }catch(e){
        console.error(e);
    }

    await renderer.stop();
    await queue.stop();

    process.exit(0);    
}



async function processHttpReq(enderer,queue,req,res){
    let code = "";
    let format = "PNG";
    
    const skStart = req.url.indexOf("!");
    if (skStart != -1) {
        try {
            code = req.url.substring(skStart + 1);
            const skEnd = code.lastIndexOf("!.");
            if (skEnd != -1) {
                format = code.substring(skEnd + 2);
                code = code.substring(0, skEnd);
            }
        } catch (e) {
            console.error(e);
        }
    }



    if (code) {
        code=decodeURI(code);
        code=await parseCode(code);
        format = format.toUpperCase();

        format=format.split("?")[0]; // remove query

        console.log("Render sketch", code, "\nwith format", format);



        queue.enqueue(
            code,
            Settings.TIMEOUT,
            (data, log, error) => {
                if (error) {
                    res.setHeader('Content-Type', 'application/json');
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        error: error,
                        log: log,
                        code:code
                    }));
                } else {
                    if (format == "PNG") {
                        res.setHeader('Content-Type', 'image/png');
                        res.writeHead(200);
                        res.end(data);
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.writeHead(200);
                        res.end(JSON.stringify({
                            log: log,
                            code:code
                        }));
                    }
                }
            }
        );
    } else {
        res.writeHead(200);
        res.end('Invalid.');
    }
}


async function main() {


    const argv = getArgs();

    const renderer=new Renderer(Settings.WORKDIR,Settings.RENDERERDIR);
    const queue=new RenderQueue(renderer);

    if (argv["help"]||argv["sketch"] ) {
        processCliReq(renderer,queue,argv);   
    } else {
        const server = Http.createServer((req, res) =>    processHttpReq(renderer,queue,req,res));
    
        queue.start();
        renderer.start();

        process.on('SIGINT', function () {
            queue.stop();
            renderer.stop();
            server.close();
            process.exit(0);
        });
    
        await server.listen(Settings.PORT);
        console.log("Http server listening on", "http://"+server.address().address+":"+server.address().port);    
    }
}


main();
