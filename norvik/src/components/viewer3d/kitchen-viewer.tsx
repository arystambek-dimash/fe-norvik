import {useRef, useEffect, useCallback} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {KitchenPlan} from '@/algorithm/types';
import {buildScene, type RoomConfig, type WallAnchors} from './scene-builder';
import {disposeScene} from './dispose';
import {clearTextureCache} from './texture-factory';

interface KitchenViewerProps {
    plan: KitchenPlan | null;
    roomConfig: RoomConfig;
    wallAnchors?: WallAnchors[];
    selectedModuleId: string | null;
    onSelectModule: (id: string | null) => void;
}

const HIGHLIGHT_EMISSIVE = new THREE.Color(0x4488ff);
const DEFAULT_EMISSIVE = new THREE.Color(0x000000);

function setEmissive(object: THREE.Object3D, color: THREE.Color): void {
    object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive.copy(color);
            child.material.emissiveIntensity = color.equals(DEFAULT_EMISSIVE) ? 0 : 0.3;
        }
    });
}

function findModuleGroup(object: THREE.Object3D): THREE.Object3D | null {
    let current: THREE.Object3D | null = object;
    while (current) {
        if (current.userData?.moduleId) return current;
        current = current.parent;
    }
    return null;
}

export function KitchenViewer({
                                  plan,
                                  roomConfig,
                                  wallAnchors,
                                  selectedModuleId,
                                  onSelectModule,
                              }: KitchenViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rafRef = useRef<number>(0);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2());
    const handleClickRef = useRef<(event: MouseEvent) => void>(() => {
    });

    const handleClick = useCallback(
        (event: MouseEvent) => {
            const container = containerRef.current;
            const camera = cameraRef.current;
            const scene = sceneRef.current;
            if (!container || !camera || !scene) return;

            const rect = container.getBoundingClientRect();
            mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycasterRef.current.setFromCamera(mouseRef.current, camera);
            const intersects = raycasterRef.current.intersectObjects(scene.children, true);

            if (intersects.length > 0) {
                const moduleGroup = findModuleGroup(intersects[0].object);
                if (moduleGroup) {
                    onSelectModule(moduleGroup.userData.moduleId as string);
                    return;
                }
            }

            onSelectModule(null);
        },
        [onSelectModule],
    );

    // Keep ref in sync so the stable listener always calls the latest handler
    handleClickRef.current = handleClick;

    // Initialize renderer, camera, controls
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Renderer — high quality
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Camera — positioned for a nice kitchen overview angle
        const rw = roomConfig.roomWidth / 1000;
        const rd = roomConfig.roomDepth / 1000;
        const aspect = container.clientWidth / container.clientHeight;
        const camera = new THREE.PerspectiveCamera(45, aspect, 0.05, 50);

        // Position camera at a 3/4 view — slightly right-of-center, elevated
        camera.position.set(rw * 0.9, 1.6, rd * 1.4);
        const lookTarget = new THREE.Vector3(rw * 0.45, 0.6, rd * 0.15);
        camera.lookAt(lookTarget);
        cameraRef.current = camera;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(lookTarget);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 0.5;
        controls.maxDistance = 12;
        controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor
        controls.minPolarAngle = 0.2; // Don't go completely top-down
        controls.panSpeed = 0.6;
        controls.rotateSpeed = 0.5;
        controls.zoomSpeed = 0.8;
        controls.update();
        controlsRef.current = controls;

        // Render loop
        const animate = () => {
            rafRef.current = requestAnimationFrame(animate);
            controls.update();
            if (sceneRef.current) {
                renderer.render(sceneRef.current, camera);
            }
        };
        animate();

        // Resize
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const {width, height} = entry.contentRect;
                if (width === 0 || height === 0) continue;
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height);
            }
        });
        resizeObserver.observe(container);

        // Click — use stable wrapper so renderer isn't torn down when handler changes
        const onCanvasClick = (e: MouseEvent) => handleClickRef.current(e);
        renderer.domElement.addEventListener('click', onCanvasClick);

        return () => {
            resizeObserver.disconnect();
            cancelAnimationFrame(rafRef.current);
            renderer.domElement.removeEventListener('click', onCanvasClick);
            controls.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
            rendererRef.current = null;
            cameraRef.current = null;
            controlsRef.current = null;
            clearTextureCache();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reposition camera when room dimensions change
    useEffect(() => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) return;

        const rw = roomConfig.roomWidth / 1000;
        const rd = roomConfig.roomDepth / 1000;

        camera.position.set(rw * 0.9, 1.6, rd * 1.4);
        const lookTarget = new THREE.Vector3(rw * 0.45, 0.6, rd * 0.15);
        controls.target.copy(lookTarget);
        controls.update();
    }, [roomConfig]);

    // Rebuild scene when plan/roomConfig changes
    useEffect(() => {
        if (sceneRef.current) {
            disposeScene(sceneRef.current);
        }

        if (!plan) {
            // Empty room scene — still show the room with nice lighting
            const emptyPlan: KitchenPlan = {
                walls: [],
                cornerModules: [],
                score: 0,
                scoreBreakdown: {
                    widthConsistency: 0,
                    moduleSweetSpot: 0,
                    ergonomicPlacement: 0,
                    fillerPenalty: 0,
                    symmetry: 0,
                    aestheticGrouping: 0,
                    visualComposition: 0,
                    workingTriangle: 0,
                    upperCoverage: 0,
                    cornerFit: 0,
                },
            };
            const {scene} = buildScene(emptyPlan, roomConfig, wallAnchors);
            sceneRef.current = scene;
            return;
        }

        const {scene, loadGlbModels} = buildScene(plan, roomConfig, wallAnchors);
        sceneRef.current = scene;

        // Async load real GLB models (procedural shown immediately as fallback)
        loadGlbModels();
    }, [plan, roomConfig, wallAnchors]);

    // Highlight selected module
    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) return;

        scene.traverse((object) => {
            if (object.userData?.moduleId) {
                const isSelected = object.userData.moduleId === selectedModuleId;
                setEmissive(object, isSelected ? HIGHLIGHT_EMISSIVE : DEFAULT_EMISSIVE);
            }
        });
    }, [selectedModuleId]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            style={{minHeight: 300}}
        />
    );
}

export default KitchenViewer;
