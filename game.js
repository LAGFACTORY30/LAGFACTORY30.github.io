(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('flight');
const ui={menu:$('menu'),hud:$('hud'),pause:$('pause'),speed:$('speed'),altitude:$('altitude'),craft:$('craft'),hullbar:$('hullbar'),objective:$('objective'),toast:$('toast')};
let THREE,renderer,scene,camera,clock,plane,worldGroup,mode='walk',paused=false,selected=0,cameraMode='chase',toastTimer=0;
let keys={},displayJets=[],player,playerHeading=0,playerX=0,playerZ=40,walkVX=0,walkVZ=0,nearJet=-1,walkClock=0,walkParts=[],walkCameraMode='first',nightMode=false,flashlightOn=false,playerLight,speed=0,altitude=12,yaw=0,pitch=0,roll=0,pitchRate=0,worldTime=0,clouds=[],terrain,radarCtx,radarCanvas,missionIndex=0,flightDistance=0,heading=0,groundSpeed=0,verticalVelocity=1.8,stallWarning=false,gForce=1,missionScore=0,flightSeconds=0,missionComplete=false,bestScore=0,crashed=false,crashTimer=0,crashVelocity=null,crashSpin=null,crashReason='',crashDebris=[],crashSmoke=[];
const jets=[
{name:'F-27 NIGHTHAWK',short:'F-27 NIGHTHAWK',speed:155,accel:38,turn:1.0,color:0xcbd9df,description:'Balanced • Multirole'},
{name:'XF-90 RAPTOR',short:'XF-90 RAPTOR',speed:215,accel:48,turn:1.28,color:0xa7b9c8,description:'Fast • Agile'},
{name:'A-10 THUNDER',short:'A-10 THUNDER',speed:112,accel:25,turn:.68,color:0x9eaa91,description:'Heavy • Stable'}];
const waypoints=[{x:0,z:-650,name:'COASTAL RIDGE'},{x:520,z:-1250,name:'NORTH CAPE'},{x:-2700,z:-3650,name:'NORTH ISLAND'},{x:3250,z:-1900,name:'EASTERN ARCHIPELAGO'}];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function toast(s){ui.toast.textContent=s;ui.toast.hidden=false;toastTimer=3}
try{bestScore=Number(localStorage.getItem('jetstorm-best-score')||0)}catch(e){}
function saveBest(){if(missionScore>bestScore){bestScore=missionScore;try{localStorage.setItem('jetstorm-best-score',String(bestScore))}catch(e){}toast('NEW FLIGHT RECORD // '+bestScore+' PTS')}}
function mat(color,roughness=.8,metalness=.1){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
function box(parent,x,y,z,sx,sy,sz,material){const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);o.position.set(x,y,z);parent.add(o);return o}
function makeJet(index){
 const spec=jets[index],g=new THREE.Group();
 // Compatibility alias for older cached aircraft-detail code paths.
 const canopyFrame=mat(0x35464f,.36,.7);
 const metal=mat(spec.color,.38,.62),edge=mat(0x657780,.48,.55),dark=mat(0x111c23,.62,.35),glass=new THREE.MeshPhysicalMaterial({color:0x17485b,metalness:.55,roughness:.13,transparent:true,opacity:.86,clearcoat:1}),glow=new THREE.MeshBasicMaterial({color:0x53dfff}),mark=mat(index===2?0xd5cda4:0x65e4f4,.5,.3);
 const fuselage=new THREE.Mesh(new THREE.CylinderGeometry(.47,.62,10.8,24,1),metal);fuselage.rotation.x=Math.PI/2;fuselage.position.z=.1;g.add(fuselage);
 const nose=new THREE.Mesh(new THREE.ConeGeometry(.47,4.1,24),metal);nose.rotation.x=-Math.PI/2;nose.position.z=-7.45;g.add(nose);
 const tailCone=new THREE.Mesh(new THREE.ConeGeometry(.6,1.7,20),metal);tailCone.rotation.x=Math.PI/2;tailCone.position.z=5.8;g.add(tailCone);
 function surface(points,y,material,thickness=.13){
  const sh=new THREE.Shape();sh.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)sh.lineTo(points[i][0],points[i][1]);sh.closePath();
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:thickness,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025}),material);
  mesh.rotation.x=-Math.PI/2;mesh.position.y=y-thickness/2;g.add(mesh);return mesh;
 }
 // Different planforms make the aircraft read as different classes, not recolored copies.
 if(index===0){
  surface([[-.48,-1.2],[-1.35,-1.2],[-6.9,-4.25],[-7.45,-3.8],[-3.0,.35],[-1.45,1.45],[-.48,1.05]],-.05,metal);
  surface([[.48,-1.2],[1.35,-1.2],[6.9,-4.25],[7.45,-3.8],[3.0,.35],[1.45,1.45],[.48,1.05]],-.05,metal);
 }else if(index===1){
  surface([[-.45,-1.25],[-1.1,-1.4],[-7.5,-4.4],[-7.1,-2.2],[-2.0,1.4],[-.45,1.65]],-.04,metal);
  surface([[.45,-1.25],[1.1,-1.4],[7.5,-4.4],[7.1,-2.2],[2.0,1.4],[.45,1.65]],-.04,metal);
  surface([[-.3,1.9],[-2.0,3.9],[-2.25,4.5],[-.3,4.0]],.03,metal);
  surface([[.3,1.9],[2.0,3.9],[2.25,4.5],[.3,4.0]],.03,metal);
 }else{
  surface([[-.55,-1.0],[-1.2,-1.1],[-6.8,-2.6],[-7.0,-2.1],[-2.3,.8],[-.6,1.0]],-.08,metal);
  surface([[.55,-1.0],[1.2,-1.1],[6.8,-2.6],[7.0,-2.1],[2.3,.8],[.6,1.0]],-.08,metal);
 }
 // Horizontal stabilizers and twin vertical tails.
 surface([[-.4,3.25],[-3.0,4.5],[-3.15,4.9],[-.35,4.35]],.05,metal);
 surface([[.4,3.25],[3.0,4.5],[3.15,4.9],[.35,4.35]],.05,metal);
 for(const side of [-1,1]){
  const fin=box(g,side*(index===2?1.45:.78),.72,3.45,.16,1.65,2.0,metal);fin.rotation.z=side*.13;
  // Raised intake shoulders, dark intake mouths, and metallic lips.
  const intakeX=side*(index===2?1.0:.72);
  const intake=new THREE.Mesh(new THREE.CylinderGeometry(index===2?.29:.31,index===2?.34:.38,.42,18),dark);intake.rotation.z=Math.PI/2;intake.position.set(intakeX,.1,-2.15);g.add(intake);
  const lip=new THREE.Mesh(new THREE.TorusGeometry(index===2?.31:.34,.045,8,24),edge);lip.rotation.y=Math.PI/2;lip.position.set(intakeX+side*.22,.1,-2.15);g.add(lip);
  const engineX=side*(index===2?1.35:.5);
  const engine=new THREE.Mesh(new THREE.CylinderGeometry(index===2?.43:.32,index===2?.48:.39,2.7,18),dark);engine.rotation.x=Math.PI/2;engine.position.set(engineX,.18,3.1);g.add(engine);
  const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(index===2?.39:.29,index===2?.36:.27,.35,18),edge);nozzle.rotation.x=Math.PI/2;nozzle.position.set(engineX,.18,4.52);g.add(nozzle);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.22,1.1,12),glow);flame.rotation.x=Math.PI/2;flame.position.set(engineX,.18,5.2);flame.name='afterburner';g.add(flame);
  // Pylons and compact external stores.
  const pylon=box(g,side*3.0,-.22,-.45,.16,.38,1.25,dark);
  const store=new THREE.Mesh(new THREE.CylinderGeometry(.11,.15,2.4,12),metal);store.rotation.x=Math.PI/2;store.position.set(side*3.05,-.3,-.5);g.add(store);
  for(let j=0;j<4;j++){const line=box(g,side*(.55+j*.13),.025,-2.6+j*.92,.018,.018,.48,edge);line.rotation.z=side*.04}
  const roundel=new THREE.Mesh(new THREE.CircleGeometry(.23,24),mark);roundel.rotation.x=-Math.PI/2;roundel.position.set(side*2.5,.035,-1.25);g.add(roundel);
 }
 // Finer airframe details: layered wing surfaces, control hinges, cockpit rails and engine hardware.
 const panel=mat(0x7f8c91,.5,.55),rubber=mat(0x101519,.9,.05),tireHub=mat(0x9ca8ad,.38,.7);
 // Thin swept leading-edge strips and trailing flaps make the wings read as built metal.
 const stripeMat=mat(index===2?0xbab39c:0x35464f,.48,.58);
 for(const side of [-1,1]){
  const stripe=box(g,side*3.35,-.015,-2.45,.045,.035,3.2,stripeMat);stripe.rotation.y=side*.16;
  const flap=box(g,side*3.55,-.12,.05,2.35,.08,.52,panel);flap.rotation.y=side*.12;
  const hinge=box(g,side*3.55,-.075,-.22,2.3,.035,.06,dark);hinge.rotation.y=side*.12;
  // Landing gear strut, fork and twin dark rubber wheels.
  const strut=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,1.15,10),tireHub);strut.position.set(side*.72,-.82,.1);g.add(strut);
  const fork=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.45,8),edge);fork.position.set(side*.72,-1.3,-.12);g.add(fork);
  for(const wheelSide of [-1,1]){
   const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.13,16),rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(side*.72+wheelSide*.09,-1.42,-.13);g.add(wheel);
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.145,12),tireHub);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);hub.position.x+=wheelSide*.012;g.add(hub);
  }
  // Small pitot probe and wingtip navigation lamps.
  const nav=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),new THREE.MeshBasicMaterial({color:side<0?0xff3535:0x35ff92}));nav.position.set(side*7.15,.015,-3.2);g.add(nav);
  const probe=new THREE.Mesh(new THREE.CylinderGeometry(.018,.045,1.05,8),edge);probe.rotation.x=Math.PI/2;probe.position.set(side*.5,.12,-8.35);g.add(probe);
 }
 // Fine canopy rails and a raised cockpit sill.
 const sill=box(g,0,.72,-3.1,1.28,.09,3.1,edge);
 for(const side of [-1,1]){
  const rail=box(g,side*.58,.77,-3.05,.045,.06,2.65,edge);rail.rotation.z=side*.08;
 }
 // Aft airbrake panel and tail warning stripes.
 const spine=box(g,0,.48,2.2,.24,.12,2.1,panel);spine.rotation.x=-.04;
 for(let i=0;i<5;i++){const vent=box(g,0,.52,2.35+i*.2,.22,.025,.045,dark);vent.rotation.x=-.04}
 // Engine nozzle inner rings give the exhaust a layered metallic appearance.
 for(const side of [-1,1]){
  const x=side*(index===2?1.35:.5);
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(index===2?.27:.19,index===2?.25:.18,.18,18),rubber);inner.rotation.x=Math.PI/2;inner.position.set(x,.18,4.7);g.add(inner);
  for(let n=0;n<8;n++){const a=n*Math.PI/4;const blade=box(g,x+Math.cos(a)*.21,.18+Math.sin(a)*.21,4.59,.035,.035,.12,edge);blade.rotation.z=a}
 }
 // Long framed canopy and a visible windscreen highlight.
 const canopy=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),glass);canopy.scale.set(.58,.48,1.72);canopy.position.set(0,.73,-3.0);g.add(canopy);

 for(const z of [-4.05,-3.05,-2.0]){const frame=box(g,0,1.08,z,.055,.055,.07,edge);frame.rotation.z=.035}
 const windscreen=new THREE.Mesh(new THREE.SphereGeometry(.58,20,12),new THREE.MeshPhysicalMaterial({color:0x6aa3b5,metalness:.35,roughness:.18,transparent:true,opacity:.42}));windscreen.scale.set(.7,.24,.43);windscreen.position.set(0,.88,-4.05);g.add(windscreen);
 box(g,0,.34,-.75,.9,.12,2.1,dark);
 // Small antenna, navigation lights, and belly gear doors add scale cues.
 box(g,0,.8,1.15,.06,.22,.5,edge);
 for(const side of [-1,1]){const light=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:side<0?0xff4545:0x45ff9c}));light.position.set(side*6.7,.03,-3.1);g.add(light);const gearDoor=box(g,side*.65,-.48,.2,.25,.04,1.1,dark);gearDoor.rotation.z=side*.08}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return g;
}
function heightAt(x,z){
 if(Math.abs(x)<220&&z>-500&&z<100)return .15;
 const ridge=Math.sin(x*.0028+z*.0017)*Math.cos(z*.0022-x*.0014);
 const hills=Math.sin(x*.0065)*Math.cos(z*.0055)*Math.sin((x+z)*.0032);
 const island=(cx,cz,rx,rz,peak)=>{const d=Math.sqrt(((x-cx)/rx)**2+((z-cz)/rz)**2);return d<1?Math.pow(1-d,0.72)*(peak+Math.max(0,ridge)*peak*.32+Math.max(0,hills)*peak*.12):0};
 const main=island(0,-1150,1850,2700,115);
 const north=island(-2700,-3650,1050,1450,82);
 const east=island(3250,-1900,1250,1850,94);
 const far=island(1200,-5350,1550,1050,72);
 const west=island(-3900,-700,760,1100,54);
 return Math.max(-3,main,north,east,far,west)-1.8;
}
function makeGroundTexture(){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#82916b';ctx.fillRect(0,0,512,512);for(let i=0;i<18000;i++){const x=Math.random()*512,y=Math.random()*512,r=.4+Math.random()*3;ctx.globalAlpha=.05+Math.random()*.22;ctx.fillStyle=['#3f694b','#a3a17a','#526b4e','#c0b58a','#6b7758'][Math.floor(Math.random()*5)];ctx.beginPath();ctx.ellipse(x,y,r*1.8,r,Math.random()*3.14,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(14,14);tex.colorSpace=THREE.SRGBColorSpace;return tex}
function makeTerrain(){const n=320,size=12000,geo=new THREE.PlaneGeometry(size,size,n,n);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,heightAt(x,z))}geo.computeVertexNormals();const colors=[];for(let i=0;i<pos.count;i++){const h=pos.getY(i);const c=new THREE.Color(h<2?0x6f9274:h<28?0x557d59:h<70?0x52715a:0x777d77);colors.push(c.r,c.g,c.b)}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:makeGroundTexture(),vertexColors:true,roughness:1}));mesh.position.set(0,0,0);mesh.receiveShadow=true;worldGroup.add(mesh);terrain=mesh}
function addRunway(){const asphalt=mat(0x252f36),paint=mat(0xe7ece9),edge=mat(0xd7e1e2),taxi=mat(0x353f43);box(worldGroup,0,.5,-180,34,.25,520,asphalt);box(worldGroup,-17.4,.65,-180,.45,.06,520,edge);box(worldGroup,17.4,.65,-180,.45,.06,520,edge);for(let z=65;z>-440;z-=27)box(worldGroup,0,.66,z,1.1,.025,13,paint);for(const side of [-1,1]){box(worldGroup,side*10,.66,-180,.22,.025,520,paint);box(worldGroup,side*29,.25,-80,13,.3,170,taxi);box(worldGroup,side*42,.25,-35,16,.3,95,asphalt)}for(let z=50;z>-420;z-=32)for(const side of [-1,1]){const lamp=new THREE.Mesh(new THREE.SphereGeometry(.42,6,5),new THREE.MeshBasicMaterial({color:0x7bdcf4}));lamp.position.set(side*16.5,1.1,z);worldGroup.add(lamp)}}
function addHangar(x,z,scale=1){const wall=mat(0x9aa6a8),roof=mat(0x34454e),door=mat(0x101e27),concrete=mat(0x53636a);const g=new THREE.Group();g.position.set(x,heightAt(x,z),z);g.scale.setScalar(scale);worldGroup.add(g);box(g,0,7,0,36,14,25,wall);box(g,0,14,0,39,1,28,roof);box(g,0,5,-12.7,21,10,.4,door);for(let i=-2;i<=2;i++)box(g,i*7,5,-12.4,.12,10,.15,concrete);box(g,0,.2,16,52,.3,35,concrete)}
function addTree(x,z,s){const y=heightAt(x,z);if(y<1||y>45)return;const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);worldGroup.add(g);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.35,.55,4,6),mat(0x554b3b));trunk.position.y=2;g.add(trunk);for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(2.8-i*.5,5,7),mat(i===1?0x456e53:0x3d6550));c.position.y=4+i*1.7;g.add(c)}}
function addCloud(x,y,z){const g=new THREE.Group();for(let j=0;j<7;j++){const puff=new THREE.Mesh(new THREE.SphereGeometry(13+Math.random()*20,10,7),new THREE.MeshStandardMaterial({color:0xf2f7f7,roughness:1,transparent:true,opacity:.82}));puff.position.set((Math.random()-.5)*65,(Math.random()-.5)*15,(Math.random()-.5)*55);puff.scale.y=.45;g.add(puff)}g.position.set(x,y,z);scene.add(g);clouds.push(g)}
function addWaypoint(w,i){const g=new THREE.Group();g.position.set(w.x,Math.max(80,heightAt(w.x,w.z)+65),w.z);const ring=new THREE.Mesh(new THREE.TorusGeometry(23,1.7,8,36),new THREE.MeshBasicMaterial({color:0x65e4f4,transparent:true,opacity:.9}));ring.rotation.x=Math.PI/2;g.add(ring);const stem=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,36,8),new THREE.MeshBasicMaterial({color:0x65e4f4,transparent:true,opacity:.45}));stem.position.y=-27;g.add(stem);g.userData={index:i};worldGroup.add(g);return g}
let waypointMeshes=[];
function buildWorld(){worldGroup=new THREE.Group();scene.add(worldGroup);makeTerrain();const water=new THREE.Mesh(new THREE.PlaneGeometry(18000,18000),new THREE.MeshStandardMaterial({color:0x245a74,roughness:.28,metalness:.15}));water.rotation.x=-Math.PI/2;water.position.set(0,-3,-1800);worldGroup.add(water);addRunway();addHangar(-72,-145,1.6);addHangar(72,-155,1.25);addHangar(-110,-225,1.05);
 for(let i=0;i<1450;i++){const x=(Math.random()-.5)*7800,z=150-Math.random()*6800;if(Math.abs(x)<115&&z<70&&z>-500)continue;addTree(x,z,.55+Math.random()*.85)}
 // A coastal town and industrial district give scale from the air
 for(let i=0;i<210;i++){const x=250+(Math.random()-.5)*620,z=-350-Math.random()*750,y=heightAt(x,z);if(y<0)continue;const h=8+Math.random()*35,w=8+Math.random()*18;const b=box(worldGroup,x,y+h/2,z,w,h,w,mat([0x75858a,0x9a9d96,0x6e777d,0xb3b2a5][i%4],.8,.12));if(i%5===0){const light=new THREE.Mesh(new THREE.BoxGeometry(w*.6,.4,.4),new THREE.MeshBasicMaterial({color:0x83d8e8}));light.position.set(x,y+h*.6,z-w/2-.2);worldGroup.add(light)}}
 for(let i=0;i<55;i++)addCloud((Math.random()-.5)*10000,120+Math.random()*340,700-Math.random()*8000);
 // Expand the airbase with taxiway markings, apron pads and runway edge lighting.
 for(let i=0;i<18;i++){
  const z=-30-i*18;
  for(const side of [-1,1]){
   const lamp=new THREE.Mesh(new THREE.SphereGeometry(.42,8,6),new THREE.MeshBasicMaterial({color:side<0?0x55ddff:0xffcc88}));
   lamp.position.set(side*34,.45,z);worldGroup.add(lamp);
   const pad=box(worldGroup,side*48,.04,z,15,.08,12,mat(0x4b5557,.9,.05));pad.position.y=heightAt(side*48,z)+.04;
   if(i%3===0){const stripe=box(worldGroup,side*48,pad.position.y+.06,z,11,.025,.18,mat(0xd0d5d0,.8,.05))}
  }
 }
 for(let i=0;i<10;i++){const x=-105+i*23;const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,5,8),mat(0x4a565c,.65,.45));beacon.position.set(x,heightAt(x,-185)+2.5,-185);worldGroup.add(beacon);const light=new THREE.Mesh(new THREE.SphereGeometry(.38,8,6),new THREE.MeshBasicMaterial({color:0x5be5ff}));light.position.set(x,heightAt(x,-185)+5.1,-185);worldGroup.add(light)}
 waypointMeshes=waypoints.map(addWaypoint)}
