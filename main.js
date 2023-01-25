import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';
import GUI from 'lil-gui';
import Stats from 'stats.js'
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min'
import { degToRad } from 'three/src/math/MathUtils';

// import { RedFormat } from 'three';
// import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';


// ----------------------- DOM
const divLanding = document.getElementById("landing");
const divDebug = document.getElementById("info");
const divOverlay = document.getElementById("overlay-outer");
const divTitle = document.getElementById("overlay-title");
const divDescription = document.getElementById("overlay-description");
const divContent = document.getElementById("overlay-content");
divLanding.style.display = "none";
divDebug.style.display = "none";

// ----------------------- FLAGS, OPTIONS
THREE.ColorManagement.legacyMode = false;
const glyphScale = 1;
const mapScale = 10;
let overlay = false;
const guiActive = false;

// ----------------------- STATS
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

// ----------------------- DATA
const assetsDir = "map-assets/";
// var glyphImages = ['glyph-test.png', 'glyph-test2.png', 'glyph-test3.png'];
// glyphImages = glyphImages.map(i => assetsDir + i);  // prepend each w directory
const glyphData =
    [
        {
            "image": assetsDir + 'glyph-test.png',
            "URL": "https://www.example.com/object.obj",
            "title": "The Title1",
            "description": "description 1",
            "position": { x: 0, y: 0, z: .5 },
            "scale": { x: 1, y: 1, z: 1 },
            // "camOffset": { x: -.05, y: 0, z: -.2 },
            // "camRot": { x: 0, y: 0, z: degToRad(0) },
        },
        {
            "image": assetsDir + 'glyph-test2.png',
            "URL": "https://www.google.com",
            "title": "The Title2",
            "description": "another description",
            "position": { x: 1.5, y: -1, z: .5 },
            // "camOffset": { x: -.07, y: -.10, z: 0.0 },
            // "camRot": { x: 0, y: 0, z: degToRad(180) },
        },
        {
            "image": assetsDir + 'glyph-test3.png',
            "URL": "https://www.google.com",
            "title": "The Title3",
            "description": "another description",
            "position": { x: -3.8, y: 3, z: .5 },
            "rotation": { x: degToRad(-10), y: 0, z: 0 },
            // "camOffset": { x: -.07, y: -.10, z: 0.0 },
            // "camRot": { x: 0, y: 0, z: degToRad(180) },
        },
    ];

// ----------------------- SCENE
const scene = new THREE.Scene();

// ----------------------- CAMERA
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .1, 10000);
// const camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, .1, 55 );
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

// ----------------------- CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.addEventListener('change', render);

// ----------------------- RAYCASTING
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

var raycastLayer = [];
let hovered = {};
let intersects = [];

window.addEventListener('pointermove', (e) => {

    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    intersects = raycaster.intersectObjects(raycastLayer, true)

    // If a previously hovered item is not among the hits we must call onPointerOut
    Object.keys(hovered).forEach((key) => {
        const hit = intersects.find((hit) => hit.object.uuid === key)
        if (hit === undefined) {
            const hoveredItem = hovered[key]
            if (hoveredItem.object.onPointerOver) hoveredItem.object.onPointerOut(hoveredItem)
            delete hovered[key]
        }
    })

    intersects.forEach((hit) => {
        // if a hit has not been flagged as hovered we must call onPointerOver
        if (!hovered[hit.object.uuid]) {
            hovered[hit.object.uuid] = hit
            if (hit.object.onPointerOver) hit.object.onPointerOver(hit)
        }
        // call onPointerMove
        if (hit.object.onPointerMove) hit.object.onPointerMove(hit)
    })

    render();
})


renderer.domElement.addEventListener('click', (e) => {



})

window.addEventListener('click', (e) => {

    if (e.target == renderer.domElement) {
        if (overlay) {
            overlay = false;
            fadeOut(divOverlay);
        } else {
            // update the picking ray with the camera and pointer position
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(raycastLayer, true);

            intersects.forEach((hit) => {

                // console.log(hit);
                // console.log(hit.point.x + ", " + hit.point.y + ", " + hit.point.z);

                if (hit.object.onClick) {
                    hit.object.onClick(hit)
                }
            })
        }
    } else {
        if (overlay) {
            // overlay = false;
            // fadeOut(divOverlay);
        } else { 

        }
    }

})



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
    map.scale.setScalar(mapScale);
    scene.add(map);
    render();

}, undefined, function (error) {

    console.error(error);

});





// ----------------------- GLYPHS

class Glyph extends THREE.Mesh {
    constructor(data) {

        super()

        this.position.set(data.position.x, data.position.y, data.position.z);

        if (data.rotation) {
            this.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
        }

        this.geometry = new THREE.PlaneGeometry(1, 1);
        this.scale.setScalar(glyphScale);
        this.isActive = false;

        const tex = new THREE.TextureLoader().load(data.image);

        this.material = new THREE.MeshStandardMaterial({
            map: tex,
            toneMapped: false,
            emissive: "red",
            emissiveIntensity: 10,
            transparent: true,
            // encoding: THREE.sRGBEncoding
        });

        // textual/html stuff
        this.htmlData = [];
        this.htmlData.URL = data.URL;
        this.htmlData.title = data.title;
        this.htmlData.description = data.description;

    }

