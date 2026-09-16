const CONFIG = {
  // -------------------------------------------------------------------------
  // API Keys — must match the key used in GRADES DB and ATTENDANCE DB
  // -------------------------------------------------------------------------
  API_KEY: "ZGM3YjJhMzEtNWU0Yi00YjZjLWE5MzctZjIxNGU4YzRhOTEx",

  // -------------------------------------------------------------------------
  // External Web App URLs
  // Fill in after deploying GRADES DB and ATTENDANCE DB as web apps
  // -------------------------------------------------------------------------
  GRADES_DB_URL: "https://script.google.com/macros/s/AKfycbwd6KRJo7YHEaEkhKvKfkEnj6AUq8CnvcAUhKnOMPhz_Sw89nKve4YkCrrz5yzhICkYrw/exec",
  ATTENDANCE_DB_URL: "https://script.google.com/macros/s/AKfycbxF7fw299-77fl1rkzFYf3-rsepbYDGiQNlvE0T6Ct5W7im98iFrHrtsqppYm6gVKY/exec",
  STUDENTS_DB_URL: "https://script.google.com/macros/s/AKfycbybGFzgjXIJdVSgErs-ogcnTpkbuQBMJESKcgKRxWRJUkJs867QNR2ptXPkyCW_d8UWmw/exec",

  // -------------------------------------------------------------------------
  // This project's own deployed web app URL — used by the "Open Web
  // Application" menu item (see openWebApp in Setup.js). Hardcoded rather
  // than read via ScriptApp.getService().getUrl() because that call can
  // resolve to a stale/different deployment when a project has more than
  // one deployment in its history (see the deployment mislabeled "Test"
  // that this URL was copied from, 2026-08-10). Update this after creating
  // a NEW deployment (a redeploy of the same deployment keeps the same URL,
  // so no update needed then).
  // -------------------------------------------------------------------------
  WEB_APP_URL: "https://script.google.com/a/macros/goldenlink.ph/s/AKfycbwIsKlDInFkFJchhJML0jNyF3dwurt8sdGeVKotpvFeCVXYuiLh0l0OukbyYZ7vi2Cl2w/exec",

  // -------------------------------------------------------------------------
  // Google Drive — root folder for all generated report PDFs
  // Create the folder manually in Drive, then paste its ID here
  // -------------------------------------------------------------------------
  REPORTS_FOLDER_NAME: "GLC Reports",
  REPORTS_FOLDER_ID:   "1U1BX2kupCvZHUq8KTSSV74LFFYh_Wqkz",

  // -------------------------------------------------------------------------
  // School seal / logo — printed on report headers. Upload the image to
  // Drive, share it (at least "Anyone with the link can view", since the
  // script runs the fetch as itself), and paste its file ID here.
  // -------------------------------------------------------------------------
  LOGO_FILE_ID: "1txr8H78F3fpnHQSQ3KIRgneuBsp-HrZU",
  
  WORKING_INSTRUCTIONS_URL: "https://students-db-wi.vercel.app//",

  // -------------------------------------------------------------------------
  // Auth — sheet tab in this spreadsheet that lists authorized users and roles
  // Columns: Email | Role | Name | Assigned Grade Level
  // Assigned Grade Level is only set for Coordinator rows — one of the
  // assignedGradeLevel values in TEMPLATE_MASTERFILES below (e.g. "7-10"),
  // hand-maintained here since Coordinator-to-block assignment changes
  // rarely (see _canAccessSection_). Teacher section-level scoping is
  // enforced separately via the ADVISORS sheet (see AdvisorSync.js), not
  // this column.
  // -------------------------------------------------------------------------
  AUTHORIZED_USERS_SHEET: "AUTHORIZED_USERS",
  AUTHORIZED_USERS_HEADERS: ["Email", "Role", "Name", "Assigned Grade Level"],

  ROLES: {
    ADMIN:       "Admin",
    TEACHER:     "Teacher",
    COORDINATOR: "Coordinator",
    PRINCIPAL:   "Principal",
    REGISTRAR:   "Registrar"
  },

  // -------------------------------------------------------------------------
  // Report types — offered in the "Report Type" dropdown.
  //   id         — passed as the `reportType` param to generateReports/sendMailMerge
  //   label      — shown in the dropdown
  //   roles      — which AUTHORIZED_USERS roles may generate this type
  //   sendRoles  — which AUTHORIZED_USERS roles may email this type via Mail
  //                Merge; defaults to `roles` when omitted (see
  //                _rolesForAction_ in Code.js). Only needed when send access
  //                is narrower than generate access.
  //   enabled    — false = "Coming soon" placeholder, no builder implemented yet
  // -------------------------------------------------------------------------
  REPORT_TYPES: [
    {
      id: "PG",
      label: "Periodical Letter Grade",
      roles: ["Admin", "Coordinator", "Principal"],
      sendRoles: ["Principal"],
      enabled: true
    },
    {
      id: "NG",
      label: "Numerical Grade",
      roles: ["Admin", "Registrar"],
      enabled: true
    },
    {
      id: "SC",
      label: "School Clearance",
      roles: ["Admin", "Registrar"],
      enabled: true
    },
    {
      id: "SF9",
      label: "Learner's Performance Report (SF-9)",
      roles: ["Admin", "Registrar"],
      enabled: true
    },
    {
      id: "SF10_SHS",
      label: "Learner's Permanent Academic Record (SF-10) — SHS",
      roles: ["Admin", "Registrar"],
      enabled: false
    },
    {
      id: "SF10_JHS",
      label: "Learner's Permanent Academic Record (SF-10) — JHS",
      roles: ["Admin", "Registrar"],
      enabled: false
    },
    {
      id: "SF10_ELEM",
      label: "Learner's Permanent Academic Record (SF-10) — Elementary",
      roles: ["Admin", "Registrar"],
      enabled: false
    }
  ],

  // -------------------------------------------------------------------------
  // Advisor sync — pulls current Advisory Teacher assignments from each
  // Template Masterfile's ADVISORY + TEACHERS_REF tabs into a local ADVISORS
  // sheet, so Teacher-role report access can be scoped to their own section.
  // Run manually via the "Sync Advisors Now" menu item, or automatically via
  // a daily time-based trigger installed by installAdvisorSyncTrigger().
  // -------------------------------------------------------------------------
  TEMPLATE_MASTERFILES: [
    { assignedGradeLevel: "1-3",   spreadsheetId: "1AF4xhpB1JeC7VTrIPKEzS7ZkPV6xyHgJPA_4Wdag3AE" },
    { assignedGradeLevel: "4-6",   spreadsheetId: "1U7nzecx28sa86ida_LmwMIISf4OGyuTxAtiPreVh7gQ" },
    { assignedGradeLevel: "7-10",  spreadsheetId: "1osyW21crqazBl8vqdL0TGYaz2gvZ114qtcjTsImyRo4" },
    { assignedGradeLevel: "11-12", spreadsheetId: "1KxUs6RxMZduLMwpMoDB5qb6hcO1PyJlSWATavM-h-jM" }
  ],

  // Sheet/tab names as they exist inside each Template Masterfile (must match
  // TEMPLATE MASTERFILE GRADE */Config.js SHEET_NAMES).
  MASTERFILE_SHEETS: {
    ADVISORY: "ADVISORY",
    TEACHERS_REF: "TEACHERS_REF"
  },

  // ADVISORY tab column indices (0-based), matching ADVISORY_COLUMNS in each
  // Template Masterfile's Config.js. 1 header row (data starts row 2).
  ADVISORY_COLUMNS: {
    TEACHER: 0,
    GRADE_LEVEL: 1,
    SECTION: 2,
    STATUS: 3
  },
  ADVISORY_STATUS_ACTIVE: "Active",

  // TEACHERS_REF tab: data starts row 3 (2 header rows), Full Name is column
  // B (array index 1), Email Address is column C (array index 2) — matches
  // _getTeacherEmail() in each Template Masterfile's API.js.
  TEACHERS_REF_NAME_COL: 1,
  TEACHERS_REF_EMAIL_COL: 2,
  TEACHERS_REF_DATA_START_ROW: 3,

  // Local sheet (in this REPORTS spreadsheet) that the sync writes resolved
  // advisor rows into. Columns: Grade Level | Section | Advisor Name |
  // Advisor Email | Source Assigned Grade Level | Synced At
  ADVISORS_SHEET: "ADVISORS",
  ADVISORS_HEADERS: ["Grade Level", "Section", "Advisor Name", "Advisor Email", "Source Assigned Grade Level", "Synced At"],

  // Sync issues (unresolved advisor names / blank emails) get written here
  // instead of silently dropped, so a Coordinator can see and fix gaps.
  ADVISOR_SYNC_ISSUES_SHEET: "ADVISOR_SYNC_ISSUES",
  ADVISOR_SYNC_ISSUES_HEADERS: ["Grade Level", "Section", "Teacher Name", "Source Assigned Grade Level", "Issue", "Synced At"],

  // -------------------------------------------------------------------------
  // School settings
  // -------------------------------------------------------------------------
  SCHOOL_NAME:    "Golden Link College",
  SCHOOL_ADDRESS: "Along Gov. Fortunato Halili Rd. Brgy. San Vicente, Santa Maria, Bulacan",
  DEPARTMENT:     "Basic Education Department",

  // DepEd letterhead text for the LPR (SF-9) report — static, matches the
  // "LEARNERS PERFORMANCE REPORT (LPR) - Google Sheets.pdf" reference
  // template exactly. Not used by PG/NG/SC, which use SCHOOL_NAME/ADDRESS
  // only (no DepEd region/district letterhead on those).
  DEPED_REGION:   "Region, National Capital Region (NCR)",
  DEPED_DIVISION: "SCHOOL DIVISION OFFICE OF CALOOCAN CITY",
  DEPED_DISTRICT: "District I",
  DEPED_CITY:     "Caloocan City, Metro Manila",

  // -------------------------------------------------------------------------
  // Trimester labels
  // -------------------------------------------------------------------------
  TRIMESTERS: {
    "1": "1st Trimester",
    "2": "2nd Trimester",
    "3": "3rd Trimester"
  },

  // -------------------------------------------------------------------------
  // Attendance month order (school year sequence)
  // -------------------------------------------------------------------------
  MONTHS: ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'],

  // -------------------------------------------------------------------------
  // Signatories — hand-maintained sheet in this REPORTS spreadsheet driving
  // the signature block on each certificate (Designation/Verification/Name
  // above the signature line). One row per Report x Grade Band; a blank/
  // "ALL" Grade Band row is the fallback used when no band-specific row
  // exists. Not synced from anywhere — edited directly in the sheet, same as
  // the old Reference sheet it replaces (see _getSignatory_ in API.js).
  // Class Adviser ("Teacher-in-Charge" on LPR) is NOT stored here — it stays
  // sourced from ADVISORS (see AdvisorSync.js), which is already synced
  // per-section and shouldn't be duplicated.
  // -------------------------------------------------------------------------
  SIGNATORIES_SHEET: "Signatories",
  SIGNATORIES_HEADERS: ["Report", "Grade Band", "Designation", "Verification", "Name"],
  SIGNATORIES_ALL_BAND: "ALL"
};
