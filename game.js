(()=>{'use strict';
const $=id=>document.getElementById(id), canvas=$('flight');
const ui={menu:$('menu'),hud:$('hud'),pause:$('pause'),speed:$('speed'),altitude:$('altitude'),craft:$('craft'),hullbar:$('hullbar'),objective:$('objective'),toast:$('toast')};
let THREE,renderer,scene,camera,clock,plane,jetGroup,worldGroup,mode='hangar',paused=false,selected=0,cameraMode='chase',toastTimer=0;
let keys={},speed=0,altitude=8,yaw=0,pitch=0,roll=0,worldTime=0,clouds=[],trees=[],cockpitFrame=null;
const jets=[{name:'F-27 NIGHTHAWK',short:'F-27 NIGHTHAWK',speed:125,turn:1.05,color:0xcbd9df},{name:'XF-90 RAPTOR',short:'XF-90 RAPTOR',speed:175,turn:1.35,color:0xa7b9c8},{name:'A-10 THUNDER',short:'A-10 THUNDER',speed:92,turn:.72,color:0x9eaa91}];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function toast(s){ui.toast.textContent=s;ui.toast.hidden=false;toastTimer=2.4}
function mat(color,roughness=.8,metalness=.1){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
function box(parent,x,y,z,sx,sy,sz,material){const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);o.position.set(x,y,z);parent.add(o);return o}
function cone(parent,x,y,z,r1,r2,len,material,rotX=0){const o=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,len,12),material);o.position.set(x,y,z);o.rotation.x=rotX;parent.add(o);return o}
function makeJet(index){const spec=jets[index],g=new THREE.Group(),metal=mat(spec.color,.5,.55),dark=mat(0x202d35,.55,.45),glass= new THREE.MeshStandardMaterial({color:0x17485b,metalness:.7,roughness:.18,transparent:true,opacity:.88}),glow=new THREE.MeshBasicMaterial({color:0x53dfff});
 // fuselage, nose points toward -Z
 const body=new THREE.Mesh(new THREE.CylinderGeometry(.48,.7,9,12),metal);body.rotation.x=Math.PI/2;body.position.z=-.1;g.add(body);
 const nose=new THREE.Mesh(new THREE.ConeGeometry(.48,3.3,12),metal);nose.rotation.x=-Math.PI/2;nose.position.z=-6.15;g.add(nose);
 box(g,0,.16,-.9,1.1,.62,4.9,metal);
 // swept wings as custom shapes
 function wing(points,y,material){const sh=new THREE.Shape();sh.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)sh.lineTo(points[i][0],points[i][1]);sh.closePath();const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),material);m.rotation.x=-Math.PI/2;m.position.y=y;g.add(m)}
 wing([[-.55,-1.6],[-7,-3.6],[-7.7,-2.9],[-2.2,.8],[-.55,1.7]],-.05,metal);
 wing([[.55,-1.6],[7,-3.6],[7.7,-2.9],[2.2,.8],[.55,1.7]],-.05,metal);
 wing([[-.35,2.7],[-2.1,4.1],[-2.3,4.5],[-.3,4.2]],.0,metal);
 wing([[.35,2.7],[2.1,4.1],[2.3,4.5],[.3,4.2]],.0,metal);
 // tail fins
 const fin1=box(g,-1.35,.72,3.1,.18,1.45,1.9,metal);fin1.rotation.z=-.18;
 const fin2=box(g,1.35,.72,3.1,.18,1.45,1.9,metal);fin2.rotation.z=.18;
 const canopy=new THREE.Mesh(new THREE.SphereGeometry(.75,16,10),glass);canopy.scale.set(.78,.58,1.7);canopy.position.set(0,.72,-2.7);g.add(canopy);
 for(const side of [-1,1]){const engine=new THREE.Mesh(new THREE.CylinderGeometry(.35,.43,2.1,12),dark);engine.rotation.x=Math.PI/2;engine.position.set(side*.48,.05,3.2);g.add(engine);const flame=new THREE.Mesh(new THREE.ConeGeometry(.27,1.6,10),glow);flame.rotation.x=Math.PI/2;flame.position.set(side*.48,.05,4.95);flame.name='afterburner';g.add(flame)}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return g}
