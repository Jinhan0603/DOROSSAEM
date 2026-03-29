function doroRebuildPhase2Forms() {
  const results = DORO_CFG.PHASE2_FORMS.map(function (spec) {
    return doroRebuildSinglePhase2Form(spec);
  });
  const lines = results.map(function (result) {
    return (
      "- " +
      result.title +
      "\n  raw_sheet: " +
      result.rawSheet +
      "\n  items: " +
      result.itemCount +
      "\n  archived_rows: " +
      result.archivedRows
    );
  });
  const msg = "Phase 2 폼 재정비 완료\n\n" + lines.join("\n\n");
  doroLogDecision("Phase 2 폼 재정비", msg);
  SpreadsheetApp.getUi().alert(msg);
}

function doroConnectPhase2Forms() {
  const results = DORO_CFG.PHASE2_FORMS.map(function (spec) {
    return doroConnectSinglePhase2Form(spec);
  });
  const legacy = doroAuditLegacyReflectionForm();
  const lines = results.map(function (result) {
    const parts = [
      "- " + result.title,
      "  raw_sheet: " + result.rawSheet,
      "  canonical_sheet: " + result.canonicalSheet,
      "  missing_before_fix: " + result.missingBeforeFix.length,
      "  missing_after_fix: " + result.missingAfterFix.length,
      "  extra_items: " + result.extraItems.length,
    ];
    if (result.extraItems.length) {
      parts.push("  extra_fields: " + result.extraItems.join(", "));
    }
    return parts.join("\n");
  });

  const legacyLine = legacy.available
    ? "\n\n[Legacy reflection review]\n- extra_candidate_fields: " + legacy.extraItems.join(", ")
    : "";

  const msg = "Phase 2 기존 폼 연결 및 점검 완료\n\n" + lines.join("\n\n") + legacyLine;
  doroLogDecision("Phase 2 기존 폼 연결 및 점검", msg);
  SpreadsheetApp.getUi().alert(msg);
}

function doroRebuildSinglePhase2Form(spec) {
  const form = doroOpenPhase2Form(spec);
  const archivedRows = doroArchiveAndDeleteSheetIfExists(spec.rawSheet);
  const rawSheet = doroReconnectFormToNamedSheet(form, spec.rawSheet);

  form.deleteAllResponses();
  doroClearFormItems(form);
  form.setTitle(spec.title);
  form.setDescription(spec.description || "");
  form.setConfirmationMessage("제출이 완료되었습니다. 감사합니다.");
  doroNormalizeResponderAccess(form);

  spec.fields.forEach(function (field) {
    doroAddFormItem(form, field);
  });

  doroInitializeRawResponseSheet(rawSheet, spec);
  doroGetOrCreateSheet(spec.targetSheet);
  doroEnsureHeaders(doroGetOrCreateSheet(spec.targetSheet), spec.headers);
  doroStorePhase2FormConfig(spec, form, rawSheet);
  doroDeleteOrphanDefaultResponseSheets();

  return {
    title: spec.title,
    rawSheet: rawSheet.getName(),
    itemCount: spec.fields.length,
    archivedRows: archivedRows,
  };
}

function doroConnectSinglePhase2Form(spec) {
  const form = doroOpenPhase2Form(spec);
  const missingBeforeFix = doroAuditFormAgainstSpec(form, spec).missingItems;
  doroNormalizeResponderAccess(form);
  doroEnsurePhase2CoreItems(form, spec);
  const rawSheet = doroAttachFormToCurrentSpreadsheet(form, spec.rawSheet);
  doroStorePhase2FormConfig(spec, form, rawSheet);
  doroGetOrCreateSheet(spec.targetSheet);
  doroEnsureHeaders(doroGetOrCreateSheet(spec.targetSheet), spec.headers);
  const auditAfterFix = doroAuditFormAgainstSpec(form, spec);

  return {
    title: spec.title,
    rawSheet: rawSheet.getName(),
    canonicalSheet: spec.targetSheet,
    missingBeforeFix: missingBeforeFix,
    missingAfterFix: auditAfterFix.missingItems,
    extraItems: auditAfterFix.extraItems,
  };
}

function doroArchiveAndDeleteSheetIfExists(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;

  const archivedRows = doroArchiveRawSheetIfNeeded(sheet);
  ss.deleteSheet(sheet);
  return archivedRows;
}

function doroReconnectFormToNamedSheet(form, rawSheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const before = doroSheetIdMap(ss);

  try {
    const destinationId = typeof form.getDestinationId === "function" ? form.getDestinationId() : "";
    if (destinationId) {
      form.removeDestination();
      SpreadsheetApp.flush();
      Utilities.sleep(800);
    }
  } catch (error) {
  }

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(1500);

  const created = doroFindCreatedSheet(ss, before) || ss.getSheets()[ss.getSheets().length - 1];
  if (created.getName() !== rawSheetName) {
    const existing = ss.getSheetByName(rawSheetName);
    if (existing && existing.getSheetId() !== created.getSheetId()) {
      ss.deleteSheet(existing);
    }
    created.setName(rawSheetName);
  }
  return created;
}

function doroFindCreatedSheet(ss, beforeMap) {
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i += 1) {
    if (!beforeMap[sheets[i].getSheetId()]) return sheets[i];
  }
  return null;
}

function doroNormalizeResponderAccess(form) {
  form.setLimitOneResponsePerUser(false);
  form.setShowLinkToRespondAgain(false);
  form.setProgressBar(false);

  if (typeof form.setCollectEmail === "function") {
    form.setCollectEmail(false);
  }
  if (typeof form.setAcceptingResponses === "function") {
    form.setAcceptingResponses(true);
  }
  if (typeof form.supportsAdvancedResponderPermissions === "function") {
    try {
      if (form.supportsAdvancedResponderPermissions()) {
        form.setPublished(true);
      }
    } catch (error) {
    }
  }
  if (typeof form.setRequireLogin === "function") {
    try {
      form.setRequireLogin(false);
    } catch (error) {
    }
  }
}

function doroOpenPhase2Form(spec) {
  const idRule = doroPhase2RuleName(spec, "FORM_ID");
  const editRule = doroPhase2RuleName(spec, "FORM_EDIT_URL");
  const configuredId = doroGetConfigValue(idRule);
  const configuredEditUrl = doroGetConfigValue(editRule);
  const formId =
    configuredId ||
    doroExtractFileId(configuredEditUrl) ||
    doroExtractFileId(spec.editUrl);

  if (!formId) {
    throw new Error("폼 ID를 찾을 수 없습니다: " + spec.title);
  }
  return FormApp.openById(formId);
}

function doroStorePhase2FormConfig(spec, form, rawSheet) {
  doroUpsertConfigValue("form", doroPhase2RuleName(spec, "FORM_ID"), form.getId());
  doroUpsertConfigValue("form", doroPhase2RuleName(spec, "FORM_URL"), form.getPublishedUrl());
  doroUpsertConfigValue("form", doroPhase2RuleName(spec, "FORM_EDIT_URL"), form.getEditUrl());
  doroUpsertConfigValue("form", doroPhase2RuleName(spec, "RESPONSE_SHEET"), rawSheet.getName());
}

