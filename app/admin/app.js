/**
 * DORO Admin App - Main Application Logic
 * Part 1: Navigation, Dashboard, Toast, Modal
 */

// ═══ State ═══
let currentView = 'dashboard';
let lectureTabFilter = 'all';
let evalTabFilter = 'eval-pending';
let reqTabFilter = 'req-pending';
let insTabFilter = 'ins-all';

// ═══ Init ═══
document.addEventListener('DOMContentLoaded', () => {
    DB._init();
    setupNavigation();
    setupQueueCards();
    setupGlobalSearch();
    setupSettingsButtons();
    setupModalClose();
    setupTabButtons();
    refreshAll();
});

// ═══ Navigation ═══
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view) navigateTo(view);
        });
    });
}

function navigateTo(view) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`[data-view="${view}"]`);
    if (navItem) navItem.classList.add('active');

    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(`view-${view}`);
    if (section) section.classList.add('active');

    const titles = {
        dashboard: ['대시보드', '처리 큐 현황'],
        lectures: ['강의 관리', 'Lecture Master'],
        evaluations: ['강의 평가', '학생·기관·동료 평가 관리'],
        requests: ['승인 대기', '내부기여 승인 큐'],
        instructors: ['강사 목록', '강사 정보 및 점수 관리'],
        incidents: ['가산 / 감점', 'Incident 관리'],
        reports: ['월간 리포트', '스냅샷 및 통계'],
        settings: ['설정', '시스템 설정 및 데이터 관리'],
        'schedule-requests': ['강의 공고', '공고 관리 및 회차 생성'],
        'schedule-assign': ['일정 배정', '추천 엔진 기반 강사 배정'],
        'availability': ['가용시간', '강사 요일별 가용시간 관리'],
        'ledger': ['결과 원장', '강의 결과 기록 (기존 엑셀 대체)']
    };
    const [title, subtitle] = titles[view] || [view, ''];
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-subtitle').textContent = subtitle;

    refreshView(view);
}

function refreshAll() {
    refreshDashboard();
    refreshBadges();
}

function refreshView(view) {
    switch(view) {
        case 'dashboard': refreshDashboard(); break;
        case 'lectures': renderLectures(); break;
        case 'evaluations': renderEvaluations(); break;
        case 'requests': renderRequests(); break;
        case 'instructors': renderInstructors(); break;
        case 'incidents': renderIncidents(); break;
        case 'reports': renderReports(); break;
    }
}

// ═══ Dashboard ═══
function refreshDashboard() {
    const lectures = DB.lectures.getAll();
    const instructors = DB.instructors.getAll();
    const pending = DB.actionRequests.getPending();
    const today = new Date().toISOString().split('T')[0];
    
    const incomplete = lectures.filter(l => l.date <= today && l.status === 'scheduled').length;
    const evalPending = lectures.filter(l => l.status === 'completed' && l.evaluation_status !== 'complete').length;
    const incidents = DB.activityLog.getAll().filter(l => l.category === 'penalty' && !l.reversal_of).length;

    document.getElementById('q-incomplete').textContent = incomplete;
    document.getElementById('q-eval').textContent = evalPending;
    document.getElementById('q-pending').textContent = pending.length;
    document.getElementById('q-incidents').textContent = incidents;

    document.getElementById('stat-total-instructors').textContent = instructors.length;
    document.getElementById('stat-masters').textContent = instructors.filter(i => (i.grade || i.tier) === 'Master').length;
    document.getElementById('stat-total-lectures').textContent = lectures.length;
    
    const scores = instructors.filter(i => i.total_score > 0).map(i => i.total_score);
    const avg = scores.length ? (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1) : '-';
    document.getElementById('stat-avg-score').textContent = avg;

    renderRecentActivity();
    renderTopInstructors();
    refreshBadges();
}

function refreshBadges() {
    const today = new Date().toISOString().split('T')[0];
    const lectures = DB.lectures.getAll();
    document.getElementById('badge-lectures').textContent = lectures.filter(l => l.date <= today && l.status === 'scheduled').length;
    document.getElementById('badge-evaluations').textContent = lectures.filter(l => l.status === 'completed' && l.evaluation_status !== 'complete').length;
    document.getElementById('badge-requests').textContent = DB.actionRequests.getPending().length;
}

function renderRecentActivity() {
    const logs = DB.activityLog.getAll().sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
    const container = document.getElementById('recent-activity');
    
    if (!logs.length) {
        container.innerHTML = '<div class="empty-state"><i class="ph ph-clock-clockwise"></i><p>활동 기록이 없습니다</p></div>';
        return;
    }

    container.innerHTML = logs.map(log => {
        const ins = DB.instructors.getById(log.instructor_id);
        const name = ins ? ins.name : log.instructor_id;
        const pointClass = (log.point || 0) >= 0 ? 'positive' : 'negative';
        const pointText = log.point != null ? `<span class="timeline-point ${pointClass}">${log.point > 0 ? '+' : ''}${log.point}p</span>` : '';
        return `<div class="timeline-item ${log.category}">
            <div class="timeline-date">${formatDate(log.date)}</div>
            <div class="timeline-content"><strong>${name}</strong> ${log.description} ${pointText}</div>
        </div>`;
    }).join('');
}

