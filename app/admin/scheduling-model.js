/**
 * DORO Scheduling Data Model & Recommendation Engine
 * ===================================================
 * 강의 공고 → 회차 → 추천 → 홀드 → 확정 → 결과 원장
 */

// ═══ Storage Keys 추가 ═══
DB.KEYS.LECTURE_REQUESTS = 'doro_lecture_requests';
DB.KEYS.LECTURE_SESSIONS = 'doro_lecture_sessions';
DB.KEYS.AVAILABILITY = 'doro_availability';
DB.KEYS.APPLICATIONS = 'doro_applications';
DB.KEYS.ASSIGNMENTS = 'doro_assignments';
DB.KEYS.SCHEDULE_LEDGER = 'doro_schedule_ledger';

// ═══ Instructor DB 확장 필드 ═══
// 기존 강사에 activity_region, specialty_tags, transport 추가
DB.instructors._ensureSchedulingFields = function(ins) {
    if (!ins.activity_region) ins.activity_region = '';
    if (!ins.specialty_tags) ins.specialty_tags = [];
    if (!ins.transport) ins.transport = 'public';
    return ins;
};

const _origGetAll = DB.instructors.getAll.bind(DB.instructors);
DB.instructors.getAll = function() {
    return _origGetAll().map(i => DB.instructors._ensureSchedulingFields(i));
};

// ═══ Lecture_Request (강의 공고) ═══
DB.lectureRequests = {
    getAll() { return DB._get(DB.KEYS.LECTURE_REQUESTS); },
    getById(id) { return this.getAll().find(r => r.request_id === id) || null; },

    add(data) {
        const all = this.getAll();
        const req = {
            request_id: DB._nextId('LREQ'),
            institution: data.institution || '',
            content: data.content || '',
            target: data.target || '',
            headcount: data.headcount || 0,
            region: data.region || '',
            location: data.location || '',
            service_level: data.service_level || 'standard',
            lecture_type: data.lecture_type || 'general',
            required_lead: data.required_lead || 1,
            required_assistant: data.required_assistant || 1,
            required_ops: data.required_ops || 0,
            specialty_tags: data.specialty_tags || [],
            hourly_rate_lead: data.hourly_rate_lead || 25000,
            hourly_rate_assistant: data.hourly_rate_assistant || 12000,
            institution_rate_lead: data.institution_rate_lead || 0,
            institution_rate_assistant: data.institution_rate_assistant || 0,
            session_count: data.session_count || 1,
            status: 'draft',
            notes: data.notes || '',
            created_at: new Date().toISOString()
        };
        all.push(req);
        DB._set(DB.KEYS.LECTURE_REQUESTS, all);
        return req;
    },

    update(id, updates) {
        const all = this.getAll();
        const idx = all.findIndex(r => r.request_id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates };
        DB._set(DB.KEYS.LECTURE_REQUESTS, all);
        return all[idx];
    },

    open(id) {
        return this.update(id, { status: 'open' });
    },

    close(id) {
        return this.update(id, { status: 'closed' });
    },

    /**
     * 공고에서 N개 회차 자동 생성
     */
    generateSessions(requestId, sessionDates) {
        const req = this.getById(requestId);
        if (!req) return [];
        const sessions = sessionDates.map((sd, idx) => {
            return DB.lectureSessions.add({
                request_id: requestId,
                session_no: idx + 1,
                date: sd.date,
                start_time: sd.start_time || '10:00',
                end_time: sd.end_time || '12:00',
                duration_hours: sd.duration_hours || 2
            });
        });
        this.update(requestId, { status: 'open', session_count: sessions.length });
        return sessions;
    }
};

