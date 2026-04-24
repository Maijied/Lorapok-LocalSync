const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'lorapok.db');
const BACKUPS_DIR = path.join(__dirname, 'backups');

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function backupDatabase() {
  try {
    ensureBackupsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUPS_DIR, `lorapok_${timestamp}.db`);
    
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, backupPath);
      console.log(`[Backup] Database backed up successfully to: ${backupPath}`);
      
      // Keep only the last 7 backups to save space
      cleanupOldBackups();
    } else {
      console.log(`[Backup] No database found at ${DB_PATH} to backup.`);
    }
  } catch (err) {
    console.error('[Backup] Error backing up database:', err);
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('lorapok_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Newest first

    if (files.length > 7) {
      const filesToDelete = files.slice(7);
      for (const file of filesToDelete) {
        fs.unlinkSync(path.join(BACKUPS_DIR, file.name));
        console.log(`[Backup] Deleted old backup: ${file.name}`);
      }
    }
  } catch (err) {
    console.error('[Backup] Error cleaning up old backups:', err);
  }
}

function scheduleBackups() {
  // Backup daily (every 24 hours)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  
  setInterval(backupDatabase, TWENTY_FOUR_HOURS);
  console.log('[Backup] Scheduled daily database backups.');
}

module.exports = {
  backupDatabase,
  scheduleBackups
};
