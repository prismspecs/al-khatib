/*

    TO DO:
    + if mouse has been dragging, dont open on click

*/


import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
// import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';
import GUI from 'lil-gui';
import Stats from 'stats.js'
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min'
import { degToRad } from 'three/src/math/MathUtils';
// import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';


// ----------------------- DOM
const divLanding = document.getElementById("landing");
// const divDebug = document.getElementById("info");
const divOverlay = document.getElementById("overlay-outer");
const divTitle = document.getElementById("overlay-title");
const divAuthor = document.getElementById("overlay-author");
const divDescription = document.getElementById("overlay-description");
const divContent = document.getElementById("overlay-content");
const divRelated = document.getElementById("overlay-related");

// const overlayCloser = document.getElementById("overlay-close");
const overlayClosers = document.getElementsByClassName('overlay-close');
for (var i = 0; i < overlayClosers.length; i++) {
    overlayClosers[i].addEventListener('click', function () {

        overlayClose();

    }, false);
}

const langArabic = document.getElementById("overlay-language-arabic");
const langGerman = document.getElementById("overlay-language-german");
const langEnglish = document.getElementById("overlay-language-english");

// listeners for languag selection
langArabic.addEventListener('click', function () {
    activeLanguage = "arabic";
    setInfo(activeGlyph.htmlData);
    langGerman.classList.remove("active");
    langEnglish.classList.remove("active");
    this.classList.add("active");

}, false);
langGerman.addEventListener('click', function () {
    activeLanguage = "german";
    setInfo(activeGlyph.htmlData);
    langArabic.classList.remove("active");
    langEnglish.classList.remove("active");
    this.classList.add("active");

}, false);
langEnglish.addEventListener('click', function () {
    activeLanguage = "english";
    setInfo(activeGlyph.htmlData);
    langGerman.classList.remove("active");
    langArabic.classList.remove("active");
    this.classList.add("active");

}, false);

divLanding.style.display = "none";



// ----------------------- FLAGS, OPTIONS
// THREE.ColorManagement.legacyMode = false;
const localTesting = false;
const DEBUG = false;
let activeLanguage = "german";
const glyphScale = 1.8;
const activeGlyphScale = 2;
const gInactiveColor = new THREE.Color(0xdd3333);
const gActiveColor = new THREE.Color(0xff0000);
const emissIntensity = 1;// was 10
const mapScale = 10;
const postcardScale = 1;
const activePostcardScale = 1.03;
let overlay = false;
const guiActive = false;
const bypassComposer = false;
const shadowMapSize = 2056;
const bgColor = new THREE.Color(0xb8635c);  //THREE.Color(0xee7edc);
let activeGlyph = null;
const startingZoomLevel = 3;
const maxZoomLevel = 10;
const startingXrot = 0;
const startingYrot = 10;
const startingZrot = 0;
const tweenDuration = 250;
let moved = false;  // keep track of whether user is currently dragging



// ----------------------- STATS
if (DEBUG) {
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
}


// ----------------------- DATA
let assetsPrepend = "";

if (!localTesting) {
    assetsPrepend = "https://al-khatib-glossar.com/wp-content/themes/blankslate/";
}

const assetsDir = assetsPrepend + "map-assets/";
const glyphDir = assetsDir + "/glyphs_jpg/";


const glyphDataX = [];
// retrieve the glossary posts data
const fetchURL = "https://al-khatib-glossar.com/wp-json/wp/v2/posts?categories=2&acf_format=standard&per_page=100&_embed&" + (new Date()).getTime();

// _embed gives the additional featured image data, acf_format=standard gives full json data for acf

fetch(fetchURL)
    .then(res => res.json())
    .then((data) => {

        // console.log('Output: ', data);

        data.forEach(obj => {

            glyphDataX.push(newGlyph(obj));

        });


        let glyphs = [];
        if (localTesting) {
            for (let i = 0; i < glyphData.length; i++) {

                debugg("adding from local");
                debugg(glyphData[i]);
                glyphs[i] = new Glyph(glyphData[i]);
                scene.add(glyphs[i]);
                raycastLayer.push(glyphs[i]);   // add this to what gets checked by raycast

            }
        } else {
            for (let i = 0; i < glyphDataX.length; i++) {

                debugg("adding from REST");
                debugg(glyphDataX[i]);
                glyphs[i] = new Glyph(glyphDataX[i]);
                scene.add(glyphs[i]);
                raycastLayer.push(glyphs[i]);   // add this to what gets checked by raycast

            }
        }


    }).catch(err => console.error(err));