// ═══ Lecture_Session (회차별 일정) ═══
DB.lectureSessions = {
    getAll() { return DB._get(DB.KEYS.LECTURE_SESSIONS); },
    getById(id) { return this.getAll().find(s => s.session_id === id) || null; },
    getByRequest(reqId) { return this.getAll().filter(s => s.request_id === reqId); },

    add(data) {
        const all = this.getAll();
        const session = {
            session_id: DB._nextId('SES'),
            request_id: data.request_id,
            session_no: data.session_no || 1,
            date: data.date || '',
            start_time: data.start_time || '10:00',
            end_time: data.end_time || '12:00',
            duration_hours: data.duration_hours || 2,
            prep_buffer_min: data.prep_buffer_min || 30,
            travel_buffer_min: data.travel_buffer_min || 60,
            status: 'open',
            created_at: new Date().toISOString()
        };
        all.push(session);
        DB._set(DB.KEYS.LECTURE_SESSIONS, all);
        return session;
    },

    update(id, updates) {
        const all = this.getAll();
        const idx = all.findIndex(s => s.session_id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates };
        DB._set(DB.KEYS.LECTURE_SESSIONS, all);
        return all[idx];
    },

    /**
     * 회차 완료 → Schedule_Ledger 자동 생성 + Activity_Log 연동
     */
    complete(sessionId) {
        const session = this.getById(sessionId);
        if (!session || session.status === 'completed') return null;

        this.update(sessionId, { status: 'completed' });
        const req = DB.lectureRequests.getById(session.request_id);

        // Get confirmed assignments
        const assignments = DB.assignments.getBySession(sessionId)
            .filter(a => a.assignment_status === 'confirmed');

        const leadNames = [], assistantNames = [], opsNames = [];
        assignments.forEach(a => {
            const ins = DB.instructors.getById(a.instructor_id);
            const name = ins ? ins.name : a.instructor_id;
            if (a.assigned_role === 'lead') leadNames.push(name);
            else if (a.assigned_role === 'assistant') assistantNames.push(name);
            else opsNames.push(name);
        });

        // Auto-generate Schedule_Ledger
        DB.scheduleLedger.add({
            session_id: sessionId,
            request_id: session.request_id,
            date: session.date,
            institution: req ? req.institution : '',
            content: req ? req.content : '',
            target: req ? req.target : '',
            headcount: req ? req.headcount : 0,
            lead_names: leadNames.join(', '),
            assistant_names: assistantNames.join(', '),
            ops_names: opsNames.join(', '),
            duration_hours: session.duration_hours,
            rate_lead: req ? req.hourly_rate_lead : 25000,
            rate_assistant: req ? req.hourly_rate_assistant : 12000,
            institution_rate_lead: req ? req.institution_rate_lead : 0,
            institution_rate_assistant: req ? req.institution_rate_assistant : 0
        });

        // Auto-generate Activity_Log for each assigned instructor
        assignments.forEach(a => {
            const role = a.assigned_role;
            const dedupeKey = `${sessionId}_${a.instructor_id}_schedule`;
            const existing = DB.activityLog.getAll().find(l => l.dedupe_key === dedupeKey);
            if (existing) return;

            DB.activityLog.add({
                instructor_id: a.instructor_id,
                date: session.date,
                category: 'lecture_experience',
                sub_category: req ? req.lecture_type : 'general',
                role: role,
                description: `${req ? req.institution : ''} - ${req ? req.content : ''} (${role === 'lead' ? '주강사' : '보조강사'})`,
                source: 'system',
                lecture_id: sessionId,
                dedupe_key: dedupeKey
            });
            DB.instructors.recalculate(a.instructor_id);
        });

        return this.getById(sessionId);
    },

    getNeedingAssignment() {
        return this.getAll().filter(s => s.status === 'open' || s.status === 'assigning');
    }
};

// ═══ Instructor_Availability (강사 가용시간) ═══
DB.availability = {
    getAll() { return DB._get(DB.KEYS.AVAILABILITY); },

    getByInstructor(insId) {
        return this.getAll().find(a => a.instructor_id === insId) || null;
    },

    upsert(insId, data) {
        const all = this.getAll();
        const idx = all.findIndex(a => a.instructor_id === insId);
        const record = {
            instructor_id: insId,
            weekly_slots: data.weekly_slots || {
                mon_am: false, mon_pm: false, mon_eve: false,
                tue_am: false, tue_pm: false, tue_eve: false,
                wed_am: false, wed_pm: false, wed_eve: false,
                thu_am: false, thu_pm: false, thu_eve: false,
                fri_am: false, fri_pm: false, fri_eve: false,
                sat_am: false, sat_pm: false, sat_eve: false,
                sun_am: false, sun_pm: false, sun_eve: false
            },
            exceptions: data.exceptions || [],
            activity_region: data.activity_region || '',
            transport: data.transport || 'public',
            updated_at: new Date().toISOString()
        };
        if (idx >= 0) { all[idx] = record; }
        else { all.push(record); }
        DB._set(DB.KEYS.AVAILABILITY, all);
        return record;
    },

    isAvailable(insId, date, startTime) {
        const avail = this.getByInstructor(insId);
        if (!avail) return true; // No data = assume available

        // Check exceptions first
        const exception = avail.exceptions.find(e => e.date === date);
        if (exception && exception.status === 'unavailable') return false;

        // Check weekly slots
        const dayOfWeek = ['sun','mon','tue','wed','thu','fri','sat'][new Date(date).getDay()];
        const hour = parseInt(startTime.split(':')[0]);
        let slot;
        if (hour < 12) slot = 'am';
        else if (hour < 18) slot = 'pm';
        else slot = 'eve';

        const key = `${dayOfWeek}_${slot}`;
        return avail.weekly_slots[key] !== false;
    }
};