function renderTopInstructors() {
    const top = DB.instructors.getAll().sort((a,b) => b.total_score - a.total_score).slice(0, 5);
    const container = document.getElementById('top-instructors');
    
    if (!top.length) {
        container.innerHTML = '<div class="empty-state"><i class="ph ph-trophy"></i><p>강사가 없습니다</p></div>';
        return;
    }

    container.innerHTML = top.map((ins, idx) => {
        const gradeInfo = ScoreCalculator.calcGrade(ins.total_score || 0);
        return `<div class="approval-item" style="cursor:pointer;" onclick="showInstructorProfile('${ins.instructor_id}')">
            <div class="approval-info">
                <div class="approval-title">${idx + 1}. ${ins.name || ''} <span class="badge ${(ins.grade || ins.tier || 'trainee').toLowerCase()}">${gradeInfo.icon} ${ins.grade || ins.tier || 'Trainee'}</span></div>
                <div class="approval-desc">${ins.major || ins.specialty || ''} · 총점 ${ins.total_score || 0}</div>
            </div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--accent-blue);">${ins.total_score || 0}</div>
        </div>`;
    }).join('');
}

// ═══ Queue Card Click ═══
function setupQueueCards() {
    document.querySelectorAll('.queue-card').forEach(card => {
        card.addEventListener('click', () => {
            const action = card.dataset.action;
            if (action === 'go-lectures') navigateTo('lectures');
            else if (action === 'go-evaluations') navigateTo('evaluations');
            else if (action === 'go-requests') navigateTo('requests');
            else if (action === 'go-incidents') navigateTo('incidents');
        });
    });
}

// ═══ Lectures ═══
function renderLectures() {
    let lectures = DB.lectures.getAll().sort((a,b) => new Date(b.date) - new Date(a.date));
    if (lectureTabFilter === 'scheduled') lectures = lectures.filter(l => l.status === 'scheduled');
    else if (lectureTabFilter === 'completed') lectures = lectures.filter(l => l.status === 'completed');

    const tbody = document.getElementById('lectures-tbody');
    if (!lectures.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">강의가 없습니다</td></tr>';
        return;
    }

    tbody.innerHTML = lectures.map(l => {
        const lead = DB.instructors.getById(l.lead_instructor_id);
        const assistants = (l.assistant_instructor_ids || []).map(id => DB.instructors.getById(id)).filter(Boolean);
        const typeLabels = { general: '일반', dls: 'DLS', doroland: 'DOROLAND', camp: '캠프', operation: '운영' };
        const evalBadge = SCORING_RULES.evaluationBadges[l.evaluation_status] || SCORING_RULES.evaluationBadges.pending;
        
        const completeBtn = l.status === 'scheduled' 
            ? `<button class="btn btn-sm btn-success" onclick="completeLecture('${l.lecture_id}')"><i class="ph ph-check"></i> 완료</button>` 
            : '';

        return `<tr>
            <td>${formatDate(l.date)}</td>
            <td class="name-cell">${l.institution}</td>
            <td>${l.lecture_name}</td>
            <td><span class="badge ${l.lecture_type}">${typeLabels[l.lecture_type] || l.lecture_type}</span></td>
            <td>${lead ? lead.name : '-'}</td>
            <td>${assistants.map(a => a.name).join(', ') || '-'}</td>
            <td><span class="badge ${l.status}">${l.status === 'scheduled' ? '예정' : l.status === 'completed' ? '완료' : '취소'}</span></td>
            <td><span class="badge eval-${l.evaluation_status}" style="background:${evalBadge.bgColor};color:${evalBadge.color};">${evalBadge.label}</span></td>
            <td>${completeBtn}</td>
        </tr>`;
    }).join('');
}

function completeLecture(id) {
    if (!confirm('이 강의를 완료 처리하시겠습니까?\n→ Activity_Log가 자동 생성됩니다.')) return;
    DB.lectures.complete(id);
    toast('강의 완료 처리됨 (Activity_Log 자동 생성)', 'success');
    renderLectures();
    refreshBadges();
}

