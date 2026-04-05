const express = require('express');
const router = express.Router();

module.exports = function (db) {
  // Export summary report as JSON
  router.get('/project/:projectId/json', (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const clips = db.prepare(`
      SELECT c.filename, c.duration_seconds, c.drive_file_id,
             a.menu_name, a.scene_type, a.confidence_score,
             r.decision, r.final_menu_name, r.final_scene_type, r.notes
      FROM clips c
      LEFT JOIN analyses a ON a.clip_id = c.id
      LEFT JOIN reviews r ON r.clip_id = c.id
      WHERE c.project_id = ?
      ORDER BY c.filename
    `).all(req.params.projectId);

    const report = {
      project: project.name,
      exportedAt: new Date().toISOString(),
      summary: {
        totalClips: clips.length,
        approved: clips.filter(c => c.decision === 'approved').length,
        edited: clips.filter(c => c.decision === 'edited').length,
        discarded: clips.filter(c => c.decision === 'discarded').length,
        pending: clips.filter(c => !c.decision).length,
      },
      sceneBreakdown: {
        production: clips.filter(c => (c.final_scene_type || c.scene_type) === 'production').length,
        preparation: clips.filter(c => (c.final_scene_type || c.scene_type) === 'preparation').length,
        conversation: clips.filter(c => (c.final_scene_type || c.scene_type) === 'conversation').length,
        other: clips.filter(c => (c.final_scene_type || c.scene_type) === 'other').length,
      },
      clips: clips.map(c => ({
        filename: c.filename,
        duration: c.duration_seconds,
        menuName: c.final_menu_name || c.menu_name,
        sceneType: c.final_scene_type || c.scene_type,
        confidence: c.confidence_score,
        decision: c.decision || 'pending',
        notes: c.notes,
      })),
    };

    res.json(report);
  });

  // Export as CSV
  router.get('/project/:projectId/csv', (req, res) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const clips = db.prepare(`
      SELECT c.filename, c.duration_seconds,
             a.menu_name, a.scene_type, a.confidence_score,
             r.decision, r.final_menu_name, r.final_scene_type, r.notes
      FROM clips c
      LEFT JOIN analyses a ON a.clip_id = c.id
      LEFT JOIN reviews r ON r.clip_id = c.id
      WHERE c.project_id = ?
      ORDER BY c.filename
    `).all(req.params.projectId);

    const header = 'ไฟล์,ความยาว(วินาที),ชื่อเมนู,ประเภทฉาก,ความมั่นใจ,สถานะรีวิว,หมายเหตุ\n';
    const rows = clips.map(c => {
      const fields = [
        c.filename,
        c.duration_seconds || '',
        c.final_menu_name || c.menu_name || '',
        c.final_scene_type || c.scene_type || '',
        c.confidence_score ? (c.confidence_score * 100).toFixed(0) + '%' : '',
        c.decision || 'pending',
        (c.notes || '').replace(/,/g, ';'),
      ];
      return fields.join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name}_report.csv"`);
    res.send('\uFEFF' + header + rows);
  });

  // Get progress stats
  router.get('/project/:projectId/stats', (req, res) => {
    const stats = db.prepare(`
      SELECT
        COUNT(c.id) as total,
        SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as analyzed,
        SUM(CASE WHEN a.status = 'analyzing' THEN 1 ELSE 0 END) as analyzing,
        SUM(CASE WHEN a.status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending_analysis,
        SUM(CASE WHEN r.decision = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN r.decision = 'edited' THEN 1 ELSE 0 END) as edited,
        SUM(CASE WHEN r.decision = 'discarded' THEN 1 ELSE 0 END) as discarded,
        SUM(CASE WHEN r.decision IS NULL AND a.status = 'completed' THEN 1 ELSE 0 END) as pending_review
      FROM clips c
      LEFT JOIN analyses a ON a.clip_id = c.id
      LEFT JOIN reviews r ON r.clip_id = c.id
      WHERE c.project_id = ?
    `).get(req.params.projectId);

    res.json(stats);
  });

  return router;
};