function doroEnsurePhase2CoreItems(form, spec) {
  const itemMap = doroFormQuestionItemMap(form);
  spec.fields.forEach(function (field) {
    if (doroFindMatchingFormItem(itemMap, field)) return;
    doroAddFormItem(form, field);
  });
}

function doroAuditFormAgainstSpec(form, spec) {
  const itemMap = doroFormQuestionItemMap(form);
  const actualTitles = doroFormQuestionTitles(form);
  const missingItems = [];

  spec.fields.forEach(function (field) {
    if (!doroFindMatchingFormItem(itemMap, field)) {
      missingItems.push(field.title || field.name);
    }
  });

  const allowed = {};
  spec.fields.forEach(function (field) {
    doroFieldAliases(field).forEach(function (alias) {
      allowed[doroNormalize(alias)] = true;
    });
  });

  const extraItems = actualTitles.filter(function (title) {
    return !allowed[doroNormalize(title)];
  });

  return {
    missingItems: missingItems,
    extraItems: extraItems,
  };
}

function doroAuditLegacyReflectionForm() {
  const url = DORO_CFG.LEGACY_REFLECTION_FORM_EDIT_URL;
  const formId = doroExtractFileId(url);
  if (!formId) return { available: false, extraItems: [] };

  const form = FormApp.openById(formId);
  const actualTitles = doroFormQuestionTitles(form);
  const currentSpec = doroFindPhase2Spec("reflection_log");
  const allowed = {};
  currentSpec.fields.forEach(function (field) {
    doroFieldAliases(field).forEach(function (alias) {
      allowed[doroNormalize(alias)] = true;
    });
  });
  const extras = actualTitles.filter(function (title) {
    return !allowed[doroNormalize(title)];
  });

  return {
    available: true,
    extraItems: extras,
  };
}

function doroAttachFormToCurrentSpreadsheet(form, rawSheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const existing = ss.getSheetByName(rawSheetName);
  let destinationId = "";
  try {
    destinationId = typeof form.getDestinationId === "function" ? form.getDestinationId() : "";
  } catch (error) {
  }

  if (existing && destinationId === ss.getId()) {
    return existing;
  }

  const configured = doroFindPhase2ConfiguredSheet(form.getId());
  if (configured && destinationId === ss.getId()) {
    return configured;
  }

  return doroReconnectFormToNamedSheet(form, rawSheetName);
}

function doroFindPhase2ConfiguredSheet(formId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (let i = 0; i < DORO_CFG.PHASE2_FORMS.length; i += 1) {
    const spec = DORO_CFG.PHASE2_FORMS[i];
    const configuredId = doroGetConfigValue(doroPhase2RuleName(spec, "FORM_ID"));
    const configuredSheet = doroGetConfigValue(doroPhase2RuleName(spec, "RESPONSE_SHEET"));
    if (configuredId === formId && configuredSheet) {
      return ss.getSheetByName(configuredSheet);
    }
  }
  return null;
}

function doroSheetIdMap(ss) {
  const map = {};
  ss.getSheets().forEach(function (sheet) {
    map[sheet.getSheetId()] = true;
  });
  return map;
}

function doroPhase2RuleName(spec, suffix) {
  return "PHASE2_" + String(spec.key || "").toUpperCase() + "_" + suffix;
}

function doroExtractFileId(url) {
  const match = String(url || "").match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : "";
}

function doroFormQuestionTitles(form) {
  return doroFormQuestionItems(form).map(function (item) {
    return doroNormalize(item.getTitle());
  });
}

function doroFormQuestionItems(form) {
  return form.getItems().filter(function (item) {
    const type = item.getType();
    return (
      type !== FormApp.ItemType.SECTION_HEADER &&
      type !== FormApp.ItemType.PAGE_BREAK &&
      type !== FormApp.ItemType.IMAGE &&
      type !== FormApp.ItemType.VIDEO
    );
  });
}

function doroFormQuestionItemMap(form) {
  const map = {};
  doroFormQuestionItems(form).forEach(function (item) {
    map[doroNormalize(item.getTitle())] = item;
  });
  return map;
}

function doroFindMatchingFormItem(itemMap, field) {
  const aliases = doroFieldAliases(field);
  for (let i = 0; i < aliases.length; i += 1) {
    const item = itemMap[doroNormalize(aliases[i])];
    if (item) return item;
  }
  return null;
}

function doroFieldAliases(field) {
  const aliases = [];
  aliases.push(field.title || field.name);
  aliases.push(field.name);
  (field.aliases || []).forEach(function (alias) {
    aliases.push(alias);
  });
  return aliases.filter(function (alias, index) {
    return alias && aliases.indexOf(alias) === index;
  });
}

function doroAddFormItem(form, field) {
  const title = field.title || field.name;

  if (field.kind === "text") {
    const item = form.addTextItem();
    item.setTitle(title);
    item.setHelpText(field.helpText || "");
    item.setRequired(Boolean(field.required));
    return item;
  }
  if (field.kind === "paragraph") {
    const item = form.addParagraphTextItem();
    item.setTitle(title);
    item.setHelpText(field.helpText || "");
    item.setRequired(Boolean(field.required));
    return item;
  }
  if (field.kind === "scale") {
    const item = form.addScaleItem();
    item.setTitle(title);
    item.setHelpText(field.helpText || "");
    item.setBounds(1, 5);
    item.setLabels(field.scaleLowLabel || "아쉬움", field.scaleHighLabel || "매우 좋음");
    item.setRequired(Boolean(field.required));
    return item;
  }
  if (field.kind === "choice") {
    const item = form.addMultipleChoiceItem();
    item.setTitle(title);
    item.setHelpText(field.helpText || "");
    item.setChoiceValues(field.values || []);
    item.setRequired(Boolean(field.required));
    return item;
  }
  throw new Error("지원하지 않는 field.kind: " + field.kind);
}

function doroClearFormItems(form) {
  const items = form.getItems();
  for (let i = items.length - 1; i >= 0; i -= 1) {
    form.deleteItem(i);
  }
}

function doroArchiveRawSheetIfNeeded(sheet) {
  if (sheet.getLastRow() <= 1) return 0;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const archiveName = "_ARCHIVE_" + sheet.getName() + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  const archive = ss.insertSheet(archiveName);
  const values = sheet.getDataRange().getValues();
  archive.getRange(1, 1, values.length, values[0].length).setValues(values);
  archive.hideSheet();
  return Math.max(values.length - 1, 0);
}

function doroDeleteOrphanDefaultResponseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  for (let i = sheets.length - 1; i >= 0; i -= 1) {
    const sheet = sheets[i];
    if (!/^설문지 응답 시트\d*$/i.test(sheet.getName())) continue;
    try {
      ss.deleteSheet(sheet);
    } catch (error) {
    }
  }
}

function doroInitializeRawResponseSheet(sheet, spec) {
  const headers = ["Timestamp"].concat(spec.fields.map(function (field) {
    return field.title || field.name;
  }));
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  doroEnsurePhase2RawStatusColumns(sheet);
}