// ═══ Evaluations ═══
function renderEvaluations() {
    let lectures = DB.lectures.getAll().filter(l => l.status === 'completed');
    if (evalTabFilter === 'eval-pending') {
        lectures = lectures.filter(l => l.evaluation_status !== 'complete');
    }
    lectures.sort((a,b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('evaluations-tbody');
    if (!lectures.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">평가 데이터가 없습니다</td></tr>';
        return;
    }

    const rows = [];
    lectures.forEach(l => {
        const allIns = [l.lead_instructor_id, ...(l.assistant_instructor_ids || [])].filter(Boolean);
        allIns.forEach(insId => {
            const ins = DB.instructors.getById(insId);
            const summaries = DB.evalSummary.getByLecture(l.lecture_id).filter(s => s.instructor_id === insId);
            const getScore = (type) => {
                const s = summaries.find(s => s.evaluator_type === type);
                return s ? `${s.avg_score.toFixed(1)}/5 (${s.response_count}건)` : '<span class="text-muted">미수집</span>';
            };
            const evalBadge = SCORING_RULES.evaluationBadges[l.evaluation_status] || SCORING_RULES.evaluationBadges.pending;

            rows.push(`<tr>
                <td class="name-cell">${l.lecture_name}</td>
                <td>${formatDate(l.date)}</td>
                <td>${ins ? ins.name : insId}</td>
                <td>${getScore('student')}</td>
                <td>${getScore('institution')}</td>
                <td>${getScore('peer')}</td>
                <td><span class="badge eval-${l.evaluation_status}" style="background:${evalBadge.bgColor};color:${evalBadge.color};">${evalBadge.label}</span></td>
                <td><button class="btn btn-sm" onclick="openEvalInputModal('${l.lecture_id}','${insId}')"><i class="ph ph-pencil-simple"></i> 입력</button></td>
            </tr>`);
        });
    });
    tbody.innerHTML = rows.join('');
}

// ═══ Requests (Approval Queue) ═══
function renderRequests() {
    let requests = DB.actionRequests.getAll();
    if (reqTabFilter === 'req-pending') requests = requests.filter(r => r.status === 'pending');
    else if (reqTabFilter === 'req-approved') requests = requests.filter(r => r.status === 'approved');
    else if (reqTabFilter === 'req-rejected') requests = requests.filter(r => r.status === 'rejected');
    requests.sort((a,b) => new Date(b.requested_at) - new Date(a.requested_at));

    const container = document.getElementById('requests-list');
    if (!requests.length) {
        container.innerHTML = '<div class="card"><div class="empty-state"><i class="ph ph-clock"></i><p>승인 대기 항목이 없습니다</p></div></div>';
        return;
    }

    container.innerHTML = '<div class="card">' + requests.map(r => {
        const ins = DB.instructors.getById(r.instructor_id);
        const actions = r.status === 'pending' 
            ? `<button class="btn btn-sm btn-success" onclick="approveRequest('${r.request_id}')"><i class="ph ph-check"></i> 승인</button>
               <button class="btn btn-sm btn-danger" onclick="rejectRequest('${r.request_id}')"><i class="ph ph-x"></i> 반려</button>`
            : `<span class="badge ${r.status}">${r.status === 'approved' ? '승인됨' : '반려됨'}</span>`;
        
        return `<div class="approval-item">
            <div class="approval-info">
                <div class="approval-title">${ins ? ins.name : r.instructor_id} — ${r.note || r.category}</div>
                <div class="approval-desc">${r.request_type} · ${r.sub_category} · 예상 ${r.point_preview}p ${r.evidence_url ? '· <a href="'+r.evidence_url+'" target="_blank">증빙</a>' : ''}</div>
            </div>
            <div class="approval-actions">${actions}</div>
        </div>`;
    }).join('') + '</div>';
}

function approveRequest(id) {
    DB.actionRequests.approve(id);
    toast('승인 완료 → Activity_Log 반영됨', 'success');
    renderRequests();
    refreshBadges();
}

function rejectRequest(id) {
    const reason = prompt('반려 사유를 입력하세요:');
    if (reason === null) return;
    DB.actionRequests.reject(id, reason);
    toast('반려 처리됨', 'warning');
    renderRequests();
    refreshBadges();
}

// ═══ Instructors ═══
function renderInstructors() {
    let instructors = DB.instructors.getAll();
    if (insTabFilter === 'ins-master') instructors = instructors.filter(i => i.grade === 'Master');
    else if (insTabFilter === 'ins-blocked') instructors = instructors.filter(i => i.assignment_block);
    instructors.sort((a,b) => b.total_score - a.total_score);

    const tbody = document.getElementById('instructors-tbody');
    if (!instructors.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted);">강사가 없습니다</td></tr>';
        return;
    }

    tbody.innerHTML = instructors.map(ins => {
        const gradeInfo = ScoreCalculator.calcGrade(ins.total_score || 0);
        const evalDisplay = ins.score_evaluation != null ? Number(ins.score_evaluation).toFixed(1) : '<span class="text-muted">-</span>';
        const statusBadge = ins.assignment_block 
            ? '<span class="badge blocked">차단</span>' 
            : '<span class="badge active">활성</span>';
        
        return `<tr style="cursor:pointer;" onclick="showInstructorProfile('${ins.instructor_id}')">
            <td class="name-cell">${ins.name || ''}</td>
            <td>${ins.major || ins.specialty || ''}</td>
            <td style="font-weight:800; color:var(--accent-blue);">${ins.total_score || 0}</td>
            <td><span class="badge ${(ins.grade || 'trainee').toLowerCase()}">${gradeInfo.icon} ${ins.grade || ins.tier || 'Trainee'}</span></td>
            <td>${ins.score_experience || 0}</td>
            <td>${evalDisplay}</td>
            <td>${ins.score_expertise || 0}</td>
            <td>${ins.score_contribution || 0}</td>
            <td>${statusBadge}</td>
            <td><button class="btn btn-sm" onclick="event.stopPropagation(); showInstructorProfile('${ins.instructor_id}')"><i class="ph ph-eye"></i></button></td>
        </tr>`;
    }).join('');
}

// ═══ Instructor Profile Modal ═══
function showInstructorProfile(id) {
    const ins = DB.instructors.getById(id);
    if (!ins) return;
    
    const gradeInfo = ScoreCalculator.calcGrade(ins.total_score || 0);
    const logs = DB.activityLog.getByInstructor(id).sort((a,b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0)).slice(0, 10);
    const abilities = DB.abilityLog.getByInstructor(id);

    const evalDisplay = ins.score_evaluation != null ? Number(ins.score_evaluation).toFixed(1) : '-';
    
    document.getElementById('profile-modal-body').innerHTML = `
        <div class="profile-card" style="padding:0;">
            <div class="profile-avatar">${(ins.name || '?').charAt(0)}</div>
            <div class="profile-info">
                <div class="profile-name">${ins.name || ''} <span class="badge ${(ins.grade || ins.tier || 'trainee').toLowerCase()}" style="font-size:0.8rem;">${gradeInfo.icon} ${ins.grade || ins.tier || 'Trainee'}</span>
                    ${ins.assignment_block ? '<span class="badge blocked" style="margin-left:4px;">🚫 배정차단</span>' : ''}
                </div>
                <div class="profile-meta">
                    <span><i class="ph ph-graduation-cap"></i> ${ins.major || ins.specialty || '-'}</span>
                    <span><i class="ph ph-envelope"></i> ${ins.email || '-'}</span>
                    <span><i class="ph ph-phone"></i> ${ins.phone || '-'}</span>
                    <span><i class="ph ph-calendar"></i> 가입: ${ins.join_date || ins.first_cohort || '-'}</span>
                    ${ins.activity_region ? `<span><i class="ph ph-map-pin"></i> ${ins.activity_region}</span>` : ''}
                </div>
                <div class="total-score-display">
                    <div>
                        <div class="total-score-number" style="color:${gradeInfo.color};">${ins.total_score || 0}</div>
                        <div class="total-score-label">총점</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="score-grid mt-4">
            <div class="score-item"><div class="score-label">강의경험 (20%)</div><div class="score-value" style="color:var(--accent-blue);">${ins.score_experience}</div><div class="score-bar"><div class="score-bar-fill blue" style="width:${ins.score_experience}%"></div></div></div>
            <div class="score-item"><div class="score-label">강의평가 (40%)</div><div class="score-value" style="color:var(--accent-green);">${evalDisplay}</div><div class="score-bar"><div class="score-bar-fill green" style="width:${ins.score_evaluation || 0}%"></div></div></div>
            <div class="score-item"><div class="score-label">전문성 (20%)</div><div class="score-value" style="color:var(--accent-amber);">${ins.score_expertise}</div><div class="score-bar"><div class="score-bar-fill amber" style="width:${ins.score_expertise}%"></div></div></div>
            <div class="score-item"><div class="score-label">내부기여 (20%)</div><div class="score-value" style="color:var(--accent-purple);">${ins.score_contribution}</div><div class="score-bar"><div class="score-bar-fill purple" style="width:${ins.score_contribution}%"></div></div></div>
        </div>

        ${abilities.length ? `<div class="mt-4"><h4 class="section-title text-sm">전문성 기록</h4>${abilities.map(a => `<div class="approval-item"><div class="approval-info"><div class="approval-title">${a.description}</div><div class="approval-desc">${a.ability_type} ${a.verified ? '✅ 인증됨' : '⏳ 미인증'}</div></div></div>`).join('')}</div>` : ''}

        <div class="mt-4">
            <h4 class="section-title text-sm">최근 활동 이력</h4>
            ${logs.length ? '<div class="timeline">' + logs.map(log => {
                const pointClass = (log.point || 0) >= 0 ? 'positive' : 'negative';
                const pointText = log.point != null ? `<span class="timeline-point ${pointClass}">${log.point > 0 ? '+' : ''}${log.point}p</span>` : '';
                return `<div class="timeline-item ${log.category}"><div class="timeline-date">${formatDate(log.date)} · ${log.source}</div><div class="timeline-content">${log.description} ${pointText}</div></div>`;
            }).join('') + '</div>' : '<p class="text-muted text-sm">활동 기록이 없습니다</p>'}
        </div>`;
    
    document.getElementById('profile-modal-overlay').classList.add('open');
}

function closeProfileModal() {
    document.getElementById('profile-modal-overlay').classList.remove('open');
}

// ═══ Incidents ═══
function renderIncidents() {
    const logs = DB.activityLog.getAll().filter(l => !l.reversal_of);
    const bonuses = logs.filter(l => l.category === 'bonus').sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const penalties = logs.filter(l => l.category === 'penalty').sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    const renderList = (items, containerId) => {
        const container = document.getElementById(containerId);
        if (!items.length) {
            container.innerHTML = '<div class="empty-state" style="padding:30px;"><i class="ph ph-check-circle"></i><p>기록 없음</p></div>';
            return;
        }
        container.innerHTML = items.map(log => {
            const ins = DB.instructors.getById(log.instructor_id);
            const pointClass = (log.point || 0) >= 0 ? 'positive' : 'negative';
            return `<div class="approval-item"><div class="approval-info"><div class="approval-title">${ins ? ins.name : log.instructor_id}</div><div class="approval-desc">${log.description} <span class="timeline-point ${pointClass}">${log.point > 0 ? '+' : ''}${log.point}p</span></div></div></div>`;
        }).join('');
    };

    renderList(bonuses, 'bonus-list');
    renderList(penalties, 'penalty-list');
}

// ═══ Reports ═══
function renderReports() {
    const snapshots = DB.snapshots.getAll().sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const container = document.getElementById('snapshots-list');
    
    if (!snapshots.length) {
        container.innerHTML = '<div class="card"><div class="empty-state"><i class="ph ph-camera"></i><p>스냅샷이 없습니다. 스냅샷을 생성하면 해당 시점의 모든 강사 점수가 기록됩니다.</p></div></div>';
        return;
    }

    container.innerHTML = snapshots.map(snap => `
        <div class="card mb-3">
            <div class="card-header"><div class="card-title"><i class="ph ph-camera"></i> ${snap.month} 스냅샷</div><span class="text-xs text-muted">${formatDateTime(snap.created_at)}</span></div>
            <div class="table-container" style="border:none;">
                <table><thead><tr><th>강사</th><th>총점</th><th>등급</th><th>경험</th><th>평가</th><th>전문</th><th>기여</th></tr></thead>
                <tbody>${snap.instructors.map(i => `<tr><td class="name-cell">${i.name}</td><td style="font-weight:800;">${i.total_score}</td><td><span class="badge ${i.grade.toLowerCase()}">${i.grade}</span></td><td>${i.score_experience}</td><td>${i.score_evaluation !== null ? i.score_evaluation.toFixed(1) : '-'}</td><td>${i.score_expertise}</td><td>${i.score_contribution}</td></tr>`).join('')}</tbody></table>
            </div>
        </div>`).join('');
}

// ═══ Tab Buttons ═══
function setupTabButtons() {
    document.querySelectorAll('.tabs').forEach(tabGroup => {
        tabGroup.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                tabGroup.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabVal = tab.dataset.tab;
                
                if (['all', 'scheduled', 'completed'].includes(tabVal)) {
                    lectureTabFilter = tabVal;
                    renderLectures();
                } else if (tabVal.startsWith('eval-')) {
                    evalTabFilter = tabVal;
                    renderEvaluations();
                } else if (tabVal.startsWith('req-')) {
                    reqTabFilter = tabVal;
                    renderRequests();
                } else if (tabVal.startsWith('ins-')) {
                    insTabFilter = tabVal;
                    renderInstructors();
                }
            });
        });
    });
}

