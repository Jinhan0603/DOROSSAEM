/**
 * DORO SCORING_RULES_V3
 * =====================
 * 모든 점수 규칙의 단일 진실 공급원 (Single Source of Truth)
 * 웹앱과 향후 Apps Script가 이 파일 하나를 참조합니다.
 * 
 * 원칙: "매니저가 설명할 수 없는 점수는 쓰지 않는다"
 */

const SCORING_RULES = {
    version: 'V3',
    lastUpdated: '2026-04-05',

    // ═══════════════════════════════════════
    // 1. 가중치 구조 (총 100%)
    // ═══════════════════════════════════════
    weights: {
        experience: 0.20,    // 강의경험 20%
        evaluation: 0.40,    // 강의평가 40%
        expertise: 0.20,     // 전문성 20%
        contribution: 0.20   // 내부기여 20%
    },

    // ═══════════════════════════════════════
    // 2. 강의경험 점수 (100점 만점)
    // ═══════════════════════════════════════
    experience: {
        maxScore: 100,
        pointsPerLecture: {
            general: 3,          // 일반 강의
            dls: 4,              // DLS
            doroland: 4,         // DOROLAND
            camp: 5,             // 캠프
            operation: 2         // 운영인력
        },
        roleMultiplier: {
            lead: 1.5,           // 주강사 가산
            assistant: 1.0       // 보조강사 기본
        }
    },

    // ═══════════════════════════════════════
    // 3. 강의평가 점수 (100점 만점)
    // ═══════════════════════════════════════
    evaluation: {
        maxScore: 100,
        scaleMax: 5,             // 리커트 5점 척도
        evaluatorWeights: {
            student: 0.40,       // 학생 평가 40%
            institution: 0.40,   // 기관 평가 40%
            peer: 0.20           // 동료 평가 20%
        },
        // 미수집 처리: 해당 타입을 제외하고 나머지로 정규화
        // 절대 0점 처리 안 함
        missingPolicy: 'exclude_and_normalize',
        // 최소 응답 수 (이 이하면 신뢰도 부족 표시)
        minResponsesForReliable: 3
    },

    // ═══════════════════════════════════════
    // 4. 전문성 점수 (100점 만점)
    // ═══════════════════════════════════════
    expertise: {
        maxScore: 100,
        items: {
            majorMatch: { point: 20, description: '전공 일치' },
            certification: { point: 15, description: '관련 자격증' },
            trainingComplete: { point: 10, description: '교육 과정 이수' },
            teachingCert: { point: 20, description: '교원 자격' },
            priorExperience: { point: 15, description: '이전 교육 경력' },
            contentDev: { point: 20, description: '교안/교재 개발 능력' }
        }
    },

    // ═══════════════════════════════════════
    // 5. 내부기여 점수 (100점 만점)
    // ═══════════════════════════════════════
    contribution: {
        maxScore: 100,
        // 자동 생성 (강의 완료 / 출석형)
        autoItems: {
            ot_attendance: { point: 2, description: 'OT 참여', category: '출석형' },
            content_training: { point: 2, description: '콘텐츠 교육 참여', category: '출석형' },
            packing: { point: 3, description: '포장 참여', category: '출석형' },
            meeting: { point: 2, description: '회의 참여', category: '출석형' }
        },
        // 승인형 (Action_Request → 매니저 승인 필요)
        approvalItems: {
            lesson_plan: { point: 10, description: '교안 제작', category: '산출물', needsEvidence: true },
            teaching_material: { point: 8, description: '교구재 제작', category: '산출물', needsEvidence: true },
            education_video: { point: 12, description: '교육 영상 제작', category: '산출물', needsEvidence: true },
            mentoring: { point: 5, description: '신입 멘토링', category: '협력', needsEvidence: false },
            content_review: { point: 5, description: '콘텐츠 리뷰', category: '협력', needsEvidence: true }
        }
    },

    // ═══════════════════════════════════════
    // 6. 가산/감점 규칙
    // ═══════════════════════════════════════
    bonusPenalty: {
        bonus: {
            student_praise: { point: 5, description: '학생 칭찬', needsApproval: true },
            institution_praise: { point: 5, description: '기관 칭찬', needsApproval: true },
            master_recommend: { point: 3, description: '마스터 추천', needsApproval: true },
            extra_effort: { point: 3, description: '추가 노력', needsApproval: true }
        },
        penalty: {
            late: { point: -10, description: '지각', immediateBlock: false },
            no_show: { point: -30, description: '노쇼', immediateBlock: true },
            complaint: { point: -15, description: '컴플레인', immediateBlock: false },
            rule_violation: { point: -20, description: '규정 위반', immediateBlock: true }
        },
        // 즉시 퇴출 사유
        immediateOut: ['no_show'],
        // 누적 퇴출 (횟수 기준)
        cumulativeOut: {
            late: { threshold: 3, description: '지각 3회 누적 시 퇴출 검토' }
        }
    },

    // ═══════════════════════════════════════
    // 7. 등급 기준
    // ═══════════════════════════════════════
    grades: {
        master: { minScore: 80, label: 'Master', color: '#f59e0b', icon: '👑' },
        standard: { minScore: 40, label: 'Standard', color: '#3b82f6', icon: '⭐' },
        trainee: { minScore: 0, label: 'Trainee', color: '#6b7280', icon: '🌱' }
    },

    // Master 재산정: 매월 1일
    masterRecalcDay: 1,

    // ═══════════════════════════════════════
    // 8. 상태 정의
    // ═══════════════════════════════════════
    statuses: {
        lecture: ['scheduled', 'completed', 'cancelled'],
        evaluation: ['pending', 'partial', 'complete', 'missing'],
        actionRequest: ['pending', 'approved', 'rejected'],
        instructor: ['active', 'inactive', 'blocked', 'out']
    },

    // ═══════════════════════════════════════
    // 9. 평가 상태 배지 스타일
    // ═══════════════════════════════════════
    evaluationBadges: {
        complete: { label: '평가완료', color: '#10b981', bgColor: '#d1fae5' },
        partial: { label: '부분수집', color: '#f59e0b', bgColor: '#fef3c7' },
        pending: { label: '평가대기', color: '#6b7280', bgColor: '#f3f4f6' },
        missing: { label: '미수집', color: '#9ca3af', bgColor: '#e5e7eb' }
    }
};