function doroSyncPhase2Responses() {
  const auditSheet = doroGetOrCreateSheet(DORO_CFG.SHEET.PHASE2_AUDIT);
  doroEnsureHeaders(auditSheet, DORO_CFG.PHASE2_AUDIT_HEADERS);

  const context = doroBuildPhase2LinkContext();
  const results = DORO_CFG.PHASE2_FORMS.map(function (spec) {
    return doroSyncSinglePhase2Response(spec, context, auditSheet);
  });
  const masterSummary = doroRefreshInstructorMasterFromPhase2();

  const lines = results.map(function (result) {
    return (
      "- " +
      result.title +
      "\n  synced: " +
      result.synced +
      "\n  pending: " +
      result.pending +
      "\n  skipped: " +
      result.skipped +
      "\n  linked: " +
      result.linked +
      "\n  unverified: " +
      result.unverified
    );
  });

  const assignmentState = context.assignmentEnabled
    ? "Assignment_Log validation: enabled"
    : "Assignment_Log validation: unavailable";
  const msg =
    "Phase 2 응답 정규화 및 링크 점검 완료\n" +
    assignmentState +
    "\nMaster refresh: updated=" +
    masterSummary.updated +
    ", graded=" +
    masterSummary.graded +
    "\n\n" +
    lines.join("\n\n");
  doroLogDecision("Phase 2 응답 정규화 및 링크 점검", msg);
  SpreadsheetApp.getUi().alert(msg);
}

function doroGeneratePhase2PrefillLinks() {
  const assignmentSheet = doroGetOrCreateSheet("Assignment_Log");
  const headers = doroEnsureHeadersAppend(assignmentSheet, DORO_CFG.ASSIGNMENT_PHASE2_HEADERS);
  const values = assignmentSheet.getDataRange().getValues();
  const headerMap = doroNormalizedHeaderMap(headers);
  const requestIndex = doroFindHeaderIndex(headerMap, ["request_id"]);
  const sessionIndex = doroFindHeaderIndex(headerMap, ["session_id", "sessionid"]);
  const instructorIndex = doroFindHeaderIndex(headerMap, [
    "instructor_id",
    "instructorid",
    "강사id",
    "고유id(instructor_id)",
    "고유id",
  ]);
  const instructorNameIndex = doroFindHeaderIndex(headerMap, ["instructor_name", "강사명", "이름"]);
  const surveyCodeIndex = doroFindHeaderIndex(headerMap, ["survey_code"]);
  const statusIndex = doroFindHeaderIndex(headerMap, ["phase2_prefill_status"]);
  const noteIndex = doroFindHeaderIndex(headerMap, ["phase2_prefill_note"]);
  const teacherUrlIndex = doroFindHeaderIndex(headerMap, ["teacher_feedback_url"]);
  const studentUrlIndex = doroFindHeaderIndex(headerMap, ["student_feedback_url"]);
  const reflectionUrlIndex = doroFindHeaderIndex(headerMap, ["reflection_url"]);
  const teacherForm = doroOpenPhase2Form(doroFindPhase2Spec("teacher_feedback"));
  const studentForm = doroOpenPhase2Form(doroFindPhase2Spec("student_feedback"));
  const reflectionForm = doroOpenPhase2Form(doroFindPhase2Spec("reflection_log"));

  if (values.length <= 1) {
    SpreadsheetApp.getUi().alert(
      "Assignment_Log에 데이터가 없습니다.\n" +
      "최소한 request_id/session_id 와 instructor_id가 있는 행을 먼저 넣어주세요."
    );
    return;
  }

  let generated = 0;
  let pending = 0;
  let copiedSession = 0;

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    let requestId = doroNormalize(row[requestIndex]);
    const sessionId = sessionIndex >= 0 ? doroNormalize(row[sessionIndex]) : "";
    const instructorId = doroNormalize(row[instructorIndex]);
    const instructorName = instructorNameIndex >= 0 ? doroNormalize(row[instructorNameIndex]) : "";
    let surveyCode = doroNormalize(row[surveyCodeIndex]);

    if (!requestId && sessionId) {
      requestId = sessionId;
      assignmentSheet.getRange(i + 1, requestIndex + 1).setValue(requestId);
      copiedSession += 1;
    }

    if (!requestId || !instructorId) {
      assignmentSheet.getRange(i + 1, statusIndex + 1).setValue("PENDING");
      assignmentSheet
        .getRange(i + 1, noteIndex + 1)
        .setValue("request_id/session_id 와 instructor_id가 모두 필요합니다.");
      pending += 1;
      continue;
    }

    if (!surveyCode) {
      surveyCode = doroGenerateSurveyCode(requestId, instructorId, instructorName);
      assignmentSheet.getRange(i + 1, surveyCodeIndex + 1).setValue(surveyCode);
    }

    assignmentSheet
      .getRange(i + 1, teacherUrlIndex + 1)
      .setValue(doroBuildPrefilledUrl(teacherForm, surveyCode));
    assignmentSheet
      .getRange(i + 1, studentUrlIndex + 1)
      .setValue(doroBuildPrefilledUrl(studentForm, surveyCode));
    assignmentSheet
      .getRange(i + 1, reflectionUrlIndex + 1)
      .setValue(doroBuildPrefilledUrl(reflectionForm, surveyCode));
    assignmentSheet.getRange(i + 1, statusIndex + 1).setValue("READY");
    assignmentSheet.getRange(i + 1, noteIndex + 1).setValue("3개 폼 프리필 링크 생성 완료");
    generated += 1;
  }

  const msg =
    "Assignment_Log 프리필 링크 생성 완료\n" +
    "- generated: " + generated +
    "\n- pending: " + pending +
    "\n- request_id copied from session_id: " + copiedSession;
  doroLogDecision("Assignment_Log 프리필 링크 생성", msg);
  SpreadsheetApp.getUi().alert(msg);
}

