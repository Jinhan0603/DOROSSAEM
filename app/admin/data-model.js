/**
 * DORO Data Model & LocalStorage CRUD
 * ====================================
 * All data is stored in LocalStorage with JSON serialization.
 * Each collection uses a prefix for namespace isolation.
 * Designed for future Google Sheet API migration.
 */

const DB = {
    // ═══════════════════════════════════════
    // Storage Keys
    // ═══════════════════════════════════════
    KEYS: {
        INSTRUCTORS: 'doro_instructors',
        LECTURES: 'doro_lectures',
        ACTIVITY_LOG: 'doro_activity_log',
        ABILITY_LOG: 'doro_ability_log',
        EVAL_RAW: 'doro_eval_raw',
        EVAL_SUMMARY: 'doro_eval_summary',
        ACTION_REQUESTS: 'doro_action_requests',
        SNAPSHOTS: 'doro_snapshots',
        COUNTERS: 'doro_counters'
    },

    // ═══════════════════════════════════════
    // Generic CRUD
    // ═══════════════════════════════════════
    _get(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch { return []; }
    },

    _set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    _nextId(prefix) {
        const counters = JSON.parse(localStorage.getItem(this.KEYS.COUNTERS) || '{}');
        const current = (counters[prefix] || 0) + 1;
        counters[prefix] = current;
        localStorage.setItem(this.KEYS.COUNTERS, JSON.stringify(counters));
        return `${prefix}_${String(current).padStart(5, '0')}`;
    },

    // ═══════════════════════════════════════
    // Instructor_DB
    // ═══════════════════════════════════════
    instructors: {
        getAll() { return DB._get(DB.KEYS.INSTRUCTORS); },
        
        getById(id) {
            return this.getAll().find(i => i.instructor_id === id) || null;
        },

        add(data) {
            const all = this.getAll();
            const instructor = {
                instructor_id: data.instructor_id || DB._nextId('INS'),
                name: data.name || '',
                major: data.major || data.specialty || '',
                phone: data.phone || '',
                email: data.email || '',
                join_date: data.join_date || new Date().toISOString().split('T')[0],
                status: data.status || data.active_status || 'active',
                // 점수 필드
                score_experience: data.score_experience || 0,
                score_evaluation: data.score_evaluation || null,
                score_expertise: data.score_expertise || 0,
                score_contribution: data.score_contribution || 0,
                bonus_penalty: data.bonus_penalty || 0,
                total_score: data.total_score || 0,
                grade: data.grade || data.tier || 'Trainee',
                assignment_block: data.assignment_block || false,
                block_reason: data.block_reason || null,
                last_calculated_at: data.last_calculated_at || null,
                created_at: data.created_at || new Date().toISOString(),
                // DOROSSAEM 호환 필드
                specialty: data.specialty || data.major || '',
                activity_region: data.activity_region || '',
                activity_time: data.activity_time || '',
                first_cohort: data.first_cohort || '',
                active_status: data.active_status || data.status || 'active',
                tier: data.tier || data.grade || 'Trainee',
                penalty_count: data.penalty_count || 0,
                last_updated: data.last_updated || null,
            };
            all.push(instructor);
            DB._set(DB.KEYS.INSTRUCTORS, all);
            return instructor;
        },

        update(id, updates) {
            const all = this.getAll();
            const idx = all.findIndex(i => i.instructor_id === id);
            if (idx === -1) return null;
            // Sync bidirectional fields
            if (updates.status) updates.active_status = updates.status;
            if (updates.active_status) updates.status = updates.active_status;
            if (updates.grade) updates.tier = updates.grade;
            if (updates.tier) updates.grade = updates.tier;
            if (updates.major) updates.specialty = updates.specialty || updates.major;
            if (updates.specialty) updates.major = updates.major || updates.specialty;
            all[idx] = { ...all[idx], ...updates };
            DB._set(DB.KEYS.INSTRUCTORS, all);
            return all[idx];
        },

        delete(id) {
            const all = this.getAll().filter(i => i.instructor_id !== id);
            DB._set(DB.KEYS.INSTRUCTORS, all);
        },

        search(query) {
            const q = query.toLowerCase();
            return this.getAll().filter(i =>
                i.name.toLowerCase().includes(q) ||
                i.major.toLowerCase().includes(q) ||
                i.email.toLowerCase().includes(q)
            );
        },

        /**
         * 점수 재계산 및 갱신
         */
        recalculate(instructorId) {
            const logs = DB.activityLog.getByInstructor(instructorId);
            const abilities = DB.abilityLog.getByInstructor(instructorId);
            const summaries = DB.evalSummary.getByInstructor(instructorId);

            const expScore = ScoreCalculator.calcExperience(logs);
            const evalScore = ScoreCalculator.calcEvaluation(summaries);
            const extScore = ScoreCalculator.calcExpertise(abilities);
            const conScore = ScoreCalculator.calcContribution(logs);
            const bpScore = ScoreCalculator.calcBonusPenalty(logs);
            const totalScore = ScoreCalculator.calcTotal(expScore, evalScore, extScore, conScore, bpScore);
            const grade = ScoreCalculator.calcGrade(totalScore);
            const blockCheck = ScoreCalculator.shouldBlock(logs);

            return this.update(instructorId, {
                score_experience: expScore,
                score_evaluation: evalScore,
                score_expertise: extScore,
                score_contribution: conScore,
                bonus_penalty: bpScore,
                total_score: Math.round(totalScore * 10) / 10,
                grade: grade.label,
                assignment_block: blockCheck.blocked,
                block_reason: blockCheck.reason,
                last_calculated_at: new Date().toISOString()
            });
        },

        recalculateAll() {
            this.getAll().forEach(i => this.recalculate(i.instructor_id));
        }
    },

    // ═══════════════════════════════════════
    // Lecture_Master
    // ═══════════════════════════════════════
    lectures: {
        getAll() { return DB._get(DB.KEYS.LECTURES); },
        
        getById(id) {
            return this.getAll().find(l => l.lecture_id === id) || null;
        },

        add(data) {
            const all = this.getAll();
            const lecture = {
                lecture_id: DB._nextId('LEC'),
                date: data.date || '',
                institution: data.institution || '',
                lecture_type: data.lecture_type || 'general',
                lecture_name: data.lecture_name || '',
                lead_instructor_id: data.lead_instructor_id || '',
                assistant_instructor_ids: data.assistant_instructor_ids || [],
                manager: data.manager || '',
                status: 'scheduled',
                evaluation_status: 'pending',
                created_at: new Date().toISOString(),
                completed_at: null
            };
            all.push(lecture);
            DB._set(DB.KEYS.LECTURES, all);
            return lecture;
        },

        update(id, updates) {
            const all = this.getAll();
            const idx = all.findIndex(l => l.lecture_id === id);
            if (idx === -1) return null;
            all[idx] = { ...all[idx], ...updates };
            DB._set(DB.KEYS.LECTURES, all);
            return all[idx];
        },

        delete(id) {
            const all = this.getAll().filter(l => l.lecture_id !== id);
            DB._set(DB.KEYS.LECTURES, all);
        },

        /**
         * 강의 완료 처리 → Activity_Log 자동 생성
         */
        complete(lectureId) {
            const lecture = this.getById(lectureId);
            if (!lecture || lecture.status === 'completed') return null;

            // Update lecture status
            this.update(lectureId, {
                status: 'completed',
                completed_at: new Date().toISOString()
            });

            // Auto-generate Activity_Log for all instructors
            const allInstructorIds = [
                lecture.lead_instructor_id,
                ...(lecture.assistant_instructor_ids || [])
            ].filter(Boolean);

            allInstructorIds.forEach(insId => {
                const role = insId === lecture.lead_instructor_id ? 'lead' : 'assistant';
                const dedupeKey = `${lectureId}_${insId}_lecture_experience`;
                
                // Dedupe check
                const existing = DB.activityLog.getAll().find(l => l.dedupe_key === dedupeKey);
                if (existing) return;

                DB.activityLog.add({
                    instructor_id: insId,
                    date: lecture.date,
                    category: 'lecture_experience',
                    sub_category: lecture.lecture_type,
                    role: role,
                    description: `${lecture.institution} - ${lecture.lecture_name} (${role === 'lead' ? '주강사' : '보조강사'})`,
                    point: null, // auto-calculated
                    source: 'system',
                    lecture_id: lectureId,
                    dedupe_key: dedupeKey
                });

                // Recalculate scores
                DB.instructors.recalculate(insId);
            });

            return this.getById(lectureId);
        },

        /**
         * 필터 메서드들
         */
        getScheduled() {
            return this.getAll().filter(l => l.status === 'scheduled');
        },

        getTodayIncomplete() {
            const today = new Date().toISOString().split('T')[0];
            return this.getAll().filter(l => l.date === today && l.status === 'scheduled');
        },

        getPendingEvaluation() {
            return this.getAll().filter(l => 
                l.status === 'completed' && 
                (l.evaluation_status === 'pending' || l.evaluation_status === 'partial')
            );
        }
    },

    // ═══════════════════════════════════════
    // Activity_Log (append-only)
    // ═══════════════════════════════════════
    activityLog: {
        getAll() { return DB._get(DB.KEYS.ACTIVITY_LOG); },

        getByInstructor(instructorId) {
            return this.getAll().filter(l => l.instructor_id === instructorId);
        },

        add(data) {
            const all = this.getAll();
            const log = {
                log_id: DB._nextId('LOG'),
                instructor_id: data.instructor_id,
                date: data.date || new Date().toISOString().split('T')[0],
                category: data.category,          // lecture_experience, contribution, bonus, penalty
                sub_category: data.sub_category,
                role: data.role || null,
                description: data.description || '',
                point: data.point || null,
                source: data.source || 'manager',  // system, form, manager
                lecture_id: data.lecture_id || null,
                dedupe_key: data.dedupe_key || null,
                origin_id: data.origin_id || null,  // Action_Request ID if from approval
                approved_by: data.approved_by || null,
                approved_at: data.approved_at || null,
                evidence_url: data.evidence_url || null,
                reversal_of: data.reversal_of || null,
                created_at: new Date().toISOString()
            };
            all.push(log);
            DB._set(DB.KEYS.ACTIVITY_LOG, all);
            return log;
        },

        /**
         * Reversal 추가 (원본 수정 대신 반대 row 추가)
         */
        addReversal(originalLogId, reason) {
            const original = this.getAll().find(l => l.log_id === originalLogId);
            if (!original) return null;

            return this.add({
                instructor_id: original.instructor_id,
                date: new Date().toISOString().split('T')[0],
                category: original.category,
                sub_category: original.sub_category,
                description: `[REVERSAL] ${reason} (원본: ${originalLogId})`,
                point: original.point ? -original.point : null,
                source: 'manager',
                lecture_id: original.lecture_id,
                reversal_of: originalLogId,
                approved_by: 'manager'
            });
        }
    },

    // ═══════════════════════════════════════
    // Ability_Log
    // ═══════════════════════════════════════
    abilityLog: {
        getAll() { return DB._get(DB.KEYS.ABILITY_LOG); },

        getByInstructor(instructorId) {
            return this.getAll().filter(l => l.instructor_id === instructorId);
        },

        add(data) {
            const all = this.getAll();
            const log = {
                ability_id: DB._nextId('ABL'),
                instructor_id: data.instructor_id,
                ability_type: data.ability_type,
                description: data.description || '',
                evidence_url: data.evidence_url || null,
                verified: data.verified || false,
                created_at: new Date().toISOString()
            };
            all.push(log);
            DB._set(DB.KEYS.ABILITY_LOG, all);
            return log;
        },

        update(id, updates) {
            const all = this.getAll();
            const idx = all.findIndex(a => a.ability_id === id);
            if (idx === -1) return null;
            all[idx] = { ...all[idx], ...updates };
            DB._set(DB.KEYS.ABILITY_LOG, all);
            return all[idx];
        }
    },

    // ═══════════════════════════════════════
    // Evaluation_Raw
    // ═══════════════════════════════════════
    evalRaw: {
        getAll() { return DB._get(DB.KEYS.EVAL_RAW); },

        getByLecture(lectureId) {
            return this.getAll().filter(e => e.lecture_id === lectureId);
        },

        add(data) {
            const all = this.getAll();
            const eval_ = {
                eval_id: DB._nextId('EVL'),
                lecture_id: data.lecture_id,
                instructor_id: data.instructor_id,
                evaluator_type: data.evaluator_type,  // student, institution, peer
                score_items: data.score_items || {},    // { satisfaction: 4, expertise: 5, ... }
                comment: data.comment || '',
                submitted_at: new Date().toISOString(),
                submitted_by: data.submitted_by || 'manager'
            };
            all.push(eval_);
            DB._set(DB.KEYS.EVAL_RAW, all);

            // Auto-update summary
            this.updateSummary(data.lecture_id, data.instructor_id, data.evaluator_type);

            return eval_;
        },

        /**
         * 강의별·강사별 집계 자동 갱신
         */
        updateSummary(lectureId, instructorId, evaluatorType) {
            const raws = this.getAll().filter(e => 
                e.lecture_id === lectureId && 
                e.instructor_id === instructorId && 
                e.evaluator_type === evaluatorType
            );

            if (raws.length === 0) return;

            // Calculate average from all score_items
            const allScores = raws.flatMap(r => Object.values(r.score_items));
            const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;

            DB.evalSummary.upsert({
                lecture_id: lectureId,
                instructor_id: instructorId,
                evaluator_type: evaluatorType,
                avg_score: Math.round(avgScore * 100) / 100,
                response_count: raws.length
            });

            // Update lecture evaluation status
            DB.lectures._updateEvalStatus(lectureId);

            // Recalculate instructor score
            DB.instructors.recalculate(instructorId);
        }
    },

    // ═══════════════════════════════════════
    // Evaluation_Summary
    // ═══════════════════════════════════════
    evalSummary: {
        getAll() { return DB._get(DB.KEYS.EVAL_SUMMARY); },

        getByInstructor(instructorId) {
            return this.getAll().filter(s => s.instructor_id === instructorId);
        },

        getByLecture(lectureId) {
            return this.getAll().filter(s => s.lecture_id === lectureId);
        },

        upsert(data) {
            const all = this.getAll();
            const idx = all.findIndex(s =>
                s.lecture_id === data.lecture_id &&
                s.instructor_id === data.instructor_id &&
                s.evaluator_type === data.evaluator_type
            );

            const summary = {
                summary_id: idx >= 0 ? all[idx].summary_id : DB._nextId('SUM'),
                lecture_id: data.lecture_id,
                instructor_id: data.instructor_id,
                evaluator_type: data.evaluator_type,
                avg_score: data.avg_score,
                response_count: data.response_count,
                calculated_at: new Date().toISOString()
            };

            if (idx >= 0) {
                all[idx] = summary;
            } else {
                all.push(summary);
            }
            DB._set(DB.KEYS.EVAL_SUMMARY, all);
            return summary;
        }
    },

    // ═══════════════════════════════════════
    // Action_Request (내부기여/가산/감점 승인 대기)
    // ═══════════════════════════════════════
    actionRequests: {
        getAll() { return DB._get(DB.KEYS.ACTION_REQUESTS); },

        getPending() {
            return this.getAll().filter(r => r.status === 'pending');
        },

        add(data) {
            const all = this.getAll();
            const request = {
                request_id: DB._nextId('REQ'),
                instructor_id: data.instructor_id,
                request_type: data.request_type,       // contribution, bonus, penalty
                category: data.category,
                sub_category: data.sub_category,
                quantity: data.quantity || 1,
                point_preview: data.point_preview || 0,
                evidence_url: data.evidence_url || '',
                note: data.note || '',
                status: 'pending',
                requested_at: new Date().toISOString(),
                reviewed_by: null,
                reviewed_at: null
            };
            all.push(request);
            DB._set(DB.KEYS.ACTION_REQUESTS, all);
            return request;
        },

        /**
         * 승인 → Activity_Log에 append
         */
        approve(requestId) {
            const all = this.getAll();
            const idx = all.findIndex(r => r.request_id === requestId);
            if (idx === -1) return null;

            const request = all[idx];
            all[idx] = {
                ...request,
                status: 'approved',
                reviewed_by: 'manager',
                reviewed_at: new Date().toISOString()
            };
            DB._set(DB.KEYS.ACTION_REQUESTS, all);

            // Determine point from rules
            let point = request.point_preview;
            if (request.request_type === 'contribution') {
                const autoItem = SCORING_RULES.contribution.autoItems[request.sub_category];
                const approvalItem = SCORING_RULES.contribution.approvalItems[request.sub_category];
                point = (autoItem?.point || approvalItem?.point || 0) * (request.quantity || 1);
            } else if (request.request_type === 'bonus') {
                point = SCORING_RULES.bonusPenalty.bonus[request.sub_category]?.point || 0;
            } else if (request.request_type === 'penalty') {
                point = SCORING_RULES.bonusPenalty.penalty[request.sub_category]?.point || 0;
            }

            // Append to Activity_Log
            DB.activityLog.add({
                instructor_id: request.instructor_id,
                category: request.request_type,
                sub_category: request.sub_category,
                description: `${request.note || request.category}`,
                point: point,
                source: 'manager',
                origin_id: requestId,
                approved_by: 'manager',
                approved_at: new Date().toISOString(),
                evidence_url: request.evidence_url
            });

            // Check immediate block for penalties
            if (request.request_type === 'penalty') {
                const rule = SCORING_RULES.bonusPenalty.penalty[request.sub_category];
                if (rule && rule.immediateBlock) {
                    DB.instructors.update(request.instructor_id, {
                        assignment_block: true,
                        block_reason: rule.description
                    });
                }
            }

            // Recalculate
            DB.instructors.recalculate(request.instructor_id);
            return all[idx];
        },

        /**
         * 반려
         */
        reject(requestId, reason) {
            const all = this.getAll();
            const idx = all.findIndex(r => r.request_id === requestId);
            if (idx === -1) return null;
            all[idx] = {
                ...all[idx],
                status: 'rejected',
                reviewed_by: 'manager',
                reviewed_at: new Date().toISOString(),
                note: all[idx].note + ` [반려사유: ${reason}]`
            };
            DB._set(DB.KEYS.ACTION_REQUESTS, all);
            return all[idx];
        }
    },

    // ═══════════════════════════════════════
    // Snapshot (월간)
    // ═══════════════════════════════════════
    snapshots: {
        getAll() { return DB._get(DB.KEYS.SNAPSHOTS); },

        create() {
            const all = this.getAll();
            const snapshot = {
                snapshot_id: DB._nextId('SNP'),
                date: new Date().toISOString().split('T')[0],
                month: new Date().toISOString().slice(0, 7),
                instructors: DB.instructors.getAll().map(i => ({
                    instructor_id: i.instructor_id,
                    name: i.name,
                    total_score: i.total_score,
                    grade: i.grade,
                    score_experience: i.score_experience,
                    score_evaluation: i.score_evaluation,
                    score_expertise: i.score_expertise,
                    score_contribution: i.score_contribution,
                    assignment_block: i.assignment_block
                })),
                created_at: new Date().toISOString()
            };
            all.push(snapshot);
            DB._set(DB.KEYS.SNAPSHOTS, all);
            return snapshot;
        }
    },

    // ═══════════════════════════════════════
    // Internal helpers
    // ═══════════════════════════════════════
    // Add _updateEvalStatus to lectures
    _init() {
        // Attach helper to lectures
        this.lectures._updateEvalStatus = (lectureId) => {
            const lecture = this.lectures.getById(lectureId);
            if (!lecture) return;

            const summaries = this.evalSummary.getByLecture(lectureId);
            const types = ['student', 'institution', 'peer'];
            const collected = types.filter(t => summaries.some(s => s.evaluator_type === t));

            let evalStatus = 'pending';
            if (collected.length === types.length) evalStatus = 'complete';
            else if (collected.length > 0) evalStatus = 'partial';

            this.lectures.update(lectureId, { evaluation_status: evalStatus });
        };
    },

    // ═══════════════════════════════════════
    // CSV Import / Export
    // ═══════════════════════════════════════
    csv: {
        export(key) {
            const data = DB._get(key);
            if (!data.length) return '';
            
            const headers = Object.keys(data[0]);
            const rows = data.map(row => 
                headers.map(h => {
                    let val = row[h];
                    if (val === null || val === undefined) val = '';
                    if (typeof val === 'object') val = JSON.stringify(val);
                    if (String(val).includes(',')) val = `"${val}"`;
                    return val;
                }).join(',')
            );
            return [headers.join(','), ...rows].join('\n');
        },

        downloadAll() {
            Object.entries(DB.KEYS).forEach(([name, key]) => {
                if (name === 'COUNTERS') return;
                const csv = this.export(key);
                if (!csv) return;
                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `doro_${name.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            });
        },

        importInstructors(csvText) {
            const lines = csvText.trim().split('\n');
            if (lines.length < 2) return 0;
            
            const headers = lines[0].split(',').map(h => h.trim());
            let count = 0;

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const obj = {};
                headers.forEach((h, idx) => obj[h] = values[idx] || '');
                
                DB.instructors.add({
                    name: obj.name || obj['이름'] || '',
                    major: obj.major || obj['전공'] || '',
                    phone: obj.phone || obj['연락처'] || '',
                    email: obj.email || obj['이메일'] || '',
                    join_date: obj.join_date || obj['가입일'] || '',
                    status: obj.status || 'active'
                });
                count++;
            }
            return count;
        }
    },

    /**
     * 데모 데이터 생성 (테스트용)
     */
    seedDemoData() {
        // 5명의 강사
        const instructors = [
            { name: '김도현', major: '컴퓨터공학', phone: '010-1234-5678', email: 'dohyun@test.com' },
            { name: '이서윤', major: '로봇공학', phone: '010-2345-6789', email: 'seoyun@test.com' },
            { name: '박지훈', major: '전자공학', phone: '010-3456-7890', email: 'jihun@test.com' },
            { name: '최유나', major: '소프트웨어학', phone: '010-4567-8901', email: 'yuna@test.com' },
            { name: '정민수', major: '기계공학', phone: '010-5678-9012', email: 'minsu@test.com' }
        ];

        const addedInstructors = instructors.map(i => DB.instructors.add(i));

        // 강의 8개 (다양한 타입)
        const lectureData = [
            { date: '2026-04-01', institution: '안산중학교', lecture_type: 'general', lecture_name: '로봇 코딩 입문', lead: 0, assistants: [1] },
            { date: '2026-04-02', institution: '한양대 ERICA', lecture_type: 'dls', lecture_name: 'DLS 프로그래밍', lead: 1, assistants: [2] },
            { date: '2026-04-03', institution: '서울과학관', lecture_type: 'general', lecture_name: 'AI 체험교육', lead: 2, assistants: [3] },
            { date: '2026-04-04', institution: '안산청소년재단', lecture_type: 'camp', lecture_name: '로봇캠프 1일차', lead: 0, assistants: [1, 4] },
            { date: '2026-04-05', institution: '안산청소년재단', lecture_type: 'camp', lecture_name: '로봇캠프 2일차', lead: 0, assistants: [1, 4] },
            { date: '2026-04-07', institution: 'KINTEX', lecture_type: 'general', lecture_name: '과학축제 체험부스', lead: 3, assistants: [4] },
            { date: '2026-04-08', institution: '상명대학교', lecture_type: 'doroland', lecture_name: 'DOROLAND 워크숍', lead: 2, assistants: [0] },
            { date: '2026-04-10', institution: '올림픽공원', lecture_type: 'general', lecture_name: '드론 원데이클래스', lead: 4, assistants: [3] }
        ];

        const addedLectures = lectureData.map(l => DB.lectures.add({
            date: l.date,
            institution: l.institution,
            lecture_type: l.lecture_type,
            lecture_name: l.lecture_name,
            lead_instructor_id: addedInstructors[l.lead].instructor_id,
            assistant_instructor_ids: l.assistants.map(a => addedInstructors[a].instructor_id),
            manager: '매니저A'
        }));

        // 일부 강의 완료 처리
        [0, 1, 2, 3].forEach(i => DB.lectures.complete(addedLectures[i].lecture_id));

        // 평가 데이터 (완료된 강의에 대해)
        [0, 1, 2, 3].forEach(i => {
            const lec = addedLectures[i];
            const allIns = [lec.lead_instructor_id, ...(lec.assistant_instructor_ids || [])];
            
            allIns.forEach(insId => {
                // 학생 평가
                DB.evalRaw.add({
                    lecture_id: lec.lecture_id,
                    instructor_id: insId,
                    evaluator_type: 'student',
                    score_items: { satisfaction: 3 + Math.random() * 2, engagement: 3 + Math.random() * 2 },
                    comment: '좋은 수업이었습니다'
                });
                // 기관 평가
                if (Math.random() > 0.3) {
                    DB.evalRaw.add({
                        lecture_id: lec.lecture_id,
                        instructor_id: insId,
                        evaluator_type: 'institution',
                        score_items: { expertise: 3 + Math.random() * 2, satisfaction: 3 + Math.random() * 2 },
                        comment: '프로그램 구성이 좋았습니다'
                    });
                }
            });
        });

        // 내부기여 Action_Requests
        DB.actionRequests.add({
            instructor_id: addedInstructors[0].instructor_id,
            request_type: 'contribution',
            category: '산출물',
            sub_category: 'lesson_plan',
            quantity: 1,
            point_preview: 10,
            evidence_url: 'https://drive.google.com/example',
            note: '로봇 코딩 입문 교안 제작'
        });

        DB.actionRequests.add({
            instructor_id: addedInstructors[1].instructor_id,
            request_type: 'contribution',
            category: '출석형',
            sub_category: 'ot_attendance',
            quantity: 1,
            point_preview: 2,
            note: '4월 정기 OT 참여'
        });

        DB.actionRequests.add({
            instructor_id: addedInstructors[2].instructor_id,
            request_type: 'bonus',
            category: '가산',
            sub_category: 'student_praise',
            point_preview: 5,
            note: '학생 칭찬 댓글 접수'
        });

        // 전문성 (Ability_Log)
        DB.abilityLog.add({ instructor_id: addedInstructors[0].instructor_id, ability_type: 'majorMatch', description: '컴퓨터공학 전공', verified: true });
        DB.abilityLog.add({ instructor_id: addedInstructors[0].instructor_id, ability_type: 'certification', description: '정보처리기사', verified: true });
        DB.abilityLog.add({ instructor_id: addedInstructors[1].instructor_id, ability_type: 'majorMatch', description: '로봇공학 전공', verified: true });
        DB.abilityLog.add({ instructor_id: addedInstructors[1].instructor_id, ability_type: 'teachingCert', description: '교원자격증', verified: true });
        DB.abilityLog.add({ instructor_id: addedInstructors[2].instructor_id, ability_type: 'priorExperience', description: '이전 교육 경력 2년', verified: true });

        // Recalculate all
        DB.instructors.recalculateAll();

        console.log('Demo data seeded!');
        return { instructors: addedInstructors.length, lectures: addedLectures.length };
    },

    /**
     * 전체 초기화
     */
    clearAll() {
        Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
    }
};

// Initialize
DB._init();