// ═══ Modals ═══
function openModal(title, bodyHTML, footerHTML) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML || '';
    document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
}

function setupModalClose() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
    document.getElementById('profile-modal-overlay').addEventListener('click', e => { if (e.target.id === 'profile-modal-overlay') closeProfileModal(); });
    
    // Quick Add Lecture
    document.getElementById('btn-quick-add').addEventListener('click', openAddLectureModal);
    document.getElementById('btn-add-lecture').addEventListener('click', openAddLectureModal);
    document.getElementById('btn-add-instructor').addEventListener('click', openAddInstructorModal);
    document.getElementById('btn-add-request').addEventListener('click', openAddRequestModal);
    document.getElementById('btn-add-incident').addEventListener('click', openAddIncidentModal);
    document.getElementById('btn-create-snapshot').addEventListener('click', () => {
        DB.snapshots.create();
        toast('월간 스냅샷 생성 완료', 'success');
        renderReports();
    });
}

// ═══ Add Lecture Modal ═══
function openAddLectureModal() {
    const instructors = DB.instructors.getAll();
    const insOptions = instructors.map(i => `<option value="${i.instructor_id}">${i.name} (${i.major})</option>`).join('');
    
    openModal('강의 등록', `
        <div class="form-row">
            <div class="form-group"><label class="form-label">날짜</label><input type="date" class="form-input" id="m-lec-date" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label class="form-label">강의 유형</label><select class="form-select" id="m-lec-type"><option value="general">일반</option><option value="dls">DLS</option><option value="doroland">DOROLAND</option><option value="camp">캠프</option><option value="operation">운영</option></select></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">기관</label><input type="text" class="form-input" id="m-lec-inst" placeholder="예: 안산중학교"></div>
            <div class="form-group"><label class="form-label">강의명</label><input type="text" class="form-input" id="m-lec-name" placeholder="예: 로봇 코딩 입문"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">주강사</label><select class="form-select" id="m-lec-lead"><option value="">선택</option>${insOptions}</select></div>
            <div class="form-group"><label class="form-label">매니저</label><input type="text" class="form-input" id="m-lec-manager" placeholder="매니저 이름"></div>
        </div>
        <div class="form-group"><label class="form-label">보조강사</label><select class="form-select" id="m-lec-assistants" multiple size="3">${insOptions}</select><div class="form-hint">Ctrl+클릭으로 여러 명 선택</div></div>
    `, '<button class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary" onclick="submitAddLecture()">등록</button>');
}

