const DATA = window.DEMO_DATA;
let rosterQuery = "";

document.addEventListener("DOMContentLoaded", () => {
    renderHeroConsole();
    renderMetrics();
    renderWorkflow();
    renderQueue();
    renderAssignments();
    renderActivity();
    renderApprovals();
    renderDistribution();
    renderRoster();
    renderLedger();
    setupEvents();
});

function setupEvents() {
    const searchInput = document.getElementById("roster-search");
    searchInput.addEventListener("input", event => {
        rosterQuery = event.target.value.trim().toLowerCase();
        renderRoster();
    });

    document.getElementById("btn-export-csv").addEventListener("click", () => {
        const rows = DATA.instructors.map(instructor => ({
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
        downloadCsv("dorossaem-resend-inspired-roster.csv", rows);
    });
}

function renderHeroConsole() {
    const completed = DATA.lectures.filter(lecture => lecture.status === "completed");
    const pendingEvaluations = completed.filter(lecture => lecture.evaluation_status !== "complete");
    const blocked = DATA.instructors.filter(instructor => instructor.assignment_block);
    const output = [
        "$ doro admin snapshot --region=AU",
        "",
        `instructors.total      ${DATA.instructors.length}`,
        `instructors.master     ${DATA.instructors.filter(instructor => instructor.grade === "Master").length}`,
        `sessions.completed     ${completed.length}`,
        `sessions.upcoming      ${DATA.lectures.filter(lecture => lecture.status === "scheduled").length}`,
        `evaluations.pending    ${pendingEvaluations.length}`,
        `assignments.blocked    ${blocked.length}`,
        `ledger.currency        AUD`
    ].join("\n");

    document.getElementById("hero-console-output").textContent = output;
}

function renderMetrics() {
    const completed = DATA.lectures.filter(lecture => lecture.status === "completed");
    const completedWithFullEval = completed.filter(lecture => lecture.evaluation_status === "complete").length;
    const totalScore = DATA.instructors.reduce((sum, instructor) => sum + instructor.total_score, 0);

    document.getElementById("metric-instructors").textContent = DATA.instructors.length;
    document.getElementById("metric-masters").textContent = DATA.instructors.filter(instructor => instructor.grade === "Master").length;
    document.getElementById("metric-eval-coverage").textContent = `${Math.round((completedWithFullEval / completed.length) * 100)}%`;
    document.getElementById("metric-average-score").textContent = (totalScore / DATA.instructors.length).toFixed(1);
}

function renderWorkflow() {
    const openRequests = DATA.programRequests.filter(request => request.status === "open").length;
    const openSessions = DATA.sessions.filter(session => session.status === "open" || session.status === "assigning").length;
    const completeEval = DATA.lectures.filter(lecture => lecture.evaluation_status === "complete").length;
    const rows = [
        {
            title: "1. Roster and compliance",
            body: `${DATA.instructors.length} instructors are profiled with region, specialty, grade, availability summary, and block status.`
        },
        {
            title: "2. School demand intake",
            body: `${openRequests} live program requests show institution, session count, risk level, and staffing need before assignment.`
        },
        {
            title: "3. Assignment recommendations",
            body: `${openSessions} upcoming sessions can be matched using grade fit, specialty, availability, and prior reliability.`
        },
        {
            title: "4. Evaluation and score loop",
            body: `${completeEval} sessions already have complete evaluation coverage, feeding back into instructor quality scoring.`
        }
    ];

    document.getElementById("workflow-grid").innerHTML = rows.map(item => `
        <div class="workflow-item">
            <strong>${item.title}</strong>
            <span>${item.body}</span>
        </div>
    `).join("");
}

function renderQueue() {
    const completed = DATA.lectures.filter(lecture => lecture.status === "completed");
    const items = [
        {
            title: "Overdue delivery updates",
            count: DATA.lectures.filter(lecture => lecture.status === "scheduled" && lecture.date <= "2026-04-23").length,
            description: "Scheduled sessions whose dates have already passed."
        },
        {
            title: "Evaluation follow-ups",
            count: completed.filter(lecture => lecture.evaluation_status !== "complete").length,
            description: "Completed sessions still missing at least one evaluation channel."
        },
        {
            title: "Pending approvals",
            count: DATA.approvals.filter(item => item.status === "pending").length,
            description: "Contribution, bonus, and incident items waiting for manager review."
        }
    ];

    document.getElementById("queue-list").innerHTML = items.map(item => `
        <div class="queue-item">
            <strong>${item.title}</strong>
            <span>${item.description}</span>
            <div class="queue-number">${item.count}</div>
        </div>
    `).join("");
}

function renderAssignments() {
    const sessions = DATA.sessions
        .filter(session => session.status === "open" || session.status === "assigning" || session.status === "confirmed")
        .slice(0, 4);

    document.getElementById("assignment-list").innerHTML = sessions.map(session => {
        const request = DATA.programRequests.find(item => item.request_id === session.request_id);
        const candidates = (DATA.recommendations[session.session_id] || []).slice(0, 3);
        return `
            <div class="assignment-item">
                <strong>${request ? request.content : "Upcoming session"}</strong>
                <span>${request ? request.institution : ""}</span>
                <div class="assignment-session-meta">${formatDate(session.date)} · ${session.start_time}-${session.end_time} · ${request ? request.state : ""}</div>
                <div class="candidate-stack">
                    ${candidates.map(candidate => {
                        const instructor = DATA.instructors.find(item => item.instructor_id === candidate.instructor_id);
                        return `
                            <div class="candidate-chip">
                                <div>
                                    <strong>${candidate.role}: ${instructor ? instructor.name : candidate.instructor_id}</strong>
                                    <span>${candidate.reason}</span>
                                </div>
                                <div class="candidate-score">${candidate.score}</div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        `;
    }).join("");
}

function renderActivity() {
    document.getElementById("activity-list").innerHTML = DATA.activities.slice(0, 6).map(item => {
        const instructor = DATA.instructors.find(entry => entry.instructor_id === item.instructor_id);
        const scoreLabel = item.point == null ? "Auto" : `${item.point > 0 ? "+" : ""}${item.point} pts`;
        return `
            <div class="activity-item">
                <strong>${instructor ? instructor.name : item.instructor_id}</strong>
                <span>${item.description}</span>
                <div class="activity-meta">${formatDate(item.date)} · ${scoreLabel}</div>
            </div>
        `;
    }).join("");
}

function renderApprovals() {
    document.getElementById("approval-list").innerHTML = DATA.approvals.slice(0, 5).map(item => {
        const instructor = DATA.instructors.find(entry => entry.instructor_id === item.instructor_id);
        return `
            <div class="approval-item">
                <strong>${item.request_type}: ${instructor ? instructor.name : item.instructor_id}</strong>
                <span>${item.note}</span>
                <div class="approval-meta">${item.sub_category} · ${item.point_preview > 0 ? "+" : ""}${item.point_preview} pts · ${badge(item.status)}</div>
            </div>
        `;
    }).join("");
}

function renderDistribution() {
    const counts = DATA.instructors.reduce((accumulator, instructor) => {
        accumulator[instructor.state] = (accumulator[instructor.state] || 0) + 1;
        return accumulator;
    }, {});

    document.getElementById("distribution-list").innerHTML = Object.entries(counts)
        .sort((left, right) => right[1] - left[1])
        .map(([state, count]) => `
            <div class="distribution-item">
                <strong>${state}</strong>
                <span>${count} instructors in the demo roster</span>
                <div class="distribution-meta">${Math.round((count / DATA.instructors.length) * 100)}% of total pool</div>
            </div>
        `)
        .join("");
}

function renderRoster() {
    const tbody = document.getElementById("roster-tbody");
    const filtered = DATA.instructors
        .filter(instructor => {
            if (!rosterQuery) return true;
            const haystack = [
                instructor.name,
                instructor.state,
                instructor.activity_region,
                instructor.major,
                instructor.specialties.join(" ")
            ].join(" ").toLowerCase();
            return haystack.includes(rosterQuery);
        })
        .sort((left, right) => right.total_score - left.total_score);

    tbody.innerHTML = filtered.map(instructor => `
        <tr>
            <td class="name-cell">${instructor.name}</td>
            <td>${instructor.state}</td>
            <td>
                <div class="specialty-stack">
                    ${instructor.specialties.slice(0, 3).map(specialty => `<span>${specialty}</span>`).join("")}
                </div>
            </td>
            <td class="number-cell">${instructor.total_score.toFixed(1)}</td>
            <td><span class="grade-badge ${instructor.grade.toLowerCase()}">${instructor.grade}</span></td>
            <td class="number-cell">${instructor.score_evaluation.toFixed(1)}</td>
            <td>${instructor.availability_summary}</td>
            <td><span class="status-pill ${instructor.assignment_block ? "blocked" : "ready"}">${instructor.assignment_block ? "Blocked" : "Ready"}</span></td>
        </tr>
    `).join("");
}

function renderLedger() {
    const tbody = document.getElementById("ledger-tbody");
    tbody.innerHTML = DATA.ledger.map(entry => `
        <tr>
            <td>${formatDate(entry.date)}</td>
            <td>${entry.institution}</td>
            <td>${entry.content}</td>
            <td>${entry.state}</td>
            <td class="number-cell">${entry.headcount}</td>
            <td>${entry.lead_names}</td>
            <td>${entry.assistant_names || "-"}</td>
            <td class="number-cell">${formatAud(entry.instructor_fees)}</td>
            <td class="number-cell">${formatAud(entry.school_invoice)}</td>
            <td class="number-cell">${formatAud(entry.margin)}</td>
        </tr>
    `).join("");
}

function badge(status) {
    const className = status === "approved" ? "complete" : status === "rejected" ? "pending" : "partial";
    return `<span class="queue-badge ${className}">${status}</span>`;
}

function formatDate(date) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatAud(value) {
    return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 0
    }).format(value);
}

function downloadCsv(filename, rows) {
    const headers = Object.keys(rows[0] || {});
    const csv = [
        headers.join(","),
        ...rows.map(row => headers.map(header => csvCell(row[header])).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function csvCell(value) {
    const text = String(value == null ? "" : value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}
