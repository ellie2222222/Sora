import fs from 'node:fs';
import path from 'node:path';
import Jimp from 'jimp-compact';
import ImageTracer from 'imagetracerjs';

const sourceJpg = 'D:/Downloads/bdbaf084-2d2d-4ff3-9f31-635c2e104682.jpg';
const downloadsDir = 'D:/Downloads';

const rootDir = process.cwd();
const rootAssetsDir = path.join(rootDir, 'assets');
const mobileAssetsDir = path.join(rootDir, 'mobile', 'assets');
const androidResDir = path.join(rootDir, 'mobile', 'android', 'app', 'src', 'main', 'res');

fs.mkdirSync(rootAssetsDir, { recursive: true });
fs.mkdirSync(mobileAssetsDir, { recursive: true });

function makeCircleMask(size) {
  const mask = new Jimp(size, size, 0x00000000);
  const r = size / 2;
  const r2 = r * r;
  mask.scan(0, 0, size, size, (x, y, idx) => {
    const dx = x - r + 0.5;
    const dy = y - r + 0.5;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= r2) {
      mask.bitmap.data[idx] = 255;
      mask.bitmap.data[idx + 1] = 255;
      mask.bitmap.data[idx + 2] = 255;
      mask.bitmap.data[idx + 3] = 255;
    }
  });
  return mask;
}

function makeRoundedRectMask(size, radius) {
  const mask = new Jimp(size, size, 0x00000000);
  mask.scan(0, 0, size, size, (x, y, idx) => {
    let dx = 0;
    let dy = 0;
    if (x < radius) dx = radius - x - 0.5;
    else if (x >= size - radius) dx = x - (size - radius) + 0.5;

    if (y < radius) dy = radius - y - 0.5;
    else if (y >= size - radius) dy = y - (size - radius) + 0.5;

    if (dx > 0 && dy > 0) {
      if (dx * dx + dy * dy <= radius * radius) {
        mask.bitmap.data[idx] = 255;
        mask.bitmap.data[idx + 1] = 255;
        mask.bitmap.data[idx + 2] = 255;
        mask.bitmap.data[idx + 3] = 255;
      }
    } else {
      mask.bitmap.data[idx] = 255;
      mask.bitmap.data[idx + 1] = 255;
      mask.bitmap.data[idx + 2] = 255;
      mask.bitmap.data[idx + 3] = 255;
    }
  });
  return mask;
}

async function extractTransparentLogo(rawImg) {
  console.log('Extracting transparent logo with anti-aliasing matte recovery...');
  const transparent = new Jimp(rawImg.bitmap.width, rawImg.bitmap.height, 0x00000000);

  rawImg.scan(0, 0, rawImg.bitmap.width, rawImg.bitmap.height, (x, y, idx) => {
    const r = rawImg.bitmap.data[idx];
    const g = rawImg.bitmap.data[idx + 1];
    const b = rawImg.bitmap.data[idx + 2];
    const dist = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);

    if (dist <= 6) {
      transparent.bitmap.data[idx] = 0;
      transparent.bitmap.data[idx + 1] = 0;
      transparent.bitmap.data[idx + 2] = 0;
      transparent.bitmap.data[idx + 3] = 0;
    } else if (dist >= 32) {
      transparent.bitmap.data[idx] = r;
      transparent.bitmap.data[idx + 1] = g;
      transparent.bitmap.data[idx + 2] = b;
      transparent.bitmap.data[idx + 3] = 255;
    } else {
      const a = (dist - 6) / (32 - 6);
      const unmul = (c) => Math.min(255, Math.max(0, Math.round((c - (1 - a) * 255) / a)));
      transparent.bitmap.data[idx] = unmul(r);
      transparent.bitmap.data[idx + 1] = unmul(g);
      transparent.bitmap.data[idx + 2] = unmul(b);
      transparent.bitmap.data[idx + 3] = Math.round(a * 255);
    }
  });

  return transparent;
}