// ═══ Instructor_Application (지원 기록) ═══
DB.applications = {
    getAll() { return DB._get(DB.KEYS.APPLICATIONS); },
    getByRequest(reqId) { return this.getAll().filter(a => a.request_id === reqId); },

    add(data) {
        const all = this.getAll();
        const app = {
            application_id: DB._nextId('APP'),
            request_id: data.request_id,
            instructor_id: data.instructor_id,
            role_preference: data.role_preference || 'any',
            can_cover_all: data.can_cover_all || false,
            notes: data.notes || '',
            applied_at: new Date().toISOString(),
            status: 'applied'
        };
        all.push(app);
        DB._set(DB.KEYS.APPLICATIONS, all);
        return app;
    }
};

// ═══ Instructor_Assignment (배정 결과) ═══
DB.assignments = {
    getAll() { return DB._get(DB.KEYS.ASSIGNMENTS); },
    getBySession(sesId) { return this.getAll().filter(a => a.session_id === sesId); },
    getByInstructor(insId) { return this.getAll().filter(a => a.instructor_id === insId); },

    add(data) {
        const all = this.getAll();
        const assignment = {
            assignment_id: DB._nextId('ASG'),
            session_id: data.session_id,
            instructor_id: data.instructor_id,
            assigned_role: data.assigned_role || 'assistant',
            assignment_status: data.assignment_status || 'recommended',
            recommendation_score: data.recommendation_score || 0,
            score_breakdown: data.score_breakdown || {},
            hold_until: data.hold_until || null,
            confirmed_at: null,
            manual_override_reason: data.manual_override_reason || null,
            created_at: new Date().toISOString()
        };
        all.push(assignment);
        DB._set(DB.KEYS.ASSIGNMENTS, all);
        return assignment;
    },

    update(id, updates) {
        const all = this.getAll();
        const idx = all.findIndex(a => a.assignment_id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates };
        DB._set(DB.KEYS.ASSIGNMENTS, all);
        return all[idx];
    },

    hold(assignmentId, hours) {
        const holdUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        return this.update(assignmentId, { assignment_status: 'hold', hold_until: holdUntil });
    },

    confirm(assignmentId) {
        return this.update(assignmentId, {
            assignment_status: 'confirmed',
            confirmed_at: new Date().toISOString()
        });
    },

    cancel(assignmentId, reason) {
        return this.update(assignmentId, {
            assignment_status: 'cancelled',
            manual_override_reason: reason || 'cancelled'
        });
    },

    /**
     * Check if instructor has time conflict
     */
    hasConflict(instructorId, date, startTime, endTime, excludeSessionId) {
        const start = this._timeToMin(startTime);
        const end = this._timeToMin(endTime);

        return this.getByInstructor(instructorId)
            .filter(a => (a.assignment_status === 'confirmed' || a.assignment_status === 'hold'))
            .filter(a => a.session_id !== excludeSessionId)
            .some(a => {
                const ses = DB.lectureSessions.getById(a.session_id);
                if (!ses || ses.date !== date) return false;
                const sStart = this._timeToMin(ses.start_time) - ses.prep_buffer_min - ses.travel_buffer_min;
                const sEnd = this._timeToMin(ses.end_time) + ses.travel_buffer_min;
                return start < sEnd && end > sStart;
            });
    },

    _timeToMin(t) {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
    }
};

