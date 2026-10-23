"""One-off script to generate simple circular placeholder icons for the
extension (icons/icon16.png, icon48.png, icon128.png). Not loaded by the
extension itself - safe to delete after running, or re-run if you want to
regenerate the icons.
"""
import struct
import zlib
import os

def make_png(width, height, rgba_bytes):
    def chunk(tag, data):
        c = tag + data
        return struct.pack("!I", len(data)) + c + struct.pack("!I", zlib.crc32(c) & 0xffffffff)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack("!IIBBBBB", width, height, 8, 6, 0, 0, 0)
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw += b"\x00" + rgba_bytes[y * stride:(y + 1) * stride]
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def circle_icon(size, fg=(46, 125, 50, 255), bg=(255, 255, 255, 0)):
    data = bytearray()
    r = size / 2
    cx = cy = size / 2
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx + 0.5, y - cy + 0.5
            if dx * dx + dy * dy <= r * r * 0.92:
                data += bytes(fg)
            else:
                data += bytes(bg)
    return bytes(data)


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in (16, 48, 128):
        png = make_png(size, size, circle_icon(size))
        with open(os.path.join(out_dir, f"icon{size}.png"), "wb") as f:
            f.write(png)
    print("Icons written to", out_dir)