function addRunway(){const asphalt=mat(0x252f36),paint=mat(0xe7ece9),edge=mat(0xd7e1e2),taxi=mat(0x353f43);
 box(worldGroup,0,.03,-180,34,.15,520,asphalt);box(worldGroup,-17.4,.12,-180,.45,.06,520,edge);box(worldGroup,17.4,.12,-180,.45,.06,520,edge);
 for(let z=65;z>-440;z-=27)box(worldGroup,0,.13,z,1.1,.025,13,paint);
 for(const side of [-1,1]){box(worldGroup,side*10,.13,-180,.22,.025,520,paint);box(worldGroup,side*29,.02,-80,13,.08,170,taxi);box(worldGroup,side*42,.05,-35,16,.1,95,asphalt)}
 // runway numbers and lights
 for(let z=50;z>-420;z-=32)for(const side of [-1,1]){const lamp=new THREE.Mesh(new THREE.SphereGeometry(.42,6,5),new THREE.MeshBasicMaterial({color:0x7bdcf4}));lamp.position.set(side*16.5,.6,z);worldGroup.add(lamp)}
}
function addHangar(x,z,scale=1){const concrete=mat(0x53636a),wall=mat(0x9aa6a8),roof=mat(0x34454e),door=mat(0x101e27);const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);worldGroup.add(g);box(g,0,7,0,36,14,25,wall);box(g,0,14,0,39,1,28,roof);box(g,0,5,-12.7,21,10,.4,door);for(let i=-2;i<=2;i++)box(g,i*7,5,-12.4,.12,10,.15,concrete);box(g,0,.2,16,52,.3,35,concrete);for(let i=-1;i<=1;i++)box(g,i*12,10,13,1,1,1,mat(0x65e4f4,0.4,.1))}
function addTree(x,z,s){const trunk=mat(0x554b3b),leaf=mat(0x3d6556);const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);worldGroup.add(g);const t=new THREE.Mesh(new THREE.CylinderGeometry(.35,.55,4,6),trunk);t.position.y=2;g.add(t);for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(2.8-i*.5,5,7),leaf);c.position.y=4+i*1.7;g.add(c)}}
function buildWorld(){worldGroup=new THREE.Group();scene.add(worldGroup);const ground=mat(0x536e61);const field=new THREE.Mesh(new THREE.PlaneGeometry(5000,5000),ground);field.rotation.x=-Math.PI/2;field.position.set(0,-2,0);field.receiveShadow=true;worldGroup.add(field);addRunway();addHangar(-72,-145,1.6);addHangar(72,-155,1.25);addHangar(-110,-225,1.05);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(5000,1600),mat(0x285b72,.35,.3));water.rotation.x=-Math.PI/2;water.position.set(0,-1.5,-1450);worldGroup.add(water);
 // coastal hills and distant mountains
 for(let i=0;i<95;i++){const x=(Math.random()-.5)*1900,z=-450-Math.random()*1900,r=40+Math.random()*150;const hill=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mat(i%3?0x526b61:0x6d7e6d));hill.position.set(x,r*.45,z);hill.scale.y=.55;worldGroup.add(hill)}
 for(let i=0;i<240;i++){const x=(Math.random()-.5)*1000,z=180-Math.random()*1300;if(Math.abs(x)<95&&z<70&&z>-500)continue;addTree(x,z,.55+Math.random()*.8)}
 for(let i=0;i<12;i++){const g=new THREE.Group();const cx=(Math.random()-.5)*1700,cy=70+Math.random()*150,cz=-250-Math.random()*1600;for(let j=0;j<6;j++){const puff=new THREE.Mesh(new THREE.SphereGeometry(12+Math.random()*15,8,6),new THREE.MeshStandardMaterial({color:0xf2f7f7,roughness:1,transparent:true,opacity:.8}));puff.position.set((Math.random()-.5)*55,(Math.random()-.5)*12,(Math.random()-.5)*45);puff.scale.y=.45;g.add(puff)}g.position.set(cx,cy,cz);scene.add(g);clouds.push(g)}
}
function setup(){return import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js').then(T=>{THREE=T;renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;scene=new THREE.Scene();scene.background=new THREE.Color(0x87b8d1);scene.fog=new THREE.Fog(0x87b8d1,650,2800);camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,5000);camera.position.set(0,6,20);clock=new THREE.Clock();scene.add(new THREE.HemisphereLight(0xd6edff,0x435343,2));const sun=new THREE.DirectionalLight(0xffedce,3);sun.position.set(-250,450,200);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);buildWorld();jetGroup=makeJet(selected);scene.add(jetGroup);jetGroup.position.set(0,8,0);plane=jetGroup;resize();requestAnimationFrame(frame);}).catch(err=>{console.error(err);toast('3D ENGINE FAILED TO LOAD — CHECK INTERNET CONNECTION')})}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
function resetFlight(){speed=jets[selected].speed*.52;altitude=8;yaw=0;pitch=0;roll=0;plane.position.set(0,altitude,0);plane.rotation.set(0,0,0)}
function chooseJet(n){selected=n;document.querySelectorAll('.jet-card').forEach(b=>b.classList.toggle('selected',Number(b.dataset.jet)===n));if(plane&&mode==='hangar'){scene.remove(plane);plane=makeJet(n);scene.add(plane);plane.position.set(0,8,0)}toast('SELECTED // '+jets[n].name)}
function takeoff(){mode='flight';paused=false;resetFlight();ui.menu.hidden=true;ui.pause.hidden=true;ui.hud.hidden=false;toast('TAXI CLEARANCE // TAKEOFF');lastTime=performance.now()}
let lastTime=performance.now();
function enterHangar(){mode='hangar';paused=false;ui.menu.hidden=false;ui.pause.hidden=true;ui.hud.hidden=true;if(plane){plane.position.set(0,8,0);plane.rotation.set(0,0,0)}speed=0}
function update(dt){worldTime+=dt;const spec=jets[selected];const left=!!(keys.ArrowLeft||keys.a),right=!!(keys.ArrowRight||keys.d),up=!!(keys.ArrowUp||keys.w),down=!!(keys.ArrowDown||keys.s),boost=!!keys.Shift;
 const throttle=boost?1.35:1;speed+=(spec.speed*throttle-speed)*Math.min(1,dt*.4);
 yaw+=(Number(right)-Number(left))*spec.turn*dt*(.25+speed/spec.speed*.75);pitch=clamp(pitch+(Number(up)-Number(down))*dt*.65,-.65,.65);roll+=( -(Number(right)-Number(left))*.62-roll)*Math.min(1,dt*2.8);
 const forward=new THREE.Vector3(Math.sin(yaw),Math.sin(pitch),-Math.cos(yaw)).normalize();plane.position.addScaledVector(forward,speed*dt);altitude=plane.position.y;plane.position.y=clamp(plane.position.y,2,900);altitude=plane.position.y;plane.rotation.order='YXZ';plane.rotation.y=yaw;plane.rotation.x=pitch;plane.rotation.z=roll;
 // chase camera follows behind and above the jet; cockpit camera sits ahead of the canopy
 let desired,look;if(cameraMode==='cockpit'){desired=plane.position.clone().add(new THREE.Vector3(0,1.05,0)).add(new THREE.Vector3(0,0,-1.6).applyAxisAngle(new THREE.Vector3(0,1,0),yaw));look=desired.clone().add(forward.clone().multiplyScalar(180));}else{desired=plane.position.clone().add(new THREE.Vector3(0,7,19).applyAxisAngle(new THREE.Vector3(0,1,0),yaw));look=plane.position.clone().add(forward.clone().multiplyScalar(100));}
 camera.position.lerp(desired,Math.min(1,dt*(cameraMode==='cockpit'?9:3.2)));camera.up.set(0,1,0);camera.lookAt(look);camera.rotateZ(-roll*.18);
 // loop the scenery to create a large free-flight area
 if(plane.position.z < -2400){plane.position.z=100;toast('COASTAL AIRSPACE // RETURNING TO TRAINING AREA')}
 if(plane.position.x>2300)plane.position.x=-2300;if(plane.position.x< -2300)plane.position.x=2300;
 clouds.forEach(c=>{if(c.position.z-plane.position.z>850)c.position.z-=3000});
 if(toastTimer>0&&(toastTimer-=dt)<=0)ui.toast.hidden=true;
 ui.speed.textContent=Math.round(speed*1.94384)+' KTS';ui.altitude.textContent=Math.round(altitude*3.28084).toLocaleString()+' FT';ui.craft.textContent=spec.short;ui.objective.textContent=altitude<18?'LOW ALTITUDE // CLIMB TO CLEAR TERRAIN':'FREE FLIGHT // COASTAL TRAINING RANGE';
}
function renderHangar(){// place jet on apron with a scenic preview camera
 if(!plane)return;const t=clock.elapsedTime;plane.position.set(0,5,-65);plane.rotation.set(0,Math.sin(t*.18)*.03,0);camera.position.lerp(new THREE.Vector3(34,24,42),.025);camera.lookAt(0,4,-65);
}
function frame(){requestAnimationFrame(frame);if(!renderer||!scene)return;const dt=Math.min(clock.getDelta(),.04);if(mode==='flight'&&!paused)update(dt);else if(mode==='hangar'){worldTime+=dt;renderHangar()}else{if(toastTimer>0&&(toastTimer-=dt)<=0)ui.toast.hidden=true}clouds.forEach(c=>{c.position.x+=Math.sin(worldTime*.03+c.position.z*.001)*dt*.8});renderer.render(scene,camera)}
document.querySelectorAll('.jet-card').forEach(b=>b.addEventListener('click',()=>chooseJet(Number(b.dataset.jet))));
$('start').addEventListener('click',takeoff);$('resume').addEventListener('click',()=>{paused=false;ui.pause.hidden=true;lastTime=performance.now()});$('tohangar').addEventListener('click',enterHangar);
addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[k]=true;if((k==='p'||k==='Escape')&&mode==='flight'){paused=!paused;ui.pause.hidden=!paused}if(k==='h')enterHangar();if(k==='c'&&mode==='flight'){cameraMode=cameraMode==='chase'?'cockpit':'chase';toast(cameraMode==='cockpit'?'COCKPIT VIEW':'CHASE CAMERA')}if(k===' '&&mode==='flight'){pitch=0;roll=0;toast('FLIGHT TRIM RESET')}});
addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=false});addEventListener('blur',()=>{keys={};if(mode==='flight'){paused=true;ui.pause.hidden=false}});addEventListener('resize',resize);
setup();
})();