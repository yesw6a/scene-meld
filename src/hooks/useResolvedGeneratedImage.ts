import { useEffect, useState } from "react";

import { loadGeneratedImage } from "../lib/studio-db";

interface GeneratedImageReference {
  imageId?: string;
  imageDataUrl?: string;
}

export interface ResolvedGeneratedImage {
  url: string;
  blob?: Blob;
}

export default function useResolvedGeneratedImage(
  reference: GeneratedImageReference | null | undefined,
): {
  image: ResolvedGeneratedImage | null;
  failed: boolean;
} {
  const [image, setImage] = useState<ResolvedGeneratedImage | null>(() =>
    reference?.imageDataUrl ? { url: reference.imageDataUrl } : null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (reference?.imageDataUrl) {
      setImage({ url: reference.imageDataUrl });
      setFailed(false);
      return;
    }

    if (!reference?.imageId) {
      setImage(null);
      setFailed(Boolean(reference));
      return;
    }

    let active = true;
    let objectUrl: string | undefined;
    setImage(null);
    setFailed(false);

    void loadGeneratedImage(reference.imageId)
      .then((blob) => {
        if (!blob) {
          throw new Error("missing image");
        }
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setImage({ url: objectUrl, blob });
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [reference?.imageDataUrl, reference?.imageId]);

  return { image, failed };
}
