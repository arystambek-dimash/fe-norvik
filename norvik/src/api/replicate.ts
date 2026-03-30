import { apiClient } from "./client";

const REPLICATE_REFERENCE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

interface GenerateKitchenPhotoOptions {
    imageDataUrl: string;
    prompt: string;
    signal?: AbortSignal;
    onStatusChange?: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildKitchenPhotoPrompt(extraInstructions: string): string {
    return [
        'Photorealistic interior photograph of a kitchen.',
        'Keep the exact same cabinet layout, number of cabinets, proportions, countertop shape, appliance positions, and camera angle as the reference image — do not add, remove, or rearrange any element.',
        'Apply realistic materials: natural wood grain on facades, polished stone or laminate countertop, brushed metal handles, tiled backsplash.',
        'Soft warm natural light from a window on the left, gentle ambient occlusion shadows under cabinets, subtle reflections on glossy surfaces.',
        'Clean white or light grey walls, realistic wooden or tiled floor.',
        'Remove all floating text labels, UI tags, wireframe edges, and any 3D-software artifacts.',
        'Professional architectural interior photo, shot on a full-frame camera with a 24mm lens, shallow depth of field.',
        extraInstructions.trim(),
    ]
        .filter(Boolean)
        .join(' ');
}

// ---------------------------------------------------------------------------
// Image utilities
// ---------------------------------------------------------------------------
function dataUrlSizeInBytes(dataUrl: string): number {
    const base64Payload = dataUrl.split(',')[1] ?? '';
    return Math.ceil((base64Payload.length * 3) / 4);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to prepare the screenshot for Replicate.'));
        image.src = dataUrl;
    });
}


export async function prepareReferenceImageForReplicate(
    sourceDataUrl: string,
    maxBytes = REPLICATE_REFERENCE_IMAGE_MAX_BYTES,
): Promise<string> {
    if (dataUrlSizeInBytes(sourceDataUrl) <= maxBytes) {
        return sourceDataUrl;
    }

    const image = await loadImage(sourceDataUrl);
    const aspectRatio = image.width / Math.max(image.height, 1);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Canvas 2D context is unavailable.');
    }

    const widths = [1280, 1152, 1024, 896, 768, 640];
    const qualities = [0.92, 0.85, 0.78, 0.70, 0.62];

    let bestCandidate = sourceDataUrl;

    for (const width of widths) {
        const height = Math.round(width / aspectRatio);
        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        for (const quality of qualities) {
            const candidate = canvas.toDataURL('image/jpeg', quality);
            if (dataUrlSizeInBytes(candidate) <= maxBytes) {
                return candidate;
            }
            bestCandidate = candidate;
        }
    }

    return bestCandidate;
}

// ---------------------------------------------------------------------------
// Photo generation (calls backend)
// ---------------------------------------------------------------------------

export async function generateKitchenPhoto(
    {
        imageDataUrl,
        prompt,
        signal,
        onStatusChange,
    }: GenerateKitchenPhotoOptions): Promise<string> {

    onStatusChange?.('Отправляем запрос на сервер...');

    const response = await apiClient.post(
        "/generation/photo",
        { image: imageDataUrl, prompt },
        { responseType: "blob", signal, timeout: 120_000 },
    );

    const blob = response.data as Blob;
    return URL.createObjectURL(blob);
}
