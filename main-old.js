import * as THREE from 'three'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import Stats from './jsm/libs/stats.module.js'
// import { GUI } from './jsm/libs/lil-gui.module.min.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RedFormat } from 'three';
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min'
import { degToRad } from 'three/src/math/MathUtils';
import { MapControls } from 'three/addons/controls/OrbitControls.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// file locations
//(local)
const PATH_DECODER = 'decoder/';
const FILE_MAP = "map-assets/map-2048.glb";
const FILE_PIN = "map-assets/pin.glb";
const FILE_PARTICLE = "map-assets/particle.png";
//(server)
// const FILE_MAP = "https://al-khatib-glossar.com/wp-content/themes/blankslate/map-assets/map-2048.glb";
// const FILE_PIN = "https://al-khatib-glossar.com/wp-content/themes/blankslate/map-assets/pin.glb";
// const FILE_PARTICLE = "https://al-khatib-glossar.com/wp-content/themes/blankslate/map-assets/particle.png";
// const PATH_DECODER = 'https://al-khatib-glossar.com/wp-content/themes/blankslate/decoder/';


// OPTIONS
const ENABLE_PARTICLES = false;
const DEBUG_MODE = true;


// ACTIVE FLAGS
let MAP_VISIBLE = true;
let IS_ANIMATING = true;    // can remove later...


if (DEBUG_MODE) {
    fadeOut(document.getElementById('landing'));
}



// DOM
const divDebug = document.getElementById("info");
const divLanding = document.getElementById("landing");
const divOverlay = document.getElementById("overlay-outer");
const divTitle = document.getElementById("overlay-title");
const divDescription = document.getElementById("overlay-description");
const divContent = document.getElementById("overlay-content");
// divLanding.style.display = "none";







// BEGIN THREE JS SETUP
const scene = new THREE.Scene()


// CAMERA
let camTarget = new THREE.Vector3(0.0, 0.0, .5);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100)
camera.position.z = .5;
camera.layers.enable(1);
const globalCamOffset = new THREE.Vector3(0.0, 0.0, .25);
const globalLookAtOffset = new THREE.Vector3(0.04, 0.0, 0.0);


const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
// renderer.setClearColor(0x000011, 1);
renderer.autoClear = false;
document.body.appendChild(renderer.domElement)


window.addEventListener(
    'resize',
    () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)

        render()
    },
    false
)
window.addEventListener('keydown', keyPressed);



let controls = new MapControls(camera, renderer.domElement);
controls.addEventListener('change', render); // call this only in static scenes (i.e., if there is no animation loop)
// controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
// controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 500;
controls.maxPolarAngle = Math.PI / 2;

// RAYCASTING
// const raycaster = new THREE.Raycaster();
// const pointer = new THREE.Vector2();

// function onPointerMove(event) {

//     pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
//     pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

// }
// window.addEventListener('pointermove', onPointerMove);



// MAP
var map = null;
let rot = 0.0;

// configure and create Draco decoder
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(PATH_DECODER);
let loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load(FILE_MAP, function (gltf) {

    map = gltf.scene.children[0];
    scene.add(map);
    // map.rotation.x = Math.PI / 2;

    // map has loaded, so just render it once then stop
    // IS_ANIMATING = false;
    renderer.render(scene, camera)

}, undefined, function (error) {

    console.error(error);

});













// COLORS
const colorActivePin = new THREE.Color(0xff0000);
const colorInactivePin = new THREE.Color(0xaaaaaa);





// LIGHTS
const light = new THREE.AmbientLight(0x404040, 2); // soft white light
scene.add(light);

const light2 = new THREE.PointLight(0xffffff, 0.9, 100);
light2.position.set(2, 2, 2);
scene.add(light2);

// const activePinLight = new THREE.PointLight( 0xff0000, 1 );
// activePinLight.position.set(99,99,99);
// scene.add(activePinLight);



// PARTICLES
if (ENABLE_PARTICLES) {
    const particlesGeometry = new THREE.BufferGeometry;
    const particlesCount = 5200;
    const posArray = new Float32Array(particlesCount * 3);
    const texLoader = new THREE.TextureLoader();
    const particleTexture = texLoader.load(FILE_PARTICLE);



    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * (Math.random() - 0.5) * 3;
    }

    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
        size: .005,
        color: 0xffff55,
        opacity: .5,
        map: particleTexture,
        transparent: true,
        blending: THREE.AdditiveBlending
    });


    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
}