function doroSyncSinglePhase2Response(spec, context, auditSheet) {
  const rawSheetName = doroGetConfigValue(doroPhase2RuleName(spec, "RESPONSE_SHEET")) || spec.rawSheet || spec.targetSheet;
  const rawSheet = doroGetSheetOrThrow(rawSheetName);
  const canonicalSheet = doroGetOrCreateSheet(spec.targetSheet);
  doroEnsureHeaders(canonicalSheet, spec.headers);

  const rawMeta = doroEnsurePhase2RawStatusColumns(rawSheet);
  const values = rawSheet.getDataRange().getValues();
  if (values.length <= 1) {
    return { title: spec.title, synced: 0, pending: 0, skipped: 0, linked: 0, unverified: 0 };
  }

  const headerMap = doroNormalizedHeaderMap(values[0]);
  let synced = 0;
  let pending = 0;
  let skipped = 0;
  let linked = 0;
  let unverified = 0;

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    const syncStatus = doroNormalize(row[rawMeta.syncStatusIndex]);
    if (syncStatus === "O") {
      skipped += 1;
      continue;
    }
    if (doroIsEmptyRow(row)) {
      skipped += 1;
      continue;
    }

    const canonical = doroBuildPhase2CanonicalRecord(spec, row, headerMap, context);
    const validation = doroValidatePhase2CanonicalRecord(canonical, context);

    let canonicalRow = "";
    if (validation.recordable) {
      canonicalSheet.appendRow(canonical.values);
      canonicalRow = canonicalSheet.getLastRow();
      rawSheet.getRange(i + 1, rawMeta.syncStatusIndex + 1).setValue("O");
      rawSheet.getRange(i + 1, rawMeta.syncAtIndex + 1).setValue(new Date());
      synced += 1;
      if (validation.linkStatus === "linked") linked += 1;
      else unverified += 1;
    } else {
      rawSheet.getRange(i + 1, rawMeta.syncStatusIndex + 1).setValue("PENDING");
      pending += 1;
    }

    rawSheet.getRange(i + 1, rawMeta.linkStatusIndex + 1).setValue(validation.linkStatus);
    rawSheet.getRange(i + 1, rawMeta.linkNoteIndex + 1).setValue(validation.note);

    auditSheet.appendRow([
      new Date(),
      spec.key,
      rawSheet.getName(),
      i + 1,
      canonicalSheet.getName(),
      canonicalRow,
      canonical.submittedAt,
      canonical.surveyCode,
      canonical.requestId,
      canonical.instructorId,
      validation.recordable ? "synced" : "pending",
      validation.linkStatus,
      validation.note,
    ]);
  }

  return {
    title: spec.title,
    synced: synced,
    pending: pending,
    skipped: skipped,
    linked: linked,
    unverified: unverified,
  };
}

function doroBuildPhase2LinkContext() {
  const instructorIds = {};
  const masterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DORO_CFG.SHEET.MASTER);
  if (masterSheet && masterSheet.getLastRow() > 1) {
    const values = masterSheet.getDataRange().getValues();
    const headerMap = doroHeaderMap(values[0]);
    const idIndex = headerMap["고유ID (instructor_id)"];
    for (let i = 1; i < values.length; i += 1) {
      const instructorId = doroNormalize(values[i][idIndex]);
      if (instructorId) instructorIds[instructorId] = true;
    }
  }

  const assignmentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Assignment_Log");
  const pairMap = {};
  const requestMap = {};
  const surveyCodeMap = {};
  let assignmentEnabled = false;

  if (assignmentSheet && assignmentSheet.getLastRow() > 1) {
    const values = assignmentSheet.getDataRange().getValues();
    const headerMap = doroNormalizedHeaderMap(values[0]);
    const requestIndex = doroFindHeaderIndex(headerMap, [
      "request_id",
      "session_id",
      "sessionid",
      "class_request_id",
      "수업id",
      "배정id",
    ]);
    const sessionIndex = doroFindHeaderIndex(headerMap, ["session_id", "sessionid"]);
    const instructorIndex = doroFindHeaderIndex(headerMap, [
      "instructor_id",
      "instructorid",
      "강사id",
      "고유id(instructor_id)",
      "고유id",
    ]);
    const surveyCodeIndex = doroFindHeaderIndex(headerMap, ["survey_code"]);

    if (requestIndex >= 0 && instructorIndex >= 0) {
      assignmentEnabled = true;
      for (let i = 1; i < values.length; i += 1) {
        let requestId = doroNormalize(values[i][requestIndex]);
        const sessionId = sessionIndex >= 0 ? doroNormalize(values[i][sessionIndex]) : "";
        const instructorId = doroNormalize(values[i][instructorIndex]);
        const surveyCode = surveyCodeIndex >= 0 ? doroNormalize(values[i][surveyCodeIndex]) : "";
        if (!requestId && sessionId) requestId = sessionId;
        if (!requestId || !instructorId) continue;
        requestMap[requestId] = true;
        pairMap[requestId + "|" + instructorId] = true;
        if (surveyCode) {
          surveyCodeMap[surveyCode] = {
            requestId: requestId,
            instructorId: instructorId,
          };
        }
      }
    }
  }

  return {
    instructorIds: instructorIds,
    assignmentEnabled: assignmentEnabled,
    requestMap: requestMap,
    pairMap: pairMap,
    surveyCodeMap: surveyCodeMap,
  };
}

function doroBuildPhase2CanonicalRecord(spec, row, headerMap, context) {
  const submittedAt = doroPickFirstHeaderValue(row, headerMap, ["submitted_at", "timestamp", "타임스탬프"]);
  const surveyField = doroFindPhase2FieldSpec(spec, "survey_code");
  const surveyCode = surveyField
    ? doroPickFirstHeaderValue(row, headerMap, doroFieldAliases(surveyField))
    : "";
  const resolved = context.surveyCodeMap[doroNormalize(surveyCode)] || {};

  const requestField = doroFindPhase2FieldSpec(spec, "request_id");
  const instructorField = doroFindPhase2FieldSpec(spec, "instructor_id");
  const requestId = doroPickFirstHeaderValue(
    row,
    headerMap,
    requestField ? doroFieldAliases(requestField) : ["request_id"]
  ) || resolved.requestId || "";
  const instructorId = doroPickFirstHeaderValue(
    row,
    headerMap,
    instructorField ? doroFieldAliases(instructorField) : ["instructor_id"]
  ) || resolved.instructorId || "";

  const values = spec.headers.map(function (header) {
    if (header === "submitted_at") return submittedAt;
    if (header === "survey_code") return surveyCode;
    if (header === "request_id") return requestId;
    if (header === "instructor_id") return instructorId;

    const field = doroFindPhase2FieldSpec(spec, header);
    const aliases = field ? doroFieldAliases(field) : [header];
    return doroPickFirstHeaderValue(row, headerMap, aliases);
  });

  return {
    values: values,
    submittedAt: doroNormalize(submittedAt),
    surveyCode: doroNormalize(surveyCode),
    requestId: doroNormalize(requestId),
    instructorId: doroNormalize(instructorId),
  };
}

function doroBuildPrefilledUrl(form, surveyCode) {
  const response = form.createResponse();
  const itemMap = doroFormQuestionItemMap(form);
  const surveyItem =
    itemMap[doroNormalize("DORO 수업 코드를 입력해 주세요")] ||
    itemMap[doroNormalize("DORO 설문 코드를 입력해 주세요")] ||
    itemMap[doroNormalize("DORO 회고 코드를 입력해 주세요")] ||
    itemMap[doroNormalize("survey_code")];

  if (!surveyItem) {
    throw new Error("폼에 survey_code 항목이 없습니다: " + form.getTitle());
  }

  doroApplyPrefillItemResponse(response, surveyItem, surveyCode);
  return response.toPrefilledUrl();
}