const glyphData =
    [
        {
            "image": glyphDir + 'glyph_1.jpg',
            // "image": assetsDir + 'glyph-test.png',
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


function debugg(d) {
    if (DEBUG) {
        console.log(d);
    }
}

// ----------------------- SCENE
const scene = new THREE.Scene();

// ----------------------- CAMERA
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .1, 10000);
// const camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, .1, 55 );
camera.position.set(0, 0, startingZoomLevel);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(bgColor);
document.body.appendChild(renderer.domElement);
renderer.setPixelRatio(window.devicePixelRatio);

// ----------------------- CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.addEventListener('change', render);
scene.rotation.x = degToRad(startingXrot);
scene.rotation.y = degToRad(startingYrot);
scene.rotation.z = degToRad(startingZrot);
controls.minDistance = startingZoomLevel;
controls.maxDistance = maxZoomLevel;
controls.minPolarAngle = Math.PI * .2; // radians
controls.maxPolarAngle = Math.PI * .8; // radians
controls.update();














// ----------------------- RAYCASTING
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

var raycastLayer = [];
// let hovered = {};
let hovered = null;
let intersects = [];


var timeout;
window.addEventListener('pointermove', (e) => {

    clearTimeout(timeout);
    timeout = setTimeout(function () { moved = false; }, 200);

    moved = true;

    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    intersects = raycaster.intersectObjects(raycastLayer, true)

    // console.log(intersects[0].object.uuid, divider.uuid);

    if (intersects.length) {

        const obj = intersects[0].object;

        if (obj.name == "glyph") {

            divider.visible = false;

            // hitting something other than divider...
            // console.log(obj);
            if (obj.name == "glyph") {

                if (!obj.isHovered) {

                    // hit a glyph
                    obj.isHovered = true;
                    if (obj.onPointerOver) obj.onPointerOver();

                    if (hovered != null) {
                        if (hovered.onPointerOut) hovered.onPointerOut();
                        hovered.isHovered = false;
                    }

                    hovered = obj;
                }
            }

        } else if (obj.name == "postcard") {

            // hovering postcard
            if (!obj.isHovered) {

                obj.isHovered = true;

                if (obj.onPointerOver) obj.onPointerOver();

                if (hovered != null) {
                    if (hovered.onPointerOut) hovered.onPointerOut();
                    hovered.isHovered = false;
                }

                hovered = obj;
            }


        } else {

            // hovering something, but not glyph
            if (hovered != null) {
                if (hovered.onPointerOut) hovered.onPointerOut();
                hovered.isHovered = false;
                hovered = null;
            }

        }

    } else {
        // hovering nothing
        if (hovered != null) {
            if (hovered.onPointerOut) hovered.onPointerOut();
            hovered.isHovered = false;
            hovered = null;
        }

    }
})

window.addEventListener('mouseup', dragStopped, { passive: false });

function dragStopped() {
    console.log("drag stopped");
    moved = false;
}

window.addEventListener('mousedown', (e) => {


    if (e.target == renderer.domElement) {

        // if user clicks into area outside the overlay while it is active, exit overlay
        if (overlay) {
            overlay = false;
            fadeOut(divOverlay);
        } else {

            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(raycastLayer, false);

            if (intersects.length) {

                const obj = intersects[0].object;

                // do something based on what is clicked...
                if (obj.name == "divider") {

                } else if (obj.name == "postcard") {

                    // debugg("postcard clicked");
                    obj.isClicked = true;
                    if (obj.onClick) obj.onClick(obj);

                } else if (obj.name == "glyph") {

                    obj.isClicked = true;
                    if (obj.onClick) obj.onClick(obj);

                }
            }

        }
    } else {
        if (overlay) {
            // overlay = false;
            // fadeOut(divOverlay);
        } else {

        }
    }

    // render();
})








window.addEventListener("keydown", (event) => {

    // console.log(event.code);

    if (event.code === "Escape") {
        overlayClose();
    }
});


function overlayClose() {
    if (overlay) {
        overlay = false;
        fadeOut(divOverlay);
    }
}
















// ----------------------- LIGHTING
const dirLight = new THREE.DirectionalLight(0xffffff, .4);
dirLight.position.setScalar(5);  // get it away from center
dirLight.position.set(0, 5, 15);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = shadowMapSize;
dirLight.shadow.mapSize.height = shadowMapSize;
dirLight.shadow.bias = - 0.0001;
scene.add(dirLight);
// const helper = new THREE.CameraHelper(dirLight.shadow.camera)
// scene.add(helper)

const ambLight = new THREE.AmbientLight(0xffffff, .7); // soft white light
scene.add(ambLight);

// const pointLight = new THREE.PointLight(0xffffff, 1, 100);
// pointLight.position.set(0, 0, 5);
// pointLight.castShadow = true;
// scene.add(pointLight);




// ----------------------- BACKGROUND
// const backgroundTex = new THREE.TextureLoader().load(assetsDir + "pano2-blur-crop.jpg");
// backgroundTex.mapping = THREE.EquirectangularReflectionMapping;
// scene.background = backgroundTex;
// scene.environment = backgroundTex;
scene.background = new THREE.Color(bgColor);

//Load background texture
let loader = new THREE.TextureLoader();
loader.load(assetsDir + "background.jpg", function (texture) {
    scene.background = texture;
});

// ----------------------- MAP
var map = null;

loader = new GLTFLoader();
loader.load(assetsDir + "map-2048.glb", function (gltf) {

    gltf.scene.traverse(function (object) {

        if (object.isMesh) {
            object.receiveShadow = true;
            object.castShadow = true;
        }

    });

    map = gltf.scene.children[0];
    map.position.z = 0;
    map.scale.setScalar(mapScale);
    scene.add(map);
    render();

}, undefined, function (error) {

    console.error(error);

});





// ----------------------- POSTCARD
var postcard = null;

loader = new GLTFLoader();
loader.load(assetsDir + "postcard.glb", function (gltf) {

    gltf.scene.traverse(function (object) {

        if (object.isMesh) {
            object.receiveShadow = true;
            object.castShadow = true;
        }

    });

    postcard = gltf.scene.children[0];
    postcard.position.z = -.3;
    postcard.rotation.x = degToRad(92);
    postcard.rotation.z = degToRad(178);
    postcard.rotation.y = degToRad(3);
    postcard.scale.setScalar(postcardScale);
    scene.add(postcard);
    raycastLayer.push(postcard);
    render();

    postcard.name = "postcard";


    postcard.onPointerOver = function () {
        // hovering postcard
        // console.log("postcard hover");

        if (!overlay) {
            new TWEEN.Tween(this.scale)
                .to(
                    { x: activePostcardScale, y: activePostcardScale, z: activePostcardScale }, tweenDuration)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    render();
                })
                .start();

        }
    }

    postcard.onPointerOut = function () {
        if (!overlay) {
            new TWEEN.Tween(this.scale)
                .to(
                    { x: postcardScale, y: postcardScale, z: postcardScale }, tweenDuration)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    render();
                })
                .start();

        }
    }

    postcard.onClick = function () {

        // this.isClicked = true;
        console.log("clicked postcard");
        overlay = true;
        fadeIn(divOverlay);
        setInfo(this.htmlData);

        render();
    }


}, undefined, function (error) {

    console.error(error);

});