function submitAddLecture() {
    const data = {
        date: document.getElementById('m-lec-date').value,
        lecture_type: document.getElementById('m-lec-type').value,
        institution: document.getElementById('m-lec-inst').value,
        lecture_name: document.getElementById('m-lec-name').value,
        lead_instructor_id: document.getElementById('m-lec-lead').value,
        assistant_instructor_ids: Array.from(document.getElementById('m-lec-assistants').selectedOptions).map(o => o.value),
        manager: document.getElementById('m-lec-manager').value
    };
    if (!data.date || !data.institution || !data.lecture_name) { toast('필수 항목을 입력하세요', 'error'); return; }
    DB.lectures.add(data);
    toast('강의가 등록되었습니다', 'success');
    closeModal();
    renderLectures();
    refreshBadges();
}

// ═══ Add Instructor Modal ═══
function openAddInstructorModal() {
    openModal('강사 추가', `
        <div class="form-row">
            <div class="form-group"><label class="form-label">이름 *</label><input type="text" class="form-input" id="m-ins-name" placeholder="홍길동"></div>
            <div class="form-group"><label class="form-label">전공</label><input type="text" class="form-input" id="m-ins-major" placeholder="컴퓨터공학"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">연락처</label><input type="text" class="form-input" id="m-ins-phone" placeholder="010-xxxx-xxxx"></div>
            <div class="form-group"><label class="form-label">이메일</label><input type="email" class="form-input" id="m-ins-email" placeholder="email@example.com"></div>
        </div>
        <div class="form-group"><label class="form-label">가입일</label><input type="date" class="form-input" id="m-ins-join" value="${new Date().toISOString().split('T')[0]}"></div>
    `, '<button class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary" onclick="submitAddInstructor()">추가</button>');
}

