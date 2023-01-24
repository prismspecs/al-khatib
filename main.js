import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import Stats from './jsm/libs/stats.module.js'
// import { GUI } from './jsm/libs/lil-gui.module.min.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RedFormat } from 'three';
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min'
import { degToRad } from 'three/src/math/MathUtils';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';

THREE.ColorManagement.legacyMode = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .1, 10000);
// const camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, .1, 55 );
// camera.position.set(-5, 5, 5);
camera.position.set(0, 0, 2);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, .5);
light.position.setScalar(100);
scene.add(light);


// MAP
var map = null;
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('decoder/');
let loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.load("map-assets/map-2048.glb", function (gltf) {

    map = gltf.scene.children[0];
    map.position.z = 0;
    map.scale.set(5, 5, 5);
    // map.layers.enable(0);
    scene.add(map);
    renderer.render(scene, camera)

}, undefined, function (error) {

    console.error(error);

});





// GLYPH
const glyphTexture = new THREE.TextureLoader().load("map-assets/glyph-test.png");
// const glyphMat = new THREE.MeshPhongMaterial({ map: glyphTexture, transparent: true, emissiveIntensity: 10 });

const glyphMat = new THREE.MeshStandardMaterial({
    map: glyphTexture,
    toneMapped: false,
    emissive: "red",
    emissiveIntensity: 10,
    transparent: true
});

const geometry = new THREE.PlaneGeometry(.12, .12);
const plane = new THREE.Mesh(geometry, glyphMat);
plane.scale.set(5, 5, 5);
scene.add(plane);
plane.position.set(0, 0, .2);

// const light3 = new THREE.PointLight(0xff0000, 1, 100);
// light3.position.set(.1, .1, .15);
// scene.add(light3);

// var objBack = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 1), new THREE.MeshBasicMaterial({ color: "red", wireframe: false }));
// objBack.layers.enable(1);
// scene.add(objBack);









/** COMPOSER */
var renderScene = new RenderPass(scene, camera)



const target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    encoding: THREE.sRGBEncoding,
})
target.samples = 8
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