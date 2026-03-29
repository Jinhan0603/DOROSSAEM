function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 DORO 통합 관리")
    .addItem("📝 1. 신규 강사 등록 폼 열기", "doroOpenRegistrationForm")
    .addItem("🔄 2. 신규 응답 DB 일괄 적용하기", "doroApplyNewResponsesToDB")
    .addSeparator()
    .addItem("🧹 3. 데이터 일괄 표준화 및 점검", "doroStandardizeAndAudit")
    .addItem("🗂️ 4. 최소 시트 구조 정리", "doroArchiveNonCoreSheets")
    .addItem("🛠️ 5. Phase 2 폼 재정비", "doroRebuildPhase2Forms")
    .addItem("🔗 6. 기존 Phase 2 폼 연결 및 점검", "doroConnectPhase2Forms")
    .addItem("🔐 7. Assignment_Log 프리필 링크 생성", "doroGeneratePhase2PrefillLinks")
    .addItem("📥 8. Phase 2 응답 정규화 및 링크 점검", "doroSyncPhase2Responses")
    .addItem("🧪 9. 테스트 응답 자동 제출 + Master 반영", "doroRunPhase2FormTest")
    .addToUi();
}

function doroOpenRegistrationForm() {
  const url = doroGetRegistrationFormUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert(
      "등록 폼 URL이 없습니다. Config_Rules 시트의 REGISTRATION_FORM_URL 값을 확인하세요."
    );
    return;
  }
  const html = HtmlService.createHtmlOutput(
    '<script>window.open("' + url + '","_blank");google.script.host.close();</script>'
  ).setWidth(250).setHeight(50);
  SpreadsheetApp.getUi().showModalDialog(html, "등록 폼으로 이동합니다...");
}

function doroGetRegistrationFormUrl() {
  const sh = doroGetOrCreateSheet(DORO_CFG.SHEET.CONFIG);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, DORO_CFG.CONFIG_HEADERS.length).setValues([DORO_CFG.CONFIG_HEADERS]);
  }
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    const name = doroNormalize(values[i][1]);
    const val = doroNormalize(values[i][2]);
    if (name === "REGISTRATION_FORM_URL" && val) return val;
  }
  return DORO_CFG.DEFAULT_FORM_URL;
}

