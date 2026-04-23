let currentView = "dashboard";
let lectureTabFilter = "lectures-all";
let evalTabFilter = "eval-pending";
let reqTabFilter = "req-pending";
let insTabFilter = "ins-all";
let schedReqTabFilter = "sreq-all";
let searchQuery = "";
let scheduleFocusRequestId = null;

const STATE = {
    data: null,
    assignments: {}
};

document.addEventListener("DOMContentLoaded", () => {
    resetDemoData();
    setupNavigation();
    setupQueueCards();
    setupTabs();
    setupSearch();
    setupButtons();
    setupProfileModal();
    refreshAll();
});

function resetDemoData() {
    STATE.data = JSON.parse(JSON.stringify(DEMO_DATA));
    STATE.assignments = {
        "SES-AU-002": [
            { assignment_id: "ASG-AU-001", instructor_id: "AUS-002", role: "Lead", status: "hold", score: 93 },
            { assignment_id: "ASG-AU-002", instructor_id: "AUS-024", role: "Assistant", status: "hold", score: 85 }
        ],
        "SES-AU-004": [
            { assignment_id: "ASG-AU-003", instructor_id: "AUS-011", role: "Lead", status: "confirmed", score: 87 },
            { assignment_id: "ASG-AU-004", instructor_id: "AUS-027", role: "Assistant", status: "confirmed", score: 80 }
        ]
    };
}

function setupNavigation() {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
            const view = item.dataset.view;
            if (view === "schedule-assign") scheduleFocusRequestId = null;
            if (view) navigateTo(view);
        });
    });
}

function setupQueueCards() {
    document.querySelectorAll(".queue-card").forEach(card => {
        card.addEventListener("click", () => {
            const action = card.dataset.action;
            if (action === "go-lectures") navigateTo("lectures");
            if (action === "go-evaluations") navigateTo("evaluations");
            if (action === "go-requests") navigateTo("requests");
            if (action === "go-incidents") navigateTo("incidents");
        });
    });
}

function setupTabs() {
    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const tabValue = tab.dataset.tab;
            const tabGroup = tab.closest(".tabs");
            if (tabGroup) {
                tabGroup.querySelectorAll(".tab").forEach(button => button.classList.remove("active"));
                tab.classList.add("active");
            }

            if (tabValue.startsWith("lectures-")) lectureTabFilter = tabValue;
            if (tabValue.startsWith("eval-")) evalTabFilter = tabValue;
            if (tabValue.startsWith("req-")) reqTabFilter = tabValue;
            if (tabValue.startsWith("ins-")) insTabFilter = tabValue;
            if (tabValue.startsWith("sreq-")) schedReqTabFilter = tabValue;

            refreshView(currentView);
        });
    });
}

function setupSearch() {
    const input = document.getElementById("global-search");
    input.addEventListener("input", event => {
        searchQuery = event.target.value.trim().toLowerCase();
        if (searchQuery) {
            navigateTo("instructors");
        } else {
            refreshView(currentView);
        }
    });
}

function setupButtons() {
    document.querySelectorAll(".demo-only-btn").forEach(button => {
        button.addEventListener("click", () => {
            toast("This preview uses fixed demo data. Interactive write actions are intentionally simulated only.", "info");
        });
    });

    document.getElementById("btn-quick-add").addEventListener("click", () => {
        toast("In the live product this would open a quick-add workflow for managers.", "info");
    });

    document.getElementById("btn-export-all").addEventListener("click", exportInstructorCsv);
    document.getElementById("btn-backup").addEventListener("click", exportInstructorCsv);
    document.getElementById("btn-export-ledger").addEventListener("click", exportLedgerCsv);

    document.getElementById("btn-reset-demo").addEventListener("click", () => {
        resetDemoData();
        refreshAll();
        toast("Demo data reloaded: 50 fictional Australian instructors restored.", "success");
    });

    document.getElementById("btn-recalc-all").addEventListener("click", () => {
        const active = STATE.data.instructors.filter(instructor => !instructor.assignment_block).length;
        toast(`Recalculated quality metrics for ${active} active instructors.`, "success");
    });
}

function setupProfileModal() {
    document.getElementById("profile-modal-close").addEventListener("click", closeProfileModal);
    document.getElementById("profile-modal-overlay").addEventListener("click", event => {
        if (event.target.id === "profile-modal-overlay") closeProfileModal();
    });
}

