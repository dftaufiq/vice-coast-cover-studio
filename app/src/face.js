// Vice Coast Cover Studio — face-aware cropping.
// When the browser offers the FaceDetector API, the biggest detected face
// becomes the panel's focus point, so a crop keeps the face in frame. Where
// it is unavailable (or finds no face), a heuristic focus in the upper third
// of the photo stands in: portraits put faces there.

export function heuristicFocus() {
  return { x: 0.5, y: 0.35 };
}

export function faceDetectorAvailable() {
  return typeof window !== 'undefined' && 'FaceDetector' in window;
}

async function detectLargestFace(image) {
  const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
  const faces = await detector.detect(image);
  if (!faces || faces.length === 0) return null;
  let best = null;
  let bestArea = 0;
  faces.forEach((face) => {
    const box = face.boundingBox;
    const area = box.width * box.height;
    if (area > bestArea) {
      bestArea = area;
      best = box;
    }
  });
  if (!best) return null;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  return {
    x: (best.x + best.width / 2) / width,
    y: (best.y + best.height / 2) / height,
  };
}

// Find the focus point for a photo: a real face when one is detected,
// otherwise the upper-third heuristic. Never throws.
export async function focusPointForPhoto(image) {
  if (faceDetectorAvailable()) {
    try {
      const face = await detectLargestFace(image);
      if (face) return { ...face, faceFound: true };
    } catch {
      // Detection is a progressive enhancement; a failure falls through.
    }
  }
  return { ...heuristicFocus(), faceFound: false };
}
