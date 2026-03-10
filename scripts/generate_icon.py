"""Generate a Pomodoro app icon - tomato with timer arc."""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

def draw_icon(size):
    """Draw a beautiful pomodoro icon at the given size."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size / 2, size / 2
    margin = size * 0.08
    r = size / 2 - margin

    # Shadow (subtle)
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    shadow_offset = size * 0.02
    sd.ellipse(
        [cx - r + shadow_offset, cy - r + shadow_offset * 2,
         cx + r + shadow_offset, cy + r + shadow_offset * 2],
        fill=(0, 0, 0, 50)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size * 0.03))
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)

    # Main circle - rich tomato red gradient effect
    # Base circle
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(220, 60, 70))

    # Gradient overlay: lighter at top-left, darker at bottom-right
    gradient = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gradient)
    # Highlight
    hr = r * 0.85
    gd.ellipse(
        [cx - hr - r * 0.15, cy - hr - r * 0.2,
         cx + hr - r * 0.15, cy + hr - r * 0.2],
        fill=(255, 100, 100, 60)
    )
    gradient = gradient.filter(ImageFilter.GaussianBlur(radius=r * 0.5))
    # Mask to circle
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    gradient.putalpha(mask)
    img = Image.alpha_composite(img, gradient)
    draw = ImageDraw.Draw(img)

    # Stem at top
    stem_w = size * 0.03
    stem_h = size * 0.1
    stem_x = cx
    stem_top = cy - r - stem_h * 0.3
    # Stem
    draw.rounded_rectangle(
        [stem_x - stem_w, stem_top, stem_x + stem_w, cy - r + stem_h * 0.5],
        radius=stem_w,
        fill=(80, 140, 60)
    )
    # Leaf
    leaf_pts = []
    for angle_deg in range(0, 361, 5):
        a = math.radians(angle_deg)
        # Leaf shape using parametric
        lr = size * 0.07 * math.sin(a)
        lx = stem_x + size * 0.02 + lr * math.cos(a + 0.8)
        ly = stem_top + stem_h * 0.4 + lr * math.sin(a + 0.8) * 0.6
        leaf_pts.append((lx, ly))
    if len(leaf_pts) > 2:
        draw.polygon(leaf_pts, fill=(90, 160, 65))

    # Timer arc inside - white arc showing ~75% progress
    arc_r = r * 0.52
    arc_width = size * 0.045

    # Track (faint white circle)
    draw.arc(
        [cx - arc_r, cy - arc_r + size * 0.03,
         cx + arc_r, cy + arc_r + size * 0.03],
        0, 360,
        fill=(255, 255, 255, 40),
        width=max(1, int(arc_width))
    )

    # Progress arc (bright white, 270 degrees = 75%)
    draw.arc(
        [cx - arc_r, cy - arc_r + size * 0.03,
         cx + arc_r, cy + arc_r + size * 0.03],
        -90, 180,
        fill=(255, 255, 255, 220),
        width=max(1, int(arc_width))
    )

    # Small dot at arc end
    dot_r = arc_width * 0.55
    # Dot at 180 degrees (bottom of arc at 270 deg sweep from -90)
    dot_angle = math.radians(180)
    dot_x = cx + arc_r * math.cos(dot_angle)
    dot_y = (cy + size * 0.03) + arc_r * math.sin(dot_angle)
    draw.ellipse(
        [dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r],
        fill=(255, 255, 255, 230)
    )

    # Center dot
    center_r = size * 0.025
    draw.ellipse(
        [cx - center_r, cy - center_r + size * 0.03,
         cx + center_r, cy + center_r + size * 0.03],
        fill=(255, 255, 255, 200)
    )

    return img


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    iconset_dir = os.path.join(base_dir, 'build', 'icon.iconset')
    os.makedirs(iconset_dir, exist_ok=True)

    # macOS iconset sizes
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    filenames = {
        16:   'icon_16x16.png',
        32:   'icon_16x16@2x.png',
        64:   'icon_32x32@2x.png',
        128:  'icon_128x128.png',
        256:  'icon_128x128@2x.png',
        512:  'icon_512x512.png',
        1024: 'icon_512x512@2x.png',
    }

    # Also need 32x32 (non-retina)
    extra = {32: 'icon_32x32.png', 256: 'icon_256x256.png', 512: 'icon_256x256@2x.png'}

    all_sizes = {}
    all_sizes.update(filenames)
    all_sizes.update(extra)

    # Generate at highest res and scale down
    icon_1024 = draw_icon(1024)

    for sz, fname in sorted(all_sizes.items()):
        if sz == 1024:
            icon = icon_1024
        else:
            icon = icon_1024.resize((sz, sz), Image.LANCZOS)
        path = os.path.join(iconset_dir, fname)
        icon.save(path, 'PNG')
        print(f"  {fname} ({sz}x{sz})")

    # Also save icon.png for electron-builder (256x256)
    icon_png = os.path.join(base_dir, 'build', 'icon.png')
    icon_1024.resize((256, 256), Image.LANCZOS).save(icon_png, 'PNG')
    print(f"  icon.png (256x256)")

    print(f"\nIconset created at: {iconset_dir}")
    print("Run: iconutil -c icns build/icon.iconset -o build/icon.icns")


if __name__ == '__main__':
    main()