function doroValidatePhase2CanonicalRecord(record, context) {
  if (!record.surveyCode && !record.requestId && !record.instructorId) {
    return {
      recordable: false,
      linkStatus: "missing_keys",
      note: "survey_code, request_id, instructor_id가 모두 비어 있습니다.",
    };
  }
  if (!record.requestId) {
    return {
      recordable: false,
      linkStatus: "missing_request_id",
      note: "request_id를 확인할 수 없습니다.",
    };
  }
  if (!record.instructorId) {
    return {
      recordable: false,
      linkStatus: "missing_instructor_id",
      note: "instructor_id를 확인할 수 없습니다.",
    };
  }
  if (!context.instructorIds[record.instructorId]) {
    return {
      recordable: false,
      linkStatus: "unknown_instructor",
      note: "Instructor_Master에 없는 instructor_id입니다.",
    };
  }
  if (!context.assignmentEnabled) {
    return {
      recordable: true,
      linkStatus: "assignment_unverified",
      note: "Assignment_Log 검증이 아직 불가한 상태입니다.",
    };
  }
  if (context.pairMap[record.requestId + "|" + record.instructorId]) {
    return {
      recordable: true,
      linkStatus: "linked",
      note: "Assignment_Log 기준 연결 확인",
    };
  }
  if (context.requestMap[record.requestId]) {
    return {
      recordable: true,
      linkStatus: "instructor_mismatch",
      note: "request_id는 있으나 instructor_id 조합이 다릅니다.",
    };
  }
  return {
    recordable: true,
    linkStatus: "request_not_found",
    note: "Assignment_Log에 없는 request_id입니다.",
  };
}

function doroEnsurePhase2RawStatusColumns(sheet) {
  const headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  let lastCol = headerRow.length;
  const headerMap = doroNormalizedHeaderMap(headerRow);

  DORO_CFG.PHASE2_RAW_STATUS_HEADERS.forEach(function (header) {
    const key = doroNormalizeHeaderKey(header);
    if (typeof headerMap[key] === "undefined") {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue(header);
    }
  });

  const refreshed = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const refreshedMap = doroNormalizedHeaderMap(refreshed);
  return {
    syncStatusIndex: refreshedMap[doroNormalizeHeaderKey("DORO_SYNC_STATUS")],
    syncAtIndex: refreshedMap[doroNormalizeHeaderKey("DORO_SYNC_AT")],
    linkStatusIndex: refreshedMap[doroNormalizeHeaderKey("DORO_LINK_STATUS")],
    linkNoteIndex: refreshedMap[doroNormalizeHeaderKey("DORO_LINK_NOTE")],
  };
}

function doroPickFirstHeaderValue(row, headerMap, aliases) {
  for (let i = 0; i < aliases.length; i += 1) {
    const key = doroNormalizeHeaderKey(aliases[i]);
    if (typeof headerMap[key] === "undefined") continue;
    const value = row[headerMap[key]];
    if (doroNormalize(value)) return value;
  }
  return "";
}

function doroFindPhase2FieldSpec(spec, fieldName) {
  for (let i = 0; i < spec.fields.length; i += 1) {
    if (spec.fields[i].name === fieldName) return spec.fields[i];
  }
  return null;
}

function doroFindPhase2Spec(key) {
  for (let i = 0; i < DORO_CFG.PHASE2_FORMS.length; i += 1) {
    if (DORO_CFG.PHASE2_FORMS[i].key === key) return DORO_CFG.PHASE2_FORMS[i];
  }
  throw new Error("Phase2 form spec not found: " + key);
}

function doroNormalizedHeaderMap(headers) {
  const map = {};
  headers.forEach(function (header, index) {
    map[doroNormalizeHeaderKey(header)] = index;
  });
  return map;
}

function doroNormalizeHeaderKey(header) {
  return doroNormalizeCompact(header).toLowerCase();
}

function doroFindHeaderIndex(headerMap, candidates) {
  for (let i = 0; i < candidates.length; i += 1) {
    const key = doroNormalizeHeaderKey(candidates[i]);
    if (typeof headerMap[key] !== "undefined") return headerMap[key];
  }
  return -1;
}

function doroIsEmptyRow(row) {
  for (let i = 0; i < row.length; i += 1) {
    if (doroNormalize(row[i])) return false;
  }
  return true;
}

function doroApplyPrefillItemResponse(formResponse, item, value) {
  const type = item.getType();
  if (type === FormApp.ItemType.TEXT) {
    formResponse.withItemResponse(item.asTextItem().createResponse(String(value)));
    return;
  }
  if (type === FormApp.ItemType.PARAGRAPH_TEXT) {
    formResponse.withItemResponse(item.asParagraphTextItem().createResponse(String(value)));
    return;
  }
  throw new Error("프리필 지원 불가 항목 타입: " + type);
}

function doroGenerateSurveyCode(requestId, instructorId, instructorName) {
  const requestPart = doroNormalizeCompact(requestId).replace(/[^0-9A-Za-z]/g, "").slice(-10) || "REQ";
  const instructorPart = doroNormalizeCompact(instructorId).replace(/[^0-9A-Za-z]/g, "") || "INST";
  const namePart = doroNormalizeCompact(instructorName).replace(/[^0-9A-Za-z가-힣]/g, "").slice(0, 6);
  return ["DORO", namePart || instructorPart, instructorPart, requestPart].join("-");
}

function doroRunPhase2FormTest() {
  const context = doroPreparePhase2TestAssignment();
  doroSubmitSampleFormResponse("teacher_feedback", {
    survey_code: context.surveyCode,
    arrival_on_time: 5,
    preparedness: 4,
    level_fit: 4,
    student_engagement: 5,
    safety_management: 5,
    reassign_intent: "네",
    comment: "테스트 응답: 운영 기준 확인용",
  });
  doroSubmitSampleFormResponse("student_feedback", {
    survey_code: context.surveyCode,
    overall_score: 5,
  });
  doroSubmitSampleFormResponse("reflection_log", {
    survey_code: context.surveyCode,
    session_summary: "학생 반응이 좋았고 진행 흐름도 안정적이었습니다.",
    what_went_well: "도입 설명이 짧고 명확해서 학생들이 빠르게 집중했습니다.",
    challenge: "중간에 한 학생의 집중력이 떨어져 흐름 관리가 필요했습니다.",
    next_improvement: "실습 전 질문 하나를 더 넣어 참여를 빨리 끌어올리겠습니다.",
    self_satisfaction: 4,
    issue_flag: "아니요",
    support_flag: "아니요",
    support_needed: "",
    comment: "테스트 응답: 회고 폼 자동 제출 확인용",
  });

  doroWaitForPhase2RawResponses(context.surveyCode);
  doroSyncPhase2ResponsesSilently();
  const masterSummary = doroRefreshInstructorMasterFromPhase2();

  const msg =
    "테스트 응답 자동 제출 및 Master 갱신 완료\n" +
    "- request_id: " + context.requestId +
    "\n- instructor_id: " + context.instructorId +
    "\n- survey_code: " + context.surveyCode +
    "\n- updated_instructors: " + masterSummary.updated +
    "\n- graded_instructors: " + masterSummary.graded;
  doroLogDecision("테스트 응답 자동 제출 및 Master 갱신", msg);
  SpreadsheetApp.getUi().alert(msg);
}