function navigateTo(view) {
    currentView = view;
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    const targetNav = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (targetNav) targetNav.classList.add("active");

    document.querySelectorAll(".view-section").forEach(section => section.classList.remove("active"));
    const targetSection = document.getElementById(`view-${view}`);
    if (targetSection) targetSection.classList.add("active");

    const titles = {
        dashboard: ["Dashboard", "Demo snapshot for Australian education partners"],
        lectures: ["Program Delivery", "Upcoming and completed STEM sessions"],
        evaluations: ["Evaluations", "Student, school, and peer quality feedback"],
        requests: ["Approval Queue", "Manager sign-off for contributions, bonuses, and incidents"],
        "schedule-requests": ["Program Requests", "School demand pipeline and staffing scope"],
        "schedule-assign": ["Assignment Engine", "Recommendation-led staffing for upcoming sessions"],
        availability: ["Availability", "Instructor region and timetable visibility"],
        ledger: ["Delivery Ledger", "Session-level operational and financial record"],
        instructors: ["Instructor Roster", "Skills, grades, scoring, and assignment readiness"],
        incidents: ["Bonus / Incidents", "Positive recognition and operational risk tracking"],
        reports: ["Monthly Report", "Snapshot of coverage, quality, and distribution"],
        settings: ["Demo Settings", "Reset, export, and explain the scoring model"]
    };

    const [title, subtitle] = titles[view] || [view, ""];
    document.getElementById("page-title").textContent = title;
    document.getElementById("page-subtitle").textContent = subtitle;

    refreshView(view);
}

function refreshAll() {
    refreshBadges();
    refreshDashboard();
    refreshView(currentView);
}

function refreshView(view) {
    if (view === "dashboard") refreshDashboard();
    if (view === "lectures") renderLectures();
    if (view === "evaluations") renderEvaluations();
    if (view === "requests") renderRequests();
    if (view === "schedule-requests") renderScheduleRequests();
    if (view === "schedule-assign") renderScheduleAssign();
    if (view === "availability") renderAvailability();
    if (view === "ledger") renderLedger();
    if (view === "instructors") renderInstructors();
    if (view === "incidents") renderIncidents();
    if (view === "reports") renderReports();
}

function refreshBadges() {
    const overdue = STATE.data.lectures.filter(lecture => lecture.status === "scheduled" && lecture.date <= DEMO_TODAY).length;
    const evalPending = STATE.data.lectures.filter(lecture => lecture.status === "completed" && lecture.evaluation_status !== "complete").length;
    const pendingRequests = STATE.data.approvals.filter(request => request.status === "pending").length;
    const openRequests = STATE.data.programRequests.filter(request => request.status === "open").length;
    const openSessions = STATE.data.sessions.filter(session => session.status === "open" || session.status === "assigning").length;

    document.getElementById("badge-lectures").textContent = overdue;
    document.getElementById("badge-evaluations").textContent = evalPending;
    document.getElementById("badge-requests").textContent = pendingRequests;
    document.getElementById("badge-requests-open").textContent = openRequests;
    document.getElementById("badge-sessions-open").textContent = openSessions;
}

function refreshDashboard() {
    const scores = STATE.data.instructors.map(instructor => instructor.total_score);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const overdue = STATE.data.lectures.filter(lecture => lecture.status === "scheduled" && lecture.date <= DEMO_TODAY).length;
    const evalPending = STATE.data.lectures.filter(lecture => lecture.status === "completed" && lecture.evaluation_status !== "complete").length;
    const pendingRequests = STATE.data.approvals.filter(request => request.status === "pending").length;
    const openIncidents = STATE.data.incidents.filter(incident => incident.type === "penalty" && incident.status !== "approved").length;

    document.getElementById("q-incomplete").textContent = overdue;
    document.getElementById("q-eval").textContent = evalPending;
    document.getElementById("q-pending").textContent = pendingRequests;
    document.getElementById("q-incidents").textContent = openIncidents;

    document.getElementById("stat-total-instructors").textContent = STATE.data.instructors.length;
    document.getElementById("stat-masters").textContent = STATE.data.instructors.filter(instructor => instructor.grade === "Master").length;
    document.getElementById("stat-total-lectures").textContent = STATE.data.lectures.length;
    document.getElementById("stat-avg-score").textContent = averageScore.toFixed(1);

    renderRecentActivity();
    renderTopInstructors();
}

function renderRecentActivity() {
    const container = document.getElementById("recent-activity");
    const activities = [...STATE.data.activities].sort((left, right) => new Date(right.date) - new Date(left.date));

    container.innerHTML = activities.map(activity => {
        const instructor = getInstructorById(activity.instructor_id);
        const pointClass = activity.point == null ? "" : activity.point >= 0 ? "positive" : "negative";
        const pointLabel = activity.point == null ? "" : `<span class="timeline-point ${pointClass}">${activity.point > 0 ? "+" : ""}${activity.point} pts</span>`;
        return `
            <div class="timeline-item ${activity.category}">
                <div class="timeline-date">${formatDate(activity.date)}</div>
                <div class="timeline-content"><strong>${instructor ? instructor.name : activity.instructor_id}</strong> ${activity.description} ${pointLabel}</div>
            </div>
        `;
    }).join("");
}