// ═══ Schedule_Ledger (결과 원장) ═══
DB.scheduleLedger = {
    getAll() { return DB._get(DB.KEYS.SCHEDULE_LEDGER); },

    add(data) {
        const all = this.getAll();
        const durationH = data.duration_hours || 2;
        const leadCost = (data.rate_lead || 25000) * durationH;
        const assistantCost = (data.rate_assistant || 12000) * durationH;
        const instLeadRate = data.institution_rate_lead || 0;
        const instAsstRate = data.institution_rate_assistant || 0;

        const ledger = {
            ledger_id: DB._nextId('LDG'),
            session_id: data.session_id,
            request_id: data.request_id,
            date: data.date,
            institution: data.institution,
            content: data.content,
            target: data.target,
            headcount: data.headcount,
            lead_names: data.lead_names || '',
            assistant_names: data.assistant_names || '',
            ops_names: data.ops_names || '',
            duration_hours: durationH,
            rate_lead: data.rate_lead || 25000,
            rate_assistant: data.rate_assistant || 12000,
            institution_rate_lead: instLeadRate,
            institution_rate_assistant: instAsstRate,
            payback_lead: instLeadRate > 0 ? (instLeadRate - (data.rate_lead || 25000)) * durationH : 0,
            payback_assistant: instAsstRate > 0 ? (instAsstRate - (data.rate_assistant || 12000)) * durationH : 0,
            payback_status: 'pending',
            notes: data.notes || '',
            auto_generated_at: new Date().toISOString()
        };
        all.push(ledger);
        DB._set(DB.KEYS.SCHEDULE_LEDGER, all);
        return ledger;
    },

    getByMonth(yearMonth) {
        return this.getAll().filter(l => l.date && l.date.startsWith(yearMonth));
    }
};