    render() {

    }

    onPointerOver(e) {
        //   this.material.color.set('hotpink')
        //   this.material.color.convertSRGBToLinear()

        // this.material.emissiveIntensity = 10;
        // this.scale.setScalar(1.3);


        new TWEEN.Tween(this.scale)
            .to(
                { x: 1.2, y: 1.2, z: 1.2, }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                render();
            })
            .start();

        new TWEEN.Tween(this.material)
            .to({ emissiveIntensity: 10 }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();

    }

    onPointerOut(e) {
        //   this.material.color.set('orange')
        //   this.material.color.convertSRGBToLinear()

        // this.material.emissiveIntensity = 1;
        // this.scale.setScalar(1);

        new TWEEN.Tween(this.scale)
            .to(
                { x: 1, y: 1, z: 1, }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                render();
            })
            .start();

        new TWEEN.Tween(this.material)
            .to({ emissiveIntensity: 1 }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();


    }

    onClick(e) {

        // console.log(this.image + " was clicked");

        this.isActive = !this.isActive;

        setInfo(this.htmlData);

        render();
    }
}


let glyphs = [];
for (let i = 0; i < glyphData.length; i++) {

    glyphs[i] = new Glyph(glyphData[i]);
    scene.add(glyphs[i]);
    raycastLayer.push(glyphs[i]);   // add this to what gets checked by raycast

    // console.log("loading " + glyphData[i].image);

    // const glyphTexture = new THREE.TextureLoader().load(glyphData[i].image);

    // const glyphMat = new THREE.MeshStandardMaterial({
    //     map: glyphTexture,
    //     toneMapped: false,
    //     emissive: "red",
    //     emissiveIntensity: 10,
    //     transparent: true,
    //     // encoding: THREE.sRGBEncoding
    // });

    // const geometry = new THREE.PlaneGeometry(.12, .12);
    // const plane = new THREE.Mesh(geometry, glyphMat);
    // // plane.scale.set(5, 5, 5);

    // const p = new THREE.Vector3(glyphData[i].position.x, glyphData[i].position.y, glyphData[i].position.z);
    // plane.position.copy(p);

    // glyphs[i] = plane;

    // scene.add(glyphs[i]);

}

// const glyphTexture = new THREE.TextureLoader().load("map-assets/glyph-test2.png");
// // const glyphMat = new THREE.MeshPhongMaterial({ map: glyphTexture, transparent: true, emissiveIntensity: 10 });

// const glyphMat = new THREE.MeshLambertMaterial({
//     map: glyphTexture,
//     toneMapped: false,
//     emissive: "red",
//     emissiveIntensity: 10,
//     transparent: true,
//     // encoding: THREE.sRGBEncoding
// });

// const geometry = new THREE.PlaneGeometry(.12, .12);
// const plane = new THREE.Mesh(geometry, glyphMat);
// plane.scale.set(5, 5, 5);
// scene.add(plane);
// plane.position.set(0, 0, .2);

// glyph light
// const glyphLight = new THREE.PointLight(0xff0000, 1, 1);
// glyphLight.position.set(0, 0, .2);
// scene.add(glyphLight);





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

// renderer.outputEncoding = THREE.sRGBEncoding
renderer.toneMapping = THREE.ACESFilmicToneMapping


// ----------------------- GUI
if(guiActive) {
    const gui = new GUI();
    let params = {
        // myBoolean: true,
        // myString: 'lil-gui',
        dirLightIntensity: .25,
        ambLightIntensity: .5,
        // myFunction: function() { alert( 'hi' ) }
        clearColor: 0x111111,
    }
    gui.add(params, 'dirLightIntensity', 0, 2).onChange(value => {
        dirLight.intensity = value;
    });
    gui.add(params, 'ambLightIntensity', 0, 2).onChange(value => {
        ambLight.intensity = value;
    });
    gui.addColor(params, 'clearColor').onChange(value => {
        renderer.setClearColor(value);
    });
}


// ----------------------- RENDER
render();
function render() {

    stats.begin();

    composer.render();

    stats.end();
}

animate();
function animate() {
    // console.log("!");
    requestAnimationFrame(animate);
    TWEEN.update();
}

// ----------------------- HELPERS
function setDebug(text) {
    if (divDebug != null) {
        divDebug.textContent = text;
    }
}
function setInfo(data) {
    if (data != null) {

        overlay = true;

        console.log(data);
        fadeIn(divOverlay);
        divTitle.innerHTML = data.title;
        divDescription.innerHTML = data.description;
    }
}