// GLYPH
const glyphTexture = new THREE.TextureLoader().load("map-assets/glyph-test.png");
const glyphMat = new THREE.MeshPhongMaterial({ map: glyphTexture, transparent: true });

const geometry = new THREE.PlaneGeometry(.1, .1);
const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const plane = new THREE.Mesh(geometry, glyphMat);
scene.add(plane);
plane.position.set(.1, .1, .1);
plane.layers.enable(1);

const light3 = new THREE.PointLight(0xff0000, 2, 100);
light3.position.set(.1, .1, .15);
scene.add(light3);
light3.layers.set(1);


// FX layers etc.
const composer = new EffectComposer(renderer);
composer.setSize(window.innerWidth, window.innerHeight)
const renderScene = new RenderPass(scene, camera);
// const effectFXAA = new ShaderPass(THREE.FXAAShader)
// effectFXAA.uniforms.resolution.value.set(5,5)

var bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85)
bloomPass.threshold = 0.2
bloomPass.strength = 1
bloomPass.radius = 1
bloomPass.renderToScreen = true


composer.addPass(renderScene)
// composer.addPass(effectFXAA)
composer.addPass(bloomPass)

renderer.gammaInput = true
renderer.gammaOutput = true
renderer.toneMappingExposure = Math.pow(0.9, 4.0)






// DEMO PLACEHOLDER JSON
const jsonData =
    [
        {
            "URL": "https://www.example.com/object.obj",
            "title": "The Title",
            "description": "A shiny red object",
            "position": { x: -.2, y: 0, z: -.01 },
            "camOffset": { x: -.05, y: 0, z: -.2 },
            "camRot": { x: 0, y: 0, z: degToRad(0) },
        },
        {
            "URL": "https://www.google.com",
            "title": "The Title",
            "description": "another description",
            "position": { x: 0.05104, y: -0.0879, z: -0.00269 },
            "camOffset": { x: -.07, y: -.10, z: 0.0 },
            "camRot": { x: 0, y: 0, z: degToRad(180) },
        },
        {
            "URL": "https://www.example.com/object.obj",
            "title": "The Title",
            "description": "A shiny red object",
            "position": { x: -0.59592, y: -0.207005, z: 0.04492 },
            "camOffset": { x: -.2, y: 0, z: -0.1 },
            "camRot": { x: 0, y: 0, z: degToRad(90) },
        },
        {
            "URL": "https://www.google.com",
            "title": "The Title",
            "description": "another description",
            "position": { x: -0.25328, y: -0.29877, z: 0.018674 },
            "camOffset": { x: .2, y: -.2, z: -0.1 },
            "camRot": { x: 0, y: 0, z: 0 },
        },
        {
            "URL": "https://www.example.com/object.obj",
            "title": "The Title",
            "description": "A shiny red object",
            "position": { x: -0.26098, y: 0.30574, z: 0.022263 },
            "camOffset": { x: .05, y: 0, z: -.02 },
            "camRot": { x: 0, y: 0, z: 0 },
        },
        {
            "URL": "https://www.google.com",
            "title": "The Title",
            "description": "another description",
            "position": { x: 0.000585, y: 0.573804, z: 0.0058135 },
            "camOffset": { x: .15, y: 0, z: 0.0 },
            "camRot": { x: 0, y: 0, z: 0 },
        },
        {
            "URL": "https://www.example.com/object.obj",
            "title": "The Title",
            "description": "A shiny red object",
            "position": { x: 0.420894, y: 0.1336326, z: 0.0020178 },
            "camOffset": { x: .05, y: 0, z: 0.0 },
            "camRot": { x: 0, y: 0, z: 0 },
        },
        {
            "URL": "https://www.google.com",
            "title": "The Title",
            "description": "another description",
            "position": { x: 0.54433, y: -0.362672, z: 0.021328 },
            "camOffset": { x: .05, y: 0, z: 0.0 },
            "camRot": { x: 0, y: 0, z: 0 },
        },
        {
            "URL": "https://www.google.com",
            "title": "The Title",
            "description": "another description",
            "position": { x: 0.32504, y: -0.44314, z: -0.01171 },
            "camOffset": { x: .05, y: -.10, z: 0.0 },
            "camRot": { x: 0, y: 0, z: 0 },
        },
        {
            "URL": "https://www.google.com",
            "title": "The Title",
            "description": "another description",
            "position": { x: 0.26185, y: -0.19463, z: -0.01868 },
            "camOffset": { x: -.05, y: 0, z: 0.0 },
            "camRot": { x: 0, y: 0, z: 0 },
        }
    ];




