import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = path.join(__dirname, '../frontend/public/avatars');

if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const downloadAvatar = async (url, filename) => {
  const filePath = path.join(AVATAR_DIR, filename);
  if (fs.existsSync(filePath)) return;

  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Failed to download ${filename}:`, error.message);
  }
};

const main = async () => {
  console.log('Starting avatar collection...');
  
  // Collecting Anime-style avatars from DiceBear (SFW styles)
  // Styles: adventurer, personas, big-ears, bottts, avataaars
  const styles = ['adventurer', 'personas', 'big-ears', 'bottts', 'avataaars'];
  let count = 1;

  for (const style of styles) {
    for (let i = 0; i < 10; i++) {
      const seed = `lorapok-${style}-${i}`;
      const url = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
      await downloadAvatar(url, `anime_${count}.svg`);
      process.stdout.write('.');
      count++;
    }
  }

  // Adding some "animal" types via bottts/miniavs or similar seeds
  for (let i = 0; i < 10; i++) {
    const seed = `animal-${i}`;
    const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&radius=50`;
    await downloadAvatar(url, `animal_${i + 1}.svg`);
    process.stdout.write('.');
  }

  console.log('\nFinished collecting 60+ avatars!');
};

main();
