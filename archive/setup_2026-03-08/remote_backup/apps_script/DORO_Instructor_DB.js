// @ts-nocheck

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 DORO 통합 관리')
      .addItem('📝 1. 신규 강사 등록 폼 열기', 'OPEN_REGISTRATION_FORM')
      .addItem('🔄 2. 신규 응답 DB 일괄 적용하기', 'SYNC_NEW_RESPONSES')
      .addSeparator()
      .addItem('🧹 3. 데이터 일괄 표준화 및 점검', 'RUN_DORO_MAINTENANCE')
      .addToUi();
}

function OPEN_REGISTRATION_FORM() {
  const formUrl = "https://docs.google.com/forms/d/1y35fmTCKS1GAk7Yu9w0m4769XFiocNIU4ogIFdcPeHU/viewform"; 
  const html = `<script>window.open("${formUrl}", "_blank"); google.script.host.close();</script>`;
  const htmlOutput = HtmlService.createHtmlOutput(html).setWidth(250).setHeight(50);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '등록 폼으로 이동합니다...');
}

const SCHOOL_MAP = {
  "한양대 ERICA": "한양대학교 ERICA", "에리카": "한양대학교 ERICA", "한양대에리카": "한양대학교 ERICA",
  "한양대": "한양대학교", "한양대 서울": "한양대학교",
  "한국공대": "한국공학대학교", "산기대": "한국공학대학교", "한국산업기술대": "한국공학대학교",
  "서울과기대": "서울과학기술대학교", "과기대": "서울과학기술대학교",
  "광운대": "광운대학교", "인하대": "인하대학교", "아주대": "아주대학교", "가천대": "가천대학교", "항공대": "한국항공대학교",
  "카이스트": "KAIST", "한국과학기술원": "KAIST", "포스텍": "POSTECH", "포항공대": "POSTECH", "포항공과대학교": "POSTECH",
  "유니스트": "UNIST", "울산과기원": "UNIST", "울산과학기술원": "UNIST", "디지스트": "DGIST", "대구경북과기원": "DGIST", "대구경북과학기술원": "DGIST",
  "지스트": "GIST", "광주과기원": "GIST", "광주과학기술원": "GIST",
  "경인교대": "경인교육대학교", "서울교대": "서울교육대학교", "춘천교대": "춘천교육대학교", "부산교대": "부산교육대학교",
  "교원대": "한국교원대학교", "한국교원대": "한국교원대학교",
  "서울대": "서울대학교", "고려대": "고려대학교", "연세대": "연세대학교", "성균관대": "성균관대학교", "성대": "성균관대학교",
  "서강대": "서강대학교", "경희대": "경희대학교", "부산대": "부산대학교", "경북대": "경북대학교",
  "전남대": "전남대학교", "충남대": "충남대학교", "강원대": "강원대학교", "충북대": "충북대학교", "전북대": "전북대학교", "제주대": "제주대학교"
};

const getDropdownRules = () => {
  const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(["active", "restricted", "suspended", "removed"], true).build();
  const gradeRule = SpreadsheetApp.newDataValidation().requireValueInList(["M", "A", "G", "N"], true).build();
  return { statusRule, gradeRule };
};

// 💡 [신규 기능] D열과 E열에 예쁜 색상 규칙(조건부 서식)을 영구적으로 입혀주는 함수
function applyColorCoding_(sheet) {
  let rules = sheet.getConditionalFormatRules();
  
  // 기존 D, E열에 있던 낡은 색상 규칙은 싹 지워서 중복 방지
  rules = rules.filter(r => {
    let ranges = r.getRanges();
    if(ranges.length === 0) return true;
    let col = ranges[0].getColumn();
    return col !== 4 && col !== 5; // D열(4), E열(5) 제외
  });

  const dRange = sheet.getRange("D2:D");
  const eRange = sheet.getRange("E2:E");

  const addRule = (text, bg, font, range) => {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(text)
      .setBackground(bg)
      .setFontColor(font)
      .setRanges([range])
      .build());
  };

  // 활동 상태 (D열) 색상 옷 입히기
  addRule("active", "#b7e1cd", "#005028", dRange);      // 초록색
  addRule("restricted", "#fce8b2", "#805b00", dRange);  // 노란색
  addRule("suspended", "#f4c7c3", "#7a1a13", dRange);   // 빨간색
  addRule("removed", "#e8eaed", "#3c4043", dRange);     // 회색

  // 등급 (E열) 색상 옷 입히기
  addRule("M", "#d7bbfd", "#4b1e8f", eRange);           // 보라색
  addRule("A", "#c9daf8", "#1c4587", eRange);           // 파란색
  addRule("G", "#c6ead8", "#0d532e", eRange);           // 민트색
  addRule("N", "#f1f3f4", "#3c4043", eRange);           // 회색

  // 시트에 규칙 최종 적용!
  sheet.setConditionalFormatRules(rules);
}