function renderTopInstructors() {
    const container = document.getElementById("top-instructors");
    const topInstructors = [...STATE.data.instructors].sort((left, right) => right.total_score - left.total_score).slice(0, 5);

    container.innerHTML = topInstructors.map((instructor, index) => `
        <div class="approval-item" style="cursor:pointer;" onclick="showInstructorProfile('${instructor.instructor_id}')">
            <div class="approval-info">
                <div class="approval-title">${index + 1}. ${instructor.name} <span class="badge ${instructor.grade.toLowerCase()}">${gradeIcon(instructor.grade)} ${instructor.grade}</span></div>
                <div class="approval-desc">${instructor.state} · ${instructor.specialties.join(" / ")}</div>
            </div>
            <div style="font-size:1.35rem;font-weight:800;color:var(--accent-blue);">${instructor.total_score.toFixed(1)}</div>
        </div>
    `).join("");
}

function renderLectures() {
    let lectures = [...STATE.data.lectures].sort((left, right) => new Date(right.date) - new Date(left.date));
    if (lectureTabFilter === "lectures-scheduled") lectures = lectures.filter(lecture => lecture.status === "scheduled");
    if (lectureTabFilter === "lectures-completed") lectures = lectures.filter(lecture => lecture.status === "completed");

    const tbody = document.getElementById("lectures-tbody");
    if (!lectures.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">No program sessions match this filter.</td></tr>`;
        return;
    }
    tbody.innerHTML = lectures.map(lecture => {
        const lead = getInstructorById(lecture.lead_instructor_id);
        const assistants = lecture.assistant_instructor_ids.map(getInstructorById).filter(Boolean);
        return `
            <tr>
                <td>${formatDate(lecture.date)}</td>
                <td class="name-cell">${lecture.institution}</td>
                <td>${lecture.lecture_name}</td>
                <td><span class="state-pill">${lecture.state}</span></td>
                <td><span class="badge ${lecture.lecture_type}">${STATE.data.programTypes[lecture.lecture_type]}</span></td>
                <td>${lead ? lead.name : "-"}</td>
                <td>${assistants.map(instructor => instructor.name).join(", ") || "-"}</td>
                <td><span class="badge ${lecture.status === "completed" ? "completed" : lecture.date <= DEMO_TODAY ? "pending" : "scheduled"}">${lecture.status === "completed" ? "Completed" : lecture.date <= DEMO_TODAY ? "Needs update" : "Scheduled"}</span></td>
                <td>${evaluationBadge(lecture.evaluation_status)}</td>
            </tr>
        `;
    }).join("");
}

