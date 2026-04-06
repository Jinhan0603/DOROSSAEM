/**
 * DORO Scheduling App - UI Logic
 * ==============================
 * 강의 공고 / 일정 배정 / 가용시간 / 결과 원장
 */

let schedReqTabFilter = 'sreq-all';

// ═══ Register with main app ═══
document.addEventListener('DOMContentLoaded', () => {
    setupSchedulingButtons();
    setupSchedulingTabs();
    refreshSchedulingBadges();

    // Patch navigateTo
    const origNavigateTo = window.navigateTo;
    window.navigateTo = function(view) {
        origNavigateTo(view);
        if (view === 'schedule-requests') renderScheduleRequests();
        else if (view === 'schedule-assign') renderScheduleAssign();
        else if (view === 'availability') renderAvailability();
        else if (view === 'ledger') renderLedger();

        const extraTitles = {
            'schedule-requests': ['강의 공고', '공고 관리 및 회차 생성'],
            'schedule-assign': ['일정 배정', '추천 엔진 기반 강사 배정'],
            'availability': ['가용시간', '강사 요일별 가용시간 관리'],
            'ledger': ['결과 원장', '강의 결과 기록 (기존 엑셀 대체)']
        };
        if (extraTitles[view]) {
            document.getElementById('page-title').textContent = extraTitles[view][0];
            document.getElementById('page-subtitle').textContent = extraTitles[view][1];
        }
    };

    // Patch refreshAll
    const origRefreshAll = window.refreshAll;
    window.refreshAll = function() {
        origRefreshAll();
        refreshSchedulingBadges();
    };

    // Extend demo seed
    const origSeedBtn = document.getElementById('btn-seed-demo');
    const origHandler = origSeedBtn.onclick;
    origSeedBtn.addEventListener('click', () => {
        setTimeout(() => {
            if (DB.lectureRequests.getAll().length === 0) {
                DB._seedSchedulingDemo();
            }
            refreshSchedulingBadges();
        }, 100);
    });
});

function refreshSchedulingBadges() {
    const openReqs = DB.lectureRequests.getAll().filter(r => r.status === 'open').length;
    const el1 = document.getElementById('badge-requests-open');
    if (el1) el1.textContent = openReqs;

    const openSessions = DB.lectureSessions.getNeedingAssignment().length;
    const el2 = document.getElementById('badge-sessions-open');
    if (el2) el2.textContent = openSessions;
}

function setupSchedulingButtons() {
    const addBtn = document.getElementById('btn-add-schedule-request');
    if (addBtn) addBtn.addEventListener('click', openAddScheduleRequestModal);

    const exportBtn = document.getElementById('btn-export-ledger');
    if (exportBtn) exportBtn.addEventListener('click', exportLedgerCSV);
}

function setupSchedulingTabs() {
    document.querySelectorAll('.tabs').forEach(tabGroup => {
        tabGroup.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabVal = tab.dataset.tab;
                if (tabVal && tabVal.startsWith('sreq-')) {
                    tabGroup.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    schedReqTabFilter = tabVal;
                    renderScheduleRequests();
                }
            });
        });
    });
}

