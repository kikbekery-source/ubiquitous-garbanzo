const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GoogleDriveService {
  constructor() {
    this.drive = null;
  }

  async init() {
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
      || path.join(__dirname, '../../credentials/service-account.json');

    if (!fs.existsSync(keyPath)) {
      console.warn('Google Drive service account key not found. Using mock mode.');
      this.mockMode = true;
      return;
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  async listVideos(folderId) {
    if (this.mockMode) return this._mockVideos();

    const response = await this.drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
      fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, videoMediaMetadata)',
      orderBy: 'name',
      pageSize: 200,
    });

    return response.data.files.map(file => ({
      driveFileId: file.id,
      filename: file.name,
      mimeType: file.mimeType,
      fileSize: parseInt(file.size || '0'),
      webViewLink: file.webViewLink,
      downloadLink: file.webContentLink,
      thumbnailUrl: file.thumbnailLink,
      durationSeconds: file.videoMediaMetadata?.durationMillis
        ? file.videoMediaMetadata.durationMillis / 1000
        : null,
    }));
  }

  async getFileStream(fileId) {
    if (this.mockMode) return null;

    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    return response.data;
  }

  async getFileMetadata(fileId) {
    if (this.mockMode) return this._mockVideos()[0];

    const response = await this.drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, videoMediaMetadata',
    });

    const file = response.data;
    return {
      driveFileId: file.id,
      filename: file.name,
      mimeType: file.mimeType,
      fileSize: parseInt(file.size || '0'),
      webViewLink: file.webViewLink,
      downloadLink: file.webContentLink,
      thumbnailUrl: file.thumbnailLink,
      durationSeconds: file.videoMediaMetadata?.durationMillis
        ? file.videoMediaMetadata.durationMillis / 1000
        : null,
    };
  }

  _mockVideos() {
    return [
      {
        driveFileId: 'mock_001',
        filename: 'ผัดไทย_ขั้นตอนการทำ.mp4',
        mimeType: 'video/mp4',
        fileSize: 52428800,
        webViewLink: '#',
        downloadLink: '#',
        thumbnailUrl: null,
        durationSeconds: 45,
      },
      {
        driveFileId: 'mock_002',
        filename: 'ส้มตำ_เตรียมเครื่อง.mp4',
        mimeType: 'video/mp4',
        fileSize: 31457280,
        webViewLink: '#',
        downloadLink: '#',
        thumbnailUrl: null,
        durationSeconds: 32,
      },
      {
        driveFileId: 'mock_003',
        filename: 'พูดคุยกับเชฟ.mp4',
        mimeType: 'video/mp4',
        fileSize: 78643200,
        webViewLink: '#',
        downloadLink: '#',
        thumbnailUrl: null,
        durationSeconds: 120,
      },
      {
        driveFileId: 'mock_004',
        filename: 'ต้มยำกุ้ง_กระบวนการผลิต.mp4',
        mimeType: 'video/mp4',
        fileSize: 62914560,
        webViewLink: '#',
        downloadLink: '#',
        thumbnailUrl: null,
        durationSeconds: 67,
      },
      {
        driveFileId: 'mock_005',
        filename: 'ข้าวผัด_เตรียมวัตถุดิบ.mp4',
        mimeType: 'video/mp4',
        fileSize: 41943040,
        webViewLink: '#',
        downloadLink: '#',
        thumbnailUrl: null,
        durationSeconds: 38,
      },
    ];
  }
}

module.exports = new GoogleDriveService();