function generateSvgFromImageData(transparentImg) {
  console.log('Tracing vector SVG with ImageTracer...');
  const rawSvg = ImageTracer.imagedataToSVG(transparentImg.bitmap, {
    corsenabled: false,
    ltres: 1,
    qtres: 1,
    pathomit: 8,
    rightangleenhance: false,
    colorsampling: 2,
    numberofcolors: 32,
    mincolorratio: 0.005,
    colorquantcycles: 5,
    layering: 0,
    strokewidth: 0,
    linefilter: true,
    scale: 1,
    roundcoords: 1,
    viewbox: true,
    desc: false,
    blurradius: 2,
    blurdelta: 20,
  });

  // Filter out any opacity="0" or near-zero noise paths
  const cleanSvg = rawSvg.replace(/<path[^>]*opacity=['"]0?(\.[0-9]+)?['"][^>]*\/>/gi, (match) => {
    const opMatch = match.match(/opacity=['"]([0-9.]+)['"]/);
    if (opMatch && parseFloat(opMatch[1]) < 0.1) return '';
    return match;
  });

  return cleanSvg;
}

async function generate() {
  const inputPath = fs.existsSync(sourceJpg)
    ? sourceJpg
    : path.join(rootAssetsDir, 'logo.png');

  console.log(`Loading source image from: ${inputPath}`);
  const rawJpg = await Jimp.read(inputPath);
  const src = await extractTransparentLogo(rawJpg);

  // 1. Generate & Save SVG
  const svgContent = generateSvgFromImageData(src);
  console.log(`Saving vector SVG (${svgContent.length} bytes)...`);

  const svgDestinations = [
    path.join(rootAssetsDir, 'logo.svg'),
    path.join(mobileAssetsDir, 'logo.svg'),
    path.join(mobileAssetsDir, 'sora-logo.svg'),
    path.join(downloadsDir, 'sora-logo.svg'),
    path.join(downloadsDir, 'sora-logo_1.svg'),
  ];

  for (const p of svgDestinations) {
    try {
      fs.writeFileSync(p, svgContent, 'utf8');
      console.log(`  -> Saved ${p}`);
    } catch (err) {
      console.warn(`  ! Could not write to ${p}:`, err.message);
    }
  }

  // 2. High-res 4096x4096 master PNG
  console.log('Generating 4096x4096 master PNGs...');
  const master4096 = src.clone().resize(4096, 4096, Jimp.RESIZE_BICUBIC);
  const png4096Destinations = [
    path.join(rootAssetsDir, 'logo.png'),
    path.join(mobileAssetsDir, 'logo.png'),
    path.join(mobileAssetsDir, 'sora-logo.png'),
    path.join(downloadsDir, 'sora-logo-4096.png'),
    path.join(downloadsDir, 'sora-logo-4096_1.png'),
  ];
  for (const p of png4096Destinations) {
    try {
      await master4096.write(p);
      console.log(`  -> Saved ${p}`);
    } catch (err) {
      console.warn(`  ! Could not write to ${p}:`, err.message);
    }
  }

  // Also save 1024x1024 transparent PNG in Downloads
  try {
    await src.write(path.join(downloadsDir, 'sora-logo.png'));
    console.log(`  -> Saved ${path.join(downloadsDir, 'sora-logo.png')}`);
  } catch (err) {
    console.warn('  ! Could not write sora-logo.png to downloads:', err.message);
  }

  // 3. Expo icon.png (1024x1024, white background, logo centered at 800px)
  console.log('Generating mobile/assets/icon.png...');
  const icon = new Jimp(1024, 1024, 0xffffffff);
  const iconLogo = src.clone().resize(Jimp.AUTO, 800, Jimp.RESIZE_BICUBIC);
  icon.composite(
    iconLogo,
    Math.round((1024 - iconLogo.bitmap.width) / 2),
    Math.round((1024 - iconLogo.bitmap.height) / 2),
  );
  await icon.write(path.join(mobileAssetsDir, 'icon.png'));

  // 4. Expo adaptive-icon.png (1024x1024, transparent background, safe-zone ~680px)
  console.log('Generating mobile/assets/adaptive-icon.png...');
  const adaptiveIcon = new Jimp(1024, 1024, 0x00000000);
  const adaptiveLogo = src.clone().resize(Jimp.AUTO, 680, Jimp.RESIZE_BICUBIC);
  adaptiveIcon.composite(
    adaptiveLogo,
    Math.round((1024 - adaptiveLogo.bitmap.width) / 2),
    Math.round((1024 - adaptiveLogo.bitmap.height) / 2),
  );
  await adaptiveIcon.write(path.join(mobileAssetsDir, 'adaptive-icon.png'));

  // 5. Expo splash-icon.png (1024x1024, transparent background, centered at 720px)
  console.log('Generating mobile/assets/splash-icon.png...');
  const splashIcon = new Jimp(1024, 1024, 0x00000000);
  const splashLogo = src.clone().resize(Jimp.AUTO, 720, Jimp.RESIZE_BICUBIC);
  splashIcon.composite(
    splashLogo,
    Math.round((1024 - splashLogo.bitmap.width) / 2),
    Math.round((1024 - splashLogo.bitmap.height) / 2),
  );
  await splashIcon.write(path.join(mobileAssetsDir, 'splash-icon.png'));

  // 6. Web favicon.png (48x48)
  console.log('Generating mobile/assets/favicon.png...');
  const favicon = new Jimp(48, 48, 0x00000000);
  const faviconLogo = src.clone().resize(Jimp.AUTO, 44, Jimp.RESIZE_BICUBIC);
  favicon.composite(
    faviconLogo,
    Math.round((48 - faviconLogo.bitmap.width) / 2),
    Math.round((48 - faviconLogo.bitmap.height) / 2),
  );
  await favicon.write(path.join(mobileAssetsDir, 'favicon.png'));

  // 7. Native Android Launcher Mipmaps
  const mipmapDensities = [
    { name: 'mdpi', size: 48, radius: 10 },
    { name: 'hdpi', size: 72, radius: 15 },
    { name: 'xhdpi', size: 96, radius: 20 },
    { name: 'xxhdpi', size: 144, radius: 30 },
    { name: 'xxxhdpi', size: 192, radius: 40 },
  ];

  for (const { name, size, radius } of mipmapDensities) {
    const dir = path.join(androidResDir, `mipmap-${name}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // ic_launcher.webp (rounded rectangle, white background)
    const launcherCanvas = new Jimp(size, size, 0xffffffff);
    const logoSquare = src.clone().resize(Jimp.AUTO, Math.round(size * 0.78), Jimp.RESIZE_BICUBIC);
    launcherCanvas.composite(
      logoSquare,
      Math.round((size - logoSquare.bitmap.width) / 2),
      Math.round((size - logoSquare.bitmap.height) / 2),
    );
    const rectMask = makeRoundedRectMask(size, radius);
    launcherCanvas.mask(rectMask, 0, 0);
    await launcherCanvas.write(path.join(dir, 'ic_launcher.webp'));

    // ic_launcher_round.webp (circle, white background)
    const roundCanvas = new Jimp(size, size, 0xffffffff);
    const logoRound = src.clone().resize(Jimp.AUTO, Math.round(size * 0.74), Jimp.RESIZE_BICUBIC);
    roundCanvas.composite(
      logoRound,
      Math.round((size - logoRound.bitmap.width) / 2),
      Math.round((size - logoRound.bitmap.height) / 2),
    );
    const circleMask = makeCircleMask(size);
    roundCanvas.mask(circleMask, 0, 0);
    await roundCanvas.write(path.join(dir, 'ic_launcher_round.webp'));
  }

  // 8. Native Android Splashscreen Logos
  const splashDensities = [
    { name: 'mdpi', size: 288 },
    { name: 'hdpi', size: 432 },
    { name: 'xhdpi', size: 576 },
    { name: 'xxhdpi', size: 864 },
    { name: 'xxxhdpi', size: 1152 },
  ];

  for (const { name, size } of splashDensities) {
    const dir = path.join(androidResDir, `drawable-${name}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const splashCanvas = new Jimp(size, size, 0x00000000);
    const splashLogoResized = src.clone().resize(Jimp.AUTO, Math.round(size * 0.7), Jimp.RESIZE_BICUBIC);
    splashCanvas.composite(
      splashLogoResized,
      Math.round((size - splashLogoResized.bitmap.width) / 2),
      Math.round((size - splashLogoResized.bitmap.height) / 2),
    );
    await splashCanvas.write(path.join(dir, 'splashscreen_logo.png'));
  }

  console.log('All app icons, SVG, and multi-resolution assets successfully generated!');
}

generate().catch(console.error);