function doroApplyNewResponsesToDB() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSh = doroGetOrCreateSheet(DORO_CFG.SHEET.MASTER);
  const sensitiveSh = doroGetOrCreateSheet(DORO_CFG.SHEET.SENSITIVE);
  const activitySh = doroGetOrCreateSheet(DORO_CFG.SHEET.ACTIVITY_LOG);
  const responseSh = doroFindResponseSheet(ss);

  if (!responseSh) {
    SpreadsheetApp.getUi().alert("응답 시트를 찾을 수 없습니다.");
    return;
  }

  doroMigrateToSimplifiedDbStructure(masterSh, sensitiveSh, activitySh);

  const responseValues = responseSh.getDataRange().getValues();
  if (responseValues.length <= 1) {
    SpreadsheetApp.getUi().alert("적용할 신규 응답이 없습니다.");
    return;
  }

  const responseHeaders = responseValues[0];
  const idx = doroDetectResponseIndices(responseHeaders);
  if (typeof idx.sync === "undefined") {
    idx.sync = responseHeaders.length;
    responseSh.getRange(1, idx.sync + 1).setValue("DB 적용 여부");
  }

  const masterValues = masterSh.getDataRange().getValues();
  const masterMap = doroHeaderMap(masterValues[0]);
  const sensitiveValues = sensitiveSh.getDataRange().getValues();
  const sensitiveMap = doroHeaderMap(sensitiveValues[0]);
  const dropdowns = doroGetDropdownRules();

  const usedIds = {};
  const keyToId = {};
  const idToMasterRow = {};
  const idToSensitiveRow = {};

  for (let i = 1; i < masterValues.length; i += 1) {
    const id = doroNormalize(masterValues[i][masterMap["고유ID (instructor_id)"]]);
    const name = doroNormalize(masterValues[i][masterMap["이름"]]);
    if (!id) continue;
    usedIds[id] = true;
    idToMasterRow[id] = i + 1;
    const phone =
      sensitiveValues[i] && typeof sensitiveMap["전화번호"] !== "undefined"
        ? doroNormalize(sensitiveValues[i][sensitiveMap["전화번호"]])
        : "";
    keyToId[doroNamePhoneKey(name, phone)] = id;
  }

  for (let i = 1; i < sensitiveValues.length; i += 1) {
    const id = doroNormalize(sensitiveValues[i][sensitiveMap["고유ID (instructor_id)"]]);
    if (id) idToSensitiveRow[id] = i + 1;
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let r = 1; r < responseValues.length; r += 1) {
    const row = responseValues[r];
    const syncStatus = doroNormalize(row[idx.sync]);
    if (syncStatus === "O") {
      skipped += 1;
      continue;
    }

    const name = doroNormalize(row[idx.name]);
    const phone = doroNormalize(row[idx.phone]);
    if (!name || !phone) {
      skipped += 1;
      continue;
    }

    const key = doroNamePhoneKey(name, phone);
    let instructorId = keyToId[key];
    if (!instructorId) {
      instructorId = doroMakeInstructorId(name + "|" + phone, usedIds);
      keyToId[key] = instructorId;
    }

    const cohort = doroCoerceCohort(row[idx.cohort]);
    const school = doroNormalizeSchoolName(row[idx.school]);
    const major = doroNormalize(row[idx.major]);
    const project = doroNormalize(row[idx.project]);
    const city = doroNormalize(row[idx.city]);
    const address = doroNormalize(row[idx.address]);
    const rrn = doroNormalize(row[idx.rrn]);
    const email = doroNormalize(row[idx.email]).toLowerCase();
    const bank = doroNormalize(row[idx.bank]);
    const account = doroNormalize(row[idx.account]);

    let masterRow = idToMasterRow[instructorId] || 0;
    let sensitiveRow = idToSensitiveRow[instructorId] || 0;
    const targetRow =
      masterRow ||
      sensitiveRow ||
      Math.max(masterSh.getLastRow(), sensitiveSh.getLastRow(), 1) + 1;

    const masterOut = new Array(DORO_CFG.MASTER_HEADERS.length).fill("");
    masterOut[masterMap["고유ID (instructor_id)"]] = instructorId;
    masterOut[masterMap["이름"]] = name;
    masterOut[masterMap["최초 기수"]] = cohort;
    masterOut[masterMap["활동 상태 (Status)"]] = "active";
    masterOut[masterMap["등급 (Tier)"]] = "General";
    masterOut[masterMap["보조강사 배정"]] = "";
    masterOut[masterMap["주강사 배정"]] = "";
    masterOut[masterMap["DLS 주강사 배정"]] = "";
    masterOut[masterMap["운영인력 배정"]] = "";
    masterOut[masterMap["강의 참여 점수"]] = 0;
    masterOut[masterMap["강의 피드백 점수"]] = 0;
    masterOut[masterMap["기여 로그 점수"]] = 0;
    masterOut[masterMap["패널티 점수"]] = 0;
    masterOut[masterMap["최종 점수"]] =
      "=CALCULATE_PRIORITY_SCORE(J" + targetRow + ", K" + targetRow + ", L" + targetRow + ", M" + targetRow + ")";
    masterOut[masterMap["학교"]] = school;
    masterOut[masterMap["학과"]] = major;
    masterOut[masterMap["전공/프로젝트 경험"]] = project;
    masterOut[masterMap["거주지"]] = city;
    masterOut[masterMap["이동 가능 범위"]] =
      "=GET_MOVABLE_RANGE(O" + targetRow + ", R" + targetRow + ")";
    masterOut[masterMap["최근 업데이트"]] = new Date();

    const sensitiveOut = new Array(DORO_CFG.SENSITIVE_HEADERS.length).fill("");
    sensitiveOut[sensitiveMap["고유ID (instructor_id)"]] = instructorId;
    sensitiveOut[sensitiveMap["전화번호"]] = doroFormatPhoneNumber(phone);
    sensitiveOut[sensitiveMap["주민번호"]] = rrn;
    sensitiveOut[sensitiveMap["이메일"]] = email;
    sensitiveOut[sensitiveMap["은행"]] = bank;
    sensitiveOut[sensitiveMap["계좌번호"]] = account;
    sensitiveOut[sensitiveMap["주소"]] = address;

    if (masterRow > 0) {
      masterSh.getRange(masterRow, 1, 1, masterOut.length).setValues([masterOut]);
    } else {
      masterSh.getRange(targetRow, 1, 1, masterOut.length).setValues([masterOut]);
      masterRow = targetRow;
      inserted += 1;
      idToMasterRow[instructorId] = targetRow;
    }

    if (sensitiveRow > 0) {
      sensitiveSh.getRange(sensitiveRow, 1, 1, sensitiveOut.length).setValues([sensitiveOut]);
    } else {
      sensitiveSh.getRange(targetRow, 1, 1, sensitiveOut.length).setValues([sensitiveOut]);
      sensitiveRow = targetRow;
      idToSensitiveRow[instructorId] = targetRow;
    }

    masterSh.getRange(masterRow, 4).setDataValidation(dropdowns.statusRule);
    masterSh.getRange(masterRow, 5).setDataValidation(dropdowns.gradeRule);

    if (masterRow !== targetRow) updated += 1;
    responseSh.getRange(r + 1, idx.sync + 1).setValue("O");
  }

  doroApplyColorCoding(masterSh);

  const msg =
    "신규 응답 적용 완료\n" +
    "- inserted: " + inserted + "\n" +
    "- updated: " + updated + "\n" +
    "- skipped: " + skipped;
  doroLogDecision("신규 응답 DB 일괄 적용", msg);
  SpreadsheetApp.getUi().alert(msg);
}