function renderEvaluations() {
    const tbody = document.getElementById("evaluations-tbody");
    let rows = STATE.data.evaluations.map(item => {
        const lecture = getLectureById(item.lecture_id);
        const instructor = getInstructorById(item.instructor_id);
        return {
            ...item,
            lecture,
            instructor
        };
    }).filter(row => row.lecture);

    if (evalTabFilter === "eval-pending") {
        rows = rows.filter(row => row.lecture.evaluation_status !== "complete");
    }

    rows.sort((left, right) => new Date(right.lecture.date) - new Date(left.lecture.date));
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">No evaluation rows match this filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(row => `
        <tr>
            <td class="name-cell">${row.lecture.lecture_name}</td>
            <td>${formatDate(row.lecture.date)}</td>
            <td>${row.instructor ? row.instructor.name : row.instructor_id}</td>
            <td>${scoreCell(row.student_score)}</td>
            <td>${scoreCell(row.school_score)}</td>
            <td>${scoreCell(row.peer_score)}</td>
            <td>${evaluationBadge(row.lecture.evaluation_status)}</td>
            <td><button class="btn btn-sm" onclick="showInstructorProfile('${row.instructor_id}')"><i class="ph ph-eye"></i> View</button></td>
        </tr>
    `).join("");
}

function renderRequests() {
    let requests = [...STATE.data.approvals].sort((left, right) => new Date(right.requested_at) - new Date(left.requested_at));
    if (reqTabFilter === "req-pending") requests = requests.filter(request => request.status === "pending");
    if (reqTabFilter === "req-approved") requests = requests.filter(request => request.status === "approved");
    if (reqTabFilter === "req-rejected") requests = requests.filter(request => request.status === "rejected");

    const container = document.getElementById("requests-list");
    container.innerHTML = `<div class="card">${requests.map(request => {
        const instructor = getInstructorById(request.instructor_id);
        const actions = request.status === "pending"
            ? `
                <button class="btn btn-sm btn-success" onclick="approveRequest('${request.request_id}')"><i class="ph ph-check"></i> Approve</button>
                <button class="btn btn-sm btn-danger" onclick="rejectRequest('${request.request_id}')"><i class="ph ph-x"></i> Reject</button>
            `
            : `<span class="badge ${request.status === "approved" ? "approved" : "rejected"}">${request.status === "approved" ? "Approved" : "Rejected"}</span>`;
        return `
            <div class="approval-item">
                <div class="approval-info">
                    <div class="approval-title">${instructor ? instructor.name : request.instructor_id} - ${request.note}</div>
                    <div class="approval-desc">${request.request_type} · ${request.sub_category} · ${request.point_preview > 0 ? "+" : ""}${request.point_preview} pts · ${formatDateTime(request.requested_at)}</div>
                </div>
                <div class="approval-actions">${actions}</div>
            </div>
        `;
    }).join("")}</div>`;
}

function approveRequest(requestId) {
    const request = STATE.data.approvals.find(item => item.request_id === requestId);
    if (!request) return;
    request.status = "approved";
    refreshBadges();
    renderRequests();
    toast("Approval simulated. In production this would append to the activity log and recalculate the score.", "success");
}

function rejectRequest(requestId) {
    const request = STATE.data.approvals.find(item => item.request_id === requestId);
    if (!request) return;
    request.status = "rejected";
    refreshBadges();
    renderRequests();
    toast("Rejection simulated. The request is kept for audit visibility in the queue.", "warning");
}

function renderScheduleRequests() {
    let requests = [...STATE.data.programRequests];
    if (schedReqTabFilter === "sreq-draft") requests = requests.filter(request => request.status === "draft");
    if (schedReqTabFilter === "sreq-open") requests = requests.filter(request => request.status === "open");
    if (schedReqTabFilter === "sreq-closed") requests = requests.filter(request => request.status === "closed");

    const tbody = document.getElementById("schedule-requests-tbody");
    if (!requests.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">No program requests in this slice.</td></tr>`;
        return;
    }
    tbody.innerHTML = requests.map(request => {
        const statusClass = request.status === "open" ? "active" : request.status === "draft" ? "pending" : "completed";
        const action = request.status === "open"
            ? `<button class="btn btn-sm" onclick="viewSessionsForRequest('${request.request_id}')"><i class="ph ph-eye"></i> View sessions</button>`
            : request.status === "draft"
                ? `<button class="btn btn-sm demo-action" onclick="toast('Draft request reviewed in demo mode.', 'info')"><i class="ph ph-note-pencil"></i> Review scope</button>`
                : `<button class="btn btn-sm" onclick="viewSessionsForRequest('${request.request_id}')"><i class="ph ph-archive-box"></i> View closed</button>`;

        return `
            <tr>
                <td class="name-cell">${request.institution}</td>
                <td>${request.content}</td>
                <td>${request.target}</td>
                <td><span class="state-pill">${request.state}</span></td>
                <td><span class="badge ${request.service_level === "high_risk" ? "rejected" : request.service_level === "important" ? "amber" : "scheduled"}">${request.service_level === "high_risk" ? "High risk" : request.service_level === "important" ? "Priority" : "Standard"}</span></td>
                <td>${request.sessions}</td>
                <td><span class="badge ${statusClass}">${capitalize(request.status)}</span></td>
                <td>${action}</td>
            </tr>
        `;
    }).join("");
}

function viewSessionsForRequest(requestId) {
    scheduleFocusRequestId = requestId;
    navigateTo("schedule-assign");
}

