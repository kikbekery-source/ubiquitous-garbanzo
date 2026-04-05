const express = require('express');
const { v4: uuidv4 } = require('uuid');
const geminiAnalyzer = require('../services/geminiAnalyzer');

const router = express.Router();

module.exports = function (db) {
  // List clips for a project with analysis + review data
  router.get('/project/:projectId', (req, res) => {
    const { status, sceneType, decision } = req.query;

    let query = `
      SELECT c.*, a.menu_name, a.scene_type, a.confidence_score, a.status as analysis_status,
             a.error_message, a.analyzed_at, a.ai_raw_response,
             r.decision, r.final_menu_name, r.final_scene_type, r.notes, r.reviewed_at
      FROM clips c
      LEFT JOIN analyses a ON a.clip_id = c.id
      LEFT JOIN reviews r ON r.clip_id = c.id
      WHERE c.project_id = ?
    `;
    const params = [req.params.projectId];

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (sceneType) {
      query += ' AND (a.scene_type = ? OR r.final_scene_type = ?)';
      params.push(sceneType, sceneType);
    }
    if (decision) {
      query += ' AND r.decision = ?';
      params.push(decision);
    }

    query += ' ORDER BY c.filename ASC';

    const clips = db.prepare(query).all(...params);
    res.json(clips);
  });

  // Get single clip detail
  router.get('/:id', (req, res) => {
    const clip = db.prepare(`
      SELECT c.*, a.menu_name, a.scene_type, a.confidence_score, a.status as analysis_status,
             a.error_message, a.analyzed_at, a.ai_raw_response,
             r.decision, r.final_menu_name, r.final_scene_type, r.notes, r.reviewed_at
      FROM clips c
      LEFT JOIN analyses a ON a.clip_id = c.id
      LEFT JOIN reviews r ON r.clip_id = c.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!clip) return res.status(404).json({ error: 'Clip not found' });
    res.json(clip);
  });

  // Analyze a single clip with Gemini
  router.post('/:id/analyze', async (req, res) => {
    try {
      const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(req.params.id);
      if (!clip) return res.status(404).json({ error: 'Clip not found' });

      db.prepare("UPDATE analyses SET status = 'analyzing' WHERE clip_id = ?").run(clip.id);

      const result = await geminiAnalyzer.analyzeClip({
        filename: clip.filename,
        durationSeconds: clip.duration_seconds,
        mimeType: clip.mime_type,
      });

      db.prepare(`
        UPDATE analyses
        SET menu_name = ?, scene_type = ?, confidence_score = ?,
            ai_raw_response = ?, status = 'completed', analyzed_at = CURRENT_TIMESTAMP
        WHERE clip_id = ?
      `).run(result.menuName, result.sceneType, result.confidenceScore, result.rawResponse, clip.id);

      const updated = db.prepare(`
        SELECT c.*, a.menu_name, a.scene_type, a.confidence_score, a.status as analysis_status,
               a.analyzed_at, a.ai_raw_response
        FROM clips c LEFT JOIN analyses a ON a.clip_id = c.id
        WHERE c.id = ?
      `).get(clip.id);

      res.json(updated);
    } catch (error) {
      db.prepare("UPDATE analyses SET status = 'failed', error_message = ? WHERE clip_id = ?")
        .run(error.message, req.params.id);
      res.status(500).json({ error: error.message });
    }
  });

  // Batch analyze all pending clips for a project
  router.post('/project/:projectId/analyze-all', async (req, res) => {
    const clips = db.prepare(`
      SELECT c.* FROM clips c
      JOIN analyses a ON a.clip_id = c.id
      WHERE c.project_id = ? AND a.status IN ('pending', 'failed')
    `).all(req.params.projectId);

    if (clips.length === 0) {
      return res.json({ message: 'No clips to analyze', results: [] });
    }

    const results = [];
    for (const clip of clips) {
      try {
        db.prepare("UPDATE analyses SET status = 'analyzing' WHERE clip_id = ?").run(clip.id);

        const result = await geminiAnalyzer.analyzeClip({
          filename: clip.filename,
          durationSeconds: clip.duration_seconds,
          mimeType: clip.mime_type,
        });

        db.prepare(`
          UPDATE analyses
          SET menu_name = ?, scene_type = ?, confidence_score = ?,
              ai_raw_response = ?, status = 'completed', analyzed_at = CURRENT_TIMESTAMP
          WHERE clip_id = ?
        `).run(result.menuName, result.sceneType, result.confidenceScore, result.rawResponse, clip.id);

        results.push({ clipId: clip.id, filename: clip.filename, status: 'completed', ...result });
      } catch (error) {
        db.prepare("UPDATE analyses SET status = 'failed', error_message = ? WHERE clip_id = ?")
          .run(error.message, clip.id);
        results.push({ clipId: clip.id, filename: clip.filename, status: 'failed', error: error.message });
      }
    }

    res.json({ message: `Analyzed ${results.length} clips`, results });
  });

  // Review a clip (approve / edit / discard)
  router.post('/:id/review', (req, res) => {
    const { decision, finalMenuName, finalSceneType, notes } = req.body;

    if (!decision || !['approved', 'edited', 'discarded'].includes(decision)) {
      return res.status(400).json({ error: 'Valid decision required: approved, edited, discarded' });
    }

    const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(req.params.id);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });

    const analysis = db.prepare('SELECT * FROM analyses WHERE clip_id = ?').get(clip.id);

    db.prepare(`
      INSERT INTO reviews (id, clip_id, decision, final_menu_name, final_scene_type, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(clip_id) DO UPDATE SET
        decision = excluded.decision,
        final_menu_name = excluded.final_menu_name,
        final_scene_type = excluded.final_scene_type,
        notes = excluded.notes,
        reviewed_at = CURRENT_TIMESTAMP
    `).run(
      uuidv4(), clip.id, decision,
      finalMenuName || (analysis ? analysis.menu_name : null),
      finalSceneType || (analysis ? analysis.scene_type : null),
      notes || null
    );

    const updated = db.prepare(`
      SELECT c.*, a.menu_name, a.scene_type, a.confidence_score, a.status as analysis_status,
             r.decision, r.final_menu_name, r.final_scene_type, r.notes, r.reviewed_at
      FROM clips c
      LEFT JOIN analyses a ON a.clip_id = c.id
      LEFT JOIN reviews r ON r.clip_id = c.id
      WHERE c.id = ?
    `).get(clip.id);

    res.json(updated);
  });

  return router;
};
