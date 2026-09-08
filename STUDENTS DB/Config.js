/**
 * Configuration file for Student Database System
 * This centralizes all configuration constants for easy maintenance
 */

const CONFIG = {
  // Web App URL - Update this after deploying the script as a web app
  // To deploy: Deploy > New deployment > Select type: Web app > Execute as: Me > Who has access: Anyone
  // Then copy the Web App URL (the one ending with /exec) and paste it below
  WEB_APP_URL: "https://script.google.com/a/macros/goldenlink.ph/s/AKfycbybGFzgjXIJdVSgErs-ogcnTpkbuQBMJESKcgKRxWRJUkJs867QNR2ptXPkyCW_d8UWmw/exec", // Replace with your /exec URL after deployment
  
  // API Key for securing the API - This is a unique identifier
  // Keep this secret and don't share it publicly
  API_KEY: "ZGM3YjJhMzEtNWU0Yi00YjZjLWE5MzctZjIxNGU4YzRhOTEx",
  
  // Spreadsheet ID - Will use the active spreadsheet
  // This is determined dynamically, no need to hardcode
  get SPREADSHEET_ID() {
    return SpreadsheetApp.getActiveSpreadsheet().getId();
  },
  
  // Column mapping for student data (0-based index)
  COLUMNS: {
    STUDENT_NUMBER: 0,
    LAST_NAME: 1,
    FIRST_NAME: 2,
    MIDDLE_NAME: 3,
    GRADE_LEVEL: 4,
    SECTION: 5,
    TRACK: 6,
    GENDER: 7
  },
  
  // Expected CSV headers for validation
  EXPECTED_HEADERS: [
    'Student Number',
    'Last Name',
    'First Name',
    'Middle Name',
    'Grade Level',
    'Section',
    'Track',
    'Gender'
  ],

  // Optional columns the per-year import CSV may append after the 8 required
  // EXPECTED_HEADERS above. When present, these are NOT written to the
  // per-year sheet (which stays the original 8-column schema) — they're
  // routed to the "Other Information" sheet instead, upserted by Student
  // Number (see _importStudentData/_upsertOtherInformation). A CSV omitting
  // these entirely (the original 8-column format) still imports normally.
  OPTIONAL_IMPORT_HEADERS: [
    'LRN',
    'Email',
    'Parent/Guardian Name',
    'Date of Birth'
  ],

  // Student fields that can be updated (excludes Student Number)
  UPDATABLE_FIELDS: [
    'Last Name',
    'First Name',
    'Middle Name',
    'Grade Level',
    'Section',
    'Track',
    'Gender'
  ],
  
  // Field name to column index mapping
  FIELD_MAP: {
    'Student Number': 1,
    'Last Name': 2,
    'First Name': 3,
    'Middle Name': 4,
    'Grade Level': 5,
    'Section': 6,
    'Track': 7,
    'Gender': 8
  },
  
  // Sheet names
  SHEET_NAMES: {
    UPDATE_LOG: 'Update Log',
    OTHER_INFORMATION: 'Other Information'
  },

  // Column mapping for the Other Information sheet (0-based index).
  // Keyed by Student Number — not scoped by academic year, unlike the
  // per-year student sheets above. Order: Student Number, LRN, Email,
  // Parent/Guardian Name, Date of Birth. Address/Place of Birth were
  // dropped from this sheet.
  OTHER_INFO_COLUMNS: {
    STUDENT_NUMBER: 0,
    LRN: 1,
    PARENT_EMAIL: 2,
    PARENT_NAME: 3,
    DATE_OF_BIRTH: 4
  },
  OTHER_INFO_HEADERS: [
    'Student Number',
    'LRN',
    'Email',
    'Parent/Guardian Name',
    'Date of Birth'
  ],

  DATA_START_ROW: 3,
  HEADER_ROWS: 2,

  // Strict formats for identifier columns that Sheets/Excel will otherwise
  // silently mangle into a Date or Number when typed/pasted (e.g. the
  // Student Number "10-01-0798" being auto-detected as a date). Enforced
  // on every write via _validateStudentNumber_/_validateLrn_ in API.js, and
  // the columns are forced to plain-text number format so a value that
  // passes validation can't be re-interpreted after being written either.
  STUDENT_NUMBER_PATTERN: /^\d{2}-\d{2}-\d{5}$/, // e.g. "22-02-00001"
  LEGACY_STUDENT_NUMBER_PATTERN: /^(\d{2}-\d{2}-)(\d{4})$/, // pre-standard 4-digit form, e.g. "22-02-0036"
  LRN_PATTERN: /^\d{12}$/, // 12-digit Learner Reference Number
  DATE_OF_BIRTH_PATTERN: /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/, // mm/dd/yyyy, e.g. "03/31/2019"
  VALID_GENDERS: ['Male', 'Female'],
  EMAIL_DOMAIN: '@goldenlink.ph',

  // Placeholder written to the Track column for Grade 1-10 students (who
  // have no Track) instead of leaving the cell blank — matches
  // TRACK_NO_TRACK_PLACEHOLDER in the separate student_import_template
  // Apps Script project (STUDENTS DB/TemplateFormatting.js), which can't
  // reference this file directly since it's bound to a different spreadsheet.
  NO_TRACK_PLACEHOLDER: '-',

  WORKING_INSTRUCTIONS_URL: "https://students-db.vercel.app/",

  // Master "student_import_template" Google Sheet in Drive. Maintained by
  // hand (headers + conditional formatting via TemplateFormatting.js) —
  // the download button exports this exact file as .xlsx rather than
  // generating a template from scratch, so it keeps the visual validation
  // (red-highlight) rules the generated version could never carry.
  IMPORT_TEMPLATE_SHEET_ID: "1LjWKvE3X1Vsyx8il9YjJTkF5WUq5zQcypkpH1oezT80"
};