function doroStandardizeAndAudit() {
  const masterSh = doroGetSheetOrThrow(DORO_CFG.SHEET.MASTER);
  const sensitiveSh = doroGetSheetOrThrow(DORO_CFG.SHEET.SENSITIVE);
  const activitySh = doroGetOrCreateSheet(DORO_CFG.SHEET.ACTIVITY_LOG);
  doroMigrateToSimplifiedDbStructure(masterSh, sensitiveSh, activitySh);
  const masterValues = masterSh.getDataRange().getValues();
  const sensitiveValues = sensitiveSh.getDataRange().getValues();

  if (masterValues.length <= 1) {
    SpreadsheetApp.getUi().alert("Instructor_Master 데이터가 없습니다.");
    return;
  }

  const masterMap = doroHeaderMap(masterValues[0]);
  const sensitiveMap = doroHeaderMap(sensitiveValues[0]);
  const dropdowns = doroGetDropdownRules();
  let fixedDefaults = 0;
  let filledRange = 0;
  let fixedPhone = 0;
  const duplicateKeys = {};
  const duplicates = [];

  if (masterValues.length > 1) {
    masterSh.getRange(2, 4, masterValues.length - 1, 1).setDataValidation(dropdowns.statusRule);
    masterSh.getRange(2, 5, masterValues.length - 1, 1).setDataValidation(dropdowns.gradeRule);
  }

  for (let i = 1; i < masterValues.length; i += 1) {
    const row = masterValues[i];
    if (!doroNormalize(row[masterMap["이름"]]) && !doroNormalize(row[masterMap["최초 기수"]])) continue;

    row[masterMap["이름"]] = doroNormalize(row[masterMap["이름"]]);
    row[masterMap["학교"]] = doroNormalizeSchoolName(row[masterMap["학교"]]);
    row[masterMap["학과"]] = doroNormalize(row[masterMap["학과"]]);
    row[masterMap["최초 기수"]] = doroCoerceCohort(row[masterMap["최초 기수"]]);
    row[masterMap["전공/프로젝트 경험"]] = doroNormalize(row[masterMap["전공/프로젝트 경험"]]);

    const rawCity = doroNormalize(row[masterMap["거주지"]]);
    row[masterMap["거주지"]] = rawCity.replace(/시$/, "").trim() || rawCity;

    if (!doroNormalize(row[masterMap["활동 상태 (Status)"]])) {
      row[masterMap["활동 상태 (Status)"]] = "active";
      fixedDefaults += 1;
    }
    if (!doroNormalize(row[masterMap["등급 (Tier)"]])) {
      row[masterMap["등급 (Tier)"]] = "General";
      fixedDefaults += 1;
    }
    ["강의 참여 점수", "강의 피드백 점수", "기여 로그 점수", "패널티 점수"].forEach(function (header) {
      if (doroNormalize(row[masterMap[header]]) === "") {
        row[masterMap[header]] = 0;
        fixedDefaults += 1;
      }
    });
    row[masterMap["최종 점수"]] =
      "=CALCULATE_PRIORITY_SCORE(J" + (i + 1) + ", K" + (i + 1) + ", L" + (i + 1) + ", M" + (i + 1) + ")";
    if (!doroNormalize(row[masterMap["이동 가능 범위"]])) {
      row[masterMap["이동 가능 범위"]] =
        "=GET_MOVABLE_RANGE(O" + (i + 1) + ", R" + (i + 1) + ")";
      filledRange += 1;
    }
    row[masterMap["최근 업데이트"]] = new Date();
  }
  masterSh.getRange(2, 1, masterValues.length - 1, masterValues[0].length).setValues(masterValues.slice(1));

  if (sensitiveValues.length > 1) {
    for (let i = 1; i < sensitiveValues.length; i += 1) {
      sensitiveValues[i][sensitiveMap["전화번호"]] = doroFormatPhoneNumber(sensitiveValues[i][sensitiveMap["전화번호"]]);
      sensitiveValues[i][sensitiveMap["이메일"]] = doroNormalize(sensitiveValues[i][sensitiveMap["이메일"]]).toLowerCase();
      if (doroNormalize(sensitiveValues[i][sensitiveMap["전화번호"]])) fixedPhone += 1;

      const key = doroNamePhoneKey(
        masterValues[i] ? masterValues[i][masterMap["이름"]] : "",
        sensitiveValues[i][sensitiveMap["전화번호"]]
      );
      if (duplicateKeys[key]) duplicates.push(key);
      duplicateKeys[key] = true;
    }
    sensitiveSh
      .getRange(2, 1, sensitiveValues.length - 1, sensitiveValues[0].length)
      .setValues(sensitiveValues.slice(1));
  }

  doroApplyColorCoding(masterSh);

  const msg =
    "표준화 완료\n" +
    "- default fixes: " + fixedDefaults + "\n" +
    "- movable range filled: " + filledRange + "\n" +
    "- phone normalized: " + fixedPhone + "\n" +
    "- duplicate name+phone keys: " + duplicates.length;
  doroLogDecision("데이터 표준화 및 점검", msg);
  SpreadsheetApp.getUi().alert(msg);
}

