import os
import resvg_py
from PIL import Image

ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets'))

# Lucide Moon path: viewBox 0 0 24 24
# M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401
MOON_PATH = "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"

# 1. Master App Icon (1024x1024)
# Luxurious squircle background with radial depth, rich crimson-rose gradient crescent moon with drop shadow & star accent
ICON_SVG = f"""<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="45%" stop-color="#FFF5F6"/>
      <stop offset="100%" stop-color="#FFE4E9"/>
    </linearGradient>

    <!-- Subtle radial glow behind the moon -->
    <radialGradient id="aura" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FDA4AF" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="#FFE4E9" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#FFE4E9" stop-opacity="0"/>
    </radialGradient>

    <!-- Moon Crimson Gradient -->
    <linearGradient id="moonGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#E11D48"/>
      <stop offset="40%" stop-color="#BE123C"/>
      <stop offset="100%" stop-color="#9F1239"/>
    </linearGradient>

    <!-- Star Glow Gradient -->
    <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FB7185"/>
      <stop offset="100%" stop-color="#E11D48"/>
    </linearGradient>

    <!-- Soft Drop Shadow for the Moon -->
    <filter id="moonShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#881337" flood-opacity="0.22"/>
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#BE123C" flood-opacity="0.18"/>
    </filter>

    <filter id="starGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#BE123C" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Clean, modern solid/gradient background -->
  <rect width="1024" height="1024" fill="url(#bgGrad)"/>
  
  <!-- Subtle circular halo -->
  <circle cx="512" cy="512" r="380" fill="url(#aura)"/>

  <!-- Centered Moon Group (scale 24x24 to ~540x540 centered at 512,512) -->
  <!-- 540 / 24 = 22.5 scale; offset: 512 - 12*22.5 = 512 - 270 = 242 -->
  <g filter="url(#moonShadow)">
    <g transform="translate(242, 242) scale(22.5)">
      <!-- Filled crescent moon for solid app icon presence -->
      <path d="{MOON_PATH}"
            fill="url(#moonGrad)"
            stroke="url(#moonGrad)"
            stroke-width="0.8"
            stroke-linejoin="round"
            stroke-linecap="round"/>
      
      <!-- Sparkle/Celestial Star in the inner crescent curve -->
      <path d="M16.8 6.2 C16.8 7.3 17.1 7.7 18.2 7.7 C17.1 7.7 16.8 8.1 16.8 9.2 C16.8 8.1 16.5 7.7 15.4 7.7 C16.5 7.7 16.8 7.3 16.8 6.2 Z"
            fill="url(#starGrad)"
            filter="url(#starGlow)"/>

      <!-- Delicate secondary micro-star -->
      <path d="M19.2 11.2 C19.2 11.8 19.4 12.0 20.0 12.0 C19.4 12.0 19.2 12.2 19.2 12.8 C19.2 12.2 19.0 12.0 18.4 12.0 C19.0 12.0 19.2 11.8 19.2 11.2 Z"
            fill="#FB7185"
            opacity="0.85"/>
    </g>
  </g>
</svg>
"""

# 2. Android Adaptive Foreground (512x512)
# Safe zone is 66% (338px diameter centered at 256, 256).
# Scaled to fit comfortably inside the safe circle (target ~260px).
# 260 / 24 = 10.83 scale; offset: 256 - 12*10.83 = 126
FOREGROUND_SVG = f"""<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fgMoonGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#E11D48"/>
      <stop offset="40%" stop-color="#BE123C"/>
      <stop offset="100%" stop-color="#9F1239"/>
    </linearGradient>
    <linearGradient id="fgStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FB7185"/>
      <stop offset="100%" stop-color="#E11D48"/>
    </linearGradient>
    <filter id="fgShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#881337" flood-opacity="0.22"/>
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#BE123C" flood-opacity="0.18"/>
    </filter>
  </defs>

  <g filter="url(#fgShadow)">
    <g transform="translate(126, 126) scale(10.83)">
      <path d="{MOON_PATH}"
            fill="url(#fgMoonGrad)"
            stroke="url(#fgMoonGrad)"
            stroke-width="0.8"
            stroke-linejoin="round"
            stroke-linecap="round"/>
      
      <path d="M16.8 6.2 C16.8 7.3 17.1 7.7 18.2 7.7 C17.1 7.7 16.8 8.1 16.8 9.2 C16.8 8.1 16.5 7.7 15.4 7.7 C16.5 7.7 16.8 7.3 16.8 6.2 Z"
            fill="url(#fgStarGrad)"/>

      <path d="M19.2 11.2 C19.2 11.8 19.4 12.0 20.0 12.0 C19.4 12.0 19.2 12.2 19.2 12.8 C19.2 12.2 19.0 12.0 18.4 12.0 C19.0 12.0 19.2 11.8 19.2 11.2 Z"
            fill="#FB7185"
            opacity="0.85"/>
    </g>
  </g>
</svg>
"""