function submitAddInstructor() {
    const name = document.getElementById('m-ins-name').value;
    if (!name) { toast('이름을 입력하세요', 'error'); return; }
    DB.instructors.add({
        name, major: document.getElementById('m-ins-major').value,
        phone: document.getElementById('m-ins-phone').value,
        email: document.getElementById('m-ins-email').value,
        join_date: document.getElementById('m-ins-join').value
    });
    toast(`${name} 강사가 추가되었습니다`, 'success');
    closeModal();
    renderInstructors();
    refreshDashboard();
}

// ═══ Add Request Modal ═══
function openAddRequestModal() {
    const instructors = DB.instructors.getAll();
    const insOptions = instructors.map(i => `<option value="${i.instructor_id}">${i.name}</option>`).join('');
    const contribOptions = Object.entries({...SCORING_RULES.contribution.autoItems, ...SCORING_RULES.contribution.approvalItems})
        .map(([k,v]) => `<option value="${k}" data-point="${v.point}">${v.description} (${v.point}p)</option>`).join('');
    
    openModal('내부기여 등록', `
        <div class="form-row">
            <div class="form-group"><label class="form-label">강사</label><select class="form-select" id="m-req-ins"><option value="">선택</option>${insOptions}</select></div>
            <div class="form-group"><label class="form-label">기여 항목</label><select class="form-select" id="m-req-sub" onchange="updateReqPreview()">${contribOptions}</select></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">수량</label><input type="number" class="form-input" id="m-req-qty" value="1" min="1" onchange="updateReqPreview()"></div>
            <div class="form-group"><label class="form-label">예상 점수</label><input type="text" class="form-input" id="m-req-preview" readonly></div>
        </div>
        <div class="form-group"><label class="form-label">증빙 URL</label><input type="url" class="form-input" id="m-req-evidence" placeholder="https://drive.google.com/..."></div>
        <div class="form-group"><label class="form-label">비고</label><textarea class="form-textarea" id="m-req-note" placeholder="상세 내용"></textarea></div>
    `, '<button class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary" onclick="submitAddRequest()">등록</button>');
    updateReqPreview();
}

