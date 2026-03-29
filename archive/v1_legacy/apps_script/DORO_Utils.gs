function doroGetSheetOrThrow(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error("시트를 찾을 수 없습니다: " + name);
  return sh;
}

function doroGetOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function doroEnsureConfigSheet() {
  const sh = doroGetOrCreateSheet(DORO_CFG.SHEET.CONFIG);
  doroEnsureHeaders(sh, DORO_CFG.CONFIG_HEADERS);
  return sh;
}

function doroHeaderMap(headers) {
  const m = {};
  headers.forEach((h, i) => {
    m[String(h || "").trim()] = i;
  });
  return m;
}

function doroEnsureHeaders(sheet, headers) {
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const currentTrimmed = headers.map((_, i) => String(current[i] || "").trim());
  const targetTrimmed = headers.map((h) => String(h || "").trim());
  if (JSON.stringify(currentTrimmed) !== JSON.stringify(targetTrimmed)) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function doroEnsureHeadersAppend(sheet, requiredHeaders) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const hasAnyHeader = current.some(function (header) {
    return doroNormalize(header) !== "";
  });

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders.slice();
  }

  const currentNorm = current.map(function (header) {
    return doroNormalizeHeaderKey(header);
  });

  let writeCol = current.length;
  requiredHeaders.forEach(function (header) {
    const key = doroNormalizeHeaderKey(header);
    if (currentNorm.indexOf(key) >= 0) return;
    writeCol += 1;
    sheet.getRange(1, writeCol).setValue(header);
    currentNorm.push(key);
  });

  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function doroGetConfigValue(ruleName) {
  const sh = doroEnsureConfigSheet();
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    if (doroNormalize(values[i][1]) === doroNormalize(ruleName)) {
      return doroNormalize(values[i][2]);
    }
  }
  return "";
}

function doroUpsertConfigValue(ruleGroup, ruleName, ruleValue) {
  const sh = doroEnsureConfigSheet();
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    if (doroNormalize(values[i][1]) === doroNormalize(ruleName)) {
      sh.getRange(i + 1, 1, 1, 3).setValues([[ruleGroup, ruleName, ruleValue]]);
      return i + 1;
    }
  }
  sh.appendRow([ruleGroup, ruleName, ruleValue]);
  return sh.getLastRow();
}

function doroNormalize(v) {
  return String(v == null ? "" : v).trim().replace(/\s+/g, " ");
}

function doroNormalizeCompact(v) {
  return doroNormalize(v).replace(/\s+/g, "");
}

function doroPhone(v) {
  return doroNormalize(v).replace(/[^0-9]/g, "");
}

function doroNamePhoneKey(name, phone) {
  return doroNormalize(name).replace(/\s+/g, "").toLowerCase() + "|" + doroPhone(phone);
}

function doroMakeInstructorId(seed, usedMap) {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (let i = 0; i < 5000; i += 1) {
    const raw = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_1,
      seed + "|" + i
    );
    let n = 0;
    for (let j = 0; j < 8; j += 1) n = n * 256 + (raw[j] & 0xff);
    let code = "";
    for (let k = 0; k < 4; k += 1) {
      const rem = n % alphabet.length;
      code += alphabet.charAt(rem);
      n = Math.floor(n / alphabet.length);
    }
    const id = "26-" + code;
    if (!usedMap[id]) {
      usedMap[id] = true;
      return id;
    }
  }
  throw new Error("instructor_id 생성 실패");
}

function doroRegionRangeByCity(city) {
  const s = doroNormalize(city);
  if (!s) return "";
  if (/(안산|시흥|수원|화성)/.test(s)) {
    return "[안산 거점] 안산, 시흥, 수원 (4호선/수인분당선)";
  }
  if (/(서울|성북|강북|관악|동작|송파|강남|마포|은평)/.test(s)) {
    return "[서울 거점] 서울 전역 및 인접";
  }
  if (/(인천|부천|김포|청라|검단)/.test(s)) {
    return "[인천 거점] 인천, 부천, 김포";
  }
  if (/(용인|성남|분당|판교|수지|기흥)/.test(s)) {
    return "[용인 거점] 용인, 성남, 수원";
  }
  if (/(부산|김해|양산)/.test(s)) {
    return "[부산 거점] 부산 전역 및 인접 (김해/양산)";
  }
  if (/(대전|세종|청주)/.test(s)) {
    return "[대전 거점] 대전/세종/청주";
  }
  return "[개별 협의] 활동 가능 범위 확인 필요";
}

