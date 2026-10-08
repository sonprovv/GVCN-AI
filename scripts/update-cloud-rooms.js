'use strict';
const fs = require('fs');

const path = './backend/data/cloud_rooms.json';
const rooms = JSON.parse(fs.readFileSync(path, 'utf8'));

if (rooms['12A5'] && rooms['12A5'].data) {
  const data = rooms['12A5'].data;
  console.log('Current discipline records:', data.disciplineRecords?.length);
  console.log('Current academic records:', data.academicRecords?.length);

  // Ensure each existing record has session: 'morning' if not present
  data.disciplineRecords = (data.disciplineRecords || []).map(r => ({
    session: 'morning',
    ...r
  }));

  data.academicRecords = (data.academicRecords || []).map(r => ({
    session: 'morning',
    ...r
  }));

  // Check if afternoon discipline record already exists
  const hasAfternoonDisc = data.disciplineRecords.some(r => r.session === 'afternoon');
  if (!hasAfternoonDisc) {
    data.disciplineRecords.push({
      id: 'disc-12A5-2026-10-08-afternoon',
      className: '12A5',
      date: '2026-10-08',
      session: 'afternoon',
      violations: {
        'hs-07': ['disc-badge'],
        'hs-12': ['disc-phone']
      },
      notes: {
        'hs-07': 'Quên đeo thẻ học sinh buổi chiều',
        'hs-12': 'Sử dụng điện thoại cuối tiết 4 buổi chiều'
      },
      recordedBy: 'Lớp trưởng (Nguyễn Minh Anh)',
      createdAt: '2026-10-08T14:30:00.000Z',
      updatedAt: '2026-10-08T14:30:00.000Z'
    });
    console.log('Added sample afternoon discipline record');
  }

  // Check if afternoon academic record already exists
  const hasAfternoonAcad = data.academicRecords.some(r => r.session === 'afternoon');
  if (!hasAfternoonAcad) {
    data.academicRecords.push({
      id: 'acad-rec-12A5-2026-10-08-van-afternoon',
      className: '12A5',
      date: '2026-10-08',
      session: 'afternoon',
      subject: 'Ngữ văn',
      completed: {
        'hs-01': ['acad-homework', 'acad-textbook', 'acad-listen', 'acad-notes', 'acad-prep', 'acad-speaking'],
        'hs-02': ['acad-homework', 'acad-textbook', 'acad-listen', 'acad-notes', 'acad-speaking'],
        'hs-03': ['acad-homework', 'acad-textbook', 'acad-listen', 'acad-notes'],
        'hs-04': ['acad-homework', 'acad-textbook', 'acad-listen', 'acad-notes'],
        'hs-05': ['acad-homework', 'acad-textbook', 'acad-listen', 'acad-notes']
      },
      notes: {
        'hs-01': 'Soạn văn chi tiết, phát biểu diễn cảm rất hay',
        'hs-02': 'Tích cực xung phong phân tích tác phẩm',
        'hs-08': 'Chưa chuẩn bị bài mới Ngữ văn chu đáo'
      },
      recordedBy: 'Lớp phó học tập (Trần Hoàng Nam)',
      createdAt: '2026-10-08T15:00:00.000Z',
      updatedAt: '2026-10-08T15:00:00.000Z'
    });
    console.log('Added sample afternoon academic record');
  }

  rooms['12A5'].updatedAt = new Date().toISOString();
  fs.writeFileSync(path, JSON.stringify(rooms, null, 2), 'utf8');
  console.log('Updated backend/data/cloud_rooms.json successfully!');
}