// ═══════════════════════════════════════
// 강의 공고 (Schedule Requests)
// ═══════════════════════════════════════
function renderScheduleRequests() {
    let reqs = DB.lectureRequests.getAll();
    if (schedReqTabFilter === 'sreq-draft') reqs = reqs.filter(r => r.status === 'draft');
    else if (schedReqTabFilter === 'sreq-open') reqs = reqs.filter(r => r.status === 'open');
    else if (schedReqTabFilter === 'sreq-closed') reqs = reqs.filter(r => r.status === 'closed');
    reqs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const tbody = document.getElementById('schedule-requests-tbody');
    if (!reqs.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">공고가 없습니다</td></tr>';
        return;
    }

    const typeLabels = { general: '일반', dls: 'DLS', doroland: 'DOROLAND', camp: '캠프', operation: '운영' };
    const levelLabels = { standard: '일반', important: '⭐ 중요', high_risk: '🔴 고위험' };
    const statusLabels = { draft: '초안', open: '모집중', closed: '마감', cancelled: '취소' };

    tbody.innerHTML = reqs.map(r => {
        const sessions = DB.lectureSessions.getByRequest(r.request_id);
        const statusClass = r.status === 'open' ? 'active' : r.status === 'draft' ? 'pending' : 'completed';
        let actions = '';
        if (r.status === 'draft') {
            actions = `<button class="btn btn-sm btn-primary" onclick="openSessionGeneratorModal('${r.request_id}')"><i class="ph ph-calendar-plus"></i> 회차생성</button>`;
        } else if (r.status === 'open') {
            actions = `<button class="btn btn-sm" onclick="viewSessionsForRequest('${r.request_id}')"><i class="ph ph-eye"></i> 배정</button>
                       <button class="btn btn-sm btn-danger" onclick="closeScheduleRequest('${r.request_id}')"><i class="ph ph-x"></i> 마감</button>`;
        }

        return `<tr>
            <td class="name-cell">${r.institution}</td>
            <td>${r.content}</td>
            <td>${r.target}</td>
            <td><span class="badge ${r.lecture_type}">${typeLabels[r.lecture_type] || r.lecture_type}</span></td>
            <td>${levelLabels[r.service_level] || r.service_level}</td>
            <td>${sessions.length}회</td>
            <td><span class="badge ${statusClass}">${statusLabels[r.status]}</span></td>
            <td>${actions}</td>
        </tr>`;
    }).join('');
}

function closeScheduleRequest(id) {
    if (!confirm('이 공고를 마감하시겠습니까?')) return;
    DB.lectureRequests.close(id);
    toast('공고 마감됨', 'info');
    renderScheduleRequests();
    refreshSchedulingBadges();
}

function viewSessionsForRequest(reqId) {
    navigateTo('schedule-assign');
    setTimeout(() => renderScheduleAssign(reqId), 50);
}

// ═══ Add Schedule Request Modal ═══
function openAddScheduleRequestModal() {
    openModal('강의 공고 등록', `
        <div class="form-row">
            <div class="form-group"><label class="form-label">기관 *</label><input type="text" class="form-input" id="m-sr-inst" placeholder="예: 안산중학교"></div>
            <div class="form-group"><label class="form-label">콘텐츠 *</label><input type="text" class="form-input" id="m-sr-content" placeholder="예: 로봇 코딩 기초"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">대상</label><input type="text" class="form-input" id="m-sr-target" placeholder="예: 중1"></div>
            <div class="form-group"><label class="form-label">인원</label><input type="number" class="form-input" id="m-sr-headcount" value="30"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">지역</label><input type="text" class="form-input" id="m-sr-region" placeholder="예: 안산"></div>
            <div class="form-group"><label class="form-label">장소</label><input type="text" class="form-input" id="m-sr-location" placeholder="상세 주소"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">유형</label><select class="form-select" id="m-sr-type"><option value="general">일반</option><option value="dls">DLS</option><option value="doroland">DOROLAND</option><option value="camp">캠프</option></select></div>
            <div class="form-group"><label class="form-label">중요도</label><select class="form-select" id="m-sr-level"><option value="standard">일반</option><option value="important">중요 파트너</option><option value="high_risk">고위험 (DLS/캠프/대규모)</option></select></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">필요 주강사</label><input type="number" class="form-input" id="m-sr-lead" value="1" min="1"></div>
            <div class="form-group"><label class="form-label">필요 보조</label><input type="number" class="form-input" id="m-sr-asst" value="1" min="0"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">주강사 단가(원/h)</label><input type="number" class="form-input" id="m-sr-rate-lead" value="25000"></div>
            <div class="form-group"><label class="form-label">보조 단가(원/h)</label><input type="number" class="form-input" id="m-sr-rate-asst" value="12000"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">기관 지급 단가(주, 원/h)</label><input type="number" class="form-input" id="m-sr-irate-lead" value="0" placeholder="0이면 차액 없음"></div>
            <div class="form-group"><label class="form-label">기관 지급 단가(보조, 원/h)</label><input type="number" class="form-input" id="m-sr-irate-asst" value="0"></div>
        </div>
        <div class="form-group"><label class="form-label">전문성 태그</label><input type="text" class="form-input" id="m-sr-tags" placeholder="코딩,로봇,AI (쉼표 구분)"></div>
        <div class="form-group"><label class="form-label">비고</label><textarea class="form-textarea" id="m-sr-notes" placeholder="특이사항"></textarea></div>
    `, '<button class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary" onclick="submitAddScheduleRequest()">등록</button>');
}