// ═══════════════════════════════════════════════════
// RECOMMENDATION ENGINE
// ═══════════════════════════════════════════════════
const RecommendationEngine = {
    WEIGHTS: {
        roleFit: 30,
        specialtyFit: 25,
        timeRegionFit: 20,
        experienceFit: 15,
        reliability: 10
    },

    /**
     * Get recommendations for a session
     * Returns { lead: [...], assistant: [...], ops: [...] }
     * Each array has items: { instructor, score, breakdown, exclusionReason }
     */
    getRecommendations(sessionId) {
        const session = DB.lectureSessions.getById(sessionId);
        if (!session) return { lead: [], assistant: [], ops: [] };

        const req = DB.lectureRequests.getById(session.request_id);
        if (!req) return { lead: [], assistant: [], ops: [] };

        const allInstructors = DB.instructors.getAll().filter(i => i.status === 'active');
        const results = { lead: [], assistant: [], ops: [] };

        allInstructors.forEach(ins => {
            const exclusion = this._hardFilter(ins, session, req);
            if (exclusion) {
                ['lead', 'assistant', 'ops'].forEach(role => {
                    results[role].push({ instructor: ins, score: 0, breakdown: {}, exclusionReason: exclusion });
                });
                return;
            }

            ['lead', 'assistant'].forEach(role => {
                const roleExclusion = this._roleFilter(ins, role, req);
                if (roleExclusion) {
                    results[role].push({ instructor: ins, score: 0, breakdown: {}, exclusionReason: roleExclusion });
                    return;
                }

                const breakdown = this._calcFitScore(ins, session, req, role);
                const adjustments = this._calcAdjustments(ins, session, req, role);
                const totalScore = Math.max(0, Math.min(100,
                    Object.values(breakdown).reduce((a, b) => a + b, 0) + adjustments.total
                ));

                results[role].push({
                    instructor: ins,
                    score: Math.round(totalScore),
                    breakdown: { ...breakdown, adjustments: adjustments.details },
                    exclusionReason: null
                });
            });
        });

        // Sort by score descending
        ['lead', 'assistant', 'ops'].forEach(role => {
            results[role].sort((a, b) => b.score - a.score);
        });

        return results;
    },

    /**
     * Get top 3 recommendation strategies
     */
    getStrategies(sessionId) {
        const recs = this.getRecommendations(sessionId);
        const eligible = {
            lead: recs.lead.filter(r => !r.exclusionReason),
            assistant: recs.assistant.filter(r => !r.exclusionReason)
        };

        const strategies = [];

        // 🟢 안정형: 최고 점수
        if (eligible.lead.length > 0) {
            strategies.push({
                type: 'stable',
                icon: '🟢',
                label: '안정형',
                description: '성공 확률 최고',
                lead: eligible.lead[0] || null,
                assistant: eligible.assistant[0] || null
            });
        }

        // 🔵 수익형: 최소 필요 등급 (과티어 방지)
        const minTierLead = eligible.lead.find(r => {
            const grade = r.instructor.grade;
            if (SCORING_RULES.grades.master && grade === 'Master') return false;
            return true;
        }) || eligible.lead[eligible.lead.length - 1];

        if (minTierLead && minTierLead !== (strategies[0]?.lead)) {
            strategies.push({
                type: 'efficient',
                icon: '🔵',
                label: '수익형',
                description: '최소 필요 등급 배정',
                lead: minTierLead,
                assistant: eligible.assistant[0] || null
            });
        }

        // 🟡 백업형: 가용시간 확실한 후보
        const backupLead = eligible.lead.find(r => {
            const avail = DB.availability.getByInstructor(r.instructor.instructor_id);
            if (!avail) return false;
            return true;
        });
        if (backupLead && backupLead !== (strategies[0]?.lead)) {
            strategies.push({
                type: 'backup',
                icon: '🟡',
                label: '백업형',
                description: '즉시 투입 가능',
                lead: backupLead,
                assistant: eligible.assistant.length > 1 ? eligible.assistant[1] : eligible.assistant[0]
            });
        }

        return strategies;
    },

    // ─── Hard Filter ───
    _hardFilter(ins, session, req) {
        if (ins.status !== 'active') return '비활성 상태';
        if (ins.assignment_block) return `배정차단: ${ins.block_reason || ''}`;

        // Time conflict
        if (DB.assignments.hasConflict(ins.instructor_id, session.date, session.start_time, session.end_time, session.session_id)) {
            return '시간 겹침 (기존 배정)';
        }

        // Availability check
        if (!DB.availability.isAvailable(ins.instructor_id, session.date, session.start_time)) {
            return '가용시간 불일치';
        }

        return null;
    },

    // ─── Role Filter ───
    _roleFilter(ins, role, req) {
        const grade = ins.grade;
        if (role === 'lead') {
            if (grade === 'Trainee') return '주강사 권한 없음 (Trainee)';
            if (req.service_level === 'high_risk' && grade !== 'Master') return 'high_risk 공고: Master만 주강 가능';
        }
        return null;
    },

    // ─── Fitness Score ───
    _calcFitScore(ins, session, req, role) {
        const w = this.WEIGHTS;
        const breakdown = {};

        // 1. Role/Grade Fit (30)
        const gradeScores = { Master: 100, Standard: 70, Trainee: 40 };
        const gradeScore = gradeScores[ins.grade] || 50;
        if (role === 'lead') {
            breakdown.roleFit = (gradeScore / 100) * w.roleFit;
        } else {
            breakdown.roleFit = w.roleFit * 0.8; // assistants are more flexible
        }

        // 2. Specialty Fit (25)
        const reqTags = req.specialty_tags || [];
        const insTags = ins.specialty_tags || [];
        if (reqTags.length > 0) {
            const matchCount = reqTags.filter(t => insTags.includes(t)).length;
            breakdown.specialtyFit = (matchCount / reqTags.length) * w.specialtyFit;
        } else {
            breakdown.specialtyFit = w.specialtyFit * 0.7;
        }

        // 3. Time/Region Fit (20)
        const avail = DB.availability.getByInstructor(ins.instructor_id);
        let timeScore = 0.5;
        if (avail) {
            const dayOfWeek = ['sun','mon','tue','wed','thu','fri','sat'][new Date(session.date).getDay()];
            const hour = parseInt(session.start_time.split(':')[0]);
            const slot = hour < 12 ? 'am' : hour < 18 ? 'pm' : 'eve';
            const key = `${dayOfWeek}_${slot}`;
            timeScore = avail.weekly_slots[key] ? 1.0 : 0.3;

            // Region match
            if (avail.activity_region && req.region) {
                if (avail.activity_region.includes(req.region) || req.region.includes(avail.activity_region)) {
                    timeScore = Math.min(1.0, timeScore + 0.2);
                }
            }
        }
        breakdown.timeRegionFit = timeScore * w.timeRegionFit;

        // 4. Experience Fit (15)
        const pastLogs = DB.activityLog.getByInstructor(ins.instructor_id)
            .filter(l => l.category === 'lecture_experience');
        const sameContent = pastLogs.filter(l => l.description && l.description.includes(req.content || ''));
        const sameInstitution = pastLogs.filter(l => l.description && l.description.includes(req.institution || ''));
        let expScore = Math.min(1.0, pastLogs.length * 0.1);
        if (sameContent.length > 0) expScore = Math.min(1.0, expScore + 0.3);
        if (sameInstitution.length > 0) expScore = Math.min(1.0, expScore + 0.2);
        breakdown.experienceFit = expScore * w.experienceFit;

        // 5. Reliability (10)
        const reliabilityScore = Math.min(1.0, (ins.total_score || 0) / 80);
        breakdown.reliability = reliabilityScore * w.reliability;

        return breakdown;
    },

    // ─── Adjustments ───
    _calcAdjustments(ins, session, req, role) {
        const details = [];
        let total = 0;

        // Repeated course same instructor bonus
        const sameReqSessions = DB.lectureSessions.getByRequest(session.request_id);
        const confirmedInSameReq = sameReqSessions.some(s =>
            s.session_id !== session.session_id &&
            DB.assignments.getBySession(s.session_id).some(a =>
                a.instructor_id === ins.instructor_id &&
                a.assigned_role === role &&
                a.assignment_status === 'confirmed'
            )
        );
        if (confirmedInSameReq) {
            total += 10;
            details.push({ reason: '반복 과정 동일 강사', value: +10 });
        }

        // Overload penalty (3+ in 7 days)
        const recentDays = 7;
        const cutoff = new Date(session.date);
        cutoff.setDate(cutoff.getDate() - recentDays);
        const recentAssignments = DB.assignments.getByInstructor(ins.instructor_id)
            .filter(a => a.assignment_status === 'confirmed')
            .filter(a => {
                const ses = DB.lectureSessions.getById(a.session_id);
                return ses && new Date(ses.date) >= cutoff;
            });
        if (recentAssignments.length >= 3) {
            total -= 15;
            details.push({ reason: `과부하 (최근 7일 ${recentAssignments.length}건)`, value: -15 });
        }

        // Over-tier penalty
        if (role === 'lead' && req.service_level === 'standard' && ins.grade === 'Master') {
            total -= 5;
            details.push({ reason: '과티어 (standard에 Master)', value: -5 });
        }

        return { total, details };
    }
};

