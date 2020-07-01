
const Puppeteer = require('puppeteer');
const Http = require("http");
const Static = require('node-static');
const Fs = require("fs");
const Path = require("path");

module.exports=class Renderer{
    constructor(workdir,rendererDir){
        this.RENDER_ID=0;
        this.WORKDIR=Path.resolve(workdir);
        this.RENDERERDIR=Path.resolve(rendererDir);
        this._tmpServers={};
    }

    async _createFileSrv(path){
        const fileSrv = new Static.Server(path);
        const tmpServer = Http.createServer((req, res) => fileSrv.serve(req, res));

        await tmpServer.listen(null, "127.0.0.1");
        console.log("Start tmp http server" + tmpServer.address().address,tmpServer.address().port);

        this._tmpServers[path]=tmpServer;
        return  "http://" + tmpServer.address().address + ":" + tmpServer.address().port + "/index.html";
    }

    async _killFileSrv(path){
        const srv=this._tmpServers[path];
        if(srv){
            await srv.close();
            delete this._tmpServers[path];
        }
    }
    async  _browserRender(url,dest,timeout,log){
        console.log("Render",url);

        log.push("Renderer started "+new Date().toString());
        
        const browser = await Puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox']
        });

        try{
            let DONE=false;

            const page = await browser.newPage();

            (async () => {
                await page.waitFor(timeout);
                if(DONE)return;
                console.log("Timeout, kill renderer", url);
                log.push("Timeout, kill renderer "+new Date().toString());

                await page.close();
                await browser.close();
            })();

            page.on('console', msg => log.push(msg.text()));
            page.on('pageerror', msg => log.push(msg));
            // page.on('response', msg => log.push(msg.text()));
            // page.on('requestfailed', msg => log.push(msg.text()));
          
            await page.goto(url);
            await page.setRequestInterception(true);

            await page.waitForFunction("typeof window.isReady!='undefined'&&window.isReady()");

            await page._client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: Path.dirname(dest),
            });
            console.log("Wait for file",dest);

            while (!Fs.existsSync(dest)) await new Promise((resolve) => setTimeout(resolve, 2));
            
            DONE=true;
        }finally{
            await browser.close();

        }
        console.log("Rendered in",dest);

        return log;
    }
    _instrumentCode(code,skipFrames){
        if(!skipFrames)skipFrames=0;
        else if(skipFrames>10)skipFrames=10;

        let finalCode = code + `
            let __count_frames=0;
            if(typeof preload != "undefined" )window.preload=preload;
            if(typeof draw != "undefined" )window.draw=function(){
                draw(); 
                if(__count_frames>=0){
                    __count_frames++;
                    if(__count_frames>=`+ skipFrames + `){
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
        return finalCode;
    }
    async render(code,timeout,callback,skipFrames){
        code=this._instrumentCode(code,skipFrames);
        console.log("Render code",code);

        const renderId = (this.RENDER_ID++);
        const workdir = Path.join(this.WORKDIR,"render" + renderId);
        const outPng = Path.join(workdir , "/out.png");
        console.log("Spawn renderer", renderId);
        console.log("Use work dir", workdir);

        if (!Fs.existsSync(workdir)) Fs.mkdirSync(workdir);

        // Prepare renderer
        Fs.readdirSync(this.RENDERERDIR).forEach(f => {
            console.log("Copy", f, "in", workdir);
            Fs.copyFileSync(this.RENDERERDIR + "/" + f, workdir + "/" + f);
        });
        if (Fs.existsSync(outPng)) Fs.unlinkSync(outPng);


        // Write code
        Fs.writeFileSync(Path.join(workdir , "sketch.js"), code);

        // Create server
        const url=await this._createFileSrv(workdir);
        let logs=[];
        let data=undefined;
        let error=undefined;
    
        try{
            await this._browserRender(url,outPng,timeout,logs);
            data = Fs.readFileSync(outPng);
        }catch(e){
            error=e.toString();
            console.error(e);
        }

        await this._killFileSrv(workdir);

        Fs.readdirSync(workdir).forEach(f => {
            console.log("Remove", f);
            Fs.unlinkSync(workdir + "/" + f);
        });

        console.log("Remove", workdir);
        Fs.rmdirSync(workdir);

        callback(data,logs,error);

    }
}