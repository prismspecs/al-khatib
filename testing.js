import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min'



// ----------------------- SCENE
const scene = new THREE.Scene();

// ----------------------- CAMERA
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .1, 10000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xfff000);
document.body.appendChild(renderer.domElement);
renderer.setPixelRatio(window.devicePixelRatio);

// ----------------------- CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.addEventListener('change', render);

// ----------------------- RAYCASTING
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

var raycastLayer = [];
let hovered = {};
let intersects = [];

let hov=null;
let inter;

window.addEventListener('pointermove', (e) => {

    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)

    inter = raycaster.intersectObjects(raycastLayer, true)[0]
    if(inter != null) {
        if (inter.object.onPointerOver) inter.object.onPointerOver(inter)
        hov = inter;
    }

    if(hov != null) {
        if(inter != hov) {
            if (hov.object.onPointerOut) hov.object.onPointerOut(hov)
            hov = inter;

        } else {

        }
    } else {
        hov = inter;
    }




    render();
})

window.addEventListener('click', (e) => {

    if (e.target == renderer.domElement) {

        // update the picking ray with the camera and pointer position
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(raycastLayer, true);

        intersects.forEach((hit) => {

            if (hit.object.onClick) {
                hit.object.onClick(hit)
            }
        })

    }

})




// ----------------------- LIGHTING
const ambLight = new THREE.AmbientLight(0xffffff, .7); // soft white light
scene.add(ambLight);

scene.background = new THREE.Color(0xffff00)



// ----------------------- GLYPHS
const activeGlyphScale = 1.25;

class Glyph extends THREE.Mesh {
    constructor() {

        super()

        this.position.set(Math.random() * 5 - 2.5, Math.random() * 5 - 2.5, Math.random() * 5 - 2.5);

        this.isActive = false;

        let randCol = new THREE.Color(0xffffff);
        randCol.setHex(Math.random() * 0xffffff);

        this.geometry = new THREE.PlaneGeometry(1, 1);

        this.material = new THREE.MeshStandardMaterial({
            side: 2,
            color: randCol,
            emissiveIntensity: 1,
        });

        this.scale.setScalar(1);

    }



    onPointerOver() {

        new TWEEN.Tween(this.scale)
            .to(
                { x: activeGlyphScale, y: activeGlyphScale, z: activeGlyphScale }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                render();
            })
            .start();


    }

    onPointerOut() {

        new TWEEN.Tween(this.scale)
            .to(
                { x: 1, y: 1, z: 1 }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                render();
            })
            .start();


    }

    onClick(e) {


    }
}
let glyphs = [];
for (let i = 0; i < 15; i++) {
    glyphs[i] = new Glyph();
    scene.add(glyphs[i]);
    raycastLayer.push(glyphs[i]);
}


// ----------------------- RENDER
render();
function render() {

    renderer.render(scene, camera);

}

animate();
function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
}

