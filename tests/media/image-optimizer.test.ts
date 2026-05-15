/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { optimizeProfileImage } from "@/lib/media/image-optimizer";

/**
 * jsdom doesn't ship a real Canvas implementation. We stub `toDataURL` /
 * `getContext` / `drawImage` so the optimizer's resize + compression loop
 * is exercised without bringing in a heavy canvas polyfill. The values we
 * return are intentionally controlled so the test asserts on the
 * optimizer's logic, not on the underlying encoder's pixel output.
 */
function installCanvasStubs(jpegOutputs: string[]) {
  const queue = [...jpegOutputs];
  HTMLCanvasElement.prototype.getContext = function (
    contextId: string,
  ): CanvasRenderingContext2D | null {
    if (contextId !== "2d") return null;
    return {
      drawImage: () => {},
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "high",
    } as unknown as CanvasRenderingContext2D;
  };
  HTMLCanvasElement.prototype.toDataURL = function () {
    return queue.shift() ?? jpegOutputs[jpegOutputs.length - 1];
  };
}

function stubImageLoad(naturalWidth: number, naturalHeight: number) {
  // jsdom doesn't auto-fire onload for image URLs. Patch the Image
  // constructor so it resolves synchronously with the supplied size.
  const realImage = globalThis.Image;
  class StubImage {
    onload: (() => void) | null = null;
    onerror: ((err?: unknown) => void) | null = null;
    naturalWidth = naturalWidth;
    naturalHeight = naturalHeight;
    width = naturalWidth;
    height = naturalHeight;
    set src(_value: string) {
      // Fire async to mimic the real Image.
      queueMicrotask(() => this.onload?.());
    }
  }
  (globalThis as { Image: typeof Image }).Image = StubImage as unknown as typeof Image;
  return () => {
    (globalThis as { Image: typeof Image }).Image = realImage;
  };
}

function makeFile(type: string): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], "photo." + type.split("/")[1], { type });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("optimizeProfileImage — input validation", () => {
  it("returns null for an unsupported mime type", async () => {
    const file = makeFile("application/pdf");
    const result = await optimizeProfileImage(file);
    expect(result).toBeNull();
  });

  it("accepts jpeg, png, webp, gif, bmp, heic, heif by mime", async () => {
    const restore = stubImageLoad(800, 600);
    installCanvasStubs(["data:image/jpeg;base64,AAAA"]);
    for (const type of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/bmp",
      "image/heic",
      "image/heif",
    ]) {
      const result = await optimizeProfileImage(makeFile(type));
      expect(result).not.toBeNull();
    }
    restore();
  });
});

describe("optimizeProfileImage — compression + resize", () => {
  it("center-crops to a square and downsizes the long edge to the default cap", async () => {
    const restore = stubImageLoad(2000, 1200);
    installCanvasStubs(["data:image/jpeg;base64,AAAA"]);
    const result = await optimizeProfileImage(makeFile("image/jpeg"));
    expect(result).not.toBeNull();
    if (result) {
      // sourceEdge=1200, targetEdge=min(512, 1200)=512.
      expect(result.width).toBe(512);
      expect(result.height).toBe(512);
      expect(result.mimeType).toBe("image/jpeg");
    }
    restore();
  });

  it("never upscales: a small source image keeps its native edge", async () => {
    const restore = stubImageLoad(64, 64);
    installCanvasStubs(["data:image/jpeg;base64,AAAA"]);
    const result = await optimizeProfileImage(makeFile("image/jpeg"));
    expect(result).not.toBeNull();
    if (result) {
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    }
    restore();
  });

  it("steps the quality down until the encoded size is under the cap", async () => {
    const restore = stubImageLoad(2000, 2000);
    // First three encodes are too large, fourth fits.
    const big = "data:image/jpeg;base64," + "A".repeat(400_000);
    const fitting = "data:image/jpeg;base64," + "A".repeat(100_000);
    const calls: string[] = [];
    HTMLCanvasElement.prototype.getContext = function () {
      return {
        drawImage: () => {},
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "high",
      } as unknown as CanvasRenderingContext2D;
    };
    HTMLCanvasElement.prototype.toDataURL = function (_mime: string, q?: number) {
      calls.push(String(q));
      // First two returns are oversized; from the third on, return fitting.
      if (calls.length < 3) return big;
      return fitting;
    };
    const result = await optimizeProfileImage(makeFile("image/jpeg"), { maxBytes: 150 * 1024 });
    expect(result).not.toBeNull();
    // Quality starts at 0.85 and steps down by 0.1 until the size fits.
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(parseFloat(calls[0] ?? "0")).toBeGreaterThan(parseFloat(calls[2] ?? "0"));
    restore();
  });

  it("clamps maxEdge to the documented [64, 1024] range", async () => {
    const restore = stubImageLoad(2000, 2000);
    installCanvasStubs(["data:image/jpeg;base64,AAAA"]);
    const tooSmall = await optimizeProfileImage(makeFile("image/jpeg"), { maxEdge: 1 });
    expect(tooSmall?.width).toBe(64);
    const tooBig = await optimizeProfileImage(makeFile("image/jpeg"), { maxEdge: 99_999 });
    expect(tooBig?.width).toBe(1024);
    restore();
  });
});
