import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { TWEEN } from 'three/examples/jsm/libs/tween.module.min'



// ----------------------- DATA
const assetsDir = "map-assets/";
const glyphDir = assetsDir + "/glyphs_jpg/";
const glyphData =
    [
        {
            // "image": glyphDir + 'glyph_1.jpg',
            "image": assetsDir + 'glyph-test.png',
            "position": { x: -4.0, y: 3.7, z: .5 },
        },
        {
            "image": glyphDir + 'glyph_2.jpg',
            "position": { x: 3.92, y: 4, z: .5 },
        },
        {
            "image": glyphDir + 'glyph_3.jpg',
            "position": { x: -0.35, y: 2.70, z: .4 },
        },

    ];

// ----------------------- SCENE
const scene = new THREE.Scene();

// ----------------------- CAMERA
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .1, 10000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);
// renderer.setPixelRatio(window.devicePixelRatio);

// ----------------------- CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.addEventListener('change', render);



// ----------------------- LIGHTING
const dirLight = new THREE.DirectionalLight(0xffffff, .5);
dirLight.position.setScalar(5);  // get it away from center
dirLight.position.set(0, 0, 15);
dirLight.castShadow = true;

dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;


scene.add(dirLight);
const helper = new THREE.CameraHelper(dirLight.shadow.camera)
scene.add(helper)





const geometry = new THREE.BoxGeometry(11, 11, 1);
const material = new THREE.MeshStandardMaterial({ color: 0xbbccaa });
const cube = new THREE.Mesh(geometry, material);
cube.position.set(0, 0, -1);
cube.receiveShadow = true;
scene.add(cube);

const geometry2 = new THREE.BoxGeometry(3, 3, 3);
const material2 = new THREE.MeshStandardMaterial({ color: 0x555555 });
const cube2 = new THREE.Mesh(geometry2, material2);
cube2.position.set(1, 0, 5);
cube2.receiveShadow = true;
cube2.castShadow = true;
scene.add(cube2);




// ----------------------- GLYPHS

class Glyph extends THREE.Mesh {
    constructor(data) {

        super()

        this.position.set(data.position.x, data.position.y, data.position.z);

        this.geometry = new THREE.PlaneGeometry(1, 1);
        this.scale.setScalar(3);

        const tex = new THREE.TextureLoader().load(data.image);

        this.material = new THREE.MeshBasicMaterial({
            map: tex,
            alphaMap: tex,
            alphaTest: .5,
            transparent: false,
            // shadowSide: THREE.DoubleSide

        });
        this.castShadow = true;
    }

}



let glyphs = [];
for (let i = 0; i < glyphData.length; i++) {

    glyphs[i] = new Glyph(glyphData[i]);
    scene.add(glyphs[i]);

}


renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

// ----------------------- RENDER
render();
function render() {

    renderer.render(scene, camera);

}

animate();
function animate() {
    // console.log("!");
    requestAnimationFrame(animate);
    TWEEN.update();
}


