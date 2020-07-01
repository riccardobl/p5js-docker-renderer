module.exports=class RenderQueue{
    constructor(renderer){
        this._queue=[];
        this._isRunning=true;
        this._renderer=renderer;
    }

    enqueue(code,timeout,callback,skipFrames){
        this._queue.push({
            code:code,
            timeout:timeout,
            callback:callback,
            skipFrames:skipFrames
        });
    }
    
    async _run(){
        while (true) {
            if (!this._isRunning) {
                this._killed=true;
                console.log("Killed");
                return;            
            }
            const e = this._queue.shift();
            if (!e) break;    
            console.log("Render!");
            await this._renderer.render(
                e.code,
                e.timeout,
                e.callback,
                e.skipFrames
            );
        }
        setTimeout(()=>{
            this._run();
        }, 500);
    }
    async start(){
        console.log("Start render queue");
        this._isRunning=true;
        this._run();
    }
    async stop(){

        if(!this._isRunning){
            return;
        }
        console.log("Stop render queue",this._isRunning);

        this._isRunning=false;
        this._killed=false;
        while (this._queue.length > 0) this._queue.shift();
        const p=new Promise((resolve,reject)=>{
            var killCheck=setInterval(()=>{
                if( this._killed){
                    clearInterval(killCheck);
                    resolve();
                }
            },100);
        })
        return p;
    }
    
}