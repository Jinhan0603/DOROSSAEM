/**
 * DORO 강사관리 시스템 Ver 2 — App Logic
 * JSON 파일 기반 CRUD + 점수 집계 + 등급 판정
 */

// ===== Data Store =====
const Store = {
  instructors: [],
  activityLogs: [],
  abilityLogs: [],

  async loadAll() {
    try {
      const [instrRes, actRes, abiRes] = await Promise.all([
        fetch('../data/instructor_db.json'),
        fetch('../data/activity_log.json'),
        fetch('../data/ability_log.json'),
      ]);
      const instrData = await instrRes.json();
      const actData = await actRes.json();
      const abiData = await abiRes.json();

      this.instructors = instrData.instructors || [];
      this.activityLogs = actData.logs || [];
      this.abilityLogs = abiData.logs || [];

      this.recalculateAll();
      return true;
    } catch (err) {
      console.error('Data load error:', err);
      // Use embedded sample data for demo
      this.instructors = SAMPLE_DATA.instructors;
      this.activityLogs = SAMPLE_DATA.activityLogs;
      this.abilityLogs = SAMPLE_DATA.abilityLogs;
      this.recalculateAll();
      return false;
    }
  },

  recalculateAll() {
    this.instructors.forEach(inst => {
      const activities = this.activityLogs.filter(l => l.instructor_id === inst.instructor_id);
      const abilities = this.abilityLogs.filter(l => l.instructor_id === inst.instructor_id);

      const activityPoints = activities.reduce((sum, l) => sum + (l.point || 0), 0);
      const abilityPoints = abilities.reduce((sum, l) => sum + (l.point || 0), 0);

      inst.total_score = activityPoints + abilityPoints;
      inst.penalty_count = activities.filter(l => l.point < 0).length;

      // Auto tier assignment
      if (inst.penalty_count >= 2 || activities.some(l => l.activity_type === '당일 강의 미참여' || l.activity_type === '강의시간보다 늦은 도착')) {
        inst.tier = 'Penalty';
      } else if (inst.total_score >= 75) {
        inst.tier = 'Advanced';
      } else {
        inst.tier = 'General';
      }

      // Latest update
      const allTimestamps = [...activities, ...abilities].map(l => new Date(l.timestamp)).filter(d => !isNaN(d));
      if (allTimestamps.length > 0) {
        inst.last_updated = new Date(Math.max(...allTimestamps)).toISOString();
      }
    });

    // Master: top 20 among Advanced+
    const eligible = this.instructors
      .filter(i => i.tier !== 'Penalty' && i.active_status === 'active')
      .sort((a, b) => b.total_score - a.total_score);

    eligible.slice(0, 20).forEach(i => {
      if (i.total_score >= 75) i.tier = 'Master';
    });
  },

  getInstructor(id) {
    return this.instructors.find(i => i.instructor_id === id);
  },

  getActivitiesFor(id) {
    return this.activityLogs.filter(l => l.instructor_id === id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  getAbilitiesFor(id) {
    return this.abilityLogs.filter(l => l.instructor_id === id);
  },

  addInstructor(data) {
    this.instructors.push(data);
    this.recalculateAll();
  },

  updateInstructor(id, data) {
    const idx = this.instructors.findIndex(i => i.instructor_id === id);
    if (idx !== -1) {
      this.instructors[idx] = { ...this.instructors[idx], ...data };
      this.recalculateAll();
    }
  },

  deleteInstructor(id) {
    this.instructors = this.instructors.filter(i => i.instructor_id !== id);
    this.activityLogs = this.activityLogs.filter(l => l.instructor_id !== id);
    this.abilityLogs = this.abilityLogs.filter(l => l.instructor_id !== id);
  },

  addActivityLog(log) {
    this.activityLogs.push(log);
    this.recalculateAll();
  },

  addAbilityLog(log) {
    this.abilityLogs.push(log);
    this.recalculateAll();
  },

  getStats() {
    const total = this.instructors.length;
    const active = this.instructors.filter(i => i.active_status === 'active').length;
    const masters = this.instructors.filter(i => i.tier === 'Master').length;
    const advanced = this.instructors.filter(i => i.tier === 'Advanced').length;
    const avgScore = total > 0 ? Math.round(this.instructors.reduce((s, i) => s + i.total_score, 0) / total) : 0;
    return { total, active, masters, advanced, avgScore };
  },

  generateId() {
    const year = new Date().getFullYear().toString().slice(-2);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return `${year}-${code}`;
  },

  exportJSON() {
    return {
      instructor_db: { instructors: this.instructors },
      activity_log: { logs: this.activityLogs },
      ability_log: { logs: this.abilityLogs },
    };
  }
};

// ===== Sample Data (fallback) =====
const SAMPLE_DATA = {
  instructors: [
    {
      instructor_id: '26-RPWR', name: '김도로', first_cohort: '3기', active_status: 'active',
      total_score: 76, tier: 'Advanced',
      activity_region: '[안산 거점] 안산, 시흥, 수원',
      activity_time: '오전-월,화,목 / 오후-화,수,목,금,토',
      specialty: '아두이노, CAD, Python, ROS', penalty_count: 0,
      last_updated: '2026-03-08T20:17:30+09:00'
    },
    {
      instructor_id: '26-AXBR', name: '이하늘', first_cohort: '1기', active_status: 'active',
      total_score: 92, tier: 'Master',
      activity_region: '[서울 거점] 강남, 서초, 송파',
      activity_time: '오후-월,수,금',
      specialty: 'Python, AI, 딥러닝', penalty_count: 0,
      last_updated: '2026-03-15T14:00:00+09:00'
    },
    {
      instructor_id: '26-CDMN', name: '박시현', first_cohort: '2기', active_status: 'active',
      total_score: 45, tier: 'General',
      activity_region: '[수원 거점] 수원, 화성',
      activity_time: '오전-화,목 / 오후-수,금',
      specialty: 'Scratch, 엔트리', penalty_count: 0,
      last_updated: '2026-03-10T09:30:00+09:00'
    },
    {
      instructor_id: '25-FGKL', name: '정다온', first_cohort: '1기', active_status: 'inactive',
      total_score: 30, tier: 'General',
      activity_region: '[인천 거점] 부평, 계양',
      activity_time: '오후-화,목',
      specialty: 'CAD, 3D프린팅', penalty_count: 0,
      last_updated: '2025-12-20T16:00:00+09:00'
    },
    {
      instructor_id: '26-HJPQ', name: '최민서', first_cohort: '3기', active_status: 'active',
      total_score: 12, tier: 'General',
      activity_region: '[안산 거점] 안산, 시흥',
      activity_time: '오전-월,화,수,목,금',
      specialty: 'ROS, 로봇', penalty_count: 1,
      last_updated: '2026-03-20T11:00:00+09:00'
    }
  ],
  activityLogs: [
    { timestamp: '2026-03-08T15:17:30+09:00', instructor_id: '26-RPWR', activity_type: 'OT 참여', activity_value: '1회', point: 1, note: '인재육성재단 OT', source: 'form' },
    { timestamp: '2026-03-08T18:17:30+09:00', instructor_id: '26-RPWR', activity_type: '교육 영상 제작', activity_value: '3편', point: 9, note: 'X-arm 영상 3편', source: 'discord' },
    { timestamp: '2026-03-10T10:00:00+09:00', instructor_id: '26-RPWR', activity_type: '일반 강의 참여', activity_value: '1회', point: 1, note: '안산 초등학교', source: 'form' },
    { timestamp: '2026-03-12T14:00:00+09:00', instructor_id: '26-AXBR', activity_type: 'DLS 참여', activity_value: '1회', point: 3, note: 'DLS 시즌3', source: 'form' },
    { timestamp: '2026-03-15T10:00:00+09:00', instructor_id: '26-AXBR', activity_type: '운영인력 참여', activity_value: '1회', point: 4, note: '봄 캠프 운영', source: 'manager' },
    { timestamp: '2026-03-18T09:00:00+09:00', instructor_id: '26-CDMN', activity_type: '일반 강의 참여', activity_value: '1회', point: 1, note: '수원 중학교', source: 'form' },
    { timestamp: '2026-03-20T10:00:00+09:00', instructor_id: '26-HJPQ', activity_type: 'OT 참여', activity_value: '1회', point: 1, note: '신입 OT', source: 'form' },
    { timestamp: '2026-03-22T09:00:00+09:00', instructor_id: '26-HJPQ', activity_type: '30분 전 지각', activity_value: '1회', point: -50, note: '안산 초등학교 지각', source: 'manager' },
  ],
  abilityLogs: [
    { timestamp: '2026-03-08T15:17:30+09:00', instructor_id: '26-RPWR', ability_type: 'major_track', ability_value: 'engineering_major', point: 2, note: '로봇공학과', source: 'form' },
    { timestamp: '2026-03-08T18:17:30+09:00', instructor_id: '26-RPWR', ability_type: 'project_track', ability_value: 'related_project_lead', point: 3, note: '파이썬 객체인식 AI 졸업작품 팀장', source: 'form' },
    { timestamp: '2026-03-01T10:00:00+09:00', instructor_id: '26-AXBR', ability_type: 'major_track', ability_value: 'engineering_major', point: 2, note: '컴퓨터공학과', source: 'form' },
    { timestamp: '2026-03-01T10:05:00+09:00', instructor_id: '26-AXBR', ability_type: 'teaching_track', ability_value: 'paid_teaching_or_tutoring', point: 2, note: '과외 경력 2년', source: 'form' },
    { timestamp: '2026-03-01T10:10:00+09:00', instructor_id: '26-AXBR', ability_type: 'skill_track', ability_value: 'has_core_skill', point: 1, note: 'Python, TensorFlow', source: 'form' },
  ]
};


// ===== UI Controller =====
const UI = {
  currentFilter: 'all',
  currentSort: { field: 'total_score', dir: 'desc' },
  searchQuery: '',

  init() {
    this.renderStats();
    this.renderTable();
    this.bindEvents();
  },

  bindEvents() {
    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderTable();
    });

    // Filter chips
    document.querySelectorAll('.chip[data-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip[data-filter]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentFilter = chip.dataset.filter;
        this.renderTable();
      });
    });

    // Add instructor button
    document.getElementById('btnAddInstructor').addEventListener('click', () => this.openAddModal());

    // Export button
    document.getElementById('btnExport').addEventListener('click', () => this.exportData());

    // Modal close
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
    document.getElementById('modalClose').addEventListener('click', () => this.closeModal());

    // Form submit
    document.getElementById('instructorForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    // Detail modal close
    document.getElementById('detailOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeDetail();
    });
    document.getElementById('detailClose').addEventListener('click', () => this.closeDetail());

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        this.closeDetail();
      }
    });
  },

  renderStats() {
    const stats = Store.getStats();
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statActive').textContent = stats.active;
    document.getElementById('statMaster').textContent = stats.masters;
    document.getElementById('statAvg').textContent = stats.avgScore;
    document.getElementById('statAdvanced').textContent = stats.advanced;
  },

  renderTable() {
    let data = [...Store.instructors];

    // Filter
    if (this.currentFilter !== 'all') {
      if (this.currentFilter === 'active') data = data.filter(i => i.active_status === 'active');
      else data = data.filter(i => i.tier === this.currentFilter);
    }

    // Search
    if (this.searchQuery) {
      data = data.filter(i =>
        i.name.toLowerCase().includes(this.searchQuery) ||
        i.instructor_id.toLowerCase().includes(this.searchQuery) ||
        (i.specialty || '').toLowerCase().includes(this.searchQuery) ||
        (i.activity_region || '').toLowerCase().includes(this.searchQuery)
      );
    }

    // Sort
    const { field, dir } = this.currentSort;
    data.sort((a, b) => {
      let va = a[field], vb = b[field];
      if (typeof va === 'number') return dir === 'asc' ? va - vb : vb - va;
      va = String(va || ''); vb = String(vb || '');
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    const tbody = document.getElementById('tableBody');

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-text">등록된 강사가 없습니다</div>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(inst => {
      const tierClass = inst.tier.toLowerCase();
      const tierIcon = { Master: '👑', Advanced: '⭐', General: '🔵', Penalty: '🚫' }[inst.tier] || '';
      const scorePercent = Math.min(100, Math.max(0, inst.total_score));
      const barColor = inst.total_score >= 75 ? 'var(--tier-advanced)' : inst.total_score >= 40 ? 'var(--color-primary)' : 'var(--text-muted)';
      const updatedStr = inst.last_updated ? new Date(inst.last_updated).toLocaleDateString('ko-KR') : '-';

      return `
        <tr onclick="UI.openDetail('${inst.instructor_id}')" data-id="${inst.instructor_id}">
          <td>
            <span class="status-dot ${inst.active_status}"></span>
            <strong>${inst.name}</strong>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${inst.instructor_id}</div>
          </td>
          <td><span class="tier-badge ${tierClass}">${tierIcon} ${inst.tier}</span></td>
          <td>
            <div class="score-bar-container">
              <span class="score-value">${inst.total_score}</span>
              <div class="score-bar">
                <div class="score-bar-fill" style="width:${scorePercent}%;background:${barColor}"></div>
              </div>
            </div>
          </td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inst.specialty || '-'}</td>
          <td>${inst.activity_region || '-'}</td>
          <td>${inst.first_cohort || '-'}</td>
          <td>${inst.penalty_count > 0 ? `<span style="color:var(--tier-penalty);font-weight:700">${inst.penalty_count}</span>` : '0'}</td>
          <td style="color:var(--text-muted);font-size:0.8rem">${updatedStr}</td>
        </tr>
      `;
    }).join('');

    // Update sort headers
    document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.sort === this.currentSort.field);
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) {
        arrow.textContent = th.dataset.sort === this.currentSort.field
          ? (this.currentSort.dir === 'asc' ? '↑' : '↓') : '↕';
      }
    });
  },

  handleSort(field) {
    if (this.currentSort.field === field) {
      this.currentSort.dir = this.currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSort = { field, dir: 'desc' };
    }
    this.renderTable();
  },

  openAddModal() {
    document.getElementById('modalTitle').textContent = '강사 등록';
    document.getElementById('formMode').value = 'add';
    document.getElementById('formId').value = '';
    document.getElementById('instructorForm').reset();
    document.getElementById('fieldInstructorId').value = Store.generateId();
    document.getElementById('fieldInstructorId').readOnly = true;
    document.getElementById('modalOverlay').classList.add('active');
  },

  openEditModal(id) {
    const inst = Store.getInstructor(id);
    if (!inst) return;

    document.getElementById('modalTitle').textContent = '강사 정보 수정';
    document.getElementById('formMode').value = 'edit';
    document.getElementById('formId').value = id;

    document.getElementById('fieldInstructorId').value = inst.instructor_id;
    document.getElementById('fieldInstructorId').readOnly = true;
    document.getElementById('fieldName').value = inst.name || '';
    document.getElementById('fieldCohort').value = inst.first_cohort || '';
    document.getElementById('fieldStatus').value = inst.active_status || 'active';
    document.getElementById('fieldRegion').value = inst.activity_region || '';
    document.getElementById('fieldTime').value = inst.activity_time || '';
    document.getElementById('fieldSpecialty').value = inst.specialty || '';

    document.getElementById('modalOverlay').classList.add('active');
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
  },

  handleFormSubmit() {
    const mode = document.getElementById('formMode').value;
    const data = {
      instructor_id: document.getElementById('fieldInstructorId').value,
      name: document.getElementById('fieldName').value.trim(),
      first_cohort: document.getElementById('fieldCohort').value.trim(),
      active_status: document.getElementById('fieldStatus').value,
      activity_region: document.getElementById('fieldRegion').value.trim(),
      activity_time: document.getElementById('fieldTime').value.trim(),
      specialty: document.getElementById('fieldSpecialty').value.trim(),
    };

    if (!data.name) {
      this.showToast('이름을 입력해주세요', 'error');
      return;
    }

    if (mode === 'add') {
      data.total_score = 0;
      data.tier = 'General';
      data.penalty_count = 0;
      data.last_updated = new Date().toISOString();
      Store.addInstructor(data);
      this.showToast(`${data.name} 강사가 등록되었습니다`, 'success');
    } else {
      Store.updateInstructor(data.instructor_id, data);
      this.showToast(`${data.name} 강사 정보가 수정되었습니다`, 'success');
    }

    this.closeModal();
    this.renderStats();
    this.renderTable();
  },

  openDetail(id) {
    const inst = Store.getInstructor(id);
    if (!inst) return;

    const activities = Store.getActivitiesFor(id);
    const abilities = Store.getAbilitiesFor(id);

    const tierClass = inst.tier.toLowerCase();
    const tierIcon = { Master: '👑', Advanced: '⭐', General: '🔵', Penalty: '🚫' }[inst.tier] || '';

    document.getElementById('detailContent').innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-lg)">
        <div style="width:52px;height:52px;border-radius:var(--radius-md);background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:var(--color-primary)">${inst.name[0]}</div>
        <div>
          <h2 style="font-size:1.3rem;font-weight:700">${inst.name}</h2>
          <div style="display:flex;gap:var(--space-sm);align-items:center;margin-top:4px">
            <span style="color:var(--text-muted);font-size:0.85rem">${inst.instructor_id}</span>
            <span class="tier-badge ${tierClass}">${tierIcon} ${inst.tier}</span>
            <span class="status-dot ${inst.active_status}" style="margin-left:4px"></span>
            <span style="font-size:0.8rem;color:var(--text-secondary)">${inst.active_status}</span>
          </div>
        </div>
        <div style="margin-left:auto;display:flex;gap:var(--space-sm)">
          <button class="btn btn-secondary" onclick="UI.openEditModal('${id}');UI.closeDetail()">✏️ 수정</button>
          <button class="btn btn-danger" onclick="UI.confirmDelete('${id}')">🗑️ 삭제</button>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">기본 정보</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-item-label">최초 기수</div><div class="detail-item-value">${inst.first_cohort || '-'}</div></div>
          <div class="detail-item"><div class="detail-item-label">총점</div><div class="detail-item-value" style="font-size:1.3rem;font-weight:800;color:var(--color-primary)">${inst.total_score}점</div></div>
          <div class="detail-item"><div class="detail-item-label">활동 지역</div><div class="detail-item-value">${inst.activity_region || '-'}</div></div>
          <div class="detail-item"><div class="detail-item-label">활동 시간</div><div class="detail-item-value">${inst.activity_time || '-'}</div></div>
          <div class="detail-item"><div class="detail-item-label">전문성</div><div class="detail-item-value">${inst.specialty || '-'}</div></div>
          <div class="detail-item"><div class="detail-item-label">패널티</div><div class="detail-item-value">${inst.penalty_count > 0 ? `<span style="color:var(--tier-penalty)">${inst.penalty_count}회</span>` : '없음'}</div></div>
        </div>
      </div>

      <div class="tabs">
        <button class="tab active" onclick="UI.switchDetailTab('activities', this)">활동 로그 (${activities.length})</button>
        <button class="tab" onclick="UI.switchDetailTab('abilities', this)">역량 정보 (${abilities.length})</button>
      </div>

      <div id="detailTabContent">
        ${this.renderActivityList(activities)}
      </div>
    `;

    document.getElementById('detailOverlay').classList.add('active');
    this._currentDetailActivities = activities;
    this._currentDetailAbilities = abilities;
  },

  switchDetailTab(tab, btnEl) {
    btnEl.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btnEl.classList.add('active');

    const content = document.getElementById('detailTabContent');
    if (tab === 'activities') {
      content.innerHTML = this.renderActivityList(this._currentDetailActivities);
    } else {
      content.innerHTML = this.renderAbilityList(this._currentDetailAbilities);
    }
  },

  renderActivityList(logs) {
    if (logs.length === 0) return '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">활동 기록이 없습니다</div></div>';

    return `<ul class="log-list">${logs.map(l => {
      const isNeg = l.point < 0;
      const dateStr = new Date(l.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      return `
        <li class="log-item">
          <span class="log-point ${isNeg ? 'negative' : 'positive'}">${isNeg ? '' : '+'}${l.point}</span>
          <div class="log-info">
            <div class="log-type">${l.activity_type} ${l.activity_value ? `(${l.activity_value})` : ''}</div>
            <div class="log-meta">${dateStr} · ${l.source} ${l.note ? `· ${l.note}` : ''}</div>
          </div>
        </li>`;
    }).join('')}</ul>`;
  },

  renderAbilityList(logs) {
    if (logs.length === 0) return '<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-text">역량 기록이 없습니다</div></div>';

    const typeLabels = {
      major_track: '전공', project_track: '프로젝트', teaching_track: '교육 경험',
      skill_track: '핵심 스킬', credential_track: '자격/연구', leadership_track: '리더십'
    };

    return `<ul class="log-list">${logs.map(l => `
      <li class="log-item">
        <span class="log-point positive">+${l.point}</span>
        <div class="log-info">
          <div class="log-type">${typeLabels[l.ability_type] || l.ability_type}: ${l.ability_value}</div>
          <div class="log-meta">${l.note || ''}</div>
        </div>
      </li>`).join('')}</ul>`;
  },

  closeDetail() {
    document.getElementById('detailOverlay').classList.remove('active');
  },

  confirmDelete(id) {
    const inst = Store.getInstructor(id);
    if (!inst) return;
    if (confirm(`정말 "${inst.name}" 강사를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      Store.deleteInstructor(id);
      this.closeDetail();
      this.renderStats();
      this.renderTable();
      this.showToast(`${inst.name} 강사가 삭제되었습니다`, 'info');
    }
  },

  exportData() {
    const data = Store.exportJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doro_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('데이터가 내보내기 되었습니다', 'success');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }
};


// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  await Store.loadAll();
  UI.init();
});