function doroWaitForPhase2RawResponses(surveyCode) {
  const expectedSheets = DORO_CFG.PHASE2_FORMS.map(function (spec) {
    return spec.rawSheet;
  });
  const start = new Date().getTime();
  const timeoutMs = 20000;

  while (new Date().getTime() - start < timeoutMs) {
    const ready = expectedSheets.every(function (sheetName) {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return false;
      const values = sheet.getDataRange().getValues();
      const headerMap = doroHeaderMap(values[0]);
      const surveyIndex = doroFindHeaderIndex(headerMap, [
        "DORO 수업 코드를 입력해 주세요",
        "DORO 설문 코드를 입력해 주세요",
        "DORO 회고 코드를 입력해 주세요",
        "survey_code",
      ]);
      if (surveyIndex < 0) return false;

      for (let i = 1; i < values.length; i += 1) {
        if (doroNormalize(values[i][surveyIndex]) === doroNormalize(surveyCode)) {
          return true;
        }
      }
      return false;
    });

    if (ready) return true;
    Utilities.sleep(1500);
  }

  return false;
}

function doroPreparePhase2TestAssignment() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = doroGetSheetOrThrow(DORO_CFG.SHEET.MASTER);
  const masterValues = masterSheet.getDataRange().getValues();
  const masterMap = doroHeaderMap(masterValues[0]);

  let instructorId = "";
  let instructorName = "";
  for (let i = 1; i < masterValues.length; i += 1) {
    const status = doroNormalize(masterValues[i][masterMap["활동 상태 (Status)"]]);
    if (status && status !== "active") continue;
    instructorId = doroNormalize(masterValues[i][masterMap["고유ID (instructor_id)"]]);
    instructorName = doroNormalize(masterValues[i][masterMap["이름"]]);
    if (instructorId) break;
  }
  if (!instructorId) {
    throw new Error("테스트에 사용할 active instructor가 없습니다.");
  }

  const assignmentSheet = doroGetOrCreateSheet("Assignment_Log");
  const headers = doroEnsureHeadersAppend(assignmentSheet, DORO_CFG.ASSIGNMENT_PHASE2_HEADERS);
  const values = assignmentSheet.getDataRange().getValues();
  const headerMap = doroNormalizedHeaderMap(headers);
  const requestIndex = doroFindHeaderIndex(headerMap, ["request_id"]);
  const sessionIndex = doroFindHeaderIndex(headerMap, ["session_id"]);
  const courseIndex = doroFindHeaderIndex(headerMap, ["course_id"]);
  const instructorIndex = doroFindHeaderIndex(headerMap, ["instructor_id"]);
  const instructorNameIndex = doroFindHeaderIndex(headerMap, ["instructor_name"]);
  const surveyCodeIndex = doroFindHeaderIndex(headerMap, ["survey_code"]);

  const requestId = "TEST-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  const sessionId = requestId;
  const surveyCode = doroGenerateSurveyCode(requestId, instructorId, instructorName);

  assignmentSheet.appendRow([
    requestId,
    sessionId,
    "TEST-COURSE",
    instructorId,
    instructorName,
    surveyCode,
    "",
    "",
    "",
    "",
    "",
  ]);

  doroGeneratePhase2PrefillLinksSilently();

  return {
    requestId: requestId,
    sessionId: sessionId,
    instructorId: instructorId,
    instructorName: instructorName,
    surveyCode: surveyCode,
  };
}

function doroSubmitSampleFormResponse(formKey, answers) {
  const spec = doroFindPhase2Spec(formKey);
  const form = doroOpenPhase2Form(spec);
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (typeof form.setAcceptingResponses === "function") {
        form.setAcceptingResponses(true);
      }

      const response = form.createResponse();
      const itemMap = doroFormQuestionItemMap(form);

      spec.fields.forEach(function (field) {
        const value = answers[field.name];
        if (typeof value === "undefined" || value === null || value === "") return;
        const item = doroFindMatchingFormItem(itemMap, field);
        if (!item) {
          throw new Error("폼 항목을 찾을 수 없습니다: " + (field.title || field.name));
        }
        response.withItemResponse(doroCreateItemResponse(item, value));
      });

      doroSubmitPrefilledResponseUrl(response.toPrefilledUrl());
      Utilities.sleep(500);
      return;
    } catch (error) {
      lastError = error;
      Utilities.sleep(1000 * attempt);
    }
  }

  throw new Error(
    "테스트 응답 제출 실패: " +
    form.getTitle() +
    (lastError && lastError.message ? " / " + lastError.message : "")
  );
}