function doroNormalizeSchoolName(v) {
  const s = doroNormalize(v);
  return DORO_CFG.SCHOOL_MAP[s] || s;
}

function doroFormatPhoneNumber(v) {
  const digits = doroPhone(v);
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }
  return doroNormalize(v);
}

function doroCoerceCohort(v) {
  const s = doroNormalize(v).replace(/\.0$/, "");
  if (!s) return "";
  return /기$/.test(s) ? s : s + "기";
}

function doroGetDropdownRules() {
  return {
    statusRule: SpreadsheetApp.newDataValidation()
      .requireValueInList(DORO_CFG.STATUS_VALUES, true)
      .build(),
    gradeRule: SpreadsheetApp.newDataValidation()
      .requireValueInList(DORO_CFG.GRADE_VALUES, true)
      .build(),
  };
}

function doroApplyColorCoding(sheet) {
  let rules = sheet.getConditionalFormatRules();
  rules = rules.filter((rule) => {
    const ranges = rule.getRanges();
    if (!ranges.length) return true;
    const col = ranges[0].getColumn();
    return col !== 4 && col !== 5;
  });

  const statusRange = sheet.getRange("D2:D");
  const gradeRange = sheet.getRange("E2:E");

  function addRule(text, bg, font, range) {
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(text)
        .setBackground(bg)
        .setFontColor(font)
        .setRanges([range])
        .build()
    );
  }

  addRule("active", "#b7e1cd", "#005028", statusRange);
  addRule("inactive", "#e8eaed", "#3c4043", statusRange);
  addRule("penalty", "#f4c7c3", "#7a1a13", statusRange);

  addRule("Master", "#d7bbfd", "#4b1e8f", gradeRange);
  addRule("Advanced", "#c9daf8", "#1c4587", gradeRange);
  addRule("General", "#c6ead8", "#0d532e", gradeRange);
  addRule("Penalty", "#f4c7c3", "#7a1a13", gradeRange);

  sheet.setConditionalFormatRules(rules);
}

function doroDetectResponseIndices(headers) {
  const idx = {};
  headers.forEach((header, i) => {
    const h = doroNormalizeCompact(header);
    if (h.includes("이름") || h.includes("성명")) idx.name = i;
    else if (h.includes("기수")) idx.cohort = i;
    else if (h.includes("학교") || h.includes("대학")) idx.school = i;
    else if (h.includes("학과") || h.includes("전공")) idx.major = i;
    else if (h.includes("메일")) idx.email = i;
    else if (h.includes("은행")) idx.bank = i;
    else if (h.includes("계좌")) idx.account = i;
    else if (h.includes("프로젝트") || h.includes("포트폴리오") || h.includes("관련경험")) idx.project = i;
    else if (h.includes("DB적용") || h.includes("적용여부")) idx.sync = i;
    else if (h.includes("주민등록번호상거주지") || h.includes("주소")) idx.address = i;
    else if (h.includes("주민등록번호") || h.includes("주민번호")) idx.rrn = i;
    else if (h.includes("현재거주지") || h.includes("현거주지") || h.includes("거주지")) idx.city = i;
    else if (h.includes("연락처") || h.includes("전화") || h.includes("번호")) idx.phone = i;
  });
  return idx;
}

function doroFindResponseSheet(ss) {
  const exact = ss.getSheetByName(DORO_CFG.SHEET.RESPONSE_NEW_INSTRUCTOR);
  if (exact) return exact;
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i += 1) {
    if (sheets[i].getName().indexOf("응답") >= 0) return sheets[i];
  }
  return null;
}

function GET_MOVABLE_RANGE(school, residence) {
  return doroRegionRangeByCity(String(school || "") + " " + String(residence || ""));
}

function CALCULATE_PRIORITY_SCORE(classPoints, feedbackPoints, contributionPoints, penaltyPoints) {
  const classScore = Number(classPoints) || 0;
  const feedbackScore = Number(feedbackPoints) || 0;
  const contributionScore = Number(contributionPoints) || 0;
  const penaltyScore = Number(penaltyPoints) || 0;
  return Math.max(0, classScore + feedbackScore + contributionScore - penaltyScore);
}

function doroLogDecision(topic, content) {
  const sh = doroGetOrCreateSheet(DORO_CFG.SHEET.DECISION_LOG);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 6).setValues([["timestamp", "topic", "content", "owner", "review_date", "status"]]);
  }
  sh.appendRow([new Date(), topic, content, Session.getActiveUser().getEmail(), "", "open"]);
}

function doroToKoreanDateTime(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}