function renderScheduleAssign() {
    const container = document.getElementById("schedule-assign-content");
    let sessions = [...STATE.data.sessions];
    if (scheduleFocusRequestId) sessions = sessions.filter(session => session.request_id === scheduleFocusRequestId);
    sessions.sort((left, right) => new Date(left.date) - new Date(right.date));
    if (!sessions.length) {
        container.innerHTML = `<div class="card"><div class="empty-state"><i class="ph ph-calendar-check"></i><p>No sessions are available for this request filter.</p></div></div>`;
        return;
    }

    container.innerHTML = sessions.map(session => {
        const request = STATE.data.programRequests.find(item => item.request_id === session.request_id);
        const assignments = STATE.assignments[session.session_id] || [];
        const recs = STATE.data.recommendations[session.session_id] || [];
        const leads = recs.filter(rec => rec.role === "Lead").slice(0, 2);
        const assistants = recs.filter(rec => rec.role === "Assistant").slice(0, 2);
        const assignmentHtml = assignments.length
            ? `<div style="margin-top:12px;">
                    <h4 class="text-sm" style="color:var(--text-muted);margin-bottom:8px;">Assigned instructors</h4>
                    ${assignments.map(assignment => {
                        const instructor = getInstructorById(assignment.instructor_id);
                        return `
                            <div class="approval-item">
                                <div class="approval-info">
                                    <div class="approval-title">${instructor ? instructor.name : assignment.instructor_id} - ${assignment.role}</div>
                                    <div class="approval-desc">${assignment.status === "confirmed" ? "Confirmed" : "On hold"} · Recommendation ${assignment.score}</div>
                                </div>
                                <div class="approval-actions">
                                    ${assignment.status === "hold" ? `<button class="btn btn-sm btn-success" onclick="confirmHeldAssignment('${session.session_id}','${assignment.assignment_id}')"><i class="ph ph-check"></i> Confirm</button>` : ""}
                                    <button class="btn btn-sm btn-danger" onclick="cancelAssignment('${session.session_id}','${assignment.assignment_id}')"><i class="ph ph-x"></i> Remove</button>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>`
            : "";

        return `
            <div class="card mb-3">
                <div class="card-header">
                    <div class="card-title">
                        <span class="badge ${session.status === "confirmed" ? "completed" : session.status === "assigning" ? "blue" : "pending"}">${session.status === "confirmed" ? "Confirmed" : session.status === "assigning" ? "Assigning" : "Open"}</span>
                        ${request ? request.institution : "Request"}
                    </div>
                    <div class="text-sm text-muted">${formatDate(session.date)} · ${session.start_time}-${session.end_time} · ${session.duration_hours}h</div>
                </div>
                <div class="approval-desc">${request ? `${request.content} · ${request.target} · ${request.state}` : ""}</div>
                ${assignmentHtml}
                <div class="candidate-grid">
                    ${leads.map(candidate => renderCandidateCard(session.session_id, candidate)).join("")}
                    ${assistants.map(candidate => renderCandidateCard(session.session_id, candidate)).join("")}
                </div>
            </div>
        `;
    }).join("");
}

function renderCandidateCard(sessionId, candidate) {
    const instructor = getInstructorById(candidate.instructor_id);
    if (!instructor) return "";
    return `
        <div class="candidate-card">
            <div class="approval-title">${candidate.role}: ${instructor.name}</div>
            <div class="score">${candidate.score}</div>
            <div class="candidate-meta">${instructor.state} · ${instructor.specialties.slice(0, 2).join(" / ")}</div>
            <div class="candidate-meta">${candidate.reason}</div>
            <div class="approval-actions" style="margin-left:0;margin-top:10px;">
                <button class="btn btn-sm" onclick="holdCandidate('${sessionId}','${candidate.instructor_id}','${candidate.role}',${candidate.score})"><i class="ph ph-hand-grabbing"></i> Hold</button>
                <button class="btn btn-sm btn-success" onclick="directConfirm('${sessionId}','${candidate.instructor_id}','${candidate.role}',${candidate.score})"><i class="ph ph-check"></i> Confirm</button>
            </div>
        </div>
    `;
}

function holdCandidate(sessionId, instructorId, role, score) {
    const assignments = STATE.assignments[sessionId] || [];
    const existing = assignments.find(item => item.instructor_id === instructorId && item.role === role);
    if (!existing) {
        assignments.push({
            assignment_id: `ASG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            instructor_id: instructorId,
            role,
            status: "hold",
            score
        });
    }
    STATE.assignments[sessionId] = assignments;
    const session = STATE.data.sessions.find(item => item.session_id === sessionId);
    if (session) session.status = "assigning";
    refreshBadges();
    renderScheduleAssign();
    toast(`${role} hold placed for demo review.`, "info");
}