function updateReqPreview() {
    const sel = document.getElementById('m-req-sub');
    const opt = sel.options[sel.selectedIndex];
    const point = parseInt(opt.dataset.point) || 0;
    const qty = parseInt(document.getElementById('m-req-qty').value) || 1;
    document.getElementById('m-req-preview').value = `${point * qty}p`;
}

function submitAddRequest() {
    const insId = document.getElementById('m-req-ins').value;
    const sub = document.getElementById('m-req-sub').value;
    if (!insId) { toast('강사를 선택하세요', 'error'); return; }
    const sel = document.getElementById('m-req-sub');
    const point = parseInt(sel.options[sel.selectedIndex].dataset.point) || 0;
    const qty = parseInt(document.getElementById('m-req-qty').value) || 1;
    
    DB.actionRequests.add({
        instructor_id: insId, request_type: 'contribution', category: '내부기여',
        sub_category: sub, quantity: qty, point_preview: point * qty,
        evidence_url: document.getElementById('m-req-evidence').value,
        note: document.getElementById('m-req-note').value
    });
    toast('내부기여가 등록되었습니다 (승인 대기)', 'info');
    closeModal();
    renderRequests();
    refreshBadges();
}

// ═══ Add Incident Modal ═══
function openAddIncidentModal() {
    const instructors = DB.instructors.getAll();
    const insOptions = instructors.map(i => `<option value="${i.instructor_id}">${i.name}</option>`).join('');
    const bonusOpts = Object.entries(SCORING_RULES.bonusPenalty.bonus).map(([k,v]) => `<option value="bonus:${k}">${v.description} (+${v.point}p)</option>`).join('');
    const penaltyOpts = Object.entries(SCORING_RULES.bonusPenalty.penalty).map(([k,v]) => `<option value="penalty:${k}">${v.description} (${v.point}p)</option>`).join('');

    openModal('Incident 기록', `
        <div class="form-row">
            <div class="form-group"><label class="form-label">강사</label><select class="form-select" id="m-inc-ins"><option value="">선택</option>${insOptions}</select></div>
            <div class="form-group"><label class="form-label">사유</label><select class="form-select" id="m-inc-type"><optgroup label="🟢 가산">${bonusOpts}</optgroup><optgroup label="🔴 감점">${penaltyOpts}</optgroup></select></div>
        </div>
        <div class="form-group"><label class="form-label">증빙 URL</label><input type="url" class="form-input" id="m-inc-evidence" placeholder="https://..."></div>
        <div class="form-group"><label class="form-label">비고</label><textarea class="form-textarea" id="m-inc-note" placeholder="상세 내용"></textarea></div>
    `, '<button class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary" onclick="submitAddIncident()">등록 (승인대기)</button>');
}

function submitAddIncident() {
    const insId = document.getElementById('m-inc-ins').value;
    const typeVal = document.getElementById('m-inc-type').value;
    if (!insId || !typeVal) { toast('필수 항목을 입력하세요', 'error'); return; }
    const [type, sub] = typeVal.split(':');
    const rules = type === 'bonus' ? SCORING_RULES.bonusPenalty.bonus : SCORING_RULES.bonusPenalty.penalty;
    const rule = rules[sub];
    
    DB.actionRequests.add({
        instructor_id: insId, request_type: type, category: type === 'bonus' ? '가산' : '감점',
        sub_category: sub, point_preview: rule.point,
        evidence_url: document.getElementById('m-inc-evidence').value,
        note: document.getElementById('m-inc-note').value || rule.description
    });
    toast('Incident가 등록되었습니다 (승인 대기)', 'warning');
    closeModal();
    renderRequests();
    navigateTo('requests');
}

// ═══ Evaluation Input Modal ═══
function openEvalInputModal(lectureId, instructorId) {
    const lecture = DB.lectures.getById(lectureId);
    const ins = DB.instructors.getById(instructorId);
    
    openModal(`평가 입력 — ${ins?.name || instructorId}`, `
        <p class="text-sm text-muted mb-3">${lecture?.lecture_name} (${formatDate(lecture?.date)})</p>
        <div class="tabs mb-3">
            <button class="tab active" onclick="switchEvalTab(this, 'student')">학생</button>
            <button class="tab" onclick="switchEvalTab(this, 'institution')">기관</button>
            <button class="tab" onclick="switchEvalTab(this, 'peer')">동료</button>
        </div>
        <input type="hidden" id="m-eval-type" value="student">
        <input type="hidden" id="m-eval-lec" value="${lectureId}">
        <input type="hidden" id="m-eval-ins" value="${instructorId}">
        <div class="form-row">
            <div class="form-group"><label class="form-label">만족도 (1~5)</label><input type="number" class="form-input" id="m-eval-s1" min="1" max="5" value="4"></div>
            <div class="form-group"><label class="form-label">전문성/참여도 (1~5)</label><input type="number" class="form-input" id="m-eval-s2" min="1" max="5" value="4"></div>
        </div>
        <div class="form-group"><label class="form-label">코멘트</label><textarea class="form-textarea" id="m-eval-comment" placeholder="한 줄 코멘트"></textarea></div>
    `, '<button class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary" onclick="submitEvalInput()">저장</button>');
}