function doroMigrateToSimplifiedDbStructure(masterSh, sensitiveSh, activitySh) {
  doroEnsureHeaders(activitySh, DORO_CFG.ACTIVITY_LOG_HEADERS);
  doroMigrateMasterSheet(masterSh);
  doroMigrateSensitiveSheet(sensitiveSh);
}

function doroMigrateMasterSheet(sheet) {
  const values = sheet.getDataRange().getValues();
  const oldHeaders = values.length ? values[0] : [];
  const oldMap = doroHeaderMap(oldHeaders);
  const newMap = doroHeaderMap(DORO_CFG.MASTER_HEADERS);
  const rows = [DORO_CFG.MASTER_HEADERS];

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    const name = doroPickLegacyValue(row, oldMap, ["이름"]);
    const cohort = doroPickLegacyValue(row, oldMap, ["최초 기수", "기수"]);
    if (!doroNormalize(name) && !doroNormalize(cohort)) continue;

    const out = new Array(DORO_CFG.MASTER_HEADERS.length).fill("");
    const oldRubric = doroNumberOrZero(doroPickLegacyValue(row, oldMap, ["승급용 점수 (관찰 루브릭)", "강의 피드백 점수"]));
    const oldCountText = doroPickLegacyValue(row, oldMap, ["누적 강의 횟수 / 누적 강의 시간"]);
    const oldCount = doroParseCountHours(oldCountText).count;
    const classPoints = doroNumberOrZero(doroPickLegacyValue(row, oldMap, ["강의 참여 점수"])) || Math.min(oldCount * 10, 30);
    const feedbackPoints = doroNumberOrZero(doroPickLegacyValue(row, oldMap, ["강의 피드백 점수"])) || (oldRubric ? doroRound(oldRubric * 0.4) : 0);
    const contributionPoints = doroNumberOrZero(doroPickLegacyValue(row, oldMap, ["기여 로그 점수"]));
    const penaltyPoints = doroNumberOrZero(doroPickLegacyValue(row, oldMap, ["패널티 점수"]));

    out[newMap["고유ID (instructor_id)"]] = doroPickLegacyValue(row, oldMap, ["고유ID (instructor_id)"]);
    out[newMap["이름"]] = doroNormalize(name);
    out[newMap["최초 기수"]] = doroCoerceCohort(cohort);
    out[newMap["활동 상태 (Status)"]] = doroNormalizeActivityStatus(doroPickLegacyValue(row, oldMap, ["활동 상태 (Status)"]));
    out[newMap["등급 (Tier)"]] = doroMapLegacyTier(doroPickLegacyValue(row, oldMap, ["등급 (Tier)", "등급 (Grade)"]));
    out[newMap["보조강사 배정"]] = doroNormalizeYN(doroPickLegacyValue(row, oldMap, ["보조강사 배정", "보조강사 자격 (assistant_cert)"]));
    out[newMap["주강사 배정"]] = doroNormalizeYN(doroPickLegacyValue(row, oldMap, ["주강사 배정", "주강사 자격 (lead_cert)"]));
    out[newMap["DLS 주강사 배정"]] = doroNormalizeYN(doroPickLegacyValue(row, oldMap, ["DLS 주강사 배정"]));
    out[newMap["운영인력 배정"]] = doroNormalizeYN(doroPickLegacyValue(row, oldMap, ["운영인력 배정"]));
    out[newMap["강의 참여 점수"]] = classPoints;
    out[newMap["강의 피드백 점수"]] = feedbackPoints;
    out[newMap["기여 로그 점수"]] = contributionPoints;
    out[newMap["패널티 점수"]] = penaltyPoints;
    out[newMap["최종 점수"]] = Math.max(0, classPoints + feedbackPoints + contributionPoints - penaltyPoints);
    out[newMap["학교"]] = doroNormalizeSchoolName(doroPickLegacyValue(row, oldMap, ["학교"]));
    out[newMap["학과"]] = doroNormalize(doroPickLegacyValue(row, oldMap, ["학과"]));
    out[newMap["전공/프로젝트 경험"]] = doroNormalize(doroPickLegacyValue(row, oldMap, ["전공/프로젝트 경험", "프로젝트 경험", "관련 프로젝트 경험"]));
    out[newMap["거주지"]] = doroNormalize(doroPickLegacyValue(row, oldMap, ["거주지"]));
    out[newMap["이동 가능 범위"]] = doroNormalize(doroPickLegacyValue(row, oldMap, ["이동 가능 범위"]));
    out[newMap["최근 업데이트"]] = doroPickLegacyValue(row, oldMap, ["최근 업데이트"]) || new Date();
    rows.push(out);
  }

  if (sheet.getMaxRows() > 0 && sheet.getMaxColumns() > 0) {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  }
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, DORO_CFG.MASTER_HEADERS.length).setValues(rows);
}

