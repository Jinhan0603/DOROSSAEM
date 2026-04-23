const DEMO_TODAY = "2026-04-23";

window.DEMO_DATA = (() => {
    const names = [
        "Amelia Carter", "Noah Thompson", "Olivia Nguyen", "Liam Wilson", "Charlotte Taylor",
        "Jack Anderson", "Mia Patel", "Ethan Brown", "Ava Martin", "Lucas Campbell",
        "Isla Singh", "James Walker", "Grace Chen", "Oliver Harris", "Sophie Robinson",
        "Henry Lee", "Chloe Mitchell", "William King", "Emily Clarke", "Thomas Wright",
        "Ruby Hall", "Benjamin Scott", "Ella Young", "Samuel Lewis", "Matilda Allen",
        "Daniel Green", "Zoe Hill", "Alexander Adams", "Hannah Baker", "Joshua Nelson",
        "Lily Turner", "Max Cooper", "Madison Hughes", "Ryan Ward", "Sarah Kelly",
        "Nathan Brooks", "Georgia Price", "Dylan Bennett", "Victoria Morris", "Aaron Russell",
        "Alice Foster", "Cooper Howard", "Maya Edwards", "Isaac Reid", "Jessica Moore",
        "Leo Morgan", "Erin Cox", "Patrick Bailey", "Priya Sharma", "Xavier O'Connor"
    ];

    const locations = [
        { state: "NSW", city: "Sydney", region: "Western Sydney" },
        { state: "VIC", city: "Melbourne", region: "Inner Melbourne" },
        { state: "QLD", city: "Brisbane", region: "South East Queensland" },
        { state: "WA", city: "Perth", region: "Perth Metro" },
        { state: "SA", city: "Adelaide", region: "Adelaide Metro" },
        { state: "ACT", city: "Canberra", region: "Canberra" },
        { state: "TAS", city: "Hobart", region: "Southern Tasmania" },
        { state: "NT", city: "Darwin", region: "Darwin" }
    ];

    const specialtyPool = [
        "Robotics", "AI literacy", "Python", "Micro:bit", "Drones", "Cyber safety",
        "Game design", "Data science", "Primary STEM", "Teacher PD", "IoT",
        "3D printing", "Science inquiry", "Digital systems"
    ];

    const programTypes = {
        general: "STEM",
        dls: "Digital Learning",
        doroland: "Immersive Lab",
        camp: "Holiday Camp",
        operation: "Operations"
    };

    const instructors = names.map((name, index) => {
        const location = locations[index % locations.length];
        const grade = index < 9 ? "Master" : index < 40 ? "Standard" : "Trainee";
        const totalScore = grade === "Master"
            ? 90.4 - index * 1.2
            : grade === "Standard"
                ? 78.5 - (index - 9) * 0.55
                : 58.5 - (index - 40) * 1.15;
        const emailName = name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.+|\.+$/g, "");
        const specialtyStart = index % specialtyPool.length;
        const specialties = [
            specialtyPool[specialtyStart],
            specialtyPool[(specialtyStart + 3) % specialtyPool.length],
            specialtyPool[(specialtyStart + 7) % specialtyPool.length]
        ];

        return {
            instructor_id: `AUS-${String(index + 1).padStart(3, "0")}`,
            name,
            email: `${emailName}@doro-demo.edu.au`,
            phone: `04${String(12000000 + index * 7319).slice(0, 8)}`,
            city: location.city,
            state: location.state,
            activity_region: location.region,
            major: specialties[0],
            specialties,
            grade,
            total_score: Number(totalScore.toFixed(1)),
            score_experience: Math.min(100, 52 + (index * 9) % 46),
            score_evaluation: Number((74 + (index * 5) % 24 + (grade === "Master" ? 1.5 : 0)).toFixed(1)),
            score_expertise: Math.min(100, 58 + (index * 11) % 40),
            score_contribution: Math.min(100, 28 + (index * 7) % 58),
            join_date: `202${index % 3 + 3}-${String(index % 12 + 1).padStart(2, "0")}-${String(index % 24 + 1).padStart(2, "0")}`,
            status: "active",
            assignment_block: [16, 35].includes(index),
            block_reason: index === 16 ? "Pending Working With Children Check renewal" : index === 35 ? "Three late arrivals in review window" : "",
            transport: index % 3 === 0 ? "car" : "public transport",
            availability_summary: index % 4 === 0 ? "Weekdays AM/PM" : index % 4 === 1 ? "After school + Sat" : index % 4 === 2 ? "Flexible" : "School hours only",
            last_program: specialtyPool[(specialtyStart + 2) % specialtyPool.length]
        };
    });

    const schools = [
        { institution: "Parramatta High School", state: "NSW", city: "Sydney", target: "Year 8" },
        { institution: "Melbourne Girls' College", state: "VIC", city: "Melbourne", target: "Year 9" },
        { institution: "Brisbane State High School", state: "QLD", city: "Brisbane", target: "Year 7" },
        { institution: "Perth Modern School", state: "WA", city: "Perth", target: "Year 10" },
        { institution: "Adelaide Botanic High School", state: "SA", city: "Adelaide", target: "Year 8" },
        { institution: "Canberra College", state: "ACT", city: "Canberra", target: "Year 11" },
        { institution: "Hobart College", state: "TAS", city: "Hobart", target: "Year 10" },
        { institution: "Darwin High School", state: "NT", city: "Darwin", target: "Year 9" },
        { institution: "Newcastle Grammar School", state: "NSW", city: "Newcastle", target: "Year 6" },
        { institution: "Geelong High School", state: "VIC", city: "Geelong", target: "Year 8" },
        { institution: "Gold Coast STEM Hub", state: "QLD", city: "Gold Coast", target: "Year 5-6" },
        { institution: "Fremantle College", state: "WA", city: "Fremantle", target: "Year 7" }
    ];

    const programs = [
        { name: "AI Robotics Lab", lecture_type: "general", tags: ["Robotics", "AI literacy"] },
        { name: "Micro:bit Climate Sensors", lecture_type: "dls", tags: ["Micro:bit", "IoT"] },
        { name: "Drone Mapping Challenge", lecture_type: "general", tags: ["Drones", "Data science"] },
        { name: "Primary STEM Discovery", lecture_type: "doroland", tags: ["Primary STEM", "Science inquiry"] },
        { name: "Python for Data Stories", lecture_type: "dls", tags: ["Python", "Data science"] },
        { name: "Cyber Safety Escape Room", lecture_type: "general", tags: ["Cyber safety", "Digital systems"] },
        { name: "Game Design with MakeCode", lecture_type: "camp", tags: ["Game design", "Micro:bit"] },
        { name: "Teacher PD: AI in the Classroom", lecture_type: "operation", tags: ["Teacher PD", "AI literacy"] },
        { name: "First Nations STEM Storytelling", lecture_type: "doroland", tags: ["Science inquiry", "Primary STEM"] },
        { name: "Future Careers in Robotics", lecture_type: "general", tags: ["Robotics", "Digital systems"] }
    ];

    const dates = [
        "2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10", "2026-04-13",
        "2026-04-14", "2026-04-15", "2026-04-16", "2026-04-17", "2026-04-20", "2026-04-21",
        "2026-04-22", "2026-04-23", "2026-04-24", "2026-04-27", "2026-04-28", "2026-04-29",
        "2026-04-30", "2026-05-01", "2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07",
        "2026-05-08", "2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15",
        "2026-05-18", "2026-05-19"
    ];

    const lectures = dates.map((date, index) => {
        const school = schools[index % schools.length];
        const program = programs[index % programs.length];
        const completed = index < 20;
        const overdueScheduled = index === 20 || index === 21;
        const lead = instructors[(index * 2) % instructors.length];
        const assistantA = instructors[(index * 2 + 7) % instructors.length];
        const assistantB = instructors[(index * 2 + 13) % instructors.length];
        return {
            lecture_id: `LEC-AU-${String(index + 1).padStart(3, "0")}`,
            date,
            institution: school.institution,
            state: school.state,
            city: school.city,
            target: school.target,
            lecture_name: program.name,
            lecture_type: program.lecture_type,
            tags: program.tags,
            lead_instructor_id: lead.instructor_id,
            assistant_instructor_ids: index % 3 === 0 ? [assistantA.instructor_id, assistantB.instructor_id] : [assistantA.instructor_id],
            status: completed ? "completed" : "scheduled",
            evaluation_status: completed ? (index % 5 === 0 ? "pending" : index % 4 === 0 ? "partial" : "complete") : "pending",
            students: 24 + (index * 7) % 82,
            manager: ["Sarah Ops", "Daniel Ops", "Mia Ops"][index % 3],
            overdue: overdueScheduled
        };
    });

    const evaluations = lectures
        .filter(lecture => lecture.status === "completed")
        .flatMap((lecture, lectureIndex) => {
            const ids = [lecture.lead_instructor_id, ...lecture.assistant_instructor_ids];
            return ids.map((instructorId, roleIndex) => {
                const base = 4.1 + ((lectureIndex + roleIndex) % 7) * 0.12;
                return {
                    eval_id: `EVAL-AU-${lecture.lecture_id}-${roleIndex}`,
                    lecture_id: lecture.lecture_id,
                    instructor_id: instructorId,
                    student_score: lecture.evaluation_status === "pending" ? null : Number(Math.min(5, base).toFixed(1)),
                    school_score: lecture.evaluation_status === "pending" || (lecture.evaluation_status === "partial" && roleIndex === 1) ? null : Number(Math.min(5, base + 0.1).toFixed(1)),
                    peer_score: lecture.evaluation_status === "complete" ? Number(Math.min(5, base - 0.05).toFixed(1)) : null,
                    response_count: 18 + (lectureIndex * 3 + roleIndex) % 34
                };
            });
        });

    const approvals = [
        { request_id: "REQ-AU-001", instructor_id: "AUS-001", request_type: "Contribution", sub_category: "New lesson plan", point_preview: 10, note: "AI Robotics Lab extension module", status: "pending", requested_at: "2026-04-22T09:30:00" },
        { request_id: "REQ-AU-002", instructor_id: "AUS-008", request_type: "Bonus", sub_category: "School praise", point_preview: 5, note: "Praised by Brisbane State High STEM coordinator", status: "pending", requested_at: "2026-04-21T14:10:00" },
        { request_id: "REQ-AU-003", instructor_id: "AUS-014", request_type: "Contribution", sub_category: "Teacher PD support", point_preview: 6, note: "Prepared PD handout for classroom AI policy", status: "pending", requested_at: "2026-04-20T11:50:00" },
        { request_id: "REQ-AU-004", instructor_id: "AUS-022", request_type: "Incident", sub_category: "Late arrival", point_preview: -10, note: "Arrived 18 minutes late, school notified", status: "pending", requested_at: "2026-04-19T08:42:00" },
        { request_id: "REQ-AU-005", instructor_id: "AUS-006", request_type: "Contribution", sub_category: "Mentoring", point_preview: 5, note: "Mentored two trainee instructors", status: "approved", requested_at: "2026-04-16T10:15:00" },
        { request_id: "REQ-AU-006", instructor_id: "AUS-031", request_type: "Contribution", sub_category: "Content review", point_preview: 5, note: "Reviewed cyber safety worksheet", status: "rejected", requested_at: "2026-04-12T16:20:00" }
    ];

    const incidents = [
        { incident_id: "INC-AU-001", instructor_id: "AUS-008", type: "bonus", date: "2026-04-21", description: "School praise: strong student engagement", point: 5, status: "pending" },
        { incident_id: "INC-AU-002", instructor_id: "AUS-019", type: "bonus", date: "2026-04-18", description: "Covered a regional session at short notice", point: 3, status: "approved" },
        { incident_id: "INC-AU-003", instructor_id: "AUS-022", type: "penalty", date: "2026-04-19", description: "Late arrival under manager review", point: -10, status: "pending" },
        { incident_id: "INC-AU-004", instructor_id: "AUS-036", type: "penalty", date: "2026-04-15", description: "Repeated late arrival - assignment blocked", point: -10, status: "approved" },
        { incident_id: "INC-AU-005", instructor_id: "AUS-017", type: "penalty", date: "2026-04-10", description: "Compliance document renewal pending", point: 0, status: "open" }
    ];

    const activities = [
        { date: "2026-04-22", instructor_id: "AUS-001", category: "contribution", description: "submitted AI Robotics Lab extension module", point: 10 },
        { date: "2026-04-21", instructor_id: "AUS-008", category: "bonus", description: "received school praise from Brisbane State High School", point: 5 },
        { date: "2026-04-20", instructor_id: "AUS-003", category: "lecture_experience", description: "completed Drone Mapping Challenge in WA", point: null },
        { date: "2026-04-19", instructor_id: "AUS-022", category: "penalty", description: "late arrival logged for manager review", point: -10 },
        { date: "2026-04-18", instructor_id: "AUS-019", category: "bonus", description: "accepted a short-notice regional session", point: 3 },
        { date: "2026-04-17", instructor_id: "AUS-006", category: "contribution", description: "mentored two trainee instructors", point: 5 },
        { date: "2026-04-16", instructor_id: "AUS-010", category: "lecture_experience", description: "delivered Micro:bit Climate Sensors", point: null },
        { date: "2026-04-15", instructor_id: "AUS-036", category: "penalty", description: "assignment block applied after repeated lateness", point: -10 }
    ];

    const programRequests = [
        { request_id: "SREQ-AU-001", institution: "Catholic Education Diocese of Parramatta", content: "AI Robotics Lab", target: "Year 8", state: "NSW", region: "Western Sydney", service_level: "important", lecture_type: "general", sessions: 4, status: "open", headcount: 120, required_lead: 1, required_assistant: 2 },
        { request_id: "SREQ-AU-002", institution: "Victorian STEM Centre", content: "Teacher PD: AI in the Classroom", target: "Teachers", state: "VIC", region: "Melbourne", service_level: "high_risk", lecture_type: "operation", sessions: 2, status: "open", headcount: 42, required_lead: 1, required_assistant: 1 },
        { request_id: "SREQ-AU-003", institution: "Queensland Virtual STEM Network", content: "Cyber Safety Escape Room", target: "Year 7-9", state: "QLD", region: "Brisbane", service_level: "standard", lecture_type: "dls", sessions: 3, status: "open", headcount: 96, required_lead: 1, required_assistant: 1 },
        { request_id: "SREQ-AU-004", institution: "WA Regional Science Alliance", content: "Drone Mapping Challenge", target: "Year 10", state: "WA", region: "Perth", service_level: "important", lecture_type: "general", sessions: 2, status: "draft", headcount: 64, required_lead: 1, required_assistant: 2 },
        { request_id: "SREQ-AU-005", institution: "ACT Education Directorate", content: "Python for Data Stories", target: "Year 11", state: "ACT", region: "Canberra", service_level: "standard", lecture_type: "dls", sessions: 1, status: "closed", headcount: 28, required_lead: 1, required_assistant: 1 },
        { request_id: "SREQ-AU-006", institution: "Tasmanian STEM Outreach", content: "Primary STEM Discovery", target: "Year 5-6", state: "TAS", region: "Hobart", service_level: "standard", lecture_type: "doroland", sessions: 3, status: "open", headcount: 75, required_lead: 1, required_assistant: 1 }
    ];

    const sessions = [
        { session_id: "SES-AU-001", request_id: "SREQ-AU-001", date: "2026-04-29", start_time: "09:30", end_time: "12:00", duration_hours: 2.5, status: "open" },
        { session_id: "SES-AU-002", request_id: "SREQ-AU-001", date: "2026-05-06", start_time: "09:30", end_time: "12:00", duration_hours: 2.5, status: "assigning" },
        { session_id: "SES-AU-003", request_id: "SREQ-AU-002", date: "2026-05-01", start_time: "13:00", end_time: "16:00", duration_hours: 3, status: "open" },
        { session_id: "SES-AU-004", request_id: "SREQ-AU-003", date: "2026-05-04", start_time: "10:00", end_time: "12:00", duration_hours: 2, status: "confirmed" },
        { session_id: "SES-AU-005", request_id: "SREQ-AU-006", date: "2026-05-08", start_time: "09:00", end_time: "11:00", duration_hours: 2, status: "open" },
        { session_id: "SES-AU-006", request_id: "SREQ-AU-003", date: "2026-05-11", start_time: "10:00", end_time: "12:00", duration_hours: 2, status: "open" }
    ];

    const recommendations = {
        "SES-AU-001": [
            { instructor_id: "AUS-001", role: "Lead", score: 96, reason: "Master grade, NSW availability, robotics expertise" },
            { instructor_id: "AUS-009", role: "Lead", score: 91, reason: "Master grade and strong evaluation history" },
            { instructor_id: "AUS-016", role: "Assistant", score: 88, reason: "Sydney region and Micro:bit experience" }
        ],
        "SES-AU-002": [
            { instructor_id: "AUS-002", role: "Lead", score: 93, reason: "Master grade, prior Parramatta delivery" },
            { instructor_id: "AUS-024", role: "Assistant", score: 85, reason: "Available Wednesday AM and robotics tag" },
            { instructor_id: "AUS-032", role: "Assistant", score: 82, reason: "Good assistant reliability score" }
        ],
        "SES-AU-003": [
            { instructor_id: "AUS-008", role: "Lead", score: 94, reason: "Teacher PD and AI literacy expertise" },
            { instructor_id: "AUS-014", role: "Lead", score: 89, reason: "High evaluation score and PD support" },
            { instructor_id: "AUS-030", role: "Assistant", score: 81, reason: "Melbourne region fit" }
        ],
        "SES-AU-004": [
            { instructor_id: "AUS-011", role: "Lead", score: 87, reason: "Confirmed lead" },
            { instructor_id: "AUS-027", role: "Assistant", score: 80, reason: "Confirmed assistant" }
        ],
        "SES-AU-005": [
            { instructor_id: "AUS-007", role: "Lead", score: 92, reason: "Master grade and primary STEM track record" },
            { instructor_id: "AUS-015", role: "Lead", score: 86, reason: "Strong classroom management score" },
            { instructor_id: "AUS-039", role: "Assistant", score: 78, reason: "Available in Hobart week 2" }
        ],
        "SES-AU-006": [
            { instructor_id: "AUS-004", role: "Lead", score: 90, reason: "Cyber safety and digital systems fit" },
            { instructor_id: "AUS-012", role: "Assistant", score: 83, reason: "Brisbane availability and prior support" },
            { instructor_id: "AUS-044", role: "Assistant", score: 72, reason: "Trainee with matching specialty" }
        ]
    };

    const ledger = lectures
        .filter(lecture => lecture.status === "completed")
        .slice(0, 12)
        .map((lecture, index) => {
            const lead = instructors.find(instructor => instructor.instructor_id === lecture.lead_instructor_id);
            const assistants = lecture.assistant_instructor_ids.map(id => instructors.find(instructor => instructor.instructor_id === id)).filter(Boolean);
            const hours = index % 3 === 0 ? 3 : 2;
            const instructorFees = 180 * hours + assistants.length * 95 * hours;
            const invoice = instructorFees + 420 + (index % 4) * 70;
            return {
                ledger_id: `LDG-AU-${String(index + 1).padStart(3, "0")}`,
                date: lecture.date,
                institution: lecture.institution,
                content: lecture.lecture_name,
                state: lecture.state,
                headcount: lecture.students,
                lead_names: lead ? lead.name : "-",
                assistant_names: assistants.map(instructor => instructor.name).join(", "),
                duration_hours: hours,
                instructor_fees: instructorFees,
                school_invoice: invoice,
                margin: invoice - instructorFees
            };
        });

    return {
        instructors,
        lectures,
        evaluations,
        approvals,
        incidents,
        activities,
        programRequests,
        sessions,
        recommendations,
        ledger,
        programTypes
    };
})();
