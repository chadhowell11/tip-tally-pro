import { useEffect, useState } from "react";
import { resolveLogoUrl } from "@/lib/location";

/** Colors pulled from an establishment's logo, used to theme printed reports. */
export type Brand = {
  logoUrl: string | null;
  /** Main accent (headers, rules). */
  primary: string;
  /** Readable text color on top of `primary`. */
  onPrimary: string;
  /** Very light tint of the accent, safe as a table/section background. */
  soft: string;
  /** Secondary accent for small labels. */
  accent: string;
};

const DEFAULT_BRAND: Brand = {
  logoUrl: null,
  primary: "#1f2937",
  onPrimary: "#ffffff",
  soft: "#f3f4f6",
  accent: "#4b5563",
};

const luminance = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Darken/lighten so the accent always reads on white paper. */
function normalize(r: number, g: number, b: number): [number, number, number] {
  let lum = luminance(r, g, b);
  let f = 1;
  if (lum > 0.62) f = 0.62 / lum; // too pale for text
  if (lum < 0.12) f = 0.12 / Math.max(lum, 0.01); // nearly black
  const out: [number, number, number] = [r * f, g * f, b * f];
  lum = luminance(out[0], out[1], out[2]);
  return out;
}

/**
 * Pick the two most-used meaningful colors in an image. Near-white, near-black
 * and washed-out pixels are ignored so a logo on a white background still
 * yields its brand color.
 */
function extractPalette(img: HTMLImageElement): { primary: string; accent: string; soft: string } | null {
  const size = 56;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null; // cross-origin image, cannot read pixels
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 160) continue;
    const lum = luminance(r, g, b);
    if (lum > 0.93 || lum < 0.06) continue;
    if (saturation(r, g, b) < 0.18 && lum > 0.55) continue;
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const cur = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    buckets.set(key, { count: cur.count + 1, r: cur.r + r, g: cur.g + g, b: cur.b + b });
  }
  if (buckets.size === 0) return null;

  const sorted = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map((x) => normalize(x.r / x.count, x.g / x.count, x.b / x.count));

  const [pr, pg, pb] = sorted[0];
  const second = sorted[1] ?? sorted[0];
  return {
    primary: hex(pr, pg, pb),
    accent: hex(second[0], second[1], second[2]),
    // 8% accent over white — light enough to print behind text.
    soft: hex(255 - (255 - pr) * 0.1, 255 - (255 - pg) * 0.1, 255 - (255 - pb) * 0.1),
  };
}

/**
 * Resolves the establishment logo and derives report colors from it.
 * Falls back to neutral colors when there is no logo (or it cannot be read).
 */
export function useBrand(logoValue: string | null | undefined): Brand {
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);

  useEffect(() => {
    let cancelled = false;
    if (!logoValue) {
      setBrand(DEFAULT_BRAND);
      return;
    }
    (async () => {
      const url = await resolveLogoUrl(logoValue);
      if (cancelled || !url) return;
      setBrand((b) => ({ ...b, logoUrl: url }));
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        const palette = extractPalette(img);
        if (!palette) return;
        setBrand({
          logoUrl: url,
          primary: palette.primary,
          accent: palette.accent,
          soft: palette.soft,
          onPrimary: "#ffffff",
        });
      };
      img.src = url;
    })();
    return () => {
      cancelled = true;
    };
  }, [logoValue]);

  return brand;
}