function setup(){return import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js').then(T=>{THREE=T;renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;scene=new THREE.Scene();scene.background=new THREE.Color(0x83b5d0);scene.fog=new THREE.Fog(0x83b5d0,900,4400);camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,8000);camera.position.set(0,12,35);clock=new THREE.Clock();scene.add(new THREE.HemisphereLight(0xd6edff,0x435343,2));const sun=new THREE.DirectionalLight(0xffedce,3.1);sun.position.set(-250,450,200);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);buildWorld();plane=makeJet(selected);scene.add(plane);plane.position.set(0,8,0);createWalkaround();mode='walk';plane.visible=false;player.visible=true;displayJets.forEach(o=>o.visible=true);const walkUi=$('walk-hud');if(walkUi)walkUi.hidden=false;const menuUi=$('menu');if(menuUi)menuUi.hidden=true;radarCanvas=$('radar');if(radarCanvas)radarCtx=radarCanvas.getContext('2d');resize();requestAnimationFrame(frame)}).catch(err=>{console.error('JETSTORM startup error:',err);const menu=$('menu');if(menu)menu.hidden=false;const walkUi=$('walk-hud');if(walkUi)walkUi.hidden=true;mode='hangar';if(renderer&&scene&&camera){try{renderer.render(scene,camera);requestAnimationFrame(frame)}catch(renderErr){console.error(renderErr)}}const msg=$('toast');if(msg){msg.textContent='STARTUP ERROR: '+(err&&err.message?err.message:String(err));msg.hidden=false}})}
function createWalkaround(){
 plane.visible=false;
 const positions=[[-55,-70],[0,-92],[55,-70]];
 displayJets=positions.map((p,i)=>{const j=makeJet(i);j.position.set(p[0],heightAt(p[0],p[1])+1.4,p[1]);j.rotation.y=Math.PI;j.scale.setScalar(1.75);scene.add(j);return j});
 player=new THREE.Group();walkParts=[];
 const cloth=mat(0x263b35,.92,0),clothLight=mat(0x405448,.88,0),black=mat(0x111a19,.84,.05),skin=mat(0xb98768,.9,0),armor=mat(0x182522,.66,.12),metal=mat(0x68736d,.45,.5),glass=new THREE.MeshStandardMaterial({color:0x172b30,metalness:.35,roughness:.22});
 const part=(geo,material,x,y,z,parent=player)=>{const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
 const capsule=(r,len,material,x,y,z,parent=player)=>{
  // Build capsules from core Three.js meshes (CapsuleGeometry is an addon, not in THREE by default).
  const group=new THREE.Group();group.position.set(x,y,z);parent.add(group);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12,1),material);body.castShadow=true;body.receiveShadow=true;group.add(body);
  for(const end of [-1,1]){const cap=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),material);cap.position.y=end*len/2;cap.castShadow=true;cap.receiveShadow=true;group.add(cap)}
  return group;
 };
 // Torso and layered tactical vest
 capsule(.49,.9,cloth,0,2.05,0);
 part(new THREE.BoxGeometry(.92,.82,.42),armor,0,2.12,-.08);
 part(new THREE.BoxGeometry(.76,.12,.45),clothLight,0,2.55,-.08);
 part(new THREE.BoxGeometry(.84,.13,.44),black,0,1.72,-.08);
 for(const x of [-.27,0,.27]){
  part(new THREE.BoxGeometry(.19,.25,.12),clothLight,x,2.05,-.32);
  part(new THREE.BoxGeometry(.17,.17,.13),armor,x,1.82,-.32);
 }
 // Shoulders, arm pivots, forearms, gloves
 for(const side of [-1,1]){
  const shoulder=new THREE.Group();shoulder.position.set(side*.56,2.38,0);player.add(shoulder);walkParts.push({node:shoulder,phase:side===-1?0:Math.PI,kind:'arm'});
  part(new THREE.SphereGeometry(.25,10,8),clothLight,0,0,0,shoulder);
  capsule(.17,.42,cloth,0,-.32,0,shoulder);
  part(new THREE.SphereGeometry(.18,10,8),armor,0,-.48,-.02,shoulder);
  capsule(.135,.36,clothLight,0,-.72,-.015,shoulder);
  part(new THREE.SphereGeometry(.14,10,8),black,0,-.96,-.02,shoulder);
  const leg=new THREE.Group();leg.position.set(side*.25,1.48,0);player.add(leg);walkParts.push({node:leg,phase:side===-1?Math.PI:0,kind:'leg'});
  capsule(.22,.48,clothLight,0,-.28,0,leg);
  part(new THREE.BoxGeometry(.39,.2,.29),armor,0,-.48,-.01,leg);
  capsule(.16,.38,cloth,0,-.68,0,leg);
  part(new THREE.BoxGeometry(.34,.18,.48),black,0,-.91,-.09,leg);
  part(new THREE.BoxGeometry(.22,.11,.12),metal,0,-.91,-.32,leg);
 }
 // Neck, head, helmet, goggles and headset
 capsule(.14,.12,skin,0,2.72,0);
 part(new THREE.SphereGeometry(.3,16,12),skin,0,3.02,-.015);
 part(new THREE.SphereGeometry(.33,16,10,0,Math.PI*2,0,Math.PI*.62),clothLight,0,3.14,.015);
 part(new THREE.CylinderGeometry(.34,.34,.07,16),black,0,3.08,0);
 part(new THREE.BoxGeometry(.42,.13,.1),glass,0,3.02,-.265);
 for(const side of [-1,1]){
  part(new THREE.CylinderGeometry(.09,.09,.1,10),armor,side*.3,2.98,0);
  part(new THREE.BoxGeometry(.12,.18,.08),clothLight,side*.31,2.98,-.02);
 }
 // Small radio and pack on the back
 part(new THREE.BoxGeometry(.38,.54,.24),cloth,0,2.12,.31);
 part(new THREE.BoxGeometry(.3,.12,.16),armor,0,2.39,.45);
 part(new THREE.CylinderGeometry(.025,.025,.38,8),metal,.17,2.52,.37);
 player.position.set(playerX,heightAt(playerX,playerZ),playerZ);scene.add(player);
 playerLight=new THREE.SpotLight(0xcceeff,0,24,Math.PI/5,.45,1.5);playerLight.position.set(0,2.8,-.25);player.add(playerLight);playerLight.target.position.set(0,1,-8);player.add(playerLight.target);
 const walkUi=$('walk-hud');if(walkUi)walkUi.hidden=false;
 camera.position.set(0,12,68);camera.lookAt(0,2,0);
 $('menu').hidden=true;
}
function walkAround(dt){
 if(!player)return;
 const forward=Number(!!(keys.w||keys.ArrowUp))-Number(!!(keys.s||keys.ArrowDown));
 const strafe=Number(!!(keys.d||keys.ArrowRight))-Number(!!(keys.a||keys.ArrowLeft));
 const inputLen=Math.hypot(forward,strafe),sprint=!!keys.Shift;
 const maxSpeed=sprint?25:13.5;
 // Use the current facing direction to calculate movement, then smoothly turn toward travel.
 let wishX=0,wishZ=0;
 if(inputLen>0){
  // Stable camera/world-relative input; turning the model never changes the movement vector.
  wishX=strafe/inputLen;
  wishZ=-forward/inputLen;
 }
 const targetVX=wishX*maxSpeed,targetVZ=wishZ*maxSpeed;
 const blend=1-Math.exp(-(inputLen>0?7:11)*dt);
 walkVX+=(targetVX-walkVX)*blend;walkVZ+=(targetVZ-walkVZ)*blend;
 const v=Math.hypot(walkVX,walkVZ);
 if(v>maxSpeed){walkVX*=maxSpeed/v;walkVZ*=maxSpeed/v}
 playerX=clamp(playerX+walkVX*dt,-125,125);playerZ=clamp(playerZ+walkVZ*dt,-170,75);
 const moving=Math.hypot(walkVX,walkVZ)>0.5;
 if(moving){
  const desiredHeading=Math.atan2(walkVX,-walkVZ);
  let delta=((desiredHeading-playerHeading+Math.PI*3)%(Math.PI*2))-Math.PI;
  playerHeading+=delta*(1-Math.exp(-9*dt));player.rotation.y=playerHeading;
  walkClock+=dt*(sprint?12:8);
 }
 walkParts.forEach(p=>{
  const swing=moving?Math.sin(walkClock+p.phase):0;
  const amount=moving?(p.kind==='leg'?.58:p.kind==='arm'?.42:.18):0;
  p.node.rotation.x=swing*amount;
  if(p.kind==='arm')p.node.rotation.z=(moving?Math.sin(walkClock+p.phase)*.08:0);
 });
 player.position.set(playerX,heightAt(playerX,playerZ),playerZ);
 nearJet=-1;let nearest=Infinity;
 displayJets.forEach((j,i)=>{const d=Math.hypot(playerX-j.position.x,playerZ-j.position.z);if(d<nearest){nearest=d;nearJet=i}});
 const prompt=$('walk-prompt');if(prompt){prompt.textContent=nearest<13?'PRESS E TO ENTER '+jets[nearJet].name:(sprint?'RUNNING • ':'')+'WASD / ARROWS TO MOVE • SHIFT TO RUN';prompt.classList.toggle('ready',nearest<13)}
 const firstPerson=walkCameraMode==='first';
 // Hide the full character mesh in first-person so the camera never sits inside the head/body.
 player.visible=!firstPerson;
 if(firstPerson){
  camera.position.set(playerX+Math.sin(playerHeading)*.48,player.position.y+2.55,playerZ-Math.cos(playerHeading)*.48);
  camera.lookAt(new THREE.Vector3(playerX+Math.sin(playerHeading)*20,player.position.y+2.5,playerZ-Math.cos(playerHeading)*20));
 }else{
  camera.position.set(playerX-Math.sin(playerHeading)*9,player.position.y+5.2,playerZ+Math.cos(playerHeading)*12);
  camera.lookAt(new THREE.Vector3(playerX,player.position.y+2.1,playerZ));
 }
}
function enterNearbyJet(){
 if(mode!=='walk'||nearJet<0||!player)return;
 const j=displayJets[nearJet],d=Math.hypot(playerX-j.position.x,playerZ-j.position.z);if(d>20){toast('MOVE CLOSER TO THE AIRCRAFT');return}
 selected=nearJet;scene.remove(plane);plane=makeJet(selected);scene.add(plane);plane.visible=true;document.querySelectorAll('.jet-card').forEach(b=>b.classList.toggle('selected',Number(b.dataset.jet)===selected));
 if(player)player.visible=false;displayJets.forEach(o=>o.visible=false);
 mode='flight';paused=false;resetFlight();ui.menu.hidden=true;ui.pause.hidden=true;ui.hud.hidden=false;
 const walkUi=$('walk-hud');if(walkUi)walkUi.hidden=true;
 toast('PILOT ONBOARD // '+jets[selected].name+' — TAKEOFF');
}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
function resetFlight(){speed=jets[selected].speed*.58;altitude=heightAt(0,0)+18;verticalVelocity=0;yaw=0;pitch=.025;pitchRate=0;roll=0;gForce=1;stallWarning=false;flightDistance=0;missionIndex=0;missionScore=0;flightSeconds=0;missionComplete=false;plane.position.set(0,altitude,0);plane.rotation.set(0,0,0);cameraMode='chase'}
function chooseJet(n){selected=n;document.querySelectorAll('.jet-card').forEach(b=>b.classList.toggle('selected',Number(b.dataset.jet)===n));if(plane&&mode==='hangar'){scene.remove(plane);plane=makeJet(n);scene.add(plane);plane.position.set(0,8,0)}toast('SELECTED // '+jets[n].name)}
function takeoff(){if(player&&displayJets.length){mode='walk';paused=false;plane.visible=false;player.visible=true;displayJets.forEach(o=>o.visible=true);ui.menu.hidden=true;ui.pause.hidden=true;ui.hud.hidden=true;const walkUi=$('walk-hud');if(walkUi)walkUi.hidden=false;toast('AIRBASE FREE ROAM // FIND A JET AND PRESS E');return}mode='flight';paused=false;resetFlight();ui.menu.hidden=true;ui.pause.hidden=true;ui.hud.hidden=false;toast('TAXI CLEARANCE // TAKEOFF');}
function enterHangar(){mode='hangar';paused=false;ui.menu.hidden=false;ui.pause.hidden=true;ui.hud.hidden=true;if(plane){plane.position.set(0,8,0);plane.rotation.set(0,0,0)}speed=0}
function drawRadar(){if(!radarCtx||!radarCanvas||!plane)return;const w=radarCanvas.width,h=radarCanvas.height,cx=w/2,cy=h/2,scale=.055;radarCtx.clearRect(0,0,w,h);radarCtx.fillStyle='rgba(4,18,27,.9)';radarCtx.fillRect(0,0,w,h);radarCtx.strokeStyle='rgba(101,228,244,.24)';radarCtx.lineWidth=1;for(let r=25;r<Math.min(w,h)/2;r+=25){radarCtx.beginPath();radarCtx.arc(cx,cy,r,0,Math.PI*2);radarCtx.stroke()}radarCtx.beginPath();radarCtx.moveTo(cx,0);radarCtx.lineTo(cx,h);radarCtx.moveTo(0,cy);radarCtx.lineTo(w,cy);radarCtx.stroke();radarCtx.save();radarCtx.translate(cx,cy);radarCtx.rotate(-yaw);radarCtx.fillStyle='#65e4f4';radarCtx.beginPath();radarCtx.moveTo(0,-8);radarCtx.lineTo(5,6);radarCtx.lineTo(0,3);radarCtx.lineTo(-5,6);radarCtx.closePath();radarCtx.fill();radarCtx.restore();for(const p of waypoints){const dx=(p.x-plane.position.x)*scale,dz=(p.z-plane.position.z)*scale;if(Math.abs(dx)<cx&&Math.abs(dz)<cy){radarCtx.fillStyle='#f2d58a';radarCtx.beginPath();radarCtx.arc(cx+dx,cy+dz,3,0,Math.PI*2);radarCtx.fill()}}}
function spawnCrashEffects(){
 crashDebris=[];crashSmoke=[];
 const metalMat=new THREE.MeshStandardMaterial({color:0x667781,metalness:.72,roughness:.38});
 const darkMat=new THREE.MeshStandardMaterial({color:0x252d32,metalness:.4,roughness:.65});
 // Toss a few visible airframe fragments from the impact point.
 for(let i=0;i<12;i++){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.25+Math.random()*.8,.12+Math.random()*.35,.3+Math.random()*.8),i%3?metalMat:darkMat);
  mesh.position.copy(plane.position);mesh.position.x+=(Math.random()-.5)*4;mesh.position.y+=Math.random()*2;mesh.position.z+=(Math.random()-.5)*4;
  mesh.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);scene.add(mesh);
  crashDebris.push({mesh,velocity:new THREE.Vector3((Math.random()-.5)*speed*.65,Math.random()*speed*.25+4,(Math.random()-.5)*speed*.65),spin:new THREE.Vector3(Math.random()*7,Math.random()*7,Math.random()*7),life:8+Math.random()*5});
 }
 // Dark smoke puffs grow and rise above the wreck.
 for(let i=0;i<18;i++){
  const puff=new THREE.Mesh(new THREE.SphereGeometry(.7+Math.random()*.65,8,7),new THREE.MeshStandardMaterial({color:i<5?0x383b3d:0x22272a,transparent:true,opacity:.55,roughness:1,depthWrite:false}));
  puff.position.copy(plane.position);puff.position.y+=1+Math.random()*2;puff.position.x+=(Math.random()-.5)*2;puff.position.z+=(Math.random()-.5)*2;scene.add(puff);
  crashSmoke.push({mesh:puff,velocity:new THREE.Vector3((Math.random()-.5)*1.4,1.2+Math.random()*2,(Math.random()-.5)*1.4),life:5+Math.random()*6,max:5+Math.random()*6});
 }
}
function triggerCrash(reason='AIRFRAME IMPACT'){
 if(crashed||!plane)return;
 crashed=true;crashTimer=0;crashReason=reason;
 spawnCrashEffects();
 crashVelocity=new THREE.Vector3();crashSpin=new THREE.Vector3();
 crashVelocity.set(Math.sin(yaw)*speed*.65,Math.max(8,Math.abs(verticalVelocity)*.8),-Math.cos(yaw)*speed*.65);
 crashSpin.set((Math.random()-.5)*2.8,(Math.random()-.5)*2.8,(Math.random()-.5)*3.8);
 speed=0;verticalVelocity=0;paused=false;ui.pause.hidden=true;
 const banner=$('crash-overlay');if(banner){banner.hidden=false;const title=banner.querySelector('[data-crash-title]');if(title)title.textContent=reason}
 toast('CRASH // AIRCRAFT DESTROYED');
}
function updateCrashEffects(dt){
 for(const d of crashDebris){if(d.life<=0)continue;d.life-=dt;d.velocity.y-=14*dt;d.mesh.position.addScaledVector(d.velocity,dt);d.mesh.rotation.x+=d.spin.x*dt;d.mesh.rotation.y+=d.spin.y*dt;d.mesh.rotation.z+=d.spin.z*dt;d.velocity.multiplyScalar(Math.exp(-.25*dt));const floor=heightAt(d.mesh.position.x,d.mesh.position.z)+.2;if(d.mesh.position.y<floor){d.mesh.position.y=floor;d.velocity.y=Math.abs(d.velocity.y)*.2;d.velocity.x*=.5;d.velocity.z*=.5;d.spin.multiplyScalar(.6)}if(d.life<=0)d.mesh.visible=false}
 for(const p of crashSmoke){if(p.life<=0)continue;p.life-=dt;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.scale.multiplyScalar(1+dt*.22);p.mesh.material.opacity=Math.max(0,.55*(p.life/p.max));if(p.life<=0)p.mesh.visible=false}
}
function updateCrash(dt){
 if(!crashed||!plane)return;
 crashTimer+=dt;updateCrashEffects(dt);const ground=heightAt(plane.position.x,plane.position.z);
 crashVelocity.y-=19*dt;
 plane.position.addScaledVector(crashVelocity,dt);
 plane.rotation.x+=crashSpin.x*dt;plane.rotation.y+=crashSpin.y*dt;plane.rotation.z+=crashSpin.z*dt;
 crashVelocity.multiplyScalar(Math.exp(-.32*dt));crashSpin.multiplyScalar(Math.exp(-.55*dt));
 if(plane.position.y<=ground+1.8){
  plane.position.y=ground+1.8;crashVelocity.y=Math.abs(crashVelocity.y)*.18;
  crashVelocity.x*=.48;crashVelocity.z*=.48;crashSpin.multiplyScalar(.62);
  if(Math.abs(crashVelocity.y)<2.5){crashVelocity.y=0;crashSpin.multiplyScalar(.88)}
 }
 const banner=$('crash-overlay');if(banner){const status=banner.querySelector('[data-crash-status]');if(status)status.textContent=crashTimer<2?'IMPACT DETECTED • AIRFRAME BREAKUP':crashTimer<5?'WRECKAGE SETTLING':'AIRCRAFT LOST • PRESS R TO RESTART'}
 const smoke=plane.getObjectByName('crash-smoke');
 if(smoke){smoke.position.set(0,1.3,1.5);smoke.visible=crashTimer>.45;smoke.scale.setScalar(1+Math.min(3,crashTimer*.28))}
 if(crashTimer>12){crashSpin.set(0,0,0);crashVelocity.set(0,0,0)}
}
function update(dt){if(crashed){worldTime+=dt;updateCrash(dt);const overlay=$('cockpit-overlay');if(overlay)overlay.hidden=true;renderer.render(scene,camera);return}worldTime+=dt;const spec=jets[selected],left=!!(keys.ArrowLeft||keys.a),right=!!(keys.ArrowRight||keys.d),up=!!(keys.ArrowUp||keys.w),down=!!(keys.ArrowDown||keys.s),boost=!!keys.Shift;
 // Thrust, drag, lift and gentle gravity create a forgiving but momentum-based flight model.
 const target=spec.speed*(boost?1.3:1);const braking=!!keys.b;
 const thrust=(target-speed)*.24;const drag=.0009*speed*speed/spec.speed;
 speed+=(thrust-drag-(braking?spec.speed*.22:0))*dt;speed=clamp(speed,0,spec.speed*(boost?1.3:1));
 const bankInput=Number(right)-Number(left);
 roll+=(-bankInput*.62-roll)*Math.min(1,dt*1.8);
 const turnRate=Math.sin(-roll)*clamp(speed/spec.speed,0,1.25)*.82*spec.turn;
 yaw+=turnRate*dt;
 const pitchInput=Number(up)-Number(down);
 pitchRate+=(pitchInput*.58-pitchRate*1.25)*dt;
 pitch=clamp(pitch+pitchRate*dt,-.48,.48);

 const forward=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw)).normalize();
 plane.position.addScaledVector(forward,speed*Math.max(.25,Math.cos(pitch))*dt);
 // Simplified aerodynamics: lift builds with airspeed, pitch adds lift, bank reduces it, gravity pulls down.
 const ground=heightAt(plane.position.x,plane.position.z);
 const gravity=9.81;
 const liftRatio=clamp(speed/(spec.speed*.64),0,1.45);
 const flightPath=Math.atan2(verticalVelocity,Math.max(18,speed));
 const angleOfAttack=pitch-flightPath;
 const liftCoefficient=clamp(1+angleOfAttack*3.2,0,1.65);
 const lift=gravity*liftRatio*liftRatio*liftCoefficient*Math.max(.12,Math.cos(roll));
 const thrustVertical=spec.accel*.11*Math.sin(pitch)*(boost?1.2:1);
 verticalVelocity+=(lift+thrustVertical-gravity)*dt;
 verticalVelocity=clamp(verticalVelocity,-65,65);
 plane.position.y+=verticalVelocity*dt;
 stallWarning=speed<spec.speed*.31&&altitude>ground+7;gForce=clamp(lift/gravity,.1,5.5);
 if(plane.position.y<ground+5){
  const impactSpeed=Math.abs(verticalVelocity);
  if(impactSpeed>24||speed>jets[selected].speed*1.18&&Math.abs(pitch)>.55){triggerCrash('TERRAIN IMPACT');return}
  plane.position.y=ground+5;verticalVelocity=Math.max(1,verticalVelocity*.15);pitch=Math.max(pitch,.035);if(!stallWarning)toast('TERRAIN WARNING // PULL UP')
 }
 plane.position.y=clamp(plane.position.y,ground+5,1800);altitude=plane.position.y;heading=((yaw*180/Math.PI)%360+360)%360;groundSpeed=speed*Math.cos(pitch);
 plane.rotation.order='YXZ';plane.rotation.y=yaw;plane.rotation.x=pitch;plane.rotation.z=roll;
 let desired,look;if(cameraMode==='cockpit'){desired=plane.position.clone().add(new THREE.Vector3(0,.95,-2.5).applyAxisAngle(new THREE.Vector3(0,1,0),yaw));look=desired.clone().add(forward.clone().multiplyScalar(180));const overlay=$('cockpit-overlay');if(overlay)overlay.hidden=false}else{const overlay=$('cockpit-overlay');if(overlay)overlay.hidden=true;desired=plane.position.clone().add(new THREE.Vector3(0,8,24).applyAxisAngle(new THREE.Vector3(0,1,0),yaw));look=plane.position.clone().add(forward.clone().multiplyScalar(130))}
 camera.position.lerp(desired,Math.min(1,dt*(cameraMode==='cockpit'?9:2.8)));camera.up.set(0,1,0);camera.lookAt(look);camera.rotateZ(-roll*.15);
 flightDistance+=speed*dt;flightSeconds+=dt;const targetPoint=waypoints[missionIndex];if(targetPoint&&Math.hypot(plane.position.x-targetPoint.x,plane.position.z-targetPoint.z)<42&&Math.abs(plane.position.y-Math.max(80,heightAt(targetPoint.x,targetPoint.z)+65))<65){missionScore+=250;missionIndex++;toast('CHECKPOINT CLEARED // +250 POINTS');if(missionIndex>=waypoints.length){missionComplete=true;toast('ALL CHECKPOINTS CLEARED // RETURN TO BASE')}}
 // Landing challenge: return to the runway slowly and close to the centerline after the route.
 const runwayZone=Math.abs(plane.position.x)<23&&plane.position.z>-455&&plane.position.z<85;const lowAndSlow=plane.position.y<12&&speed<55;if(missionComplete&&runwayZone&&lowAndSlow){missionScore+=1000;missionComplete=false;saveBest();toast('MISSION COMPLETE // LANDING BONUS +1000');missionIndex=0;flightSeconds=0;missionScore=0;}
 clouds.forEach(c=>{c.position.x+=Math.sin(worldTime*.03+c.position.z*.001)*dt*.8});
 if(toastTimer>0&&(toastTimer-=dt)<=0)ui.toast.hidden=true;
 ui.speed.textContent=Math.round(speed*1.94384)+' KTS';ui.altitude.textContent=Math.round(altitude*3.28084).toLocaleString()+' FT';ui.craft.textContent=spec.short;const greadout=$('gforce');if(greadout)greadout.textContent=gForce.toFixed(1)+' G';const stall=$('stall-warning');if(stall)stall.hidden=!stallWarning;ui.objective.textContent=targetPoint?'CHECKPOINT '+(missionIndex+1)+'/'+waypoints.length+' // '+targetPoint.name:(missionComplete?'RETURN TO AIRBASE // LAND TO COMPLETE':'FREE FLIGHT');const scoreEl=$('score');if(scoreEl)scoreEl.textContent=missionScore.toLocaleString()+' PTS';const timerEl=$('flight-time');if(timerEl){const mins=Math.floor(flightSeconds/60),secs=Math.floor(flightSeconds%60);timerEl.textContent=String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0')}const bestEl=$('best-score');if(bestEl)bestEl.textContent=bestScore.toLocaleString()+' PTS';const h=$('heading');if(h)h.textContent=String(Math.round(heading)).padStart(3,'0')+'°';const dist=$('distance');if(dist)dist.textContent=targetPoint?(Math.hypot(plane.position.x-targetPoint.x,plane.position.z-targetPoint.z)/1000).toFixed(1)+' KM':'BASE';drawRadar();
}
function renderHangar(){const overlay=$('cockpit-overlay');if(overlay)overlay.hidden=true;if(!plane)return;const t=clock.elapsedTime;plane.position.set(0,5,-65);plane.rotation.set(0,Math.sin(t*.18)*.03,0);camera.position.lerp(new THREE.Vector3(34,24,42),.025);camera.lookAt(0,4,-65)}
function frame(){requestAnimationFrame(frame);if(!renderer||!scene)return;try{const dt=Math.min(clock.getDelta(),.04);if(mode==='flight'&&!paused)update(dt);else if(mode==='walk'){worldTime+=dt;walkAround(dt)}else if(mode==='hangar'){worldTime+=dt;renderHangar()}else if(toastTimer>0&&(toastTimer-=dt)<=0)ui.toast.hidden=true;renderer.render(scene,camera)}catch(err){console.error('JETSTORM render error:',err);const prompt=$('walk-prompt');if(prompt)prompt.textContent='GAME ERROR: '+(err&&err.message?err.message:'RENDER FAILED')+' — RELOAD THE PAGE';}}
document.querySelectorAll('.jet-card').forEach(b=>b.addEventListener('click',()=>chooseJet(Number(b.dataset.jet))));$('start').addEventListener('click',takeoff);$('resume').addEventListener('click',()=>{paused=false;ui.pause.hidden=true});$('tohangar').addEventListener('click',enterHangar);
addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[k]=true;if((k==='p'||k==='Escape')&&mode==='flight'){paused=!paused;ui.pause.hidden=!paused}if(k==='h'&&mode==='flight')enterHangar();if(k==='e')enterNearbyJet();
if(k==='v'&&mode==='walk'){walkCameraMode=walkCameraMode==='third'?'first':'third';toast(walkCameraMode==='first'?'FIRST-PERSON VIEW':'THIRD-PERSON VIEW')}
if(k==='f'&&mode==='walk'&&playerLight){flashlightOn=!flashlightOn;playerLight.intensity=flashlightOn?22:0;toast(flashlightOn?'PILOT LIGHT ON':'PILOT LIGHT OFF')}
if(k==='r'&&mode==='walk'){playerX=0;playerZ=40;walkVX=0;walkVZ=0;playerHeading=0;player.rotation.y=0;walkCameraMode='first';toast('RESET TO AIRBASE START')}
if(k==='t'&&mode==='walk'&&scene){nightMode=!nightMode;scene.background.set(nightMode?0x071321:0x83b5d0);scene.fog.color.set(nightMode?0x071321:0x83b5d0);toast(nightMode?'NIGHT ENVIRONMENT':'DAY ENVIRONMENT')}
if(k==='r'&&crashed){crashed=false;crashTimer=0;const banner=$('crash-overlay');if(banner)banner.hidden=true;resetFlight();toast('AIRCRAFT RESET // READY FOR TAKEOFF')}if(k==='c'&&mode==='flight'&&!crashed){cameraMode=cameraMode==='chase'?'cockpit':'chase';toast(cameraMode==='cockpit'?'COCKPIT VIEW':'CHASE CAMERA')}if(k===' '&&mode==='flight'&&!crashed){pitch=0;roll=0;toast('FLIGHT TRIM RESET')}});
addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=false});
document.querySelectorAll('[data-control]').forEach(btn=>{const key=btn.dataset.control;const down=e=>{e.preventDefault();keys[key]=true;btn.classList.add('pressed')};const up=e=>{e.preventDefault();keys[key]=false;btn.classList.remove('pressed')};btn.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(ev=>btn.addEventListener(ev,up))});addEventListener('blur',()=>{keys={};if(mode==='flight'){paused=true;ui.pause.hidden=false}});addEventListener('resize',resize);setup();
})();