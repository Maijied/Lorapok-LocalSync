import sharp from 'sharp';

async function resizeIcons() {
  try {
    const input = 'public/logo-transparent.png';
    console.log('Resizing to 512x512...');
    await sharp(input)
      .resize(512, 512, { fit: 'contain', background: { r: 5, g: 5, b: 5, alpha: 1 } })
      .toFile('public/icon.png');
    
    console.log('Resizing to 256x256...');
    await sharp(input)
      .resize(256, 256, { fit: 'contain', background: { r: 5, g: 5, b: 5, alpha: 1 } })
      .toFile('public/icon-small.png');
      
    console.log('Done resizing icons.');
  } catch (err) {
    console.error('Error resizing:', err);
  }
}

resizeIcons();
