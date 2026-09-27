import * as THREE from 'three';
export async function addSpace(globe){
 const sky=new THREE.Group();globe.scene().add(sky);
 // A textured celestial sphere retains perspective during camera orbits.
 const photo=await new THREE.TextureLoader().loadAsync('/textures/galaxy-starfield.png');photo.colorSpace=THREE.SRGBColorSpace;
 const shell=new THREE.Mesh(new THREE.SphereGeometry(1900,64,32),new THREE.MeshBasicMaterial({map:photo,side:THREE.BackSide,color:0xb8c4d6,depthWrite:false}));
 shell.rotation.set(.4,.7,-.65);shell.renderOrder=-2;sky.add(shell);
 let seed=481;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const positions=[],colors=[],sizes=[];
 const palette=[new THREE.Color('#bdd7ff'),new THREE.Color('#e2eaff'),new THREE.Color('#fff5de'),new THREE.Color('#ffd8ac')];
 for(let i=0;i<4200;i++){
  const y=random()*2-1,a=random()*Math.PI*2,r=1700;
  positions.push(r*Math.sqrt(1-y*y)*Math.cos(a),r*y,r*Math.sqrt(1-y*y)*Math.sin(a));
  const bright=Math.pow(random(),5);const c=palette[Math.floor(random()*palette.length)].clone().multiplyScalar(.35+bright*1.8);
  colors.push(c.r,c.g,c.b);sizes.push(1.8+bright*4.4);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('size',new THREE.Float32BufferAttribute(sizes,1));
 const stars=new THREE.Points(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`attribute vec3 color; attribute float size; varying vec3 tint; void main(){tint=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=size;}`,fragmentShader:`varying vec3 tint;void main(){float r=length(gl_PointCoord-0.5)*2.0;if(r>1.0)discard;float core=exp(-r*r*12.0);float halo=exp(-r*r*3.0)*0.14;gl_FragColor=vec4(tint,core+halo);}`}));
 sky.add(stars);
 // Keep the sky centered on the eye: orbit changes direction, never foreground parallax.
 shell.onBeforeRender=()=>{sky.position.copy(globe.camera().position);sky.updateMatrixWorld(true)};
 return sky;
}
