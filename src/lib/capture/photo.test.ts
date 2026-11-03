import { describe, it, expect } from "vitest";
import { preparePhoto, isImageFile, PhotoTypeError } from "./photo";

function imageFile(type = "image/jpeg", bytes = [1, 2, 3]): File {
  return new File([new Uint8Array(bytes)], "photo.jpg", { type });
}

describe("isImageFile (FR5)", () => {
  it("accepts image mime types", () => {
    expect(isImageFile(imageFile("image/jpeg"))).toBe(true);
    expect(isImageFile(imageFile("image/png"))).toBe(true);
  });

  it("rejects non-image mime types", () => {
    const pdf = new File([new Uint8Array([1])], "x.pdf", {
      type: "application/pdf",
    });
    expect(isImageFile(pdf)).toBe(false);
  });
});

describe("preparePhoto (FR5)", () => {
  it("returns a Blob for a valid image", async () => {
    const blob = await preparePhoto(imageFile("image/png", [9, 9, 9]));
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
  });

  it("preserves the image bytes when no downscale is possible", async () => {
    const file = imageFile("image/jpeg", [4, 5, 6, 7]);
    const blob = await preparePhoto(file);
    expect(blob.size).toBe(file.size);
  });

  it("rejects a non-image file with PhotoTypeError", async () => {
    const txt = new File([new Uint8Array([1])], "note.txt", {
      type: "text/plain",
    });
    await expect(preparePhoto(txt)).rejects.toBeInstanceOf(PhotoTypeError);
  });
});