function animate() {

    requestAnimationFrame(animate);

    let time = Date.now() * 0.001;
    if (ENABLE_PARTICLES) {
        particlesMesh.rotation.z = time * .1;
        particlesMesh.rotation.x = time * .05;
    }


    renderer.autoClear = false;
    renderer.clear();

    camera.layers.set(1);
    composer.render();

    renderer.clearDepth();
    camera.layers.set(0);
    renderer.render(scene, camera);


    TWEEN.update();

}

function render() {
    if (IS_ANIMATING) {
        renderer.render(scene, camera)
    }
}

animate()

function changeDesc(text) {
    if (divDebug != null) {
        divDebug.textContent = text;
    }
}





// PIN
var pin = null;
let pins = [];

// configure and create Draco decoder
loader = new GLTFLoader();

loader.load(FILE_PIN, function (gltf) {

    pin = gltf.scene;
    // scene.add(pin);
    pin.rotation.x = Math.PI / 2;
    pin.scale.set(.02, .02, .02);

    for (let i = 0; i < 10; i++) {

        // const cubeGeometry = new THREE.BoxGeometry(.003, .003, .012);
        // const cubeMaterial = new THREE.MeshBasicMaterial({ color: colorInactivePin });
        // const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

        const pinObj = pin.clone();

        // pinObj.userData = { URL: jsonData[i].URL };
        // pinObj.userData = { description: jsonData[i].description };
        // pinObj.userData = { camRot: jsonData[i].camRot };
        // pinObj.userData = { camOffset: jsonData[i].camOffset };

        pinObj.url = jsonData[i].URL;
        pinObj.title = jsonData[i].title;
        pinObj.description = jsonData[i].description;
        pinObj.camRot = jsonData[i].camRot;
        pinObj.camOffset = jsonData[i].camOffset;
        pinObj.myId = i;


        const p = new THREE.Vector3(jsonData[i].position.x, jsonData[i].position.y, jsonData[i].position.z);
        pinObj.position.copy(p);

        pins[i] = pinObj;   // was pinObj.clone()
        scene.add(pins[i]);



    }

    camera.target = pins[currentPin].position;

}, undefined, function (error) {
    console.error(error);
});

let currentPin = 9;
let lastPin = 0;
// camera.target = pins[currentPin].position;

