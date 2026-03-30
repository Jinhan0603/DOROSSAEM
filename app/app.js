/**
 * DORO 강사관리 시스템 Ver 2 — App Logic
 * JSON 파일 기반 CRUD + 점수 집계 + 등급 판정
 */

// ===== Data Store =====
const Store = {
  instructors: [],
  activityLogs: [],
  abilityLogs: [],
  STORAGE_KEY: 'DORO_DATA_V2',

  async loadAll() {
    // 1) Try localStorage first (persisted data)
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.instructors = parsed.instructors || [];
        this.activityLogs = parsed.activityLogs || [];
        this.abilityLogs = parsed.abilityLogs || [];
        this.recalculateAll();
        console.log(`[Store] localStorage 데이터 로드 (강사 ${this.instructors.length}명)`);
        return true;
      } catch (e) {
        console.warn('[Store] localStorage 파싱 실패, JSON 파일에서 로드');
      }
    }

    // 2) Fallback: fetch from JSON files
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
      this.save(); // Save initial data to localStorage
      return true;
    } catch (err) {
      console.error('Data load error:', err);
      // Use embedded sample data for demo
      this.instructors = SAMPLE_DATA.instructors;
      this.activityLogs = SAMPLE_DATA.activityLogs;
      this.abilityLogs = SAMPLE_DATA.abilityLogs;
      this.recalculateAll();
      this.save();
      return false;
    }
  },

  // Persist all data to localStorage
  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        instructors: this.instructors,
        activityLogs: this.activityLogs,
        abilityLogs: this.abilityLogs,
        savedAt: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('[Store] localStorage 저장 실패:', e);
    }
  },

  // Clear localStorage and reload from JSON files
  async resetData() {
    localStorage.removeItem(this.STORAGE_KEY);
    await this.loadAll();
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
    this.save();
  },

  updateInstructor(id, data) {
    const idx = this.instructors.findIndex(i => i.instructor_id === id);
    if (idx !== -1) {
      this.instructors[idx] = { ...this.instructors[idx], ...data };
      this.recalculateAll();
      this.save();
    }
  },

  deleteInstructor(id) {
    this.instructors = this.instructors.filter(i => i.instructor_id !== id);
    this.activityLogs = this.activityLogs.filter(l => l.instructor_id !== id);
    this.abilityLogs = this.abilityLogs.filter(l => l.instructor_id !== id);
    this.save();
  },

  addActivityLog(log) {
    this.activityLogs.push(log);
    this.recalculateAll();
    this.save();
  },

  addAbilityLog(log) {
    this.abilityLogs.push(log);
    this.recalculateAll();
    this.save();
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

    // Reset button
    document.getElementById('btnReset').addEventListener('click', async () => {
      if (confirm('저장된 데이터를 모두 초기화하고 원래 상태로 돌아갑니다.\n계속하시겠습니까?')) {
        await Store.resetData();
        this.renderStats();
        this.renderTable();
        this.showToast('데이터가 초기화되었습니다', 'success');
      }
    });

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

// ===== Region Auto-Calculator =====
const RegionEngine = {
  // University → City/Area mapping (order matters: more specific first)
  UNIVERSITY_DB: [
    // 안산
    { kw: ['한양대 erica', '한양대학교 erica', '한양 에리카', '한양대에리카', '한양대(erica)'], city: '안산' },
    { kw: ['안산대', '안산대학'], city: '안산' },
    { kw: ['신안산대'], city: '안산' },
    // 수원
    { kw: ['경기대', '경기대학교'], city: '수원' },
    { kw: ['아주대', '아주대학교'], city: '수원' },
    { kw: ['성균관대 자연', '성균관대 수원', '성대 수원'], city: '수원' },
    { kw: ['수원대', '수원대학교'], city: '화성' },
    { kw: ['협성대', '협성대학교'], city: '수원' },
    // 서울
    { kw: ['서울대', '서울대학교'], city: '서울 관악' },
    { kw: ['연세대', '연세대학교'], city: '서울 서대문' },
    { kw: ['고려대', '고려대학교'], city: '서울 성북' },
    { kw: ['성균관대', '성균관대학교', '성대'], city: '서울 종로' },
    { kw: ['한양대', '한양대학교'], city: '서울 성동' },
    { kw: ['중앙대 안성'], city: '안성' },
    { kw: ['중앙대', '중앙대학교'], city: '서울 동작' },
    { kw: ['경희대 국제', '경희대학교 국제'], city: '용인' },
    { kw: ['경희대', '경희대학교'], city: '서울 동대문' },
    { kw: ['한국외대', '한국외국어대', '외대'], city: '서울 동대문' },
    { kw: ['건국대', '건국대학교'], city: '서울 광진' },
    { kw: ['세종대', '세종대학교'], city: '서울 광진' },
    { kw: ['동국대', '동국대학교'], city: '서울 중구' },
    { kw: ['숭실대', '숭실대학교'], city: '서울 동작' },
    { kw: ['홍익대', '홍익대학교', '홍대'], city: '서울 마포' },
    { kw: ['서강대', '서강대학교'], city: '서울 마포' },
    { kw: ['이화여대', '이화여자대학교', '이대'], city: '서울 서대문' },
    { kw: ['숙명여대', '숙명여자대학교', '숙대'], city: '서울 용산' },
    { kw: ['국민대', '국민대학교'], city: '서울 성북' },
    { kw: ['서울과기대', '서울과학기술대'], city: '서울 노원' },
    { kw: ['한성대', '한성대학교'], city: '서울 성북' },
    { kw: ['광운대', '광운대학교'], city: '서울 노원' },
    { kw: ['서울시립대', '시립대'], city: '서울 동대문' },
    { kw: ['명지대 용인', '명지대 자연'], city: '용인' },
    { kw: ['명지대', '명지대학교'], city: '서울 서대문' },
    { kw: ['서울여대', '서울여자대학교'], city: '서울 노원' },
    { kw: ['덕성여대', '덕성여자대학교'], city: '서울 도봉' },
    { kw: ['삼육대', '삼육대학교'], city: '서울 노원' },
    { kw: ['상명대 천안'], city: '천안' },
    { kw: ['상명대', '상명대학교'], city: '서울 종로' },
    { kw: ['한국항공대', '항공대'], city: '고양' },
    { kw: ['총신대', '총신대학교'], city: '서울 동작' },
    // 인천
    { kw: ['인하대', '인하대학교'], city: '인천' },
    { kw: ['인천대', '인천대학교'], city: '인천' },
    // 성남/분당
    { kw: ['가천대 글로벌', '가천대학교 글로벌'], city: '인천' },
    { kw: ['가천대', '가천대학교'], city: '성남' },
    // 용인
    { kw: ['단국대 천안', '단국대학교 천안'], city: '천안' },
    { kw: ['단국대', '단국대학교'], city: '용인' },
    { kw: ['강남대', '강남대학교'], city: '용인' },
    { kw: ['용인대', '용인대학교'], city: '용인' },
    // 고양/김포
    { kw: ['김포대'], city: '김포' },
    // 부천
    { kw: ['가톨릭대', '가톨릭대학교'], city: '부천' },
    // 의정부
    { kw: ['신한대', '신한대학교'], city: '의정부' },
    // 천안/아산
    { kw: ['호서대', '호서대학교'], city: '천안' },
    { kw: ['백석대', '백석대학교'], city: '천안' },
    { kw: ['남서울대', '남서울대학교'], city: '천안' },
    { kw: ['순천향대', '순천향대학교'], city: '아산' },
    { kw: ['한국기술교육대', '한기대', '코리아텍'], city: '천안' },
    // 안성/평택
    { kw: ['한경국립대', '한경대', '한경대학교'], city: '안성' },
    { kw: ['평택대', '평택대학교'], city: '평택' },
    { kw: ['한신대', '한신대학교'], city: '오산' },
  ],

  // Hub system: 거점별 접근 가능 지역 (대중교통 기반)
  HUBS: [
    { name: '안산',   core: ['안산'], near: ['시흥','군포','의왕','광명'], ext: ['수원','화성','과천','안양'] },
    { name: '수원',   core: ['수원'], near: ['화성','오산','용인','의왕','동탄'], ext: ['안산','시흥','안양','평택','성남','과천','군포'] },
    { name: '인천',   core: ['인천','부평','계양','미추홀','연수','남동'], near: ['부천','시흥','김포','광명'], ext: ['안산','안양'] },
    { name: '서울 강남', core: ['서울 강남','서울 서초','서울 송파'], near: ['서울 강동','서울 동작','과천','성남','하남'], ext: ['서울 관악','서울 용산','용인'] },
    { name: '서울 강북', core: ['서울 종로','서울 중구','서울 성동'], near: ['서울 동대문','서울 광진','서울 성북','서울 용산'], ext: ['서울 마포','서울 서대문','서울 강남','구리'] },
    { name: '서울 서부', core: ['서울 마포','서울 서대문','서울 은평'], near: ['서울 영등포','서울 양천','서울 종로','서울 용산'], ext: ['고양','서울 구로','서울 강서','부천','김포'] },
    { name: '서울 남부', core: ['서울 관악','서울 동작','서울 영등포'], near: ['서울 구로','서울 금천','서울 양천','서울 강남','안양','과천'], ext: ['서울 서초','광명','군포','서울 마포'] },
    { name: '서울 동부', core: ['서울 광진','서울 강동','서울 송파'], near: ['서울 성동','서울 동대문','하남','구리','남양주'], ext: ['서울 강남','서울 중구','성남'] },
    { name: '서울 북부', core: ['서울 노원','서울 도봉','서울 강북'], near: ['의정부','서울 성북','서울 중랑','남양주'], ext: ['양주','구리','서울 동대문'] },
    { name: '고양/파주', core: ['고양','파주'], near: ['김포','서울 은평','서울 마포'], ext: ['서울 서대문','서울 종로','의정부'] },
    { name: '성남/분당', core: ['성남','분당','판교'], near: ['용인','광주','하남','서울 강남','서울 송파'], ext: ['수원','서울 서초','서울 강동','과천'] },
    { name: '평택/천안', core: ['평택','천안','아산'], near: ['오산','안성'], ext: ['수원','화성'] },
    { name: '의정부/북부', core: ['의정부','양주','동두천'], near: ['서울 노원','서울 도봉','포천','남양주'], ext: ['구리','서울 강북'] },
  ],

  // Normalize city name from free-text input
  normalizeCity(text) {
    if (!text) return null;
    let s = text.trim()
      .replace(/특별시|광역시|도|자치시|자치도/g, '')
      .replace(/시$|군$|구$/g, '')
      .trim();
    // Map Seoul districts
    const seoulDistricts = ['강남','서초','송파','강동','관악','동작','영등포','구로','금천','양천','강서','마포','서대문','은평','종로','중구','성동','동대문','광진','성북','용산','노원','도봉','강북','중랑'];
    for (const d of seoulDistricts) {
      if (s.includes(d)) return '서울 ' + d;
    }
    // Map Incheon districts
    const incheonDistricts = ['부평','계양','미추홀','연수','남동','서구','중구','동구','부천'];
    for (const d of incheonDistricts) {
      if (s.includes(d) && s.includes('인천')) return '인천';
    }
    // Strip remaining suffixes
    s = s.replace(/시|군|구/g, '').trim();
    // Common aliases
    const aliases = { '서울': '서울 종로', '분당': '성남', '판교': '성남', '동탄': '화성', '일산': '고양', '산본': '군포', '범계': '안양' };
    return aliases[s] || s;
  },

  // Lookup university to get city
  lookupUniversity(name) {
    if (!name) return null;
    const n = name.trim().toLowerCase().replace(/\s+/g, ' ');
    for (const entry of this.UNIVERSITY_DB) {
      if (entry.kw.some(k => n.includes(k.toLowerCase()))) {
        return entry.city;
      }
    }
    return null;
  },

  // Find which hubs cover a city
  findHubs(city) {
    if (!city) return [];
    const c = city.toLowerCase();
    return this.HUBS.filter(h =>
      h.core.some(x => c.includes(x.toLowerCase()) || x.toLowerCase().includes(c)) ||
      h.near.some(x => c.includes(x.toLowerCase()) || x.toLowerCase().includes(c)) ||
      h.ext.some(x => c.includes(x.toLowerCase()) || x.toLowerCase().includes(c))
    );
  },

  // Calculate activity region from residence + university
  calculate(residence, universityName) {
    const residenceCity = this.normalizeCity(residence);
    const uniCity = this.lookupUniversity(universityName);

    if (!residenceCity && !uniCity) return '';

    // Find hubs for each location
    const resHubs = this.findHubs(residenceCity);
    const uniHubs = this.findHubs(uniCity);

    // Find common hubs (both locations covered)
    let primaryHub = null;
    if (resHubs.length > 0 && uniHubs.length > 0) {
      primaryHub = resHubs.find(h => uniHubs.includes(h));
    }
    if (!primaryHub) {
      // Pick the hub closest to the residence (or university if no residence)
      primaryHub = resHubs[0] || uniHubs[0];
    }
    if (!primaryHub) return '';

    // Build reachable cities list
    const reachable = new Set(primaryHub.core);
    primaryHub.near.forEach(c => reachable.add(c));

    // If user has a second location in a different hub, add its core too
    const secondCity = residenceCity && uniCity && residenceCity !== uniCity
      ? (primaryHub.core.some(c => c === residenceCity || residenceCity.includes(c)) ? uniCity : residenceCity)
      : null;
    if (secondCity) {
      const secondHubs = this.findHubs(secondCity);
      if (secondHubs.length > 0 && secondHubs[0] !== primaryHub) {
        secondHubs[0].core.forEach(c => reachable.add(c));
      }
    }

    // Format: remove "서울 " prefix for cleaner display within Seoul hubs
    const hubName = primaryHub.name;
    const cities = [...reachable]
      .map(c => c.replace(/^서울 /, ''))
      .slice(0, 6)
      .join(', ');

    return `[${hubName} 거점] ${cities}`;
  }
};


// ===== Specialty Auto-Extractor =====
const SpecialtyEngine = {
  // Keyword → Specialty tag mapping
  KEYWORDS: [
    { tag: 'Python',       kw: ['파이썬','python','파이선','django','flask','tensorflow','pytorch','keras'] },
    { tag: 'AI',           kw: ['ai','인공지능','딥러닝','머신러닝','기계학습','객체인식','deep learning','machine learning','자연어처리','nlp','컴퓨터비전','신경망'] },
    { tag: 'Scratch',      kw: ['스크래치','scratch'] },
    { tag: '엔트리',       kw: ['엔트리','entry'] },
    { tag: '아두이노',     kw: ['아두이노','arduino'] },
    { tag: 'ROS',          kw: ['ros','로봇운영체제'] },
    { tag: 'CAD',          kw: ['cad','캐드','solidworks','솔리드웍스','autocad','오토캐드','fusion','인벤터','inventor'] },
    { tag: '3D프린팅',     kw: ['3d프린팅','3d프린터','3d 프린팅','3d 프린터','적층제조'] },
    { tag: '로봇',         kw: ['로봇','robot','로보틱스','robotics'] },
    { tag: 'C/C++',        kw: ['c언어','c++','c 언어','c/c++','임베디드'] },
    { tag: 'Java',         kw: ['자바','java','spring','스프링'] },
    { tag: 'IoT',          kw: ['iot','사물인터넷'] },
    { tag: '웹개발',       kw: ['웹개발','html','css','javascript','react','vue','node','웹 개발','프론트엔드','백엔드','풀스택'] },
    { tag: '앱개발',       kw: ['앱개발','android','ios','flutter','react native','앱 개발','안드로이드','어플','모바일'] },
    { tag: '라즈베리파이', kw: ['라즈베리파이','라즈베리 파이','raspberry'] },
    { tag: '드론',         kw: ['드론','drone','uav'] },
    { tag: '데이터분석',   kw: ['데이터분석','데이터 분석','pandas','r언어','통계','빅데이터','데이터사이언스'] },
    { tag: '게임개발',     kw: ['게임개발','게임 개발','unity','유니티','unreal','언리얼'] },
    { tag: '영상편집',     kw: ['영상편집','영상 편집','프리미어','에프터이펙트','영상제작'] },
    { tag: '코딩교육',     kw: ['코딩교육','코딩 교육','코딩강사','sw교육','소프트웨어 교육','정보교육'] },
  ],

  // Department → Specialty hint mapping
  DEPT_HINTS: [
    { kw: ['컴퓨터','소프트웨어','sw','정보통신','it'], tags: ['Python','코딩교육'] },
    { kw: ['로봇','메카트로닉스'], tags: ['로봇','아두이노','ROS'] },
    { kw: ['전자','전기','제어'], tags: ['아두이노','IoT'] },
    { kw: ['기계','산업디자인'], tags: ['CAD','3D프린팅'] },
    { kw: ['ai','인공지능','데이터'], tags: ['AI','Python','데이터분석'] },
    { kw: ['교육','사범'], tags: ['코딩교육'] },
    { kw: ['디자인','미디어','영상'], tags: ['영상편집'] },
  ],

  // Extract specialties from career text + department
  extract(careerText, department) {
    const found = new Set();
    const textLower = (careerText || '').toLowerCase().replace(/\s+/g, ' ');
    const deptLower = (department || '').toLowerCase();

    // Scan career text for keyword matches
    for (const entry of this.KEYWORDS) {
      if (entry.kw.some(k => textLower.includes(k.toLowerCase()))) {
        found.add(entry.tag);
      }
    }

    // Add department-based hints (only if career didn't produce results)
    if (found.size === 0 && deptLower) {
      for (const hint of this.DEPT_HINTS) {
        if (hint.kw.some(k => deptLower.includes(k))) {
          hint.tags.forEach(t => found.add(t));
        }
      }
    }

    return [...found].slice(0, 5).join(', ');
  }
};


// ===== Upload Module =====
const Upload = {
  parsedData: [],      // Raw parsed rows from file
  fileHeaders: [],     // Column headers from file
  columnMapping: {},   // Maps DB field -> file column header
  fileName: '',

  // DB fields that can be mapped from uploaded file
  FIELDS: [
    { key: 'name', label: '이름', required: true },
    { key: 'first_cohort', label: '최초 기수', required: false },
    { key: 'active_status', label: '활동 상태', required: false },
    { key: 'activity_region', label: '활동 지역', required: false },
    { key: 'activity_time', label: '활동 시간', required: false },
    { key: 'specialty', label: '전문성', required: false },
    { key: 'gender', label: '성별', required: false },
    { key: 'university', label: '대학교', required: false },
    { key: 'department', label: '학과', required: false },
    { key: 'phone', label: '전화번호', required: false },
    { key: 'email', label: '이메일', required: false },
    { key: 'current_residence', label: '현 거주지', required: false },
    { key: 'career_history', label: '강의/개발 경력', required: false },
  ],

  // Auto-matching rules: file header keywords -> DB field key
  HEADER_ALIASES: {
    'name': ['이름', '성명', '강사명', 'name', '강사 이름'],
    'first_cohort': ['기수', '최초 기수', 'cohort', '합격 기수', '합격기수', '몇 기', '전형', '현 기수'],
    'active_status': ['활동', '활동 상태', '활동 여부', 'status', '상태'],
    'activity_region': ['지역', '활동 지역', '거점', 'region', '활동가능지역', '활동 가능 지역'],
    'activity_time': ['시간', '활동 시간', '가능 시간', 'time', '활동가능시간', '활동 가능 시간'],
    'specialty': ['전문', '전문성', '전문 분야', 'specialty', '전문분야', '스킬', '역량'],
    'gender': ['성별', 'gender'],
    'university': ['대학', '대학교', '학교', 'university'],
    'department': ['학과', '전공', 'department', '학부'],
    'phone': ['전화', '연락처', '핸드폰', '전화번호', 'phone', '휴대폰', '번호'],
    'email': ['이메일', '메일', 'email', 'e-mail'],
    'current_residence': ['거주지', '거주', '현 거주지', '주소', '현거주지'],
    'career_history': ['경력', '강의/개발 경력', '강의 경력', '개발 경력', '진행하셨던', 'career'],
  },

  init() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');

    // Upload button
    document.getElementById('btnUpload').addEventListener('click', () => this.openModal());

    // Close modal
    document.getElementById('uploadOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
    document.getElementById('uploadClose').addEventListener('click', () => this.closeModal());

    // Dropzone click
    dropzone.addEventListener('click', () => fileInput.click());

    // Drag events
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleFile(file);
      e.target.value = ''; // Reset for re-upload
    });

    // Back button
    document.getElementById('btnUploadBack').addEventListener('click', () => this.showStep(1));

    // Import button
    document.getElementById('btnImport').addEventListener('click', () => this.doImport());

    // Done button
    document.getElementById('btnUploadDone').addEventListener('click', () => this.closeModal());

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('uploadOverlay').classList.contains('active')) {
        this.closeModal();
      }
    });
  },

  openModal() {
    this.showStep(1);
    document.getElementById('uploadOverlay').classList.add('active');
  },

  closeModal() {
    document.getElementById('uploadOverlay').classList.remove('active');
    this.parsedData = [];
    this.fileHeaders = [];
    this.columnMapping = {};
  },

  showStep(step) {
    document.getElementById('uploadStep1').style.display = step === 1 ? 'block' : 'none';
    document.getElementById('uploadStep2').style.display = step === 2 ? 'block' : 'none';
    document.getElementById('uploadStep3').style.display = step === 3 ? 'block' : 'none';
  },

  async handleFile(file) {
    const validExts = ['.xlsx', '.xls', '.csv'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExts.includes(ext)) {
      UI.showToast('지원하지 않는 파일 형식입니다. (.xlsx, .xls, .csv)', 'error');
      return;
    }

    this.fileName = file.name;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      // Use first sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (jsonData.length === 0) {
        UI.showToast('파일에 데이터가 없습니다.', 'error');
        return;
      }

      this.fileHeaders = Object.keys(jsonData[0]);
      this.parsedData = jsonData;

      // Auto-detect column mapping
      this.autoDetectMapping();

      // Show step 2
      this.showStep(2);
      this.renderFileInfo(file, jsonData.length, sheetName);
      this.renderMappingUI();
      this.renderPreview();

    } catch (err) {
      console.error('File parse error:', err);
      UI.showToast('파일 읽기 실패: ' + err.message, 'error');
    }
  },

  autoDetectMapping() {
    this.columnMapping = {};

    for (const field of this.FIELDS) {
      const aliases = this.HEADER_ALIASES[field.key] || [];
      let bestMatch = null;

      for (const header of this.fileHeaders) {
        const h = header.trim().toLowerCase().replace(/\s+/g, ' ');

        // Exact match
        if (aliases.some(a => a.toLowerCase() === h)) {
          bestMatch = header;
          break;
        }

        // Contains match
        if (!bestMatch && aliases.some(a => h.includes(a.toLowerCase()) || a.toLowerCase().includes(h))) {
          bestMatch = header;
        }
      }

      if (bestMatch) {
        this.columnMapping[field.key] = bestMatch;
      }
    }
  },

  renderFileInfo(file, rowCount, sheetName) {
    const sizeStr = file.size > 1024 * 1024
      ? (file.size / 1024 / 1024).toFixed(1) + ' MB'
      : Math.round(file.size / 1024) + ' KB';

    document.getElementById('uploadFileInfo').innerHTML = `
      <span class="file-icon">📄</span>
      <div>
        <div class="file-name">${file.name}</div>
        <div class="file-meta">${sizeStr} · 시트: ${sheetName} · ${rowCount}행 · ${this.fileHeaders.length}열</div>
      </div>
    `;
  },

  renderMappingUI() {
    const grid = document.getElementById('mappingGrid');
    grid.innerHTML = this.FIELDS.map(field => {
      const options = this.fileHeaders.map(h => {
        const selected = this.columnMapping[field.key] === h ? 'selected' : '';
        return `<option value="${this.escapeHtml(h)}" ${selected}>${this.escapeHtml(h)}</option>`;
      }).join('');

      const requiredMark = field.required ? ' <span style="color:var(--tier-penalty)">*</span>' : '';

      return `
        <div class="mapping-item">
          <span class="mapping-label">${field.label}${requiredMark}</span>
          <span class="mapping-arrow">←</span>
          <select data-field="${field.key}" onchange="Upload.updateMapping('${field.key}', this.value)">
            <option value="">— 선택 안함 —</option>
            ${options}
          </select>
        </div>
      `;
    }).join('');
  },

  updateMapping(fieldKey, headerValue) {
    if (headerValue) {
      this.columnMapping[fieldKey] = headerValue;
    } else {
      delete this.columnMapping[fieldKey];
    }
    this.renderPreview();
  },

  renderPreview() {
    const nameCol = this.columnMapping['name'];
    if (!nameCol) {
      document.getElementById('previewCount').textContent = '(이름 열을 매핑해주세요)';
      document.getElementById('previewHead').innerHTML = '';
      document.getElementById('previewBody').innerHTML = `
        <tr><td colspan="5">
          <div class="empty-state">
            <div class="empty-state-icon">📌</div>
            <div class="empty-state-text">"이름" 필드를 매핑하면 미리보기가 표시됩니다</div>
          </div>
        </td></tr>`;
      return;
    }

    // Build mapped preview data with auto-calculations
    const mapped = this.parsedData.map(row => {
      const result = {};
      for (const field of this.FIELDS) {
        const col = this.columnMapping[field.key];
        result[field.key] = col ? String(row[col] || '').trim() : '';
      }
      // Auto-calculate activity_region if not directly mapped
      if (!this.columnMapping['activity_region'] && (result.current_residence || result.university)) {
        result._auto_region = RegionEngine.calculate(result.current_residence, result.university);
      }
      // Auto-calculate specialty if not directly mapped
      if (!this.columnMapping['specialty'] && (result.career_history || result.department)) {
        result._auto_specialty = SpecialtyEngine.extract(result.career_history, result.department);
      }
      return result;
    }).filter(r => r.name);

    // Check for existing
    const existingNames = new Set(Store.instructors.map(i => i.name));

    document.getElementById('previewCount').textContent = `(${mapped.length}명)`;

    // Build display columns: mapped fields + auto-calculated fields
    const mappedFields = this.FIELDS.filter(f => this.columnMapping[f.key]);
    const hasAutoRegion = mapped.some(r => r._auto_region);
    const hasAutoSpecialty = mapped.some(r => r._auto_specialty);

    let headerHtml = '<tr><th>#</th><th>상태</th>';
    headerHtml += mappedFields.map(f => `<th>${f.label}</th>`).join('');
    if (hasAutoRegion) headerHtml += '<th style="color:var(--tier-advanced)">🤖 활동 지역</th>';
    if (hasAutoSpecialty) headerHtml += '<th style="color:var(--tier-advanced)">🤖 전문성</th>';
    headerHtml += '</tr>';
    document.getElementById('previewHead').innerHTML = headerHtml;

    // Table body (show up to 50 rows)
    const displayRows = mapped.slice(0, 50);
    document.getElementById('previewBody').innerHTML = displayRows.map((row, i) => {
      const exists = existingNames.has(row.name);
      const cls = exists ? 'row-existing' : '';
      const badge = exists
        ? '<span class="row-badge exists">기존</span>'
        : '<span class="row-badge new">신규</span>';

      let cells = `<td>${i + 1}</td><td>${badge}</td>`;
      cells += mappedFields.map(f => `<td title="${this.escapeHtml(row[f.key])}">${this.escapeHtml(row[f.key]) || '-'}</td>`).join('');
      if (hasAutoRegion) cells += `<td style="color:var(--tier-advanced);font-size:0.75rem" title="${this.escapeHtml(row._auto_region)}">${this.escapeHtml(row._auto_region) || '<span style="color:var(--text-muted)">-</span>'}</td>`;
      if (hasAutoSpecialty) cells += `<td style="color:var(--tier-advanced);font-size:0.75rem" title="${this.escapeHtml(row._auto_specialty)}">${this.escapeHtml(row._auto_specialty) || '<span style="color:var(--text-muted)">-</span>'}</td>`;

      return `<tr class="${cls}">${cells}</tr>`;
    }).join('');

    const totalCols = mappedFields.length + 2 + (hasAutoRegion ? 1 : 0) + (hasAutoSpecialty ? 1 : 0);
    if (mapped.length > 50) {
      document.getElementById('previewBody').innerHTML += `
        <tr><td colspan="${totalCols}" style="text-align:center;color:var(--text-muted);padding:var(--space-md)">
          ... 외 ${mapped.length - 50}명 더
        </td></tr>`;
    }
  },

  doImport() {
    const nameCol = this.columnMapping['name'];
    if (!nameCol) {
      UI.showToast('이름 열이 매핑되지 않았습니다.', 'error');
      return;
    }

    const overwrite = document.getElementById('chkOverwrite').checked;
    const existingNames = new Map(Store.instructors.map(i => [i.name, i]));

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of this.parsedData) {
      const name = String(row[nameCol] || '').trim();
      if (!name) continue;

      const data = {};
      for (const field of this.FIELDS) {
        const col = this.columnMapping[field.key];
        if (col) {
          data[field.key] = String(row[col] || '').trim();
        }
      }

      // Normalize active_status
      if (data.active_status) {
        const val = data.active_status.toLowerCase();
        if (val.includes('active') || val.includes('활동') || val === 'o' || val === 'yes' || val === '예') {
          data.active_status = 'active';
        } else if (val.includes('inactive') || val.includes('비활') || val === 'x' || val === 'no' || val === '아니오') {
          data.active_status = 'inactive';
        } else {
          data.active_status = 'active'; // Default
        }
      } else {
        data.active_status = 'active';
      }

      // Normalize first_cohort (add "기" suffix if just a number)
      if (data.first_cohort) {
        const num = data.first_cohort.replace(/[^0-9]/g, '');
        if (num && !data.first_cohort.includes('기')) {
          data.first_cohort = num + '기';
        }
      }

      // ── Auto-calculate activity_region ──
      if (!data.activity_region && (data.current_residence || data.university)) {
        data.activity_region = RegionEngine.calculate(data.current_residence, data.university);
      }

      // ── Auto-calculate specialty ──
      if (!data.specialty && (data.career_history || data.department)) {
        data.specialty = SpecialtyEngine.extract(data.career_history, data.department);
      }

      // Check if exists
      const existing = existingNames.get(name);

      if (existing) {
        if (overwrite) {
          // Update existing instructor (keep ID, score, tier, penalty)
          const updateData = { ...data };
          delete updateData.instructor_id;
          // Remove non-DB helper fields
          delete updateData.career_history;
          delete updateData.gender;
          delete updateData.university;
          delete updateData.department;
          delete updateData.phone;
          delete updateData.email;
          delete updateData.current_residence;
          Store.updateInstructor(existing.instructor_id, updateData);
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Add new instructor
        const newInstructor = {
          instructor_id: Store.generateId(),
          name: data.name,
          first_cohort: data.first_cohort || '',
          active_status: data.active_status || 'active',
          activity_region: data.activity_region || '',
          activity_time: data.activity_time || '',
          specialty: data.specialty || '',
          total_score: 0,
          tier: 'General',
          penalty_count: 0,
          last_updated: new Date().toISOString(),
        };
        Store.addInstructor(newInstructor);
        existingNames.set(name, newInstructor); // Prevent same-file duplicates
        added++;
      }
    }

    // Recalculate and re-render
    Store.recalculateAll();
    Store.save();
    UI.renderStats();
    UI.renderTable();

    // ── Analyze missing data ──
    const CRITICAL_FIELDS = [
      { key: 'activity_time', label: '활동 가능 시간', icon: '⏰', desc: '강의 배정에 필수 (예: 오전-월,수,금)' },
      { key: 'specialty', label: '전문 분야', icon: '🎯', desc: '강사 역량 파악 (예: Python, Scratch, AI)' },
      { key: 'activity_region', label: '활동 지역', icon: '📍', desc: '강의 배정 지역 (자동 계산 가능)' },
    ];

    const totalImported = added + updated;
    const missingReport = [];

    if (totalImported > 0) {
      for (const field of CRITICAL_FIELDS) {
        const missingCount = Store.instructors.filter(i =>
          !i[field.key] || i[field.key].trim() === ''
        ).length;
        if (missingCount > 0) {
          missingReport.push({ ...field, missingCount, pct: Math.round(missingCount / Store.instructors.length * 100) });
        }
      }
    }

    // Show result
    this.showStep(3);

    let missingHtml = '';
    if (missingReport.length > 0) {
      missingHtml = `
        <div class="missing-data-alert">
          <div class="missing-alert-header">
            <span class="missing-alert-icon">⚠️</span>
            <span class="missing-alert-title">정보를 채워 주세요!</span>
          </div>
          <p class="missing-alert-desc">아래 정보가 부족한 강사가 있습니다. 추가 수집이 필요합니다.</p>
          <div class="missing-items">
            ${missingReport.map(r => `
              <div class="missing-item">
                <div class="missing-item-header">
                  <span>${r.icon} ${r.label}</span>
                  <span class="missing-item-count">${r.missingCount}명 미입력 (${r.pct}%)</span>
                </div>
                <div class="missing-item-bar">
                  <div class="missing-item-fill" style="width:${100 - r.pct}%"></div>
                </div>
                <div class="missing-item-desc">${r.desc}</div>
              </div>
            `).join('')}
          </div>
          <div class="missing-alert-action">
            💡 <strong>권장:</strong> 기존 구글폼의 활동시간(14번), 경력(15번) 질문으로 추가 설문을 발송하세요.
          </div>
        </div>
      `;
    }

    document.getElementById('uploadResult').innerHTML = `
      <div class="result-icon">🎉</div>
      <div class="result-title">일괄 등록 완료!</div>
      <div class="result-stats">
        <div class="result-stat">
          <div class="result-stat-value" style="color:var(--status-active)">${added}</div>
          <div class="result-stat-label">신규 등록</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-value" style="color:var(--color-primary)">${updated}</div>
          <div class="result-stat-label">업데이트</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-value" style="color:var(--text-muted)">${skipped}</div>
          <div class="result-stat-label">건너뛰기</div>
        </div>
      </div>
      ${missingHtml}
    `;

    UI.showToast(`${added}명 등록, ${updated}명 업데이트 완료`, 'success');
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};


// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  await Store.loadAll();
  UI.init();
  Upload.init();
});
