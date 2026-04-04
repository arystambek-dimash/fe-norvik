import {forwardRef, useRef, useEffect, useCallback, useImperativeHandle} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {KitchenPlan} from '@/algorithm/types';
import {EMPTY_SCORE_BREAKDOWN} from '@/algorithm/scoring';
import {buildScene, type RoomConfig, type WallAnchors} from './scene-builder';
import {disposeScene} from './dispose';
import {clearTextureCache} from './texture-factory';
import {countertopMaterial, facadeMaterial} from './procedural-models';
import defaultCountertopTextureUrl from '@/textures/дуб вотан.png';

interface KitchenViewerProps {
    plan: KitchenPlan | null;
    roomConfig: RoomConfig;
    wallAnchors?: WallAnchors[];
    selectedModuleId: string | null;
    fridgeSide?: 'left' | 'right';
    onSelectModule: (id: string | null) => void;
    onSelectCountertop?: () => void;
    countertopColor?: string | null;
    countertopTextureUrl?: string | null;
    facadeColor?: string | null;
    facadeTextureUrl?: string | null;
}

export interface KitchenViewerHandle {
    captureReferenceImage: () => Promise<string>;
}

const HIGHLIGHT_EMISSIVE = new THREE.Color(0x4488ff);
const DEFAULT_EMISSIVE = new THREE.Color(0x000000);
const PHOTO_CAPTURE_WIDTH = 1280;
const PHOTO_CAPTURE_HEIGHT = 1024;

function setEmissive(object: THREE.Object3D, color: THREE.Color): void {
    object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            material.emissive.copy(color);
            material.emissiveIntensity = color.equals(DEFAULT_EMISSIVE) ? 0 : 0.3;
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

function findCountertopMesh(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
        if (current.userData?.isCountertop) return true;
        current = current.parent;
    }
    return false;
}

function isSceneAnnotation(object: THREE.Object3D): boolean {
    return Boolean(object.userData?.isSceneLabel) || object.name.startsWith('label-');
}

function getCaptureView(roomConfig: RoomConfig, fridgeSide: 'left' | 'right' = 'right') {
    const rw = roomConfig.roomWidth / 1000;
    const rd = roomConfig.roomDepth / 1000;
    const wallHeight = roomConfig.wallHeight / 1000;

    // Service capture should read like a straight-on catalog shot,
    // not the interactive 3/4 overview used in the main viewer.
    const compositionBias = fridgeSide === 'right' ? 0.06 : -0.06;
    const axisX = THREE.MathUtils.clamp(rw * (0.5 + compositionBias), rw * 0.42, rw * 0.58);

    const cameraY = Math.max(1.42, wallHeight * 0.5);
    const cameraZ = Math.max(rd * 1.7, rw * 1.15, 3.6);

    const targetY = Math.max(1.0, wallHeight * 0.39);
    const targetZ = rd * 0.12;

    return {
        position: new THREE.Vector3(axisX, cameraY, cameraZ),
        target: new THREE.Vector3(axisX, targetY, targetZ),
    };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Failed to capture viewer image.'));
                return;
            }
            resolve(blob);
        }, type, quality);
    });
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result !== 'string') {
                reject(new Error('Failed to read captured image.'));
                return;
            }
            resolve(reader.result);
        };
        reader.onerror = () => reject(new Error('Failed to read captured image.'));
        reader.readAsDataURL(blob);
    });
}