function doroSubmitPrefilledResponseUrl(prefilledUrl) {
  const url = String(prefilledUrl || "");
  if (!url) throw new Error("프리필 URL이 비어 있습니다.");

  const parts = url.split("?");
  const submitUrl = parts[0].replace("/viewform", "/formResponse");
  const query = parts.length > 1 ? parts.slice(1).join("?") : "";
  const payload = {};

  query.split("&").forEach(function (pair) {
    if (!pair) return;
    const idx = pair.indexOf("=");
    const rawKey = idx >= 0 ? pair.slice(0, idx) : pair;
    const rawValue = idx >= 0 ? pair.slice(idx + 1) : "";
    const key = decodeURIComponent(rawKey || "");
    const value = decodeURIComponent(String(rawValue || "").replace(/\+/g, " "));
    if (!key || key === "usp") return;
    payload[key] = value;
  });

  payload.fvv = payload.fvv || "1";
  payload.pageHistory = payload.pageHistory || "0";
  payload.submit = payload.submit || "Submit";

  const response = UrlFetchApp.fetch(submitUrl, {
    method: "post",
    payload: payload,
    followRedirects: false,
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();

  if (code >= 200 && code < 400) return;

  throw new Error(
    "formResponse HTTP " +
    code +
    " / " +
    doroNormalize(response.getContentText()).slice(0, 200)
  );
}

function doroCreateItemResponse(item, value) {
  const type = item.getType();
  if (type === FormApp.ItemType.TEXT) {
    return item.asTextItem().createResponse(String(value));
  }
  if (type === FormApp.ItemType.PARAGRAPH_TEXT) {
    return item.asParagraphTextItem().createResponse(String(value));
  }
  if (type === FormApp.ItemType.SCALE) {
    return item.asScaleItem().createResponse(Number(value));
  }
  if (type === FormApp.ItemType.MULTIPLE_CHOICE) {
    return item.asMultipleChoiceItem().createResponse(String(value));
  }
  throw new Error("응답 생성 미지원 항목 타입: " + type);
}

function doroSyncPhase2ResponsesSilently() {
  const auditSheet = doroGetOrCreateSheet(DORO_CFG.SHEET.PHASE2_AUDIT);
  doroEnsureHeaders(auditSheet, DORO_CFG.PHASE2_AUDIT_HEADERS);
  const context = doroBuildPhase2LinkContext();
  return DORO_CFG.PHASE2_FORMS.map(function (spec) {
    return doroSyncSinglePhase2Response(spec, context, auditSheet);
  });
}

function doroGeneratePhase2PrefillLinksSilently() {
  const assignmentSheet = doroGetOrCreateSheet("Assignment_Log");
  const headers = doroEnsureHeadersAppend(assignmentSheet, DORO_CFG.ASSIGNMENT_PHASE2_HEADERS);
  const values = assignmentSheet.getDataRange().getValues();
  const headerMap = doroNormalizedHeaderMap(headers);
  const requestIndex = doroFindHeaderIndex(headerMap, ["request_id"]);
  const sessionIndex = doroFindHeaderIndex(headerMap, ["session_id", "sessionid"]);
  const instructorIndex = doroFindHeaderIndex(headerMap, ["instructor_id", "instructorid", "고유id(instructor_id)"]);
  const instructorNameIndex = doroFindHeaderIndex(headerMap, ["instructor_name", "이름"]);
  const surveyCodeIndex = doroFindHeaderIndex(headerMap, ["survey_code"]);
  const teacherUrlIndex = doroFindHeaderIndex(headerMap, ["teacher_feedback_url"]);
  const studentUrlIndex = doroFindHeaderIndex(headerMap, ["student_feedback_url"]);
  const reflectionUrlIndex = doroFindHeaderIndex(headerMap, ["reflection_url"]);
  const statusIndex = doroFindHeaderIndex(headerMap, ["phase2_prefill_status"]);
  const noteIndex = doroFindHeaderIndex(headerMap, ["phase2_prefill_note"]);
  const teacherForm = doroOpenPhase2Form(doroFindPhase2Spec("teacher_feedback"));
  const studentForm = doroOpenPhase2Form(doroFindPhase2Spec("student_feedback"));
  const reflectionForm = doroOpenPhase2Form(doroFindPhase2Spec("reflection_log"));

  for (let i = 1; i < values.length; i += 1) {
    let requestId = doroNormalize(values[i][requestIndex]);
    const sessionId = sessionIndex >= 0 ? doroNormalize(values[i][sessionIndex]) : "";
    const instructorId = doroNormalize(values[i][instructorIndex]);
    const instructorName = instructorNameIndex >= 0 ? doroNormalize(values[i][instructorNameIndex]) : "";
    let surveyCode = doroNormalize(values[i][surveyCodeIndex]);

    if (!requestId && sessionId) requestId = sessionId;
    if (!requestId || !instructorId) continue;
    if (!surveyCode) {
      surveyCode = doroGenerateSurveyCode(requestId, instructorId, instructorName);
      assignmentSheet.getRange(i + 1, surveyCodeIndex + 1).setValue(surveyCode);
    }
    assignmentSheet.getRange(i + 1, teacherUrlIndex + 1).setValue(doroBuildPrefilledUrl(teacherForm, surveyCode));
    assignmentSheet.getRange(i + 1, studentUrlIndex + 1).setValue(doroBuildPrefilledUrl(studentForm, surveyCode));
    assignmentSheet.getRange(i + 1, reflectionUrlIndex + 1).setValue(doroBuildPrefilledUrl(reflectionForm, surveyCode));
    assignmentSheet.getRange(i + 1, statusIndex + 1).setValue("READY");
    assignmentSheet.getRange(i + 1, noteIndex + 1).setValue("자동 생성");
  }
}

function doroRefreshInstructorMasterFromPhase2() {
  const masterSheet = doroGetSheetOrThrow(DORO_CFG.SHEET.MASTER);
  const masterValues = masterSheet.getDataRange().getValues();
  if (masterValues.length <= 1) return { updated: 0, graded: 0 };

  const masterMap = doroHeaderMap(masterValues[0]);
  const metrics = doroCollectPhase2MasterMetrics();
  const activityMetrics = doroCollectActivityLogMetrics();
  const candidates = [];
  let updated = 0;

  for (let i = 1; i < masterValues.length; i += 1) {
    const row = masterValues[i];
    const instructorId = doroNormalize(row[masterMap["고유ID (instructor_id)"]]);
    if (!instructorId) continue;

    const metric = metrics[instructorId] || doroEmptyInstructorMetric();
    const activity = activityMetrics[instructorId] || doroEmptyActivityMetric();
    const rubric = doroRound(doroCalculateInstructorRubric(metric));
    const uniqueClasses = Object.keys(metric.requestMap).length;
    const status = doroNormalize(row[masterMap["활동 상태 (Status)"]]) || "active";
    const classPoints = doroRound(Math.max(activity.classPoints, Math.min(uniqueClasses * 10, 30)));
    const feedbackPoints = doroRound(rubric ? rubric * 0.4 : 0);
    const contributionPoints = doroRound(Math.min(activity.contributionPoints, 30));
    const penaltyPoints = doroRound(activity.penaltyPoints + metric.issueCount * 5);
    const totalScore = doroRound(Math.max(0, classPoints + feedbackPoints + contributionPoints - penaltyPoints));
    const roles = doroDecideRoleFlags(status, uniqueClasses, feedbackPoints, contributionPoints, penaltyPoints, totalScore);

    row[masterMap["보조강사 배정"]] = roles.assistant;
    row[masterMap["주강사 배정"]] = roles.lead;
    row[masterMap["DLS 주강사 배정"]] = roles.dlsLead;
    row[masterMap["운영인력 배정"]] = roles.ops;
    row[masterMap["강의 참여 점수"]] = classPoints;
    row[masterMap["강의 피드백 점수"]] = feedbackPoints;
    row[masterMap["기여 로그 점수"]] = contributionPoints;
    row[masterMap["패널티 점수"]] = penaltyPoints;
    row[masterMap["최종 점수"]] = totalScore;
    row[masterMap["최근 업데이트"]] = new Date();

    candidates.push({
      rowIndex: i,
      totalScore: totalScore,
      eligibleForMaster: roles.ops === "Y" && totalScore >= 85 && penaltyPoints < 20 && status === "active",
    });
    updated += 1;
  }

  const masterRows = doroPickMasterRows(candidates);
  let graded = 0;

  for (let i = 1; i < masterValues.length; i += 1) {
    const row = masterValues[i];
    const status = doroNormalize(row[masterMap["활동 상태 (Status)"]]) || "active";
    const totalScore = doroNumberOrZero(row[masterMap["최종 점수"]]);
    const rowIndex = i;
    const isMaster = masterRows[rowIndex] === true;
    row[masterMap["등급 (Tier)"]] = doroDecideTier(status, totalScore, isMaster);
    if (totalScore > 0) graded += 1;
  }

  masterSheet.getRange(2, 1, masterValues.length - 1, masterValues[0].length).setValues(masterValues.slice(1));
  doroApplyColorCoding(masterSheet);
  return { updated: updated, graded: graded };
}

function doroCollectPhase2MasterMetrics() {
  const metrics = {};

  function ensureMetric(instructorId) {
    if (!metrics[instructorId]) metrics[instructorId] = doroEmptyInstructorMetric();
    return metrics[instructorId];
  }

  const teacherSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Teacher_Feedback");
  if (teacherSheet && teacherSheet.getLastRow() > 1) {
    const values = teacherSheet.getDataRange().getValues();
    const map = doroHeaderMap(values[0]);
    for (let i = 1; i < values.length; i += 1) {
      const instructorId = doroNormalize(values[i][map["instructor_id"]]);
      const requestId = doroNormalize(values[i][map["request_id"]]);
      if (!instructorId) continue;
      const metric = ensureMetric(instructorId);
      metric.requestMap[requestId] = true;
      metric.teacherScores.push(
        doroRound(
          (
            doroNumberOrZero(values[i][map["arrival_on_time"]]) +
            doroNumberOrZero(values[i][map["preparedness"]]) +
            doroNumberOrZero(values[i][map["level_fit"]]) +
            doroNumberOrZero(values[i][map["student_engagement"]]) +
            doroNumberOrZero(values[i][map["safety_management"]])
          ) / 5 * 20
        )
      );
      if (doroNormalize(values[i][map["reassign_intent"]]) === "네") {
        metric.teacherScores.push(100);
      }
    }
  }

  const studentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Student_Feedback");
  if (studentSheet && studentSheet.getLastRow() > 1) {
    const values = studentSheet.getDataRange().getValues();
    const map = doroHeaderMap(values[0]);
    for (let i = 1; i < values.length; i += 1) {
      const instructorId = doroNormalize(values[i][map["instructor_id"]]);
      const requestId = doroNormalize(values[i][map["request_id"]]);
      if (!instructorId) continue;
      const metric = ensureMetric(instructorId);
      metric.requestMap[requestId] = true;
      metric.studentScores.push(doroNumberOrZero(values[i][map["overall_score"]]) * 20);
    }
  }

  const reflectionSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Reflection_Log");
  if (reflectionSheet && reflectionSheet.getLastRow() > 1) {
    const values = reflectionSheet.getDataRange().getValues();
    const map = doroHeaderMap(values[0]);
    for (let i = 1; i < values.length; i += 1) {
      const instructorId = doroNormalize(values[i][map["instructor_id"]]);
      const requestId = doroNormalize(values[i][map["request_id"]]);
      if (!instructorId) continue;
      const metric = ensureMetric(instructorId);
      metric.requestMap[requestId] = true;
      const selfScore = doroNumberOrZero(values[i][map["self_satisfaction"]]) * 20;
      if (selfScore) metric.reflectionScores.push(selfScore);
      else metric.reflectionScores.push(80);
      if (doroNormalize(values[i][map["issue_flag"]]) === "네") metric.issueCount += 1;
    }
  }

  return metrics;
}

function doroEmptyInstructorMetric() {
  return {
    requestMap: {},
    teacherScores: [],
    studentScores: [],
    reflectionScores: [],
    issueCount: 0,
  };
}

function doroCollectActivityLogMetrics() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DORO_CFG.SHEET.ACTIVITY_LOG);
  const metrics = {};
  if (!sheet || sheet.getLastRow() <= 1) return metrics;

  const values = sheet.getDataRange().getValues();
  const map = doroHeaderMap(values[0]);
  for (let i = 1; i < values.length; i += 1) {
    const instructorId = doroNormalize(values[i][map["instructor_id"]]);
    if (!instructorId) continue;
    if (!metrics[instructorId]) metrics[instructorId] = doroEmptyActivityMetric();

    const metric = metrics[instructorId];
    const category = doroNormalize(String(values[i][map["category"]] || "").toLowerCase());
    const role = doroNormalize(String(values[i][map["role"]] || "").toLowerCase());
    const points = doroNumberOrZero(values[i][map["points"]]);
    const penaltyPoints = doroNumberOrZero(values[i][map["penalty_points"]]);

    if (category === "class") metric.classPoints += points;
    else if (category === "penalty") metric.penaltyPoints += penaltyPoints || Math.abs(points);
    else metric.contributionPoints += points;

    if (role === "assistant") metric.assistantCount += 1;
    if (role === "lead") metric.leadCount += 1;
    if (role === "dls_lead") metric.dlsLeadCount += 1;
    if (role === "ops") metric.opsCount += 1;
  }

  return metrics;
}

