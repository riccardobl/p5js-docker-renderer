function setup() {
    createCanvas(512, 512);
  }
  
  function draw() {


    const fg=color(167, 209, 41);
    const bg=alpha(0);
    const border=color(111, 138, 30);
    
    stroke(border);
    strokeWeight(3);

    background( bg );




    fill(fg);

    circle(width/2,height/2,width/2-60);

    fill( bg);

    circle(width/2,height/2,width/2-60*2.2);
    fill(fg);

    circle(width/2,height/2,width/2-60*3.5);




  }