function SYNC_NEW_RESPONSES() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName("Instructor_Master");
  const sensitiveSheet = ss.getSheetByName("Instructor_Sensitive");

  let responseSheet = null;
  for (let sheet of ss.getSheets()) {
    if (sheet.getName().includes("응답")) {
      responseSheet = sheet;
      break;
    }
  }

  if (!responseSheet) {
    SpreadsheetApp.getUi().alert("❌ 이름에 '응답'이 포함된 시트를 찾을 수 없습니다.");
    return;
  }

  const responseData = responseSheet.getDataRange().getValues();
  if (responseData.length <= 1) {
    SpreadsheetApp.getUi().alert("✅ 적용할 응답 데이터가 없습니다.");
    return;
  }

  const headers = responseData[0];

  let idxName=-1, idxCohort=-1, idxSchool=-1, idxMajor=-1;
  let idxResidence=-1, idxAddress=-1, idxGender=-1, idxPhone=-1;
  let idxRrn=-1, idxEmail=-1, idxBank=-1, idxAccount=-1, idxSync=-1;

  for (let i = 0; i < headers.length; i++) {
    let h = String(headers[i]).replace(/\s+/g, '');
    
    if (h.includes("이름") || h.includes("성명")) idxName = i;
    else if (h.includes("기수")) idxCohort = i;
    else if (h.includes("학교") || h.includes("대학")) idxSchool = i;
    else if (h.includes("학과") || h.includes("전공")) idxMajor = i;
    else if (h.includes("성별")) idxGender = i;
    else if (h.includes("메일")) idxEmail = i;
    else if (h.includes("은행")) idxBank = i;
    else if (h.includes("계좌")) idxAccount = i;
    else if (h.includes("DB적용") || h.includes("적용여부")) idxSync = i;
    
    else if (h.includes("주민등록번호상거주지") || h.includes("주소")) idxAddress = i;
    else if (h.includes("주민등록번호") || h.includes("주민번호")) idxRrn = i;
    else if (h.includes("현재거주지") || h.includes("거주지")) idxResidence = i;
    else if (h.includes("연락처") || h.includes("전화") || h.includes("번호")) idxPhone = i;
  }

  if (idxSync === -1) {
    idxSync = headers.length;
    responseSheet.getRange(1, idxSync + 1).setValue("DB 적용 여부");
  }

  let count = 0;
  const { statusRule, gradeRule } = getDropdownRules();

  for (let i = 1; i < responseData.length; i++) {
    let row = responseData[i];
    let syncStatus = String(row[idxSync] || "").trim();

    if (syncStatus === "O") continue;

    let name = idxName !== -1 ? String(row[idxName]).trim() : "";
    if (!name) continue;

    let cohort = idxCohort !== -1 ? String(row[idxCohort]).trim() : "";
    let school = idxSchool !== -1 ? String(row[idxSchool]).trim() : "";
    let major = idxMajor !== -1 ? String(row[idxMajor]).trim() : "";
    let residence = idxResidence !== -1 ? String(row[idxResidence]).trim() : "";
    let address = idxAddress !== -1 ? String(row[idxAddress]).trim() : "";
    let gender = idxGender !== -1 ? String(row[idxGender]).trim() : "";
    let phone = idxPhone !== -1 ? String(row[idxPhone]).trim() : "";
    let rrn = idxRrn !== -1 ? String(row[idxRrn]).trim() : "";
    let email = idxEmail !== -1 ? String(row[idxEmail]).trim() : "";
    let bank = idxBank !== -1 ? String(row[idxBank]).trim() : "";
    let account = idxAccount !== -1 ? String(row[idxAccount]).trim() : "";

    if (SCHOOL_MAP[school]) school = SCHOOL_MAP[school];

    const newId = generateRandomId_();
    const targetRow = Math.max(masterSheet.getLastRow(), sensitiveSheet.getLastRow()) + 1;

    const formulaRange = `=GET_MOVABLE_RANGE(L${targetRow}, N${targetRow})`;
    const formulaScore = `=CALCULATE_PRIORITY_SCORE(D${targetRow}, E${targetRow}, I${targetRow})`;

    const masterRow = [newId, name, cohort, "active", "N", "", "", "0 / 0", "", formulaScore, "", school, major, residence, formulaRange];
    const sensitiveRow = [newId, gender, phone, rrn, email, bank, account, address];

    masterSheet.getRange(targetRow, 1, 1, masterRow.length).setValues([masterRow]);
    sensitiveSheet.getRange(targetRow, 1, 1, sensitiveRow.length).setValues([sensitiveRow]);

    masterSheet.getRange(targetRow, 4).setDataValidation(statusRule);
    masterSheet.getRange(targetRow, 5).setDataValidation(gradeRule);

    if (cohort && !cohort.includes("기")) masterSheet.getRange(targetRow, 3).setValue(cohort + "기");
    if (phone) sensitiveSheet.getRange(targetRow, 3).setValue(phone.replace(/[^0-9]/g, "").replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3'));

    responseSheet.getRange(i + 1, idxSync + 1).setValue("O");
    count++;
  }

  if (count > 0) SpreadsheetApp.getUi().alert(`✅ 성공! 총 ${count}명의 데이터가 적용되었습니다.\n(드롭다운 및 색상 블록 완료)`);
  else SpreadsheetApp.getUi().alert("ℹ️ 새롭게 적용할 응답이 없습니다.");
}