function doroEmptyActivityMetric() {
  return {
    classPoints: 0,
    contributionPoints: 0,
    penaltyPoints: 0,
    assistantCount: 0,
    leadCount: 0,
    dlsLeadCount: 0,
    opsCount: 0,
  };
}

function doroCalculateInstructorRubric(metric) {
  const teacherMean = doroAverageNumbers(metric.teacherScores);
  const studentMean = doroAverageNumbers(metric.studentScores);
  const reflectionMean = doroAverageNumbers(metric.reflectionScores);

  const parts = [];
  if (teacherMean) parts.push({ score: teacherMean, weight: 0.55 });
  if (studentMean) parts.push({ score: studentMean, weight: 0.25 });
  if (reflectionMean) parts.push({ score: reflectionMean, weight: 0.20 });
  if (!parts.length) return 0;

  let totalWeight = 0;
  let weighted = 0;
  parts.forEach(function (part) {
    totalWeight += part.weight;
    weighted += part.score * part.weight;
  });

  let result = weighted / totalWeight;
  if (metric.issueCount > 0) result -= Math.min(metric.issueCount * 5, 15);
  return Math.max(0, Math.min(100, result));
}

function doroAverageNumbers(values) {
  const filtered = values.filter(function (value) {
    return Number(value) > 0;
  });
  if (!filtered.length) return 0;
  const sum = filtered.reduce(function (acc, value) {
    return acc + Number(value);
  }, 0);
  return sum / filtered.length;
}

function doroRound(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function doroNumberOrZero(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function doroDecideRoleFlags(status, uniqueClasses, feedbackPoints, contributionPoints, penaltyPoints, totalScore) {
  if (status !== "active" || penaltyPoints >= 20) {
    return { assistant: "", lead: "", dlsLead: "", ops: "" };
  }

  const assistant = uniqueClasses >= 1 || totalScore >= 10 ? "Y" : "";
  const lead = uniqueClasses >= 3 && feedbackPoints >= 28 && totalScore >= 65 ? "Y" : "";
  const dlsLead = uniqueClasses >= 5 && feedbackPoints >= 32 && totalScore >= 75 ? "Y" : "";
  const ops = dlsLead === "Y" && contributionPoints >= 8 && totalScore >= 85 ? "Y" : "";

  return {
    assistant: assistant,
    lead: lead,
    dlsLead: dlsLead,
    ops: ops,
  };
}

function doroPickMasterRows(candidates) {
  const eligible = candidates
    .filter(function (item) {
      return item.eligibleForMaster;
    })
    .sort(function (a, b) {
      return b.totalScore - a.totalScore;
    })
    .slice(0, 20);

  const result = {};
  eligible.forEach(function (item) {
    result[item.rowIndex] = true;
  });
  return result;
}

function doroDecideTier(status, totalScore, isMaster) {
  if (status === "penalty") return "Penalty";
  if (isMaster) return "Master";
  if (totalScore >= 65) return "Advanced";
  return "General";
}

function doroParseCountHours(raw) {
  const text = doroNormalize(raw);
  const match = text.match(/^(\d+)\s*\/\s*(\d+)/);
  if (!match) return { count: 0, hours: 0 };
  return {
    count: Number(match[1]) || 0,
    hours: Number(match[2]) || 0,
  };
}