# 3. Android Adaptive Background (512x512)
BACKGROUND_SVG = """<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgAdaptive" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#FFF1F3"/>
      <stop offset="100%" stop-color="#FFE4E9"/>
    </linearGradient>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FDA4AF" stop-opacity="0.3"/>
      <stop offset="70%" stop-color="#FFE4E9" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#FFE4E9" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bgAdaptive)"/>
  <circle cx="256" cy="256" r="220" fill="url(#bgGlow)"/>
</svg>
"""

# 4. Android Themed / Monochrome Icon (432x432)
# Material You monochrome icon uses white fill on transparent background
MONOCHROME_SVG = f"""<svg width="432" height="432" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(106, 106) scale(9.166)">
    <path d="{MOON_PATH}"
          fill="#FFFFFF"
          stroke="#FFFFFF"
          stroke-width="0.8"
          stroke-linejoin="round"
          stroke-linecap="round"/>
    <path d="M16.8 6.2 C16.8 7.3 17.1 7.7 18.2 7.7 C17.1 7.7 16.8 8.1 16.8 9.2 C16.8 8.1 16.5 7.7 15.4 7.7 C16.5 7.7 16.8 7.3 16.8 6.2 Z"
          fill="#FFFFFF"/>
  </g>
</svg>
"""

# 5. Splash Screen Icon (1024x1024)
# Matches <Moon color="#BE123C" size={48} /> with subtle glow and crimson fill
SPLASH_SVG = f"""<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="splashMoonGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#E11D48"/>
      <stop offset="50%" stop-color="#BE123C"/>
      <stop offset="100%" stop-color="#9F1239"/>
    </linearGradient>
    <filter id="splashShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#881337" flood-opacity="0.25"/>
    </filter>
  </defs>

  <g filter="url(#splashShadow)">
    <g transform="translate(262, 262) scale(20.83)">
      <path d="{MOON_PATH}"
            fill="url(#splashMoonGrad)"
            stroke="url(#splashMoonGrad)"
            stroke-width="0.8"
            stroke-linejoin="round"
            stroke-linecap="round"/>
      
      <path d="M16.8 6.2 C16.8 7.3 17.1 7.7 18.2 7.7 C17.1 7.7 16.8 8.1 16.8 9.2 C16.8 8.1 16.5 7.7 15.4 7.7 C16.5 7.7 16.8 7.3 16.8 6.2 Z"
            fill="#FB7185"/>
    </g>
  </g>
</svg>
"""

def generate():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    
    files = [
        ('icon.png', ICON_SVG),
        ('android-icon-foreground.png', FOREGROUND_SVG),
        ('android-icon-background.png', BACKGROUND_SVG),
        ('android-icon-monochrome.png', MONOCHROME_SVG),
        ('splash-icon.png', SPLASH_SVG),
    ]

    for filename, svg in files:
        target_path = os.path.join(ASSETS_DIR, filename)
        png_bytes = resvg_py.svg_to_bytes(svg)
        with open(target_path, 'wb') as f:
            f.write(png_bytes)
        print(f"Generated {filename}: {len(png_bytes):,} bytes")

    # Generate favicon (48x48) from icon.png
    icon_path = os.path.join(ASSETS_DIR, 'icon.png')
    favicon_path = os.path.join(ASSETS_DIR, 'favicon.png')
    im = Image.open(icon_path)
    favicon = im.resize((48, 48), Image.Resampling.LANCZOS)
    favicon.save(favicon_path, format='PNG')
    print("Generated favicon.png: 48x48")

    # Also update Android native mipmap resources if android directory exists
    res_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res'))
    if os.path.exists(res_dir):
        densities = {
            'mipmap-mdpi': (48, 108),
            'mipmap-hdpi': (72, 162),
            'mipmap-xhdpi': (96, 216),
            'mipmap-xxhdpi': (144, 324),
            'mipmap-xxxhdpi': (192, 432),
        }

        fg_im = Image.open(os.path.join(ASSETS_DIR, 'android-icon-foreground.png'))
        bg_im = Image.open(os.path.join(ASSETS_DIR, 'android-icon-background.png'))
        mono_im = Image.open(os.path.join(ASSETS_DIR, 'android-icon-monochrome.png'))

        for folder, (icon_size, adapt_size) in densities.items():
            dest_dir = os.path.join(res_dir, folder)
            os.makedirs(dest_dir, exist_ok=True)

            # Legacy full icon (ic_launcher.png and ic_launcher_round.png)
            im.resize((icon_size, icon_size), Image.Resampling.LANCZOS).save(os.path.join(dest_dir, 'ic_launcher.png'))
            im.resize((icon_size, icon_size), Image.Resampling.LANCZOS).save(os.path.join(dest_dir, 'ic_launcher_round.png'))

            # Adaptive layers
            fg_im.resize((adapt_size, adapt_size), Image.Resampling.LANCZOS).save(os.path.join(dest_dir, 'ic_launcher_foreground.png'))
            bg_im.resize((adapt_size, adapt_size), Image.Resampling.LANCZOS).save(os.path.join(dest_dir, 'ic_launcher_background.png'))
            mono_im.resize((adapt_size, adapt_size), Image.Resampling.LANCZOS).save(os.path.join(dest_dir, 'ic_launcher_monochrome.png'))

        print(f"Updated Android native mipmap folders in {res_dir}")

if __name__ == '__main__':
    generate()
