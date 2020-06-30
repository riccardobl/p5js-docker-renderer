const Fs=require("fs");
const Path = require("path");
const Puppeteer = require('puppeteer');
const Http=require("http");
const Static = require('node-static');

const Settings={
    WORKDIR:"./workdir",
    RENDERERDIR:"./renderer",
    PORT:8080
}

for(let k in Settings){
    if(process.env[k]){
        console.log("Set",k,"from env vars");
        Settings[k]=process.env[k];
    }    
}



const RENDER_QUEUE=[];
let RUN_RENDER_QUEUE=true;

let RENDER_ID=0;

async function killRenderQueue(){
    RUN_RENDER_QUEUE=false;
}

async function startRenderQueue(){
    RUN_RENDER_QUEUE=true;
    runRenderQueue();
}

async function runRenderQueue(){
    
    while(true){
        if(!RUN_RENDER_QUEUE){
           while(RENDER_QUEUE.length>0)RENDER_QUEUE.shift();
            return;
        }
            const e=RENDER_QUEUE.shift();
            if(!e)break;

            const log=[]

            try{
                const renderId=(RENDER_ID++);
                const workdir= Settings.WORKDIR+"/render"+renderId;
                const workdirAbs=Path.resolve(workdir);
                const outPng=workdirAbs+"/out.png";

                console.log("Spawn renderer",renderId);
                console.log("Use work dir",workdir);

                if(!Fs.existsSync(workdir))Fs.mkdirSync(workdir);
                Fs.readdirSync(Settings.RENDERERDIR).forEach(f=>{
                    console.log("Copy",f,"in",workdir);
                    Fs.copyFileSync(Settings.RENDERERDIR+"/"+f,workdir+"/"+f);
                });

                Fs.writeFileSync(workdir+"/sketch.js",e.code);
        

                const fileSrv = new Static.Server(workdirAbs);
                const tmpServer=Http.createServer( (req, res) => fileSrv.serve(req, res));
                
                await tmpServer.listen(null,"127.0.0.1");
                console.log("Start tmp http server"+tmpServer.address());

                let renderUrl="http://"+tmpServer.address().address+":"+tmpServer.address().port+"/index.html";

                console.log("Render",renderUrl,renderId);

                if(Fs.existsSync(outPng))Fs.unlinkSync(outPng);

                const browser = await Puppeteer.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox'                    ]
                });
                const page = await browser.newPage();

                (async () => {
                    // try{
                        await page.waitFor(e.timeout);
                        console.log("Timeout, kill renderer",renderId);
                        await page.close();
                        await browser.close();
                    // }catch(e){

                    // }
                })();
                

                page.on('console', msg => log.push(msg.text()));

                await page.goto(renderUrl);  
                await page.setRequestInterception(true);
                await page.waitForFunction("typeof window.isReady!='undefined'&&window.isReady()");
                await page._client.send('Page.setDownloadBehavior', {
                    behavior: 'allow',
                    downloadPath: workdirAbs,
                });


                while(!Fs.existsSync(outPng)){
                    await  new Promise((resolve) => setTimeout(resolve, 2));
                }

                await browser.close();

                // console.log(log);
                console.log("Done",renderId);

                console.log("Kill tmp http server"+tmpServer.address());
                tmpServer.close();

                const data=Fs.readFileSync(outPng);

                Fs.readdirSync(workdir).forEach(f=>{
                    console.log("Remove",f);
                    Fs.unlinkSync(workdir+"/"+f);
                });

                console.log("Remove",workdir);
                Fs.rmdirSync(workdir);

                e.callback(data,log);
            }catch(err){
                console.error(err);        
                e.callback(undefined,log,err.toString());
                
            }
        }

  
    setTimeout(runRenderQueue,10);
}

function render(code,callback,timeout){
    const frames=10;
    let finalCode=code+`
        let __count_frames=0;
        if(typeof preload != "undefined" )window.preload=preload;
        if(typeof draw != "undefined" )window.draw=function(){
            draw(); 
            if(__count_frames>=0){
                __count_frames++;
                if(__count_frames>=`+frames+`){
                    console.log("Save");
                    saveCanvas("out","png");
                    __count_frames=-1;
                    console.log("!kill");
                    window.isReady=function(){return true;};
                }else{
                    console.log("Skip frame",__count_frames);
                }
            }
        };
        if(typeof setup != "undefined" )window.setup=setup;

    `;

    RENDER_QUEUE.push({
        code:finalCode,
        callback:callback,
        timeout:timeout
    });

}


async function main(){
    const argv={};
    for(let i in process.argv){
        const arg=process.argv[i];
        let k=arg;
        let v=true;
        const feq=arg.indexOf("=");
        if(feq!=-1){
            k=arg.substring(0,feq);
            v=arg.substring(feq+1);
            console.log(k,"=",v);
        }
        argv[k]=v;
    }
    startRenderQueue();
    console.log(argv);
    if(argv["renderSketch"]){

        let outfile=argv["out"];
        if(!outfile)outfile="out.png";

        let timeout=argv["timeout"];
        if(!timeout)timeout=5000;

        const file=argv["renderSketch"];
        if(!Fs.existsSync(file)){
            console.error(file,"doesn't exist");
            return;
        }
        console.log("Render",file,"in",outfile,"with timeout",timeout);
        try{
            const code=Fs.readFileSync(file, "utf8");
            console.log("Render",code);

            const promise=new Promise(function(resolve,reject){
                render(code,(data,log,error)=>{
                    if(!error){
                        resolve(data);                 
                    }else{
                        reject(error);
                    }
                },timeout);
            });
            const outD=await promise;
            console.log("Write",outfile);
            Fs.writeFileSync(outfile,outD);

            killRenderQueue();
            process.exit(0);
        }catch(e){
            console.error(e);
            killRenderQueue();
            process.exit(1);
        }
    }else{
        const server = Http.createServer((req,res)=>{
            let sketch="";
            let format="png";
            const skStart=req.url.indexOf("!");
            if(skStart!=-1){
                try{
                    sketch=req.url.substring(skStart+1);
                    const skEnd=sketch.lastIndexOf("!.");
                    if(skEnd!=-1){
                        format=sketch.substring(skEnd+2);
                        sketch=sketch.substring(0,skEnd);
                    }
                    sketch=decodeURI(sketch);
                    if(sketch.startsWith("b64:")){
                        sketch=atob(sketch.substring(4));
                    }

                }catch(e){
                    console.error(e);
                }
            }
            format=format.toUpperCase();
            if(sketch){
                console.log("Render sketch",sketch,"\nwith format",format);
                render(sketch,(data,log,error)=>{
                    if(!error){
                        if(format=="PNG"){
                            res.setHeader('Content-Type', 'image/png');
                            res.writeHead(200);
                            res.end(data);
                        }else{
                            res.setHeader('Content-Type', 'application/json');
                            res.writeHead(200);
                            res.end(JSON.stringify({
                                log:log
                            }));
                        }
                    }else{
                        res.setHeader('Content-Type', 'application/json');
                        res.writeHead(200);
                        res.end(JSON.stringify({
                            error:error,
                            log:log
                        }));
                    }
                },5000);
            }else{
                res.writeHead(200);
                    res.end('Invalid.');
            }

        });

        server.listen(Settings.PORT);
    }
}
main();