function keyPressed(e) {
    switch (e.key) {
        case 'a':

            lastPin = currentPin;
            currentPin++;
            if (currentPin >= pins.length) currentPin = 0;
            setActivePin(currentPin);


            // camera.translateZ(-1);
            break;

        case 'm':
            // update the picking ray with the camera and pointer position
            raycaster.setFromCamera(pointer, camera);

            // calculate objects intersecting the picking ray
            const intersects = raycaster.intersectObjects(scene.children);
            console.log(intersects[0].point.x + ", " + intersects[0].point.y + ", " + intersects[0].point.z);
            break;

        case 'ArrowDown':
            new TWEEN.Tween(pins[1].position)
                .to({ y: .5 }, 2000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start()
                ;
            break;

        case 'j':
            console.log(jsonData);
            break;

        case 'o':
            MAP_VISIBLE = !MAP_VISIBLE;
            animate();
            break;

    }
    e.preventDefault();
    // render();
}


function setActivePin(id) {

    fadeOut(divOverlay);



    // prevCamTarget.copy(camTarget);

    const pOffset = new THREE.Vector3(pins[id].camOffset.x, pins[id].camOffset.y, pins[id].camOffset.z);
    pOffset.add(globalCamOffset);

    camTarget.copy(pins[id].position.clone());
    // console.log(camTarget);
    // camTarget.setZ(1);


    // // tween camera position
    // new TWEEN.Tween(camera.position)
    //     .to(camTarget.clone().add(offset), 1000)
    //     .easing(TWEEN.Easing.Cubic.InOut)
    //     .start()
    //     ;


    // smoothCamTarget.copy(prevCamTarget);
    // // const testing = new THREE.Vector3(2,2,2);

    // var tween = new TWEEN.Tween(smoothCamTarget) 
    //     .to(camTarget, 1000) 
    //     .easing(TWEEN.Easing.Cubic.InOut)
    //     .onUpdate(function () { 
    //         // console.log(smoothCamTarget);
    //         camera.lookAt(smoothCamTarget);
    //     })
    //     .start()
    //     .onComplete(() => {

    //     });

    // console.log(pins[id].camRot);
    const rOffset = new THREE.Vector3(pins[id].camRot.x, pins[id].camRot.y, pins[id].camRot.z);

    cameraToMarker(camTarget, pOffset, rOffset, id);

    // pins[lastPin].material.color.set(colorInactivePin);
    // pins[id].material.color.set(colorActivePin);

    changeDesc(id);

    // const lightOffset = new THREE.Vector3(0,0,-.1);
    // activePinLight.position.set(camTarget.clone().add(lightOffset));
}



function cameraToMarker(marker, pOffset, rOffset, id) {

    // console.log("Calling cameraToMarker()");

    // camera.up = rOffset;


    const offsetPos = marker.clone().add(pOffset);

    const currentCamPosition = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const storedMarkerPosition = new THREE.Vector3(marker.x, marker.y, marker.z);
    const newCameraTarget = getNewPointOnVector(currentCamPosition, storedMarkerPosition);
    // const markerPosition = new THREE.Vector3(...Object.values(newCameraTarget));
    const startRotation = new THREE.Euler().copy(camera.rotation);

    // console.log(currentCamPosition);
    // camera.position.set(offsetPos);
    camera.lookAt(storedMarkerPosition.clone().add(globalLookAtOffset));
    let endRotation = new THREE.Euler().copy(camera.rotation);
    // endRotation.add(rOffset);
    camera.rotation.copy(startRotation);
    // camera.position.set(currentCamPosition.x, currentCamPosition.y, currentCamPosition.z);

    new TWEEN.Tween(camera.rotation)
        .to(
            {
                x: endRotation.x + rOffset.x,
                y: endRotation.y + rOffset.y,
                z: endRotation.z + rOffset.z,
            }, 500)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onComplete(() => {
            new TWEEN.Tween(camera.position)
                .to({
                    x: offsetPos.x,
                    y: offsetPos.y,
                    z: offsetPos.z,
                })
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    camera.lookAt(storedMarkerPosition.clone().add(globalLookAtOffset));
                    camera.rotation.set(camera.rotation.x + rOffset.x, camera.rotation.y + rOffset.y, camera.rotation.z + rOffset.z);
                })
                .onComplete(() => {
                    camera.lookAt(storedMarkerPosition.clone().add(globalLookAtOffset));
                    camera.rotation.set(camera.rotation.x + rOffset.x, camera.rotation.y + rOffset.y, camera.rotation.z + rOffset.z);
                    IS_ANIMATING = false;

                    loadOverlay(id);

                })
                .start();
        })
        .onStart(() => {
            IS_ANIMATING = true;

        })
        .start();
}

const getNewPointOnVector = (p1, p2) => {
    let distAway = 200;
    let vector = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    let vl = Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2) + Math.pow(vector.z, 2));
    let vectorLength = { x: vector.x / vl, y: vector.y / vl, z: vector.z / vl };
    let v = { x: distAway * vectorLength.x, y: distAway * vectorLength.y, z: distAway * vectorLength.z };
    return { x: p2.x + v.x, y: p2.y + v.y, z: p2.z + v.z };
}

function loadOverlay(id) {
    console.log(id);

    divTitle.textContent = pins[id].title;
    divDescription.textContent = pins[id].description;

    fadeIn(divOverlay);

}