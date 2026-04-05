import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from './hooks/useApi';
import ProjectList from './components/ProjectList';
import ClipList from './components/ClipList';
import ClipReview from './components/ClipReview';
import ProgressBar from './components/ProgressBar';
import './App.css';

export default function App() {
  const api = useApi();
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [clips, setClips] = useState([]);
  const [filteredClips, setFilteredClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.get('/projects');
      setProjects(data);
    } catch (e) { /* ignore */ }
  }, [api]);

  const loadClips = useCallback(async (projectId) => {
    try {
      const [clipsData, statsData] = await Promise.all([
        api.get(`/clips/project/${projectId}`),
        api.get(`/export/project/${projectId}/stats`),
      ]);
      setClips(clipsData);
      setStats(statsData);
      return clipsData;
    } catch (e) { return []; }
  }, [api]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    let result = clips;
    if (filter === 'pending') result = clips.filter(c => !c.decision && c.analysis_status === 'completed');
    else if (filter === 'approved') result = clips.filter(c => c.decision === 'approved');
    else if (filter === 'edited') result = clips.filter(c => c.decision === 'edited');
    else if (filter === 'discarded') result = clips.filter(c => c.decision === 'discarded');
    else if (filter === 'unanalyzed') result = clips.filter(c => c.analysis_status !== 'completed');
    setFilteredClips(result);
  }, [clips, filter]);

  const handleSelectProject = async (project) => {
    setCurrentProject(project);
    setSelectedClip(null);
    const clipsData = await loadClips(project.id);
    if (clipsData.length > 0) {
      setSelectedClip(clipsData[0]);
      setSelectedIndex(0);
    }
  };

  const handleCreateProject = async ({ name, driveFolderId }) => {
    await api.post('/projects', { name, driveFolderId });
    loadProjects();
  };

  const handleSync = async () => {
    if (!currentProject) return;
    setSyncing(true);
    try {
      await api.post(`/projects/${currentProject.id}/sync`);
      await loadClips(currentProject.id);
    } finally {
      setSyncing(false);
    }
  };

  const handleAnalyzeAll = async () => {
    if (!currentProject) return;
    setAnalyzing(true);
    try {
      await api.post(`/clips/project/${currentProject.id}/analyze-all`);
      await loadClips(currentProject.id);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeClip = async (clipId) => {
    await api.post(`/clips/${clipId}/analyze`);
    await loadClips(currentProject.id);
    const updated = clips.find(c => c.id === clipId);
    if (updated) setSelectedClip(updated);
  };

  const handleReview = async (reviewData) => {
    if (!selectedClip) return;
    await api.post(`/clips/${selectedClip.id}/review`, reviewData);
    const newClips = await loadClips(currentProject.id);
    const updated = newClips.find(c => c.id === selectedClip.id);
    if (updated) setSelectedClip(updated);
  };

  const handleSelectClip = (clip, index) => {
    setSelectedClip(clip);
    setSelectedIndex(index);
  };

  const handleExport = async (format) => {
    if (!currentProject) return;
    if (format === 'csv') {
      window.open(`/api/export/project/${currentProject.id}/csv`, '_blank');
    } else {
      const data = await api.get(`/export/project/${currentProject.id}/json`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject.name}_report.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Project list view
  if (!currentProject) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>🎬 Video Footage Analyzer</h1>
          <p className="subtitle">วิเคราะห์และจัดหมวดหมู่วิดีโอร้านอาหารด้วย AI</p>
        </header>
        <main className="app-main">
          <ProjectList
            projects={projects}
            onSelect={handleSelectProject}
            onCreateProject={handleCreateProject}
            onRefresh={loadProjects}
          />
        </main>
      </div>
    );
  }

  // Project detail view
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button className="btn btn-ghost" onClick={() => { setCurrentProject(null); setClips([]); setSelectedClip(null); }}>
            ← กลับ
          </button>
          <h1>{currentProject.name}</h1>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
            {syncing ? '🔄 กำลัง Sync...' : '📥 Sync จาก Drive'}
          </button>
          <button className="btn btn-primary" onClick={handleAnalyzeAll} disabled={analyzing}>
            {analyzing ? '🧠 กำลังวิเคราะห์...' : '🤖 วิเคราะห์ทั้งหมด'}
          </button>
          <div className="export-group">
            <button className="btn btn-outline" onClick={() => handleExport('json')}>📊 Export JSON</button>
            <button className="btn btn-outline" onClick={() => handleExport('csv')}>📋 Export CSV</button>
          </div>
        </div>
      </header>

      <ProgressBar stats={stats} />

      <main className="app-main workspace">
        <aside className="sidebar">
          <ClipList
            clips={filteredClips}
            selectedId={selectedClip?.id}
            onSelect={handleSelectClip}
            filter={filter}
            onFilterChange={setFilter}
          />
        </aside>
        <section className="content">
          {selectedClip ? (
            <ClipReview
              key={selectedClip.id}
              clip={selectedClip}
              onReview={handleReview}
              onAnalyze={handleAnalyzeClip}
              onNext={() => {
                if (selectedIndex < filteredClips.length - 1) {
                  handleSelectClip(filteredClips[selectedIndex + 1], selectedIndex + 1);
                }
              }}
              onPrev={() => {
                if (selectedIndex > 0) {
                  handleSelectClip(filteredClips[selectedIndex - 1], selectedIndex - 1);
                }
              }}
              currentIndex={selectedIndex}
              totalClips={filteredClips.length}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🎥</div>
              <p>เลือกคลิปจากรายการด้านซ้ายเพื่อเริ่มรีวิว</p>
              {clips.length === 0 && <p className="text-muted">กด "Sync จาก Drive" เพื่อดึงวิดีโอเข้ามา</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