// 점수 계산 유틸리티
const ScoreCalculator = {
    /**
     * 강의경험 점수 계산
     */
    calcExperience(activityLogs) {
        const rules = SCORING_RULES.experience;
        let total = 0;
        
        activityLogs
            .filter(log => log.category === 'lecture_experience')
            .forEach(log => {
                const basePoint = rules.pointsPerLecture[log.sub_category] || rules.pointsPerLecture.general;
                const multiplier = rules.roleMultiplier[log.role] || 1.0;
                total += basePoint * multiplier;
            });
        
        return Math.min(total, rules.maxScore);
    },

    /**
     * 강의평가 점수 계산 (미수집 정규화 포함)
     */
    calcEvaluation(summaries) {
        const rules = SCORING_RULES.evaluation;
        const weights = { ...rules.evaluatorWeights };
        let weightedSum = 0;
        let totalWeight = 0;

        Object.entries(weights).forEach(([type, weight]) => {
            const typeSummaries = summaries.filter(s => s.evaluator_type === type);
            if (typeSummaries.length === 0) return; // 미수집 → 제외

            const avgScore = typeSummaries.reduce((sum, s) => sum + s.avg_score, 0) / typeSummaries.length;
            const normalizedScore = (avgScore / rules.scaleMax) * 100;
            
            weightedSum += normalizedScore * weight;
            totalWeight += weight;
        });

        if (totalWeight === 0) return null; // 전체 미수집
        return Math.min((weightedSum / totalWeight), rules.maxScore);
    },

    /**
     * 전문성 점수 계산
     */
    calcExpertise(abilityLogs) {
        const rules = SCORING_RULES.expertise;
        let total = 0;

        abilityLogs.forEach(log => {
            const item = rules.items[log.ability_type];
            if (item) total += item.point;
        });

        return Math.min(total, rules.maxScore);
    },

    /**
     * 내부기여 점수 계산
     */
    calcContribution(activityLogs) {
        const rules = SCORING_RULES.contribution;
        let total = 0;

        activityLogs
            .filter(log => log.category === 'contribution')
            .forEach(log => {
                const autoItem = rules.autoItems[log.sub_category];
                const approvalItem = rules.approvalItems[log.sub_category];
                if (autoItem) total += autoItem.point;
                else if (approvalItem) total += approvalItem.point;
            });

        return Math.min(total, rules.maxScore);
    },

    /**
     * 가산/감점 합산
     */
    calcBonusPenalty(activityLogs) {
        let total = 0;
        activityLogs
            .filter(log => log.category === 'bonus' || log.category === 'penalty')
            .forEach(log => {
                total += log.point || 0;
            });
        return total;
    },

    /**
     * 총점 계산
     */
    calcTotal(experienceScore, evaluationScore, expertiseScore, contributionScore, bonusPenalty) {
        const w = SCORING_RULES.weights;
        
        const exp = experienceScore || 0;
        const eva = evaluationScore || 0;
        const ext = expertiseScore || 0;
        const con = contributionScore || 0;
        const bp = bonusPenalty || 0;

        const weighted = (exp * w.experience) + (eva * w.evaluation) + (ext * w.expertise) + (con * w.contribution);
        return Math.max(0, Math.min(100, weighted + bp));
    },

    /**
     * 등급 판정
     */
    calcGrade(totalScore) {
        const grades = SCORING_RULES.grades;
        if (totalScore >= grades.master.minScore) return grades.master;
        if (totalScore >= grades.standard.minScore) return grades.standard;
        return grades.trainee;
    },

    /**
     * assignment_block 판정
     */
    shouldBlock(activityLogs) {
        const penalties = activityLogs.filter(log => log.category === 'penalty');
        
        // 즉시 차단 사유 확인
        for (const log of penalties) {
            const rule = SCORING_RULES.bonusPenalty.penalty[log.sub_category];
            if (rule && rule.immediateBlock) return { blocked: true, reason: rule.description };
        }

        // 누적 차단 확인
        for (const [type, config] of Object.entries(SCORING_RULES.bonusPenalty.cumulativeOut)) {
            const count = penalties.filter(log => log.sub_category === type && !log.reversal_of).length;
            if (count >= config.threshold) return { blocked: true, reason: config.description };
        }

        return { blocked: false, reason: null };
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SCORING_RULES, ScoreCalculator };
}