function doroMigrateSensitiveSheet(sheet) {
  const values = sheet.getDataRange().getValues();
  const oldHeaders = values.length ? values[0] : [];
  const oldMap = doroHeaderMap(oldHeaders);
  const newMap = doroHeaderMap(DORO_CFG.SENSITIVE_HEADERS);
  const rows = [DORO_CFG.SENSITIVE_HEADERS];

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    const id = doroPickLegacyValue(row, oldMap, ["고유ID (instructor_id)"]);
    const phone = doroPickLegacyValue(row, oldMap, ["전화번호", "번호"]);
    const rrn = doroPickLegacyValue(row, oldMap, ["주민번호"]);
    const email = doroPickLegacyValue(row, oldMap, ["이메일"]);
    if (!doroNormalize(id) && !doroNormalize(phone) && !doroNormalize(email)) continue;

    const out = new Array(DORO_CFG.SENSITIVE_HEADERS.length).fill("");
    out[newMap["고유ID (instructor_id)"]] = id;
    out[newMap["전화번호"]] = doroFormatPhoneNumber(phone);
    out[newMap["주민번호"]] = doroNormalize(rrn);
    out[newMap["이메일"]] = doroNormalize(email).toLowerCase();
    out[newMap["은행"]] = doroNormalize(doroPickLegacyValue(row, oldMap, ["은행"]));
    out[newMap["계좌번호"]] = doroNormalize(doroPickLegacyValue(row, oldMap, ["계좌번호"]));
    out[newMap["주소"]] = doroNormalize(doroPickLegacyValue(row, oldMap, ["주소"]));
    rows.push(out);
  }

  if (sheet.getMaxRows() > 0 && sheet.getMaxColumns() > 0) {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  }
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, DORO_CFG.SENSITIVE_HEADERS.length).setValues(rows);
}

function doroPickLegacyValue(row, map, names) {
  for (let i = 0; i < names.length; i += 1) {
    const index = map[names[i]];
    if (typeof index === "undefined") continue;
    const value = row[index];
    if (doroNormalize(value) !== "") return value;
  }
  return "";
}

function doroMapLegacyTier(raw) {
  const value = doroNormalize(raw);
  if (value === "Master" || value === "Advanced" || value === "General" || value === "Penalty") return value;
  if (value === "M") return "Master";
  if (value === "A") return "Advanced";
  if (value === "G" || value === "N") return "General";
  return "General";
}