// ═══ Demo Data Extension ═══
DB._seedSchedulingDemo = function() {
    const instructors = DB.instructors.getAll();
    if (instructors.length === 0) return;

    // Add specialty tags and regions to existing instructors
    instructors.forEach((ins, idx) => {
        const specialties = [['코딩','로봇'], ['로봇','AI'], ['전자','드론'], ['코딩','AI','3D프린팅'], ['기계','로봇','드론']];
        const regions = ['안산', '서울', '안산', '수원', '안산'];
        DB.instructors.update(ins.instructor_id, {
            specialty_tags: specialties[idx % 5],
            activity_region: regions[idx % 5],
            transport: idx % 2 === 0 ? 'car' : 'public'
        });

        // Set availability
        const slots = {};
        ['mon','tue','wed','thu','fri','sat','sun'].forEach(day => {
            slots[`${day}_am`] = Math.random() > 0.3;
            slots[`${day}_pm`] = Math.random() > 0.2;
            slots[`${day}_eve`] = Math.random() > 0.6;
        });
        DB.availability.upsert(ins.instructor_id, {
            weekly_slots: slots,
            activity_region: regions[idx % 5],
            transport: idx % 2 === 0 ? 'car' : 'public'
        });
    });

    // Create lecture requests
    const requests = [
        { institution: '안산중학교', content: '로봇 코딩 기초', target: '중1', headcount: 30, region: '안산', service_level: 'standard', lecture_type: 'general', specialty_tags: ['코딩','로봇'], session_count: 4 },
        { institution: '한양대 ERICA', content: 'DLS AI 워크숍', target: '대학생', headcount: 20, region: '안산', service_level: 'high_risk', lecture_type: 'dls', specialty_tags: ['AI','코딩'], session_count: 1 },
        { institution: 'KINTEX', content: '과학축제 드론 체험', target: '초등', headcount: 100, region: '서울', service_level: 'important', lecture_type: 'general', specialty_tags: ['드론'], session_count: 2 }
    ];

    requests.forEach(r => {
        const req = DB.lectureRequests.add(r);
        const dates = [];
        for (let i = 0; i < r.session_count; i++) {
            const d = new Date();
            d.setDate(d.getDate() + 7 + i * 7);
            dates.push({ date: d.toISOString().split('T')[0], start_time: '10:00', end_time: '12:00', duration_hours: 2 });
        }
        DB.lectureRequests.generateSessions(req.request_id, dates);
    });

    console.log('Scheduling demo data seeded!');
};