function submitAddScheduleRequest() {
    const inst = document.getElementById('m-sr-inst').value;
    const content = document.getElementById('m-sr-content').value;
    if (!inst || !content) { toast('기관과 콘텐츠는 필수입니다', 'error'); return; }
    const tags = document.getElementById('m-sr-tags').value.split(',').map(t => t.trim()).filter(Boolean);
    DB.lectureRequests.add({
        institution: inst, content: content,
        target: document.getElementById('m-sr-target').value,
        headcount: parseInt(document.getElementById('m-sr-headcount').value) || 30,
        region: document.getElementById('m-sr-region').value,
        location: document.getElementById('m-sr-location').value,
        lecture_type: document.getElementById('m-sr-type').value,
        service_level: document.getElementById('m-sr-level').value,
        required_lead: parseInt(document.getElementById('m-sr-lead').value) || 1,
        required_assistant: parseInt(document.getElementById('m-sr-asst').value) || 1,
        hourly_rate_lead: parseInt(document.getElementById('m-sr-rate-lead').value) || 25000,
        hourly_rate_assistant: parseInt(document.getElementById('m-sr-rate-asst').value) || 12000,
        institution_rate_lead: parseInt(document.getElementById('m-sr-irate-lead').value) || 0,
        institution_rate_assistant: parseInt(document.getElementById('m-sr-irate-asst').value) || 0,
        specialty_tags: tags, notes: document.getElementById('m-sr-notes').value
    });
    toast('공고가 등록되었습니다 (회차 생성 필요)', 'success');
    closeModal(); renderScheduleRequests();
}

// ═══ Session Generator Modal ═══
function openSessionGeneratorModal(requestId) {
    const req = DB.lectureRequests.getById(requestId);
    openModal(`회차 생성 — ${req.institution}`, `
        <p class="text-sm text-muted mb-3">${req.content} (${req.target})</p>
        <div class="form-group"><label class="form-label">회차 수</label><input type="number" class="form-input" id="m-ses-count" value="1" min="1" max="20" onchange="updateSessionDateInputs()"></div>
        <input type="hidden" id="m-ses-reqid" value="${requestId}">
        <div id="session-date-inputs"></div>
    `, '<button class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary" onclick="submitGenerateSessions()">생성 및 공고 오픈</button>');
    updateSessionDateInputs();
}

function updateSessionDateInputs() {
    const count = parseInt(document.getElementById('m-ses-count').value) || 1;
    const container = document.getElementById('session-date-inputs');
    let html = '';
    for (let i = 0; i < count; i++) {
        const d = new Date(); d.setDate(d.getDate() + 7 + i * 7);
        html += `<div class="form-row" style="margin-top:8px;">
            <div class="form-group"><label class="form-label">${i + 1}회 날짜</label><input type="date" class="form-input ses-date" value="${d.toISOString().split('T')[0]}"></div>
            <div class="form-group"><label class="form-label">시작</label><input type="time" class="form-input ses-start" value="10:00"></div>
            <div class="form-group"><label class="form-label">종료</label><input type="time" class="form-input ses-end" value="12:00"></div>
        </div>`;
    }
    container.innerHTML = html;
}