function doroNormalizeActivityStatus(raw) {
  const value = doroNormalize(String(raw || "").toLowerCase());
  if (value === "penalty" || value === "restricted" || value === "suspended" || value === "removed") return "penalty";
  if (value === "inactive" || value === "n" || value === "false") return "inactive";
  return "active";
}

function doroNormalizeYN(raw) {
  const value = doroNormalize(String(raw || "").toUpperCase());
  return value === "Y" || value === "YES" || value === "TRUE" ? "Y" : "";
}

function doroArchiveNonCoreSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const formCleanup = doroCleanupObsoleteManagedForms(ss);
  const core = {};
  DORO_CFG.CORE_SHEETS.forEach((name) => {
    core[name] = true;
  });

  const deletable = ss.getSheets().filter((sheet) => {
    const name = sheet.getName();
    if (core[name]) return false;
    return true;
  });

  const deletedNames = [];
  const failedNames = [];
  deletable.forEach((sheet) => {
    try {
      deletedNames.push(sheet.getName());
      ss.deleteSheet(sheet);
    } catch (error) {
      failedNames.push(sheet.getName() + " / " + error.message);
    }
  });

  const msg =
    "불필요 설문/응답 정리 완료\n" +
    "- trashed_forms: " +
    formCleanup.trashedCount +
    "\n- unlinked_forms: " +
    formCleanup.unlinkedCount +
    "\n- deleted_sheets: " +
    deletedNames.length +
    "\n- failed_sheets: " +
    failedNames.length +
    (formCleanup.trashedNames.length ? "\n\n[Trashed forms]\n- " + formCleanup.trashedNames.join("\n- ") : "") +
    (deletedNames.length ? "\n\n[Deleted sheets]\n- " + deletedNames.join("\n- ") : "") +
    (failedNames.length ? "\n\n[Failed sheets]\n- " + failedNames.join("\n- ") : "");
  doroLogDecision("최소 시트 구조 정리", msg);
  SpreadsheetApp.getUi().alert(msg);
}

function doroCleanupObsoleteManagedForms(ss) {
  const keepIds = doroCollectActiveFormIds();
  const spreadsheetId = ss.getId();
  const spreadsheetFile = DriveApp.getFileById(spreadsheetId);
  const parents = spreadsheetFile.getParents();
  const seen = {};
  const trashedNames = [];
  let trashedCount = 0;
  let unlinkedCount = 0;

  while (parents.hasNext()) {
    const folder = parents.next();
    const files = folder.getFilesByType(MimeType.GOOGLE_FORMS);
    while (files.hasNext()) {
      const file = files.next();
      const formId = file.getId();
      const title = file.getName();
      if (seen[formId]) continue;
      seen[formId] = true;

      if (keepIds[formId]) continue;
      if (!doroShouldCleanupManagedForm(title)) continue;

      try {
        const form = FormApp.openById(formId);
        const destinationId = form.getDestinationId();
        if (destinationId && destinationId === spreadsheetId) {
          form.removeDestination();
          unlinkedCount += 1;
        }
      } catch (error) {
      }

      file.setTrashed(true);
      trashedCount += 1;
      trashedNames.push(title);
    }
  }

  return {
    trashedCount: trashedCount,
    unlinkedCount: unlinkedCount,
    trashedNames: trashedNames,
  };
}

function doroCollectActiveFormIds() {
  const keep = {};

  DORO_CFG.PHASE2_FORMS.forEach(function (spec) {
    const configuredId = doroGetConfigValue(doroPhase2RuleName(spec, "FORM_ID"));
    const configuredEditUrl = doroGetConfigValue(doroPhase2RuleName(spec, "FORM_EDIT_URL"));
    const formId = configuredId || doroExtractFileId(configuredEditUrl) || doroExtractFileId(spec.editUrl);
    if (formId) keep[formId] = true;
  });

  const registrationFormId = doroExtractFileId(doroGetRegistrationFormUrl());
  if (registrationFormId) keep[registrationFormId] = true;

  return keep;
}

function doroShouldCleanupManagedForm(title) {
  const name = doroNormalize(title);
  return /^(copy of |사본[- ]*)?(담임\/기관 피드백|DORO 학생 마이크로 피드백|DOROSSAEM 회고|강의 피드백 설문)/i.test(name);
}