function directConfirm(sessionId, instructorId, role, score) {
    const assignments = STATE.assignments[sessionId] || [];
    const existing = assignments.find(item => item.instructor_id === instructorId && item.role === role);
    if (existing) {
        existing.status = "confirmed";
        existing.score = score;
    } else {
        assignments.push({
            assignment_id: `ASG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            instructor_id: instructorId,
            role,
            status: "confirmed",
            score
        });
    }
    STATE.assignments[sessionId] = assignments;
    updateSessionStatus(sessionId);
    refreshBadges();
    renderScheduleAssign();
    toast(`${role} confirmed for the selected session.`, "success");
}

function confirmHeldAssignment(sessionId, assignmentId) {
    const assignments = STATE.assignments[sessionId] || [];
    const assignment = assignments.find(item => item.assignment_id === assignmentId);
    if (!assignment) return;
    assignment.status = "confirmed";
    updateSessionStatus(sessionId);
    refreshBadges();
    renderScheduleAssign();
    toast("Held assignment confirmed.", "success");
}

function cancelAssignment(sessionId, assignmentId) {
    STATE.assignments[sessionId] = (STATE.assignments[sessionId] || []).filter(item => item.assignment_id !== assignmentId);
    updateSessionStatus(sessionId);
    refreshBadges();
    renderScheduleAssign();
    toast("Assignment removed from the demo queue.", "warning");
}

function updateSessionStatus(sessionId) {
    const session = STATE.data.sessions.find(item => item.session_id === sessionId);
    if (!session) return;
    const request = STATE.data.programRequests.find(item => item.request_id === session.request_id);
    const assignments = STATE.assignments[sessionId] || [];
    const confirmedLeads = assignments.filter(item => item.role === "Lead" && item.status === "confirmed").length;
    const confirmedAssistants = assignments.filter(item => item.role === "Assistant" && item.status === "confirmed").length;
    if (request && confirmedLeads >= request.required_lead && confirmedAssistants >= request.required_assistant) {
        session.status = "confirmed";
        return;
    }
    session.status = assignments.length ? "assigning" : "open";
}

function renderAvailability() {
    const container = document.getElementById("availability-content");
    const rows = [...STATE.data.instructors].sort((left, right) => left.state.localeCompare(right.state) || left.name.localeCompare(right.name));
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div class="card-title"><i class="ph ph-map-pin-line"></i> Region and timetable coverage</div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Instructor</th>
                            <th>State</th>
                            <th>Region</th>
                            <th>Travel</th>
                            <th>Availability</th>
                            <th>Specialties</th>
                            <th>Grade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(instructor => `
                            <tr onclick="showInstructorProfile('${instructor.instructor_id}')" style="cursor:pointer;">
                                <td class="name-cell">${instructor.name}</td>
                                <td>${instructor.state}</td>
                                <td>${instructor.activity_region}</td>
                                <td>${capitalize(instructor.transport)}</td>
                                <td>${instructor.availability_summary}</td>
                                <td>${instructor.specialties.slice(0, 2).join(", ")}</td>
                                <td><span class="badge ${instructor.grade.toLowerCase()}">${gradeIcon(instructor.grade)} ${instructor.grade}</span></td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderLedger() {
    const tbody = document.getElementById("ledger-tbody");
    tbody.innerHTML = [...STATE.data.ledger].sort((left, right) => new Date(right.date) - new Date(left.date)).map(entry => `
        <tr>
            <td>${formatDate(entry.date)}</td>
            <td class="name-cell">${entry.institution}</td>
            <td>${entry.content}</td>
            <td>${entry.state}</td>
            <td>${entry.headcount}</td>
            <td>${entry.lead_names}</td>
            <td>${entry.assistant_names || "-"}</td>
            <td>${entry.duration_hours}h</td>
            <td>${formatAud(entry.instructor_fees)}</td>
            <td>${formatAud(entry.school_invoice)}</td>
            <td style="color:var(--accent-green);font-weight:700;">${formatAud(entry.margin)}</td>
        </tr>
    `).join("");
}

function renderInstructors() {
    let instructors = [...STATE.data.instructors];
    if (insTabFilter === "ins-master") instructors = instructors.filter(instructor => instructor.grade === "Master");
    if (insTabFilter === "ins-blocked") instructors = instructors.filter(instructor => instructor.assignment_block);

    if (searchQuery) {
        instructors = instructors.filter(instructor => {
            const haystack = [
                instructor.name,
                instructor.state,
                instructor.activity_region,
                instructor.major,
                instructor.specialties.join(" ")
            ].join(" ").toLowerCase();
            return haystack.includes(searchQuery);
        });
    }

    instructors.sort((left, right) => right.total_score - left.total_score);

    const tbody = document.getElementById("instructors-tbody");
    if (!instructors.length) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted);">No instructors match the current search or filter.</td></tr>`;
        return;
    }
    tbody.innerHTML = instructors.map(instructor => `
        <tr onclick="showInstructorProfile('${instructor.instructor_id}')" style="cursor:pointer;">
            <td class="name-cell">${instructor.name}</td>
            <td><span class="state-pill">${instructor.state}</span></td>
            <td>
                <div class="skill-stack">
                    ${instructor.specialties.slice(0, 3).map(skill => `<span class="skill-pill">${skill}</span>`).join("")}
                </div>
            </td>
            <td style="font-weight:800;color:var(--accent-blue);">${instructor.total_score.toFixed(1)}</td>
            <td><span class="badge ${instructor.grade.toLowerCase()}">${gradeIcon(instructor.grade)} ${instructor.grade}</span></td>
            <td>${instructor.score_experience}</td>
            <td>${instructor.score_evaluation}</td>
            <td>${instructor.score_expertise}</td>
            <td>${instructor.score_contribution}</td>
            <td>${instructor.assignment_block ? `<span class="badge blocked">Blocked</span>` : `<span class="badge active">Ready</span>`}</td>
        </tr>
    `).join("");
}

function showInstructorProfile(instructorId) {
    const instructor = getInstructorById(instructorId);
    if (!instructor) return;

    const delivered = STATE.data.lectures.filter(lecture =>
        lecture.lead_instructor_id === instructorId || lecture.assistant_instructor_ids.includes(instructorId)
    );
    const recentDelivered = [...delivered].sort((left, right) => new Date(right.date) - new Date(left.date)).slice(0, 6);
    const recentActivity = STATE.data.activities.filter(item => item.instructor_id === instructorId).slice(0, 5);

    document.getElementById("profile-modal-title").textContent = `${instructor.name} - Instructor Profile`;
    document.getElementById("profile-modal-body").innerHTML = `
        <div class="profile-card" style="padding:0;">
            <div class="profile-avatar">${instructor.name.charAt(0)}</div>
            <div class="profile-info">
                <div class="profile-name">${instructor.name} <span class="badge ${instructor.grade.toLowerCase()}">${gradeIcon(instructor.grade)} ${instructor.grade}</span></div>
                <div class="profile-meta">
                    <span><i class="ph ph-map-pin"></i> ${instructor.city}, ${instructor.state}</span>
                    <span><i class="ph ph-briefcase"></i> ${instructor.major}</span>
                    <span><i class="ph ph-envelope"></i> ${instructor.email}</span>
                    <span><i class="ph ph-calendar"></i> Joined ${formatDate(instructor.join_date)}</span>
                </div>
                <div class="total-score-display">
                    <div>
                        <div class="total-score-number" style="color:${gradeColor(instructor.grade)};">${instructor.total_score.toFixed(1)}</div>
                        <div class="total-score-label">Total score</div>
                    </div>
                </div>
                <div class="profile-actions">
                    <span class="badge active">${instructor.availability_summary}</span>
                    <span class="badge ${instructor.assignment_block ? "blocked" : "scheduled"}">${instructor.assignment_block ? instructor.block_reason : "Assignable"}</span>
                    <span class="badge">${capitalize(instructor.transport)}</span>
                </div>
            </div>
        </div>

        <div class="quick-breakdown">
            <div class="score-item">
                <div class="score-label">Experience</div>
                <div class="score-value" style="color:var(--accent-blue);">${instructor.score_experience}</div>
            </div>
            <div class="score-item">
                <div class="score-label">Evaluation</div>
                <div class="score-value" style="color:var(--accent-green);">${instructor.score_evaluation}</div>
            </div>
            <div class="score-item">
                <div class="score-label">Expertise</div>
                <div class="score-value" style="color:var(--accent-amber);">${instructor.score_expertise}</div>
            </div>
            <div class="score-item">
                <div class="score-label">Contribution</div>
                <div class="score-value" style="color:var(--accent-purple);">${instructor.score_contribution}</div>
            </div>
        </div>

        <div class="mt-4">
            <h4 class="section-title text-sm">STEM specialties</h4>
            <div class="skill-stack">
                ${instructor.specialties.map(skill => `<span class="skill-pill">${skill}</span>`).join("")}
            </div>
        </div>

        <div class="mt-4">
            <h4 class="section-title text-sm">Recent delivery</h4>
            ${recentDelivered.length ? recentDelivered.map(lecture => `
                <div class="approval-item">
                    <div class="approval-info">
                        <div class="approval-title">${lecture.lecture_name}</div>
                        <div class="approval-desc">${lecture.institution} · ${formatDate(lecture.date)} · ${lecture.status === "completed" ? "Completed" : "Scheduled"}</div>
                    </div>
                    <div>${evaluationBadge(lecture.evaluation_status)}</div>
                </div>
            `).join("") : `<p class="text-muted text-sm">No recent sessions in the demo snapshot.</p>`}
        </div>

        <div class="mt-4">
            <h4 class="section-title text-sm">Recent activity</h4>
            ${recentActivity.length ? recentActivity.map(item => `
                <div class="approval-item">
                    <div class="approval-info">
                        <div class="approval-title">${item.description}</div>
                        <div class="approval-desc">${formatDate(item.date)}</div>
                    </div>
                    <div>${item.point == null ? "-" : `${item.point > 0 ? "+" : ""}${item.point} pts`}</div>
                </div>
            `).join("") : `<p class="text-muted text-sm">No direct activity log entries in this slice.</p>`}
        </div>
    `;

    document.getElementById("profile-modal-overlay").classList.add("open");
}

function closeProfileModal() {
    document.getElementById("profile-modal-overlay").classList.remove("open");
}

function renderIncidents() {
    const bonusList = document.getElementById("bonus-list");
    const penaltyList = document.getElementById("penalty-list");
    const bonuses = STATE.data.incidents.filter(item => item.type === "bonus");
    const penalties = STATE.data.incidents.filter(item => item.type === "penalty");

    bonusList.innerHTML = bonuses.map(item => incidentRow(item)).join("");
    penaltyList.innerHTML = penalties.map(item => incidentRow(item)).join("");
}

function incidentRow(item) {
    const instructor = getInstructorById(item.instructor_id);
    return `
        <div class="approval-item">
            <div class="approval-info">
                <div class="approval-title">${instructor ? instructor.name : item.instructor_id}</div>
                <div class="approval-desc">${item.description} · ${formatDate(item.date)}</div>
            </div>
            <div class="approval-actions">
                <span class="badge ${item.type === "bonus" ? "active" : item.status === "approved" ? "completed" : "blocked"}">${item.point > 0 ? "+" : ""}${item.point}</span>
            </div>
        </div>
    `;
}

function renderReports() {
    const container = document.getElementById("reports-content");
    const stateCounts = STATE.data.instructors.reduce((accumulator, instructor) => {
        accumulator[instructor.state] = (accumulator[instructor.state] || 0) + 1;
        return accumulator;
    }, {});
    const evaluationReady = STATE.data.lectures.filter(lecture => lecture.evaluation_status === "complete").length;
    const blocked = STATE.data.instructors.filter(instructor => instructor.assignment_block).length;

    container.innerHTML = `
        <div class="report-grid">
            <div class="report-card"><strong>${STATE.data.instructors.length}</strong><span>Registered instructors in the demo pool</span></div>
            <div class="report-card"><strong>${evaluationReady}</strong><span>Sessions with complete evaluation coverage</span></div>
            <div class="report-card"><strong>${Object.keys(stateCounts).length}</strong><span>States and territories covered</span></div>
            <div class="report-card"><strong>${blocked}</strong><span>Instructors currently blocked from assignment</span></div>
        </div>
        <div class="card">
            <div class="card-header">
                <div class="card-title"><i class="ph ph-chart-bar"></i> Instructor distribution by state</div>
            </div>
            ${Object.entries(stateCounts).sort((left, right) => right[1] - left[1]).map(([stateCode, count]) => `
                <div class="approval-item">
                    <div class="approval-info">
                        <div class="approval-title">${stateCode}</div>
                        <div class="approval-desc">${count} instructors available in this region</div>
                    </div>
                    <div style="font-size:1.15rem;font-weight:800;color:var(--accent-blue);">${count}</div>
                </div>
            `).join("")}
        </div>
    `;
}

function exportInstructorCsv() {
    const rows = STATE.data.instructors.map(instructor => ({
        id: instructor.instructor_id,
        name: instructor.name,
        state: instructor.state,
        region: instructor.activity_region,
        grade: instructor.grade,
        total_score: instructor.total_score,
        evaluation_score: instructor.score_evaluation,
        specialties: instructor.specialties.join(" | "),
        status: instructor.assignment_block ? "Blocked" : "Ready"
    }));
    downloadCsv("dorossaem-au-instructors.csv", rows);
    toast("Instructor CSV exported.", "info");
}

function exportLedgerCsv() {
    downloadCsv("dorossaem-au-ledger.csv", STATE.data.ledger);
    toast("Delivery ledger CSV exported.", "info");
}

function downloadCsv(filename, rows) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
        headers.join(","),
        ...rows.map(row => headers.map(header => csvValue(row[header])).join(","))
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function csvValue(value) {
    const text = String(value == null ? "" : value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function getInstructorById(instructorId) {
    return STATE.data.instructors.find(instructor => instructor.instructor_id === instructorId) || null;
}

function getLectureById(lectureId) {
    return STATE.data.lectures.find(lecture => lecture.lecture_id === lectureId) || null;
}

function formatDate(dateText) {
    return new Date(`${dateText}T00:00:00`).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatDateTime(dateText) {
    return new Date(dateText).toLocaleString("en-AU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatAud(value) {
    return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 0
    }).format(value);
}

function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function gradeIcon(grade) {
    if (grade === "Master") return "M";
    if (grade === "Standard") return "S";
    return "T";
}

function gradeColor(grade) {
    if (grade === "Master") return "var(--accent-amber)";
    if (grade === "Standard") return "var(--accent-blue)";
    return "#9ca3af";
}

function evaluationBadge(status) {
    const label = status === "complete" ? "Complete" : status === "partial" ? "Partial" : "Pending";
    return `<span class="badge ${status === "complete" ? "completed" : status === "partial" ? "amber" : "pending"}">${label}</span>`;
}

function scoreCell(score) {
    if (score == null) return `<span class="text-muted">Not collected</span>`;
    return `${score.toFixed(1)} / 5 <span class="rating-stars">${renderStars(score)}</span>`;
}

function renderStars(score) {
    const filled = Math.round(score);
    return "★★★★★".slice(0, filled) + "☆☆☆☆☆".slice(0, 5 - filled);
}

function toast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const icons = {
        success: "ph-check-circle",
        error: "ph-x-circle",
        warning: "ph-warning",
        info: "ph-info"
    };
    const element = document.createElement("div");
    element.className = `toast ${type}`;
    element.innerHTML = `<i class="ph ${icons[type]}"></i> ${message}`;
    container.appendChild(element);
    setTimeout(() => {
        element.style.opacity = "0";
        element.style.transform = "translateX(100px)";
        setTimeout(() => element.remove(), 300);
    }, 3000);
}