function GET_MOVABLE_RANGE(school, residence) {
  const regionRules = {
    "안산": "안산, 시흥, 수원 (4호선/수인분당선)", "서울": "서울 전역 및 인접 경기권", "인천": "인천 전역 및 부천",
    "수원": "수원, 용인, 화성", "용인": "용인, 성남, 수원", "경기": "경기 권역 (상세 지역 수동 확인 필요)",
    "원주": "원주 시내 및 인접 (방학 거점)", "춘천": "춘천 시내 및 인접", "강릉": "강릉 시내 및 인접", "강원": "강원 권역",
    "대전": "대전 전역 및 세종", "세종": "세종 및 대전, 청주", "천안": "천안, 아산", "청주": "청주 시내 및 인접",
    "충남": "충남 권역", "충북": "충북 권역", "부산": "부산 전역 및 인접 (김해/양산)", "대구": "대구 전역 및 경산",
    "울산": "울산 전역", "창원": "창원, 마산, 진해", "포항": "포항 시내 및 인접", "경남": "경남 권역", "경북": "경북 권역",
    "광주": "광주 전역 및 인접 전남권", "전주": "전주 시내 및 익산", "전남": "전남 권역", "전북": "전북 권역", "제주": "제주 전역"
  };
  const combinedText = String(school || "") + " " + String(residence || "");
  let detectedRegions = [];
  for (let key in regionRules) if (combinedText.includes(key)) detectedRegions.push(key);
  detectedRegions = [...new Set(detectedRegions)];
  if (detectedRegions.length === 0) return "수동 확인 필요 (미등록 지역)";
  let resultText = "";
  for (let i = 0; i < detectedRegions.length; i++) resultText += "[" + detectedRegions[i] + " 거점] " + regionRules[detectedRegions[i]] + "\n";
  return resultText.trim();
}

function CALCULATE_PRIORITY_SCORE(status, grade, rubricScore) {
  if (status === "suspended" || status === "removed") return "배정 제외";
  let baseScore = 0;
  switch(grade) { case "M": baseScore = 30; break; case "A": baseScore = 20; break; case "G": baseScore = 10; break; case "N": baseScore = 0; break; }
  let additionalScore = Number(rubricScore) || 0;
  let penalty = (status === "restricted") ? -5 : 0;
  return baseScore + additionalScore + penalty;
}

function generateRandomId_() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let randomStr = '';
  for (let i = 0; i < 4; i++) randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  return new Date().getFullYear().toString().slice(-2) + "-" + randomStr;
}

/**
 * 3. 데이터 일괄 표준화 및 점검 (+ 기존 데이터에 드롭다운 및 색상 일괄 입히기)
 */
function RUN_DORO_MAINTENANCE() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName("Instructor_Master");
  const sensitiveSheet = ss.getSheetByName("Instructor_Sensitive");
  if (!masterSheet || !sensitiveSheet) return;

  // 💡 [실행] D열과 E열에 색상 옷 입히기 함수 호출!
  applyColorCoding_(masterSheet);

  const masterData = masterSheet.getDataRange().getValues();
  const sensitiveData = sensitiveSheet.getDataRange().getValues();
  const { statusRule, gradeRule } = getDropdownRules();

  if (masterData.length > 1) {
    masterSheet.getRange(2, 4, masterData.length - 1).setDataValidation(statusRule);
    masterSheet.getRange(2, 5, masterData.length - 1).setDataValidation(gradeRule);
  }

  for (let i = 1; i < masterData.length; i++) {
    if (!masterData[i][1] && !masterData[i][2]) continue;
    let cohort = String(masterData[i][2] || "").trim();
    let school = String(masterData[i][11] || "").trim();
    let residence = String(masterData[i][13] || "").trim();

    if (SCHOOL_MAP[school]) masterSheet.getRange(i + 1, 12).setValue(SCHOOL_MAP[school]);
    if (cohort && !cohort.includes("기")) masterSheet.getRange(i + 1, 3).setValue(cohort + "기");
    if (residence) masterSheet.getRange(i + 1, 14).setValue(residence.replace("시", "").trim());

    if (sensitiveData[i]) {
      let phone = String(sensitiveData[i][2] || "").replace(/[^0-9]/g, "");
      if (phone.length === 11) sensitiveSheet.getRange(i + 1, 3).setValue(phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3'));
      let email = String(sensitiveData[i][4] || "").trim().toLowerCase();
      if (email) sensitiveSheet.getRange(i + 1, 5).setValue(email);
    }
  }
  SpreadsheetApp.getUi().alert("✅ 일괄 표준화 완료!\n(과거 데이터들의 상태/등급도 모두 드롭다운과 색상 블록으로 예쁘게 변경되었습니다.)");
}