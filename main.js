import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';

// import Stats from './jsm/libs/stats.module.js'
// import { GUI } from './jsm/libs/lil-gui.module.min.js'
// import { RedFormat } from 'three';
// import { TWEEN } from 'three/examples/jsm/libs/tween.module.min'
// import { degToRad } from 'three/src/math/MathUtils';
// import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ----------------------- FLAGS, OPTIONS
THREE.ColorManagement.legacyMode = false;

const scene = new THREE.Scene();


// ----------------------- CAMERA
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .1, 10000);
// const camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, .1, 55 );
camera.position.set(0, 0, 2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);


// ----------------------- LIGHTING
const dirLight = new THREE.DirectionalLight(0xffffff, .25);
dirLight.position.setScalar(5);  // get it away from center
scene.add(dirLight);

const ambLight = new THREE.AmbientLight(0x404040, .5); // soft white light
scene.add(ambLight);


// ----------------------- MAP
var map = null;

let loader = new GLTFLoader();
loader.load("map-assets/map-2048.glb", function (gltf) {

    map = gltf.scene.children[0];
    map.position.z = 0;
    map.scale.set(5, 5, 5);
    scene.add(map);
    renderer.render(scene, camera)

}, undefined, function (error) {

    console.error(error);

});



 

// ----------------------- GLYPHS 
const glyphTexture = new THREE.TextureLoader().load("map-assets/glyph-test2.png");
// const glyphMat = new THREE.MeshPhongMaterial({ map: glyphTexture, transparent: true, emissiveIntensity: 10 });

const glyphMat = new THREE.MeshLambertMaterial({
    map: glyphTexture,
    toneMapped: false,
    emissive: "red",
    emissiveIntensity: 10,
    transparent: true,
    // encoding: THREE.sRGBEncoding
});

const geometry = new THREE.PlaneGeometry(.12, .12);
const plane = new THREE.Mesh(geometry, glyphMat);
plane.scale.set(5, 5, 5);
scene.add(plane);
plane.position.set(0, 0, .2);

// glyph light
const glyphLight = new THREE.PointLight( 0xff0000, 1, 1 );
glyphLight.position.set(0, 0, .2);
scene.add(glyphLight);





// ----------------------- COMPOSER
const target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    encoding: THREE.sRGBEncoding,
})
target.samples = 0; // was 8
const composer = new EffectComposer(renderer, target)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new ShaderPass(GammaCorrectionShader))
// setting threshold to 1 will make sure nothing glows
composer.addPass(new UnrealBloomPass(undefined, .5, 1, 1))   // thresh, str, radius


renderer.outputEncoding = THREE.sRGBEncoding
renderer.toneMapping = THREE.ACESFilmicToneMapping

render();
function render() {
    requestAnimationFrame(render);

    // renderer.autoClear = false;
    // renderer.clear();

    composer.render();

}