export const KitchenViewer = forwardRef<KitchenViewerHandle, KitchenViewerProps>(function KitchenViewer({
    plan,
    roomConfig,
    wallAnchors,
    selectedModuleId,
    fridgeSide = 'right',
    onSelectModule,
    onSelectCountertop,
    countertopColor,
    countertopTextureUrl,
    facadeColor,
    facadeTextureUrl,
}, ref) {
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
                // Check if countertop was clicked
                if (findCountertopMesh(intersects[0].object)) {
                    onSelectModule(null);
                    onSelectCountertop?.();
                    return;
                }
                const moduleGroup = findModuleGroup(intersects[0].object);
                if (moduleGroup) {
                    onSelectModule(moduleGroup.userData.moduleId as string);
                    return;
                }
            }

            onSelectModule(null);
        },
        [onSelectModule, onSelectCountertop],
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
            preserveDrawingBuffer: true,
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
                scoreBreakdown: EMPTY_SCORE_BREAKDOWN,
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

    // Apply countertop color/texture via the shared material
    useEffect(() => {
        const textureUrl = countertopTextureUrl ?? defaultCountertopTextureUrl;
        if (!countertopColor) {
            new THREE.TextureLoader().load(textureUrl, (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(2, 2);
                countertopMaterial.map = texture;
                countertopMaterial.color.setHex(0xffffff);
                countertopMaterial.needsUpdate = true;
            });
        } else {
            countertopMaterial.map = null;
            countertopMaterial.color.set(countertopColor);
            countertopMaterial.needsUpdate = true;
        }
    }, [countertopColor, countertopTextureUrl]);

    // Apply facade (door) color/texture via the shared material
    useEffect(() => {
        if (facadeTextureUrl) {
            new THREE.TextureLoader().load(facadeTextureUrl, (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(2, 2);
                facadeMaterial.map = texture;
                facadeMaterial.color.setHex(0xffffff);
                facadeMaterial.needsUpdate = true;
            });
        } else if (facadeColor) {
            facadeMaterial.map = null;
            facadeMaterial.color.set(facadeColor);
            facadeMaterial.needsUpdate = true;
        } else {
            facadeMaterial.map = null;
            facadeMaterial.color.setHex(0xFFFFFF);
            facadeMaterial.needsUpdate = true;
        }
    }, [facadeColor, facadeTextureUrl]);

    const captureReferenceImage = useCallback(async () => {
        const container = containerRef.current;
        const renderer = rendererRef.current;
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        const scene = sceneRef.current;
        if (!container || !renderer || !camera || !controls || !scene) {
            throw new Error('3D viewer is not ready yet.');
        }

        const previousPosition = camera.position.clone();
        const previousTarget = controls.target.clone();
        const previousControlsEnabled = controls.enabled;
        const previousPixelRatio = renderer.getPixelRatio();
        const annotationVisibility: Array<{ object: THREE.Object3D; visible: boolean }> = [];

        scene.traverse((object) => {
            if (isSceneAnnotation(object)) {
                annotationVisibility.push({object, visible: object.visible});
                object.visible = false;
            }

            if (object.userData?.moduleId) {
                setEmissive(object, DEFAULT_EMISSIVE);
            }
        });

        const captureView = getCaptureView(roomConfig, fridgeSide);
        const renderWidth = container.clientWidth;
        const renderHeight = container.clientHeight;

        controls.enabled = false;
        camera.aspect = PHOTO_CAPTURE_WIDTH / PHOTO_CAPTURE_HEIGHT;
        camera.updateProjectionMatrix();
        camera.position.copy(captureView.position);
        controls.target.copy(captureView.target);
        controls.update();

        renderer.setPixelRatio(1);
        renderer.setSize(PHOTO_CAPTURE_WIDTH, PHOTO_CAPTURE_HEIGHT, false);
        renderer.render(scene, camera);

        try {
            const blob = await canvasToBlob(renderer.domElement, 'image/jpeg', 0.95);
            return await blobToDataUrl(blob);
        } finally {
            camera.aspect = renderWidth / Math.max(renderHeight, 1);
            camera.updateProjectionMatrix();
            camera.position.copy(previousPosition);
            controls.target.copy(previousTarget);
            controls.enabled = previousControlsEnabled;
            controls.update();

            renderer.setPixelRatio(previousPixelRatio);
            renderer.setSize(renderWidth, renderHeight, false);

            for (const {object, visible} of annotationVisibility) {
                object.visible = visible;
            }

            scene.traverse((object) => {
                if (object.userData?.moduleId) {
                    const isSelected = object.userData.moduleId === selectedModuleId;
                    setEmissive(object, isSelected ? HIGHLIGHT_EMISSIVE : DEFAULT_EMISSIVE);
                }
            });

            renderer.render(scene, camera);
        }
    }, [fridgeSide, roomConfig, selectedModuleId]);

    useImperativeHandle(ref, () => ({
        captureReferenceImage,
    }), [captureReferenceImage]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            style={{minHeight: 300}}
        />
    );
});

KitchenViewer.displayName = 'KitchenViewer';

export default KitchenViewer;
