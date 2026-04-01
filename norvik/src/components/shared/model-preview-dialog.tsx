import { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { disposeScene } from "@/components/viewer3d/dispose";
import { proxyGlbUrl, gltfLoader, enableShadows } from "@/components/viewer3d/three-utils";
import { createLowerCabinet, createUpperCabinet, createCornerCabinet, createTallCabinet } from "@/components/viewer3d/procedural-models";
import type { CabinetRead } from "@/types/entities";
import { CabinetKind, CabinetSubtype, CabinetType } from "@/types/enums";
import { capitalize } from "@/lib/utils";
import { Box, Ruler, DollarSign, Layers, Tag, Cuboid } from "lucide-react";


interface ModelPreviewDialogProps {
  cabinet: CabinetRead | null;
  onOpenChange: (open: boolean) => void;
}

interface ModelViewerProps {
  glbUrl: string | null;
  width: number;
  height: number;
  depth: number;
  cabinetType: CabinetType;
  cabinetKind: CabinetKind;
  cabinetSubtype: CabinetSubtype;
  isCorner: boolean;
}

function ModelViewer({
  glbUrl,
  width,
  height,
  depth,
  cabinetType,
  cabinetKind,
  cabinetSubtype,
  isCorner,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();

    // Lights — studio setup
    scene.add(new THREE.AmbientLight(0xfff5ee, 0.6));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(2, 3, 2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff0e0, 0.4);
    fillLight.position.set(-2, 2, -1);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xe0e8ff, 0.3);
    rimLight.position.set(0, 1, -3);
    scene.add(rimLight);

    // Ground plane — subtle shadow catcher
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.ShadowMaterial({ opacity: 0.15 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.01, 20);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.3;
    controls.maxDistance = 5;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.8;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    // Render loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObserver.observe(container);

    // Fit camera to bounding box
    const fitCamera = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const distance = maxDim * 2.2;

      controls.target.copy(center);
      camera.position.set(
        center.x + distance * 0.7,
        center.y + distance * 0.5,
        center.z + distance * 0.7,
      );
      controls.update();
    };

    const addProcedural = () => {
      let model: THREE.Group;
      if (isCorner) {
        model = createCornerCabinet(width, depth, height);
      } else {
        switch (cabinetType) {
          case CabinetType.UPPER:
            model = createUpperCabinet(width, depth, height);
            break;
          case CabinetType.TALL:
            model = createTallCabinet(width, depth, height);
            break;
          default:
            model = createLowerCabinet(width, depth, height, {
              includeCountertop: !(
                cabinetKind === CabinetKind.SINK &&
                cabinetSubtype === CabinetSubtype.SINK_BASE
              ),
            });
            break;
        }
      }
      scene.add(model);
      fitCamera(model);
    };

    // Load model or create procedural
    if (glbUrl) {
      gltfLoader.load(
        proxyGlbUrl(glbUrl),
        (gltf) => {
          enableShadows(gltf.scene);
          scene.add(gltf.scene);
          fitCamera(gltf.scene);
        },
        undefined,
        addProcedural,
      );
    } else {
      addProcedural();
    }

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(rafRef.current);
      controls.dispose();
      disposeScene(scene);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
    };
  }, [glbUrl, width, height, depth, cabinetType, cabinetKind, cabinetSubtype, isCorner]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab active:cursor-grabbing rounded-xl"
      style={{ minHeight: 320 }}
    />
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export function ModelPreviewDialog({
  cabinet,
  onOpenChange,
}: ModelPreviewDialogProps) {
  if (!cabinet) return null;

  const hasGlb = !!cabinet.glb_file;

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] h-full">
          {/* 3D Viewer */}
          <div className="relative bg-gradient-to-br from-stone-100 to-stone-50 min-h-[320px] md:min-h-[480px]">
            <ModelViewer
              glbUrl={cabinet.glb_file}
              width={cabinet.width}
              height={cabinet.height}
              depth={cabinet.depth}
              cabinetType={cabinet.type}
              cabinetKind={cabinet.kind}
              cabinetSubtype={cabinet.subtype}
              isCorner={cabinet.is_corner}
            />

            {/* Floating badge */}
            <div className={`absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm px-3 py-1.5 text-xs font-medium shadow-sm ${hasGlb ? "text-foreground" : "text-muted-foreground"}`}>
              {hasGlb ? <Cuboid className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />}
              {hasGlb ? "3D Модель" : "Предпросмотр"}
            </div>
          </div>

          {/* Details panel */}
          <div className="flex flex-col border-l border-border/60 p-6 overflow-y-auto">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl">{cabinet.article}</DialogTitle>
              <DialogDescription className="sr-only">
                Предпросмотр и детали модели шкафа
              </DialogDescription>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary" className="rounded-md">
                  {capitalize(cabinet.kind)}
                </Badge>
                <Badge variant="outline" className="rounded-md">
                  {capitalize(cabinet.type)}
                </Badge>
                {cabinet.inbuilt && (
                  <Badge className="rounded-md">Встроенный</Badge>
                )}
              </div>
            </DialogHeader>

            <Separator className="my-2" />

            <div className="flex-1 space-y-0.5">
              <DetailRow
                icon={<Ruler className="h-4 w-4" />}
                label="Размеры"
                value={`${cabinet.width} x ${cabinet.height} x ${cabinet.depth} mm`}
              />
              <DetailRow
                icon={<DollarSign className="h-4 w-4" />}
                label="Цена"
                value={`$${cabinet.price}`}
              />
              <DetailRow
                icon={<Tag className="h-4 w-4" />}
                label="Подтип"
                value={capitalize(cabinet.subtype)}
              />
              <DetailRow
                icon={<Layers className="h-4 w-4" />}
                label="Категория"
                value={`#${cabinet.category_id}`}
              />

              {cabinet.description && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                      Описание
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {cabinet.description}
                    </p>
                  </div>
                </>
              )}
            </div>

            <Separator className="my-3" />

            <div className="flex items-center justify-between text-xs text-muted-foreground/60">
              <span>ID #{cabinet.id}</span>
              {cabinet.created_at && (
                <span>
                  {new Date(cabinet.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
