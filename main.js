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
const glyphScale = 1.5;
const activeGlyphScale = 1.7;
const gInactiveColor = new THREE.Color(0xdd3333);
const gActiveColor = new THREE.Color(0xff0000);
const mapScale = 10;
let overlay = false;
const guiActive = false;

// ----------------------- STATS
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

// ----------------------- DATA
const assetsDir = "map-assets/";
const glyphDir = assetsDir + "/glyphs_jpg/";
// var glyphImages = ['glyph-test.png', 'glyph-test2.png', 'glyph-test3.png'];
// glyphImages = glyphImages.map(i => assetsDir + i);  // prepend each w directory
const glyphData =
    [
        {
            "image": glyphDir + 'glyph_1.jpg',
            "URL": "https://www.example.com/object.obj",
            "title": "The Title1",
            "description": "description 1",
            "position": { x: -4.0, y: 3.7, z: .5 },
            "scale": { x: 1, y: 1, z: 1 },
        },
        {
            "image": glyphDir + 'glyph_2.jpg',
            "URL": "https://www.google.com",
            "title": "The Title2",
            "description": "another description",
            "position": { x: 3.92, y: 4, z: .5 },
            "rotation": { x: degToRad(10), y: degToRad(-15), z: 0 },
        },
        {
            "image": glyphDir + 'glyph_3.jpg',
            "URL": "https://www.google.com",
            "title": "The Title3",
            "description": "another description",
            "position": { x: -0.35, y: 2.70, z: .4 },
            "rotation": { x: degToRad(-10), y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_4.jpg',
            "URL": "https://www.google.com",
            "title": "The Title4",
            "description": "another description4",
            "position": { x: 1.05, y: -3.85, z: .2 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_5.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 5",
            "description": "another description 5",
            "position": { x: 4.0, y: -3.8, z: .5 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_6.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 6",
            "description": "another description 6",
            "position": { x: -4.09, y: -1.86, z: .5 },
            "rotation": { x: degToRad(-12), y: 0, z: degToRad(-8) },
        },
        {
            "image": glyphDir + 'glyph_7.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 7",
            "description": "another description 7",
            "position": { x: 4.3, y: 0.68, z: .55 },
            "rotation": { x: 0, y: degToRad(18), z: 0 },
        },
        {
            "image": glyphDir + 'glyph_8.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 8",
            "description": "another description 8",
            "position": { x: -2.34, y: 1.1, z: .4 },
            "rotation": { x: degToRad(10), y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_9.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 9",
            "description": "another description 9",
            "position": { x: 4.0, y: 2.3, z: .5 },
            "rotation": { x: degToRad(-10), y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_10.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 10",
            "description": "another description 10",
            "position": { x: -0.61, y: -3.69, z: .35 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_11.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 11",
            "description": "another description 11",
            "position": { x: -3.16, y: 2.74, z: .55 },
            "rotation": { x: degToRad(-6), y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_12.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 12",
            "description": "another description 12",
            "position": { x: -1.79, y: 3.96, z: .3 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_13.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 13",
            "description": "another description 13",
            "position": { x: 1.95, y: 0.48, z: .3 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_14.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 14",
            "description": "another description 14",
            "position": { x: 3.0, y: 1.28, z: .6 },
            "rotation": { x: 0, y: degToRad(-11), z: degToRad(-6) },
        },
        {
            "image": glyphDir + 'glyph_15.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 15",
            "description": "another description 15",
            "position": { x: 0.38, y: -1.86, z: .4 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_16.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 16",
            "description": "another description 16",
            "position": { x: -4.13, y: 1.37, z: .5 },
            "rotation": { x: 0, y: degToRad(7), z: 0 },
        },
        {
            "image": glyphDir + 'glyph_17.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 17",
            "description": "another description 17",
            "position": { x: 1.47, y: -0.86, z: .35 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_18.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 18",
            "description": "another description 18",
            "position": { x: -1.18, y: -1.38, z: .35 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_19.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 19",
            "description": "another description 19",
            "position": { x: -1.86, y: -2.56, z: .5 },
            "rotation": { x: 0, y: 0, z: degToRad(-28) },
        },
        {
            "image": glyphDir + 'glyph_20.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 20",
            "description": "another description 20",
            "position": { x: 2.62, y: -3.7, z: .35 },
            "rotation": { x: 0, y: 0, z: degToRad(-8) },
        },
        {
            "image": glyphDir + 'glyph_21.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 21",
            "description": "another description 21",
            "position": { x: 4.5, y: -1.5, z: .4 },
            "rotation": { x: 0, y: degToRad(15), z: degToRad(-90) },
        },
        {
            "image": glyphDir + 'glyph_23.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 22",
            "description": "another description 22",
            "position": { x: 2.2, y: 3.1, z: .3 },
            "rotation": { x: 0, y: 0, z: degToRad(-7) },
        },
        {
            "image": glyphDir + 'glyph_23.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 23",
            "description": "another description 23",
            "position": { x: -3.60, y: 0.30, z: .3 },
            "rotation": { x: 0, y: 0, z: degToRad(50) },
        },
        {
            "image": glyphDir + 'glyph_24.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 24",
            "description": "another description 24",
            "position": { x: -3.6, y: -3.24, z: .3 },
            "rotation": { x: degToRad(10), y: 0, z: degToRad(-30) },
        },
        {
            "image": glyphDir + 'glyph_25.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 25",
            "description": "another description 25",
            "position": { x: 1.69, y: 1.93, z: .35 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_26.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 26",
            "description": "another description 26",
            "position": { x: 1.47, y: -2.46, z: .35 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_27.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 27",
            "description": "another description 27",
            "position": { x: -2.17, y: -3.83, z: .25 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_28.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 28",
            "description": "another description 28",
            "position": { x: -1.93, y: 2.2, z: .45 },
            "rotation": { x: 0, y: 0, z: degToRad(-5) },
        },
        {
            "image": glyphDir + 'glyph_29.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 29",
            "description": "another description 29",
            "position": { x: -2.7, y: -1.03, z: .35 },
            "rotation": { x: degToRad(-13), y: 0, z: degToRad(10) },
        },
        {
            "image": glyphDir + 'glyph_30.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 30",
            "description": "another description 30",
            "position": { x: 0.06, y: 1.18, z: .35 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_31.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 31",
            "description": "another description 31",
            "position": { x: 3.34, y: -0.30, z: .5 },
            "rotation": { x: 0, y: degToRad(-13), z: 0 },
        },
        {
            "image": glyphDir + 'glyph_32.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 32",
            "description": "another description 32",
            "position": { x: 3.24, y: -2.34, z: .55 },
            "rotation": { x: 0, y: degToRad(-13), z: 0 },
        },
        {
            "image": glyphDir + 'glyph_33.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 33",
            "description": "another description 33",
            "position": { x: -0.24, y: -0.68, z: .40 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_34.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 34",
            "description": "another description 34",
            "position": { x: -2.08, y: -0.03, z: .35 },
            "rotation": { x: 0, y: 0, z: 0 },
        },
        {
            "image": glyphDir + 'glyph_35.jpg',
            "URL": "https://www.google.com",
            "title": "The Title 35",
            "description": "another description 35",
            "position": { x: 0.97, y: 3.7, z: .4 },
            "rotation": { x: 0, y: 0, z: 0 },
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
loader.load("map-assets/map-2048-faded.glb", function (gltf) {

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
            alphaMap: tex,
            alphaTest: .05,
            transparent: true,
            toneMapped: false,
            emissive: gInactiveColor,
            //color: "red",
            emissiveIntensity: 1,
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

        new TWEEN.Tween(this.scale)
            .to(
                { x: activeGlyphScale, y: activeGlyphScale, z: activeGlyphScale }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                render();
            })
            .start();

        new TWEEN.Tween(this.material)
            .to({ emissive: gActiveColor, emissiveIntensity: 10 }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();

    }

    onPointerOut(e) {

        new TWEEN.Tween(this.scale)
            .to(
                { x: glyphScale, y: glyphScale, z: glyphScale }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                render();
            })
            .start();

        new TWEEN.Tween(this.material)
            .to({ emissiveIntensity: 1, emissive: gInactiveColor }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();

    }

    onClick(e) {

        this.isActive = !this.isActive;

        // glyphLight.position.copy(this.position);

        setInfo(this.htmlData);

        render();
    }
}


let glyphs = [];
for (let i = 0; i < glyphData.length; i++) {

    glyphs[i] = new Glyph(glyphData[i]);
    scene.add(glyphs[i]);
    raycastLayer.push(glyphs[i]);   // add this to what gets checked by raycast

}


// glyph light
const glyphLight = new THREE.PointLight(0xffffff, 3, 1);
glyphLight.position.setScalar(100); // put it aside for now
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

// renderer.outputEncoding = THREE.sRGBEncoding
renderer.toneMapping = THREE.ACESFilmicToneMapping


// ----------------------- GUI
if (guiActive) {
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