function submitGenerateSessions() {
    const reqId = document.getElementById('m-ses-reqid').value;
    const dates = [];
    document.querySelectorAll('.ses-date').forEach((el, i) => {
        const start = document.querySelectorAll('.ses-start')[i].value;
        const end = document.querySelectorAll('.ses-end')[i].value;
        dates.push({ date: el.value, start_time: start, end_time: end, duration_hours: parseInt(end.split(':')[0]) - parseInt(start.split(':')[0]) });
    });
    if (dates.length === 0) { toast('최소 1개 회차가 필요합니다', 'error'); return; }
    DB.lectureRequests.generateSessions(reqId, dates);
    toast(`${dates.length}개 회차 생성 및 공고 오픈`, 'success');
    closeModal(); renderScheduleRequests(); refreshSchedulingBadges();
}

// ═══════════════════════════════════════
// 일정 배정 (Schedule Assignment)
// ═══════════════════════════════════════
function renderScheduleAssign(filterReqId) {
    const container = document.getElementById('schedule-assign-content');
    let sessions = DB.lectureSessions.getAll();
    if (filterReqId) sessions = sessions.filter(s => s.request_id === filterReqId);
    sessions = sessions.filter(s => s.status !== 'cancelled');
    sessions.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (!sessions.length) {
        container.innerHTML = '<div class="card"><div class="empty-state"><i class="ph ph-calendar-check"></i><p>배정할 회차가 없습니다. 강의 공고에서 회차를 먼저 생성하세요.</p></div></div>';
        return;
    }

    container.innerHTML = sessions.map(ses => {
        const req = DB.lectureRequests.getById(ses.request_id);
        const assignments = DB.assignments.getBySession(ses.session_id);
        const confirmed = assignments.filter(a => a.assignment_status === 'confirmed');
        const holds = assignments.filter(a => a.assignment_status === 'hold');
        const statusColors = { open:'amber', assigning:'blue', confirmed:'green', completed:'completed' };
        const statusLabels = { open:'배정대기', assigning:'배정중', confirmed:'확정', completed:'완료' };

        let assignedHTML = '';
        if (confirmed.length > 0 || holds.length > 0) {
            assignedHTML = '<div style="margin-top:12px;"><h4 class="text-sm" style="color:var(--text-muted);margin-bottom:8px;">배정된 강사</h4>';
            [...confirmed, ...holds].forEach(a => {
                const ins = DB.instructors.getById(a.instructor_id);
                const statusBadge = a.assignment_status === 'confirmed'
                    ? '<span class="badge active">✅ 확정</span>'
                    : `<span class="badge pending">⏳ 홀드 (${new Date(a.hold_until).toLocaleTimeString('ko', {hour:'2-digit',minute:'2-digit'})}까지)</span>`;
                assignedHTML += `<div class="approval-item">
                    <div class="approval-info">
                        <div class="approval-title">${ins ? ins.name : a.instructor_id} — ${a.assigned_role === 'lead' ? '주강사' : '보조강사'} ${statusBadge}</div>
                        <div class="approval-desc">적합도 ${a.recommendation_score}점</div>
                    </div>
                    <div class="approval-actions">
                        ${a.assignment_status === 'hold' ? `<button class="btn btn-sm btn-success" onclick="confirmAssignment('${a.assignment_id}')"><i class="ph ph-check"></i> 확정</button>` : ''}
                        <button class="btn btn-sm btn-danger" onclick="cancelAssignment('${a.assignment_id}')"><i class="ph ph-x"></i> 취소</button>
                    </div>
                </div>`;
            });
            assignedHTML += '</div>';
        }

        const canComplete = ses.status === 'confirmed' || (confirmed.length > 0 && ses.status !== 'completed');
        return `<div class="card mb-3">
            <div class="card-header">
                <div class="card-title">
                    <span class="badge ${statusColors[ses.status] || 'pending'}">${statusLabels[ses.status] || ses.status}</span>
                    ${req ? req.institution : ''} — ${req ? req.content : ''}
                    <span class="text-sm text-muted" style="font-weight:400;margin-left:8px;">${ses.session_no}회차</span>
                </div>
                <div class="text-sm text-muted">${ses.date} ${ses.start_time}~${ses.end_time} (${ses.duration_hours}h)</div>
            </div>
            ${assignedHTML}
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                ${ses.status !== 'completed' ? `<button class="btn btn-primary btn-sm" onclick="showRecommendations('${ses.session_id}')"><i class="ph ph-magic-wand"></i> 추천 후보 보기</button>` : ''}
                ${canComplete ? `<button class="btn btn-sm btn-success" onclick="completeSession('${ses.session_id}')"><i class="ph ph-check-circle"></i> 수업 완료</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function confirmAssignment(id) {
    DB.assignments.confirm(id);
    const asg = DB.assignments.getAll().find(a => a.assignment_id === id);
    if (asg) {
        const allAsg = DB.assignments.getBySession(asg.session_id).filter(a => a.assignment_status === 'confirmed');
        const ses = DB.lectureSessions.getById(asg.session_id);
        const req = ses ? DB.lectureRequests.getById(ses.request_id) : null;
        if (req && allAsg.length >= (req.required_lead + req.required_assistant)) {
            DB.lectureSessions.update(asg.session_id, { status: 'confirmed' });
        }
    }
    toast('배정 확정됨', 'success'); renderScheduleAssign();
}

function cancelAssignment(id) { DB.assignments.cancel(id, '매니저 취소'); toast('배정 취소됨', 'warning'); renderScheduleAssign(); }

function completeSession(sessionId) {
    if (!confirm('수업을 완료 처리하시겠습니까?\n→ 결과 원장 + Activity_Log 자동 생성')) return;
    DB.lectureSessions.complete(sessionId);
    toast('수업 완료 → 결과 원장 & Activity_Log 생성됨', 'success');
    renderScheduleAssign(); refreshSchedulingBadges(); refreshAll();
}

// ═══ Recommendation Panel ═══
function showRecommendations(sessionId) {
    const session = DB.lectureSessions.getById(sessionId);
    const req = DB.lectureRequests.getById(session.request_id);
    const recs = RecommendationEngine.getRecommendations(sessionId);
    const strategies = RecommendationEngine.getStrategies(sessionId);

    let html = `<h4 class="mb-3">${req?.institution} — ${req?.content} (${session.date} ${session.start_time}~${session.end_time})</h4>`;

    if (strategies.length > 0) {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-bottom:20px;">';
        strategies.forEach(s => {
            html += `<div class="card" style="border:1px solid var(--border-color);padding:16px;">
                <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px;">${s.icon} ${s.label}</div>
                <div class="text-sm text-muted mb-2">${s.description}</div>
                ${s.lead ? `<div class="text-sm">주강: <strong>${s.lead.instructor.name}</strong> (${s.lead.score}점)</div>` : ''}
                ${s.assistant ? `<div class="text-sm">보조: <strong>${s.assistant.instructor.name}</strong> (${s.assistant.score}점)</div>` : ''}
                <button class="btn btn-sm btn-primary mt-2" style="width:100%;" onclick="applyStrategy('${sessionId}','${s.lead?.instructor?.instructor_id || ''}','${s.assistant?.instructor?.instructor_id || ''}')">이 조합 홀드</button>
            </div>`;
        });
        html += '</div>';
    }

    ['lead', 'assistant'].forEach(role => {
        const roleName = role === 'lead' ? '주강사' : '보조강사';
        const candidates = recs[role];
        html += `<h4 class="mb-2 mt-3">${roleName} 후보 (${candidates.filter(c => !c.exclusionReason).length}명 적합)</h4>`;
        html += '<div style="max-height:300px;overflow-y:auto;">';
        candidates.slice(0, 10).forEach(c => {
            if (c.exclusionReason) {
                html += `<div class="approval-item" style="opacity:0.5;">
                    <div class="approval-info">
                        <div class="approval-title">${c.instructor.name} <span class="badge blocked">${c.instructor.grade}</span></div>
                        <div class="approval-desc" style="color:var(--accent-red);">❌ ${c.exclusionReason}</div>
                    </div>
                </div>`;
            } else {
                const breakdown = c.breakdown;
                const adjText = (breakdown.adjustments || []).map(a => `${a.reason}: ${a.value > 0 ? '+' : ''}${a.value}`).join(', ');
                html += `<div class="approval-item">
                    <div class="approval-info">
                        <div class="approval-title">${c.instructor.name} <span class="badge ${c.instructor.grade.toLowerCase()}">${c.instructor.grade}</span>
                            <span style="color:var(--accent-blue);font-weight:800;margin-left:8px;">${c.score}점</span>
                        </div>
                        <div class="approval-desc text-xs">
                            역할${Math.round(breakdown.roleFit||0)} · 전문${Math.round(breakdown.specialtyFit||0)} · 시간${Math.round(breakdown.timeRegionFit||0)} · 경험${Math.round(breakdown.experienceFit||0)} · 신뢰${Math.round(breakdown.reliability||0)}
                            ${adjText ? ' · <span style="color:var(--accent-amber);">' + adjText + '</span>' : ''}
                        </div>
                    </div>
                    <div class="approval-actions">
                        <button class="btn btn-sm" onclick="holdCandidate('${sessionId}','${c.instructor.instructor_id}','${role}',${c.score})"><i class="ph ph-hand-grabbing"></i> 홀드</button>
                        <button class="btn btn-sm btn-success" onclick="directConfirm('${sessionId}','${c.instructor.instructor_id}','${role}',${c.score})"><i class="ph ph-check"></i> 즉시확정</button>
                    </div>
                </div>`;
            }
        });
        html += '</div>';
    });

    openModal('추천 후보', html, '<button class="btn" onclick="closeModal()">닫기</button>');
}

function applyStrategy(sessionId, leadId, assistantId) {
    if (leadId) holdCandidate(sessionId, leadId, 'lead', 0);
    if (assistantId) holdCandidate(sessionId, assistantId, 'assistant', 0);
    closeModal();
}

function holdCandidate(sessionId, instructorId, role, score) {
    DB.assignments.add({
        session_id: sessionId, instructor_id: instructorId, assigned_role: role,
        assignment_status: 'hold', recommendation_score: score,
        hold_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    DB.lectureSessions.update(sessionId, { status: 'assigning' });
    toast(`${role === 'lead' ? '주강사' : '보조강사'} 홀드 (24시간)`, 'info');
    closeModal(); renderScheduleAssign();
}

function directConfirm(sessionId, instructorId, role, score) {
    DB.assignments.add({
        session_id: sessionId, instructor_id: instructorId, assigned_role: role,
        assignment_status: 'confirmed', recommendation_score: score,
        confirmed_at: new Date().toISOString()
    });
    toast(`${role === 'lead' ? '주강사' : '보조강사'} 즉시 확정`, 'success');
    closeModal(); renderScheduleAssign();
}

// ═══════════════════════════════════════
// 가용시간 관리 (Availability)
// ═══════════════════════════════════════
function renderAvailability() {
    const container = document.getElementById('availability-content');
    const instructors = DB.instructors.getAll().filter(i => i.status === 'active');
    if (!instructors.length) {
        container.innerHTML = '<div class="card"><div class="empty-state"><i class="ph ph-clock"></i><p>강사가 없습니다</p></div></div>';
        return;
    }
    const insOptions = instructors.map(i => `<option value="${i.instructor_id}">${i.name} (${i.major})</option>`).join('');
    container.innerHTML = `
        <div class="card mb-3">
            <div class="form-row">
                <div class="form-group" style="flex:1;"><label class="form-label">강사 선택</label><select class="form-select" id="avail-instructor" onchange="renderAvailabilityGrid()"><option value="">선택</option>${insOptions}</select></div>
                <div class="form-group" style="flex:1;"><label class="form-label">활동 지역</label><input type="text" class="form-input" id="avail-region" placeholder="예: 안산"></div>
                <div class="form-group" style="flex:1;"><label class="form-label">이동수단</label><select class="form-select" id="avail-transport"><option value="public">대중교통</option><option value="car">자차</option></select></div>
            </div>
        </div>
        <div id="avail-grid-container"></div>
        <div style="margin-top:12px;"><button class="btn btn-primary" onclick="saveAvailability()"><i class="ph ph-floppy-disk"></i> 저장</button></div>`;
}

function renderAvailabilityGrid() {
    const insId = document.getElementById('avail-instructor').value;
    const container = document.getElementById('avail-grid-container');
    if (!insId) { container.innerHTML = ''; return; }
    const avail = DB.availability.getByInstructor(insId);
    const days = [{key:'mon',label:'월'},{key:'tue',label:'화'},{key:'wed',label:'수'},{key:'thu',label:'목'},{key:'fri',label:'금'},{key:'sat',label:'토'},{key:'sun',label:'일'}];
    const slots = [{key:'am',label:'오전'},{key:'pm',label:'오후'},{key:'eve',label:'저녁'}];
    if (avail) {
        document.getElementById('avail-region').value = avail.activity_region || '';
        document.getElementById('avail-transport').value = avail.transport || 'public';
    }
    let html = '<div class="card"><table class="avail-table"><thead><tr><th></th>';
    days.forEach(d => html += `<th>${d.label}</th>`);
    html += '</tr></thead><tbody>';
    slots.forEach(s => {
        html += `<tr><td style="font-weight:600;color:var(--text-muted);">${s.label}</td>`;
        days.forEach(d => {
            const key = `${d.key}_${s.key}`;
            const checked = avail?.weekly_slots?.[key] ? 'checked' : '';
            html += `<td style="text-align:center;"><input type="checkbox" class="avail-check" data-slot="${key}" ${checked}></td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function saveAvailability() {
    const insId = document.getElementById('avail-instructor').value;
    if (!insId) { toast('강사를 선택하세요', 'error'); return; }
    const weekly_slots = {};
    document.querySelectorAll('.avail-check').forEach(cb => { weekly_slots[cb.dataset.slot] = cb.checked; });
    DB.availability.upsert(insId, {
        weekly_slots,
        activity_region: document.getElementById('avail-region').value,
        transport: document.getElementById('avail-transport').value
    });
    toast('가용시간 저장됨', 'success');
}

// ═══════════════════════════════════════
// 결과 원장 (Schedule Ledger)
// ═══════════════════════════════════════
function renderLedger() {
    const ledger = DB.scheduleLedger.getAll().sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById('ledger-tbody');
    if (!ledger.length) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-muted);">결과 원장이 비어 있습니다. 수업 완료 시 자동 생성됩니다.</td></tr>';
        return;
    }
    tbody.innerHTML = ledger.map(l => {
        const leadCost = (l.rate_lead * l.duration_hours).toLocaleString();
        const asstCost = (l.rate_assistant * l.duration_hours).toLocaleString();
        const payback = l.payback_lead + l.payback_assistant;
        const paybackClass = payback > 0 ? 'style="color:var(--accent-green);font-weight:600;"' : payback < 0 ? 'style="color:var(--accent-red);"' : '';
        return `<tr>
            <td>${l.date}</td><td class="name-cell">${l.institution}</td><td>${l.content}</td><td>${l.target}</td>
            <td>${l.headcount}</td><td>${l.lead_names || '-'}</td><td>${l.assistant_names || '-'}</td><td>${l.duration_hours}h</td>
            <td>₩${leadCost}</td><td>₩${asstCost}</td>
            <td ${paybackClass}>${payback !== 0 ? '₩' + payback.toLocaleString() : '-'}</td>
        </tr>`;
    }).join('');
}

function exportLedgerCSV() {
    const csv = DB.csv.export(DB.KEYS.SCHEDULE_LEDGER);
    if (!csv) { toast('내보낼 데이터가 없습니다', 'warning'); return; }
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `doro_schedule_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast('결과 원장 CSV 다운로드', 'info');
}