// postcard data
const postcardURL = "https://al-khatib-glossar.com/wp-json/wp/v2/pages/462?acf_format=standard&_embed&" + (new Date()).getTime();


fetch(postcardURL)
    .then(res => res.json())
    .then((data) => {

        // textual/html stuff
        postcard.htmlData = [];
        postcard.htmlData.URL = data.link;
        postcard.htmlData.title = data.title.rendered;
        postcard.htmlData.post = data.content.rendered;
        // postcard.htmlData.description = "data.description";
        // postcard.htmlData.author = data.author;
        // postcard.htmlData.related = data.related;

        debugg("adding postcard:");
        debugg(postcard.htmlData);

    }).catch(err => console.error(err));













// ----------------------- DIVIDER PLANE (to disallow clicking thru map)
const dividerGeometry = new THREE.PlaneGeometry(10, 10);
const dividerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide
});
const divider = new THREE.Mesh(dividerGeometry, dividerMaterial);
scene.add(divider);
divider.name = "divider";
divider.visible = false;
raycastLayer.push(divider);





// ----------------------- GLYPHS

class Glyph extends THREE.Mesh {
    constructor(data) {

        // console.log("creating new glyph with data:");
        // console.log(data);

        super()

        this.position.set(data.position.x, data.position.y, data.position.z);

        if (data.rotation) {
            this.rotation.set(degToRad(data.rotation.x), degToRad(data.rotation.y), degToRad(data.rotation.z));
        }

        this.isClicked = false;
        this.isHovered = false;
        this.name = "glyph";

        // let randCol = new THREE.Color(0xffffff);
        // randCol.setHex(Math.random() * 0xffffff);

        // CALLBACK METHOD ...
        // instantiate a loader
        const loader = new THREE.TextureLoader();

        const glyph = this;
        let nw, nh = 0;

        loader.load(

            data.image,

            // onLoad callback
            function (texture) {

                //console.log(texture.image.width);
                const w = texture.image.width;
                const h = texture.image.height;

                if (w > h) {
                    nw = 1;
                    nh = h / w;
                } else {
                    nh = 1;
                    nw = w / h;
                }

                // console.log("w: " + nw + " h: " + nh);
                glyph.geometry = new THREE.PlaneGeometry(nw, nh);

                glyph.material = new THREE.MeshStandardMaterial({
                    map: texture,
                    alphaMap: texture,
                    alphaTest: .15,
                    transparent: true,
                    opacity: 0,
                    side: 2,
                    // color: randCol,
                    emissive: gInactiveColor,
                    emissiveIntensity: 1,
                });
            },

            // onProgress callback currently not supported
            undefined,

            // onError callback
            function (err) {
                console.error('An error happened.');
            }
        );


        // this.geometry = new THREE.PlaneGeometry(1, 1);
        this.scale.setScalar(glyphScale);

        this.castShadow = true;

        // textual/html stuff
        this.htmlData = [];
        this.htmlData.URL = data.URL;
        this.htmlData.title = data.title;

        this.htmlData.post = data.post;
        this.htmlData.description = data.description;
        this.htmlData.author = data.author;
        this.htmlData.related = data.related;
    }



