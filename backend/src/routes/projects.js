const express = require('express');
const { v4: uuidv4 } = require('uuid');
const driveService = require('../services/googleDrive');

const router = express.Router();

module.exports = function (db) {
  // List all projects
  router.get('/', (req, res) => {
    const projects = db.prepare(`
      SELECT p.*,
        COUNT(c.id) as total_clips,
        SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as analyzed_clips,
        SUM(CASE WHEN r.decision IS NOT NULL THEN 1 ELSE 0 END) as reviewed_clips
      FROM projects p
      LEFT JOIN clips c ON c.project_id = p.id
      LEFT JOIN analyses a ON a.clip_id = c.id
      LEFT JOIN reviews r ON r.clip_id = c.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();

    res.json(projects);
  });

  // Create project
  router.post('/', (req, res) => {
    const { name, driveFolderId } = req.body;
    if (!name || !driveFolderId) {
      return res.status(400).json({ error: 'name and driveFolderId are required' });
    }

    const id = uuidv4();
    db.prepare('INSERT INTO projects (id, name, drive_folder_id) VALUES (?, ?, ?)')
      .run(id, name, driveFolderId);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json(project);
  });

  // Get project details
  router.get('/:id', (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  });

  // Sync clips from Google Drive
  router.post('/:id/sync', async (req, res) => {
    try {
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const videos = await driveService.listVideos(project.drive_folder_id);

      const insertClip = db.prepare(`
        INSERT OR IGNORE INTO clips (id, project_id, drive_file_id, filename, mime_type, duration_seconds, thumbnail_url, drive_web_view_link, drive_download_link, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertAnalysis = db.prepare(`
        INSERT OR IGNORE INTO analyses (id, clip_id) VALUES (?, ?)
      `);

      const syncMany = db.transaction((videos) => {
        let added = 0;
        for (const v of videos) {
          const existing = db.prepare('SELECT id FROM clips WHERE drive_file_id = ? AND project_id = ?')
            .get(v.driveFileId, project.id);

          if (!existing) {
            const clipId = uuidv4();
            insertClip.run(clipId, project.id, v.driveFileId, v.filename, v.mimeType,
              v.durationSeconds, v.thumbnailUrl, v.webViewLink, v.downloadLink, v.fileSize);
            insertAnalysis.run(uuidv4(), clipId);
            added++;
          }
        }
        return added;
      });

      const added = syncMany(videos);

      res.json({
        message: `Synced ${added} new clips from Google Drive`,
        totalInDrive: videos.length,
        newlyAdded: added,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete project
  router.delete('/:id', (req, res) => {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted' });
  });

  return router;
};
