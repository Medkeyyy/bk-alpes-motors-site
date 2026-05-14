// GET /api/videos-list
// Retourne la liste des fichiers vidéo présents dans /videos/ (auto-détection).
// L'admin n'a qu'à déposer ses .mp4 dedans avec le nom de son choix, ils
// apparaîtront automatiquement dans le marquee "Nos réalisations".

const fs = require('fs');
const path = require('path');

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    // Chemins possibles pour le dossier videos selon l'environnement Vercel
    const candidates = [
      path.join(process.cwd(), 'videos'),
      path.join(process.cwd(), 'public', 'videos'),
    ];
    let dir = null;
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) { dir = c; break; }
    }
    if (!dir) {
      return res.status(200).json({ videos: [] });
    }
    const files = fs.readdirSync(dir)
      .filter(f => !f.startsWith('.'))
      .filter(f => VIDEO_EXTS.has(path.extname(f).toLowerCase()))
      .sort();
    // Cache edge 5 min pour éviter de stat le disk à chaque requête
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      videos: files.map(f => ({ src: '/videos/' + f, name: f })),
    });
  } catch (err) {
    console.error('videos-list error:', err);
    return res.status(200).json({ videos: [] });
  }
};