    onPointerOver() {

        if (!overlay) {
            new TWEEN.Tween(this.scale)
                .to(
                    { x: activeGlyphScale, y: activeGlyphScale, z: activeGlyphScale }, tweenDuration)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    render();
                })
                .start();

            new TWEEN.Tween(this.material)
                .to({ emissive: gActiveColor, emissiveIntensity: emissIntensity, opacity: 1 }, tweenDuration)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .start();
        }



    }

    onPointerOut() {

        new TWEEN.Tween(this.scale)
            .to(
                { x: glyphScale, y: glyphScale, z: glyphScale }, tweenDuration)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                render();
            })
            .start();

        new TWEEN.Tween(this.material)
            .to({ emissiveIntensity: 1, emissive: gInactiveColor, opacity: 0 }, tweenDuration)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .start();

    }

    onClick(e) {

        // this.isClicked = true;
        if (!moved) {
            console.log("clicked a glyph");

            // glyphLight.position.copy(this.position);
            activeGlyph = this;
            overlay = true;
            fadeIn(divOverlay);
            setInfo(activeGlyph.htmlData);

            render();
        }

    }
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
// composer.addPass(new ShaderPass(GammaCorrectionShader))
// setting threshold to 1 will make sure nothing glows
composer.addPass(new UnrealBloomPass(undefined, .5, 1, 1))   // thresh, str, radius

