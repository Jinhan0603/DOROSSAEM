#!/usr/bin/env python3
"""
Normalize legacy instructor Excel data into the Google Sheet target schema.

Inputs:
- local legacy xlsx: DORO 강사정보_최신화.xlsx
- google sheet id: used to load current Instructor_Master/Instructor_Sensitive

Outputs:
- data/normalized/instructor_master_seed.csv
- data/normalized/instructor_sensitive_seed.csv
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import re
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import xml.etree.ElementTree as ET


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg": "http://schemas.openxmlformats.org/package/2006/relationships",
}

MASTER_HEADERS = [
    "고유ID (instructor_id)",
    "이름",
    "기수",
    "활동 상태 (Status)",
    "등급 (Grade)",
    "보조강사 자격 (assistant_cert)",
    "주강사 자격 (lead_cert)",
    "누적 강의 횟수 / 누적 강의 시간",
    "승급용 점수 (관찰 루브릭)",
    "배정용 점수 (우선순위)",
    "승급 증거팩 제출 여부",
    "학교",
    "학과",
    "거주지",
    "이동 가능 범위",
]

SENSITIVE_HEADERS = [
    "고유ID (instructor_id)",
    "성별",
    "번호",
    "주민번호",
    "이메일",
    "은행",
    "계좌번호",
    "주소",
]


def normalize_str(v: Optional[str]) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    s = re.sub(r"\s+", " ", s)
    return s


def excel_col_to_num(col: str) -> int:
    n = 0
    for ch in col:
        if "A" <= ch <= "Z":
            n = n * 26 + (ord(ch) - 64)
    return n


def num_to_excel_col(idx: int) -> str:
    s = ""
    n = idx
    while n:
        n, rem = divmod(n - 1, 26)
        s = chr(65 + rem) + s
    return s


def parse_xlsx_sheet_rows(xlsx_bytes: bytes, sheet_name: str) -> List[Dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(xlsx_bytes), "r") as zf:
        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rid_to_target = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall("pkg:Relationship", NS)
        }

        shared: List[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            ss = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in ss.findall("main:si", NS):
                text = "".join(t.text or "" for t in si.findall(".//main:t", NS))
                shared.append(text)

        sheet_path = None
        for s in wb.findall("main:sheets/main:sheet", NS):
            name = s.attrib.get("name", "")
            rid = s.attrib.get(
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id", ""
            )
            if name == sheet_name:
                target = rid_to_target.get(rid, "")
                sheet_path = "xl/" + target if not target.startswith("xl/") else target
                break

        if not sheet_path:
            raise ValueError(f"sheet not found: {sheet_name}")

        root = ET.fromstring(zf.read(sheet_path))
        rows = root.findall("main:sheetData/main:row", NS)

        def read_cell(c: ET.Element) -> str:
            t = c.attrib.get("t")
            v = c.find("main:v", NS)
            if v is not None and v.text is not None:
                if t == "s":
                    idx = int(v.text)
                    return shared[idx] if idx < len(shared) else ""
                return v.text
            is_node = c.find("main:is", NS)
            if is_node is not None:
                return "".join(tn.text or "" for tn in is_node.findall(".//main:t", NS))
            return ""

        if not rows:
            return []

        max_col = 0
        for r in rows:
            for c in r.findall("main:c", NS):
                ref = c.attrib.get("r", "A1")
                col = "".join(ch for ch in ref if ch.isalpha())
                max_col = max(max_col, excel_col_to_num(col))

        header_row = rows[0]
        header_cells = {c.attrib.get("r"): c for c in header_row.findall("main:c", NS)}
        headers: List[str] = []
        for ci in range(1, max_col + 1):
            ref = f"{num_to_excel_col(ci)}1"
            c = header_cells.get(ref)
            headers.append(normalize_str(read_cell(c)) if c is not None else "")

        out: List[Dict[str, str]] = []
        for r in rows[1:]:
            rnum = r.attrib.get("r", "")
            cell_map = {c.attrib.get("r"): c for c in r.findall("main:c", NS)}
            record: Dict[str, str] = {}
            has_any = False
            for ci, h in enumerate(headers, start=1):
                if not h:
                    continue
                ref = f"{num_to_excel_col(ci)}{rnum}"
                c = cell_map.get(ref)
                value = normalize_str(read_cell(c)) if c is not None else ""
                record[h] = value
                if value:
                    has_any = True
            if has_any:
                out.append(record)
        return out


def download_sheet_xlsx(sheet_id: str) -> bytes:
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


def make_id(seed: str, used: set[str]) -> str:
    alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    for i in range(2000):
        raw = f"{seed}|{i}".encode("utf-8")
        digest = hashlib.sha1(raw).digest()
        num = int.from_bytes(digest[:8], "big")
        chars = []
        for _ in range(4):
            num, rem = divmod(num, len(alphabet))
            chars.append(alphabet[rem])
        cid = "26-" + "".join(chars)
        if cid not in used:
            used.add(cid)
            return cid
    raise RuntimeError("id generation failed")


def key_name_phone(name: str, phone: str) -> str:
    n = re.sub(r"\s+", "", normalize_str(name)).lower()
    p = re.sub(r"[^0-9]", "", normalize_str(phone))
    return f"{n}|{p}"


def write_csv(path: Path, headers: List[str], rows: List[Dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for r in rows:
            w.writerow({h: normalize_str(r.get(h, "")) for h in headers})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--legacy-xlsx", required=True)
    parser.add_argument("--sheet-id", required=True)
    parser.add_argument("--out-dir", default="data/normalized")
    args = parser.parse_args()

    legacy_path = Path(args.legacy_xlsx)
    legacy_bytes = legacy_path.read_bytes()
    legacy_rows = parse_xlsx_sheet_rows(legacy_bytes, "강사정보")

    gsheet_bytes = download_sheet_xlsx(args.sheet_id)
    gm_rows = parse_xlsx_sheet_rows(gsheet_bytes, "Instructor_Master")
    gs_rows = parse_xlsx_sheet_rows(gsheet_bytes, "Instructor_Sensitive")

    # Existing ID map from Google Sheet by (name, phone)
    id_to_name = {
        normalize_str(r.get("고유ID (instructor_id)")): normalize_str(r.get("이름"))
        for r in gm_rows
        if normalize_str(r.get("고유ID (instructor_id)"))
    }
    id_to_phone = {
        normalize_str(r.get("고유ID (instructor_id)")): normalize_str(r.get("번호"))
        for r in gs_rows
        if normalize_str(r.get("고유ID (instructor_id)"))
    }
    existing_map: Dict[str, str] = {}
    used_ids = set(id_to_name.keys())
    for iid, name in id_to_name.items():
        key = key_name_phone(name, id_to_phone.get(iid, ""))
        if key != "|":
            existing_map[key] = iid

    out_master: List[Dict[str, str]] = []
    out_sensitive: List[Dict[str, str]] = []

    missing_name = 0
    missing_phone = 0
    matched_existing = 0
    generated_new = 0

    for idx, r in enumerate(legacy_rows, start=2):
        name = normalize_str(r.get("이름"))
        if not name:
            missing_name += 1
            continue

        phone = normalize_str(r.get("번호"))
        if not phone:
            missing_phone += 1

        k = key_name_phone(name, phone)
        iid = existing_map.get(k)
        if iid:
            matched_existing += 1
        else:
            seed = f"{name}|{phone}|{idx}"
            iid = make_id(seed, used_ids)
            generated_new += 1

        cohort = normalize_str(r.get("전형")) or normalize_str(r.get("현 기수"))
        lesson_count = normalize_str(r.get("횟수"))
        lesson_hours = normalize_str(r.get("시간"))
        cumulative = ""
        if lesson_count or lesson_hours:
            cumulative = f"{lesson_count or '0'} / {lesson_hours or '0'}"

        master_row = {
            "고유ID (instructor_id)": iid,
            "이름": name,
            "기수": cohort,
            "활동 상태 (Status)": "active",
            "등급 (Grade)": "N",
            "보조강사 자격 (assistant_cert)": "",
            "주강사 자격 (lead_cert)": "",
            "누적 강의 횟수 / 누적 강의 시간": cumulative,
            "승급용 점수 (관찰 루브릭)": "",
            "배정용 점수 (우선순위)": "0",
            "승급 증거팩 제출 여부": "",
            "학교": normalize_str(r.get("학교")),
            "학과": normalize_str(r.get("학과")),
            "거주지": normalize_str(r.get("거주지")),
            "이동 가능 범위": "",
        }
        out_master.append(master_row)

        sensitive_row = {
            "고유ID (instructor_id)": iid,
            "성별": normalize_str(r.get("성별")),
            "번호": phone,
            "주민번호": normalize_str(r.get("주민번호")),
            "이메일": normalize_str(r.get("이메일")),
            "은행": normalize_str(r.get("은행")),
            "계좌번호": normalize_str(r.get("계좌번호")),
            "주소": normalize_str(r.get("주소")),
        }
        out_sensitive.append(sensitive_row)

    # Deduplicate by ID while preserving first occurrence.
    def dedupe(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
        seen = set()
        out = []
        for r in rows:
            iid = r.get("고유ID (instructor_id)", "")
            if iid in seen:
                continue
            seen.add(iid)
            out.append(r)
        return out

    out_master = dedupe(out_master)
    out_sensitive = dedupe(out_sensitive)

    out_dir = Path(args.out_dir)
    write_csv(out_dir / "instructor_master_seed.csv", MASTER_HEADERS, out_master)
    write_csv(out_dir / "instructor_sensitive_seed.csv", SENSITIVE_HEADERS, out_sensitive)

    print("[normalize_instructor_data]")
    print("legacy_rows:", len(legacy_rows))
    print("output_master_rows:", len(out_master))
    print("output_sensitive_rows:", len(out_sensitive))
    print("matched_existing_ids:", matched_existing)
    print("generated_new_ids:", generated_new)
    print("missing_name_rows:", missing_name)
    print("missing_phone_rows:", missing_phone)
    print("written:", (out_dir / "instructor_master_seed.csv").as_posix())
    print("written:", (out_dir / "instructor_sensitive_seed.csv").as_posix())


if __name__ == "__main__":
    main()