function switchEvalTab(btn, type) {
    btn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('m-eval-type').value = type;
}

function submitEvalInput() {
    const lectureId = document.getElementById('m-eval-lec').value;
    const instructorId = document.getElementById('m-eval-ins').value;
    const evaluatorType = document.getElementById('m-eval-type').value;
    const s1 = parseFloat(document.getElementById('m-eval-s1').value);
    const s2 = parseFloat(document.getElementById('m-eval-s2').value);
    
    if (isNaN(s1) || isNaN(s2) || s1 < 1 || s1 > 5 || s2 < 1 || s2 > 5) {
        toast('점수는 1~5 사이여야 합니다', 'error'); return;
    }

    DB.evalRaw.add({
        lecture_id: lectureId, instructor_id: instructorId, evaluator_type: evaluatorType,
        score_items: { satisfaction: s1, engagement: s2 },
        comment: document.getElementById('m-eval-comment').value
    });
    toast(`${evaluatorType} 평가가 저장되었습니다`, 'success');
    closeModal();
    renderEvaluations();
    refreshBadges();
}

// ═══ Global Search ═══
function setupGlobalSearch() {
    document.getElementById('global-search').addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (q.length >= 1) {
            const results = DB.instructors.search(q);
            if (results.length > 0) {
                navigateTo('instructors');
                insTabFilter = 'ins-all';
                const tbody = document.getElementById('instructors-tbody');
                tbody.innerHTML = results.map(ins => {
                    const gradeInfo = ScoreCalculator.calcGrade(ins.total_score);
                    return `<tr style="cursor:pointer;" onclick="showInstructorProfile('${ins.instructor_id}')"><td class="name-cell">${ins.name}</td><td>${ins.major}</td><td style="font-weight:800;color:var(--accent-blue);">${ins.total_score}</td><td><span class="badge ${ins.grade.toLowerCase()}">${gradeInfo.icon} ${ins.grade}</span></td><td>${ins.score_experience}</td><td>${ins.score_evaluation !== null ? ins.score_evaluation.toFixed(1) : '-'}</td><td>${ins.score_expertise}</td><td>${ins.score_contribution}</td><td>${ins.assignment_block ? '<span class="badge blocked">차단</span>' : '<span class="badge active">활성</span>'}</td><td></td></tr>`;
                }).join('');
            }
        }
    });
}

// ═══ Settings Buttons ═══
function setupSettingsButtons() {
    document.getElementById('btn-seed-demo').addEventListener('click', () => {
        if (!confirm('데모 데이터를 생성하시겠습니까?')) return;
        const result = DB.seedDemoData();
        toast(`데모 데이터 생성: 강사 ${result.instructors}명, 강의 ${result.lectures}건`, 'success');
        refreshAll();
        navigateTo('dashboard');
    });

    document.getElementById('btn-clear-all').addEventListener('click', () => {
        if (!confirm('⚠️ 모든 데이터가 삭제됩니다. 계속하시겠습니까?')) return;
        if (!confirm('정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        DB.clearAll();
        toast('전체 데이터가 삭제되었습니다', 'warning');
        refreshAll();
        navigateTo('dashboard');
    });

    document.getElementById('btn-export-all').addEventListener('click', () => {
        DB.csv.downloadAll();
        toast('CSV 파일이 다운로드됩니다', 'info');
    });

    document.getElementById('btn-backup').addEventListener('click', () => {
        DB.csv.downloadAll();
        toast('CSV 백업 다운로드 시작', 'info');
    });

    document.getElementById('btn-recalc-all').addEventListener('click', () => {
        DB.instructors.recalculateAll();
        toast('전체 점수 재계산 완료', 'success');
        refreshAll();
    });

    document.getElementById('btn-import-csv').addEventListener('click', () => {
        const input = document.getElementById('csv-file-input');
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const count = DB.csv.importInstructors(ev.target.result);
                toast(`${count}명의 강사가 가져와졌습니다`, 'success');
                renderInstructors();
                refreshDashboard();
            };
            reader.readAsText(file);
        };
        input.click();
    });
}

// ═══ Toast ═══
function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: 'ph-check-circle', error: 'ph-x-circle', warning: 'ph-warning', info: 'ph-info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="ph ${icons[type]}"></i> ${message}`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100px)'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ═══ Utils ═══
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getMonth()+1}/${d.getDate()}`;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