// renderer.outputEncoding = THREE.sRGBEncoding;
// renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;



// ----------------------- GUI
if (guiActive) {
    const gui = new GUI();
    let params = {
        // myBoolean: true,
        // myString: 'lil-gui',
        dirLightIntensity: .25,
        ambLightIntensity: .5,
        // myFunction: function() { alert( 'hi' ) }
        clearColor: 0xff0000,	// 0x6b135d
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

    if (DEBUG) stats.begin();

    console.log(moved);


    if (!overlay) {
        if (bypassComposer) {
            renderer.render(scene, camera);
        } else {
            composer.render();
        }
    }

    if (DEBUG) stats.end();
}

animate();
function animate() {
    // console.log("!");
    requestAnimationFrame(animate);
    TWEEN.update();
}

// ----------------------- HELPERS


function newGlyph(obj) {

    // console.log("object", obj);

    const glyph = {
        "id": obj.id,
        "image": obj._embedded['wp:featuredmedia'][0].media_details.sizes.full.source_url,
        "URL": obj.link,
        "title": obj.title.rendered,

        // "postData": obj.content.rendered,
        "position": {
            "x": parseFloat(obj.acf.position.x),
            "y": parseFloat(obj.acf.position.y),
            "z": parseFloat(obj.acf.position.z),
        },
        "rotation": {
            "x": parseFloat(obj.acf.rotation.x),
            "y": parseFloat(obj.acf.rotation.y),
            "z": parseFloat(obj.acf.rotation.z),
        },
        "post": {
            "english": obj.acf.english,
            "german": obj.acf.german,
            "arabic": obj.acf.arabic,
        },
        "description": {
            "english": obj.acf.description.english,
            "german": obj.acf.description.german,
            "arabic": obj.acf.description.arabic,
        },
        "author": obj.acf.author,
        "related": obj.acf.related,
    };

    return glyph;

}

function getDataFromID(id) {

    for (let i = 0; i < glyphDataX.length; i++) {
        // console.log(id, glyphDataX[i].id);
        if (id == glyphDataX[i].id) {
            // setInfo(glyphDataX[i]);
            return glyphDataX[i];
        }
    }

    return null;

}

function setInfoFromRel(id) {
    // console.log(getDataFromID(id));
    setInfo(getDataFromID(id));
}

function setInfo(data) {
    if (data != null) {

        if (data.title)
            divTitle.innerHTML = data.title;

        if (data.author)
            divAuthor.innerHTML = data.author;

        // add related links
        divRelated.innerHTML = "";

        if (data.related) {

            divRelated.innerHTML = "Related entries:";

            for (let i = 0; i < data.related.length; i++) {

                // console.log(data.related[i]);

                const relID = data.related[i].ID;
                const relTitle = data.related[i].post_title;
                const idTag = "rel-" + relID;

                // const relData = getDataFromID(relID);
                const linkCode = "<a href='javascript:void(0)' id='" + idTag + "'>" + relTitle + "</a>";

                var a = document.createElement('a');
                var linkText = document.createTextNode(relTitle);
                a.appendChild(linkText);
                a.title = "my title text";
                a.href = "javascript:void(0)";
                a.id = idTag;
                divRelated.appendChild(a);

                a.addEventListener('click', function () {
                    setInfoFromRel(relID);
                }, false);

            }
        }


        langGerman.classList.remove("active");
        langEnglish.classList.remove("active");
        langArabic.classList.remove("active");

        switch (activeLanguage) {
            case ("english"):
                divContent.innerHTML = data.post.english;
                // divDescription.innerHTML = data.description.english;
                langEnglish.classList.add("active");
                break;
            case ("german"):
                divContent.innerHTML = data.post.german;
                // divDescription.innerHTML = data.description.german;
                langGerman.classList.add("active");
                break;
            case ("arabic"):
                divContent.innerHTML = data.post.arabic;
                // divDescription.innerHTML = data.description.arabic;
                langArabic.classList.add("active");
                break;
        }

    }
}




