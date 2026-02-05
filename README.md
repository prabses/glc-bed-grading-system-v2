# GLC BED Grading System

A Google Apps Script–based grading system for managing student data, grades, and Official Grade Sheet (OGS) templates.

---

## Project Overview

| Module | Google Sheet | Purpose |
|--------|--------------|---------|
| **STUDENTS DB** | Students Database | Import/update student info (name, grade level, section, etc.) |
| **TEMPLATE MASTERFILE** | Template Masterfile | Assign teachers to subjects, generate OGS templates |
| **GRADES DB** | Grades Database | Import grades from OGS templates, update individual grades, export to CSV |

**Flow:** Students DB → Template Masterfile (OGS) → GRADES DB

---

## Quick Start

1. **Students DB** – Import student roster via CSV → creates academic year sheets (e.g. `2024-2025`).
2. **Template Masterfile** – Assign teachers to subjects → generate OGS templates for each class.
3. **GRADES DB** – Import grades from OGS templates → update grades as needed → export to CSV.

---

## Directory Structure

```
GLC BED Grading System/
├── STUDENTS DB/          # Student information module
├── TEMPLATE MASTERFILE/  # OGS template generation module
├── GRADES DB/            # Grades import/update/export module
├── OGS TEMPLATE WI/      # Working instructions for OGS templates
├── documents/            # Guides, flow docs, sheet structure
├── excel-files/          # Sample CSV/Excel files
└── README.md
```

---

## Module Navigation

### 1. STUDENTS DB

**Google Sheet:** One spreadsheet for student roster per school.

| File | Role |
|------|------|
| `Code.js` | Menu, dialogs, `onOpen`, calls to API |
| `Config.js` | `WEB_APP_URL`, `API_KEY`, column mappings, CSV headers |
| `API.js` | `doPost`, `callApi`, import/update logic |
| `StudentImportDialog.html` | Import CSV UI |
| `StudentUpdateDialog.html` | Update student info UI |
| `index.html` | Working instructions (Manual menu) |

**Menus:** Upload (Import Student Data, Update Student Information), Manual (Open Working Instruction)

**Sheets:** Academic year tabs named `YYYY-YYYY` (e.g. `2024-2025`), plus `Update Log`.

---

### 2. TEMPLATE MASTERFILE

**Google Sheet:** Central hub for teacher assignments and OGS generation.

| File | Role |
|------|------|
| `Code.js` | Menus, dialogs, helpers for subjects/teachers/sections |
| `Config.js` | `WEB_APP_URL`, sheet names, column mappings, grading weights |
| `API.js` | OGS generation, subject/advisory management, `doPost`/`callApi` |
| `OGSTemplateDialog.html` | Generate OGS template UI |
| `AssignmentDialog.html` | Manage Subjects UI |
| `AdvisoryDialog.html` | Manage Advisory Classes UI |
| `index.html` | Working instructions |

**Menus:** Export OGS, Manage (Manage Subjects, Manage Advisory Classes), Manual

**Sheets:**

| Sheet | Editable? | Purpose |
|-------|-----------|---------|
| MASTER_DATA | No | Generated OGS templates and links |
| SUBJECTS | No | Teacher–subject–grade–section assignments |
| ADVISORY | No | Teacher advisory class assignments |
| SUBJECTS_REF | Yes | Subject list |
| TEACHERS_REF | Yes | Teacher list |
| SECTIONS_REF | Yes | Grade levels and sections |
| GRADING_REF | Yes | Grading weights (Written Work, Performance Task, Assessment) |
| ATTENDANCE_REF | Yes | School days per month |
| CHARACTERS_REF | Yes | Character traits |

---

### 3. GRADES DB

**Google Sheet:** Central grades database per school.

| File | Role |
|------|------|
| `Code.js` | Menus, dialogs, helpers (sheets, students, subjects) |
| `Config.js` | `WEB_APP_URL`, `API_KEY`, semesters |
| `API.js` | Import, update, export logic; `doPost`/`callApi` |
| `ImportGradesDialog.html` | Import from OGS template UI |
| `UpdateGradesDialog.html` | Update grades UI |
| `ExportGradesDialog.html` | Export to CSV UI |
| `index.html` | Working instructions |

**Menus:** Upload (Import Student Grades, Update Student Grades), Export (Export Student Grades), Manual

**Sheets:** Academic year tabs `YYYY-YYYY`, plus `UPDATE LOG`.

---

## Google Sheet Setup

### Academic Year Sheets

- Name format: `YYYY-YYYY` (e.g. `2024-2025`).
- Create sheets manually; scripts only read/write data.

### STUDENTS DB Sheet Layout

- Rows 1–2: Headers.
- Row 3+: Student data.
- Columns: Student Number, Last Name, First Name, Middle Name, Grade Level, Section, Strand, Gender.

### GRADES DB Sheet Layout

- Row 1: Headers (Student Number, Full Name, Grade Level, Section, Subject, Semester, Teacher, grading columns).
- Row 2+: Grade records (one row per student–subject combination).

### TEMPLATE MASTERFILE Reference Sheets

- Row 1: Parent header (merged).
- Row 2: Column headers.
- Row 3+: Data.
- Use `✓` in the Active column for items that should appear in dropdowns.

---

## Configuration

Each module has a `Config.js` with:

- `WEB_APP_URL` – Web app URL after deployment (Deploy → New deployment → Web app).
- `API_KEY` – Used for API authentication.
- Column mappings and sheet names.

**Deploy steps:** Extensions → Apps Script → Deploy → New deployment → Web app → set access → copy URL to `Config.js`.

---

## Documents Reference

| Document | Content |
|---------|---------|
| `documents/SYSTEM FLOW.txt` | High-level system flow |
| `documents/Template_Masterfile_Sheet_Structure_Guide.md` | Template Masterfile sheet structure |
| `documents/SHS_Sheet_Structure_Updates.md` | SHS-specific sheet changes |
| `documents/TASK_LIST.md` | Task list |

---

## Working Instructions

Each module’s **Manual → Open Working Instruction** opens a step-by-step guide:

- **STUDENTS DB** – Import CSV, update student info.
- **TEMPLATE MASTERFILE** – Manage subjects, advisories, generate OGS.
- **GRADES DB** – Import grades, update grades, export CSV.
- **OGS TEMPLATE WI** – How to use generated OGS templates.

---

## File Flow Summary

```
CSV (student roster)
    → STUDENTS DB (import)
    → Academic year sheets

TEMPLATE MASTERFILE
    → Assign teachers to subjects
    → Generate OGS templates (Google Sheets)

OGS templates (teachers enter grades)
    → GRADES DB (import)
    → Academic year grade sheets

GRADES DB
    → Export filtered grades to CSV
```

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| Forms don’t open | Internet, refresh, permissions |
| Import fails | CSV format, sheet names, access to source sheet |
| Dropdowns empty | Reference sheets, Active column (`✓`) |
| API errors | `WEB_APP_URL`, `API_KEY`, deployment |
| Wrong grading weights | `GRADING_REF` subject name and Active status |

For more detail, use each module’s **Manual → Open Working Instruction**.
