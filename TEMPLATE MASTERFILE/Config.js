/**
 * Configuration file for Template Masterfile System
 * This centralizes all configuration constants for easy maintenance
 */

const CONFIG = {
  // Web App URL - Update this after deploying the script as a web app
  // To deploy: Deploy > New deployment > Select type: Web app > Execute as: Me > Who has access: Anyone
  // Then copy the Web App URL (the one ending with /exec) and paste it below
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzaNA9GXlzlO_NoydV9JZ9F93UXj03FZzK7sQdnNbOc4vdThsRc8UBV6jlY1EeaIMIB/exec", // Replace with your /exec URL after deployment
  
  // API Key for securing the API - This is a unique identifier
  // Keep this secret and don't share it publicly
  API_KEY: "YTM0NzhkODItZmU4Zi00YjczLWI5ZGQtZGVhNjYxZGI4ZmFi",
  
  // Spreadsheet ID - Will use the active spreadsheet
  // This is determined dynamically, no need to hardcode
  get SPREADSHEET_ID() {
    return SpreadsheetApp.getActiveSpreadsheet().getId();
  },
  
  // STUDENTS DB Spreadsheet Name - Located in the same folder as Template Masterfile
  STUDENTS_DB_NAME: "STUDENTS DB - GRADE 1-3",
  
  // Sheet names
  SHEET_NAMES: {
    MASTER_DATA: 'MASTER_DATA',
    SUBJECTS: 'SUBJECTS',
    ADVISORY: 'ADVISORY',
    SUBJECTS_REF: 'SUBJECTS_REF',
    TEACHERS_REF: 'TEACHERS_REF',
    SECTIONS_REF: 'SECTIONS_REF',
    GRADING_REF: 'GRADING_REF',
    ATTENDANCE_REF: 'ATTENDANCE_REF',
    CHARACTERS_REF: 'CHARACTERS_REF'
  },
  
  // Column mapping for MASTER_DATA (0-based index)
  MASTER_DATA_COLUMNS: {
    SCHOOL_YEAR: 0,      // Column A
    GRADE_LEVEL: 1,      // Column B
    SECTION: 2,          // Column C
    TEACHER: 3,       // Column D
    TEMPLATE_LINK: 4,    // Column E
    CREATED: 5,          // Column F
    MODIFIED: 6,         // Column G
    CREATED_BY: 7        // Column H
  },
  
  // Column mapping for GRADING_REF (0-based index)
  GRADING_COLUMNS: {
    SUBJECT_NAME: 1,      // Column B
    WRITTEN_WORK: 2,      // Column C
    PERFORMANCE_TASK: 3,  // Column D
    ASSESSMENT: 4,        // Column E
    ACTIVE: 5             // Column F
  },
  
  // Column mapping for SUBJECTS (0-based index)
  SUBJECTS_COLUMNS: {
    GRADE_LEVEL: 0,       // Column A
    SECTION: 1,          // Column B
    TEACHER: 2,       // Column C
    SUBJECT: 3,          // Column D
    STATUS: 4,            // Column E
    CREATED: 5,           // Column F
    MODIFIED: 6,          // Column G
    CREATED_BY: 7         // Column H
  },
  
  // Column mapping for ADVISORY (0-based index)
  ADVISORY_COLUMNS: {
    TEACHER: 0,        // Column A
    GRADE_LEVEL: 1,      // Column B
    SECTION: 2,          // Column C
    STATUS: 3,            // Column D
    CREATED: 4,           // Column E
    MODIFIED: 5,          // Column F
    CREATED_BY: 6         // Column G
  },
  
  // Fixed grading components
  GRADING_COMPONENTS: ['Written Work', 'Performance Task', 'Assessment'],
  
  // Data row configuration
  DATA_START_ROW: 3,  // Data starts from row 3 (after 2 header rows)
  HEADER_ROWS: 2,     // Rows 1-2 contain parent header and column headers
  
  // Status values
  STATUS: {
    ACTIVE: 'Active',
    ARCHIVED: 'Archived'
  },
  
  // Color palette for templates and UI
  COLORS: {
    // Template colors
    LIGHT_GRAY: '#f3f3f3',   // Light gray for info rows
    MEDIUM_GRAY: '#d9d9d9',  // Medium gray for headers and formula columns
    LIGHTER_GRAY: '#e6e6e6', // Lighter gray for grading period headers
    LIGHT_RED: '#ffcccc',    // Light red for validation errors
    BLUE: '#667eea'          // Blue for sheet tabs
  },
  
  // Template configuration
  TEMPLATE: {
    NUM_STUDENT_ROWS: 30,           // Number of student rows to pre-create
    PASSING_GRADE: 75,               // Minimum passing grade
    MIN_GRADE: 44,                   // Minimum valid grade input
    MAX_GRADE: 100,                  // Maximum valid grade input
    STUDENT_COLUMNS: [               // Standard student information columns
      'Student Number',
      'Last Name',
      'First Name',
      'Middle Name'
    ],
    // Protection settings
    // Set to false to disable sheet protections (much faster generation, ~5-15 seconds vs ~90-100 seconds)
    // Set to true to enable protections (required for sharing with others - protects student info, headers, and formulas)
    ENABLE_PROTECTIONS: true,
    // Email addresses of people who will have edit access to protected ranges and the file
    // Can be a single email string or an array of email strings
    // Leave empty array [] to skip protection setup if no emails are available
    PROTECTION_EDITOR_EMAILS: ['system.center@goldenlink.ph'],
    // Protected ranges configuration for OGS template sheets
    // Column numbers are 1-based (1 = Column A, 2 = Column B, etc.)
    PROTECTED_RANGES: {
      // Subject sheets protection ranges
      SUBJECT_SHEETS: {
        STUDENT_INFO_COLUMNS: [1, 2],  // Columns A-B
        HEADER_ROWS: [8, 9],  // Rows 8-9 (grading period headers and column headers)
        FORMULA_COLUMNS: [6, 7, 11, 12, 16, 17, 21, 22, 23, 24]  // Columns F, G, K, L, P, Q, U, V, W, X
      },
      // Character sheet protection ranges
      CHARACTER_SHEET: {
        STUDENT_INFO_COLUMNS: [1, 2],  // Columns A-B
        HEADER_ROW: 7,  // Row 7 (column headers)
        FORMULA_COLUMNS: [3, 5, 7, 9, 11, 13]  // Columns C, E, G, I, K, M
      },
      // Attendance sheet protection ranges
      ATTENDANCE_SHEET: {
        STUDENT_INFO_COLUMNS: [1, 2],  // Columns A-B
        HEADER_ROWS: [6, 7],  // Rows 6-7 (month headers and column headers)
        PROTECTED_COLUMN_PATTERN: {
          START_COL: 3,  // Starting column (Column C)
          STEP: 3,       // Step size (each month takes 3 columns)
          COLUMNS: [0, 2]  // Relative positions within each month group: 0 = School DAYS, 2 = Days ABSENT
        }
      },
      // MAPEH sheet protection ranges
      MAPEH_SHEET: {
        STUDENT_INFO_COLUMNS: [1, 2],  // Columns A-B
        HEADER_ROWS: [8, 9],  // Rows 8-9 (grading period headers and column headers)
        FORMULA_COLUMNS: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
      }
    }
  },
  
  // Transmutation table for converting weighted averages to transmuted grades
  TRANSMUTATION_TABLE: [
    { from: 44.00, to: 44.99, transmutation: 60.00, eq: '' },
    { from: 45.00, to: 45.99, transmutation: 60.71, eq: '' },
    { from: 46.00, to: 46.99, transmutation: 61.43, eq: '' },
    { from: 47.00, to: 47.99, transmutation: 62.14, eq: '' },
    { from: 48.00, to: 48.99, transmutation: 62.86, eq: '' },
    { from: 49.00, to: 49.99, transmutation: 63.57, eq: '' },
    { from: 50.00, to: 50.99, transmutation: 64.29, eq: '' },
    { from: 51.00, to: 51.99, transmutation: 65.00, eq: '' },
    { from: 52.00, to: 52.99, transmutation: 65.71, eq: '' },
    { from: 53.00, to: 53.99, transmutation: 66.43, eq: '' },
    { from: 54.00, to: 54.99, transmutation: 67.14, eq: '' },
    { from: 55.00, to: 55.99, transmutation: 67.86, eq: '' },
    { from: 56.00, to: 56.99, transmutation: 68.57, eq: '' },
    { from: 57.00, to: 57.99, transmutation: 69.29, eq: '' },
    { from: 58.00, to: 58.99, transmutation: 70.00, eq: 'B' },
    { from: 59.00, to: 59.99, transmutation: 70.71, eq: 'B' },
    { from: 60.00, to: 60.99, transmutation: 71.43, eq: 'B' },
    { from: 61.00, to: 61.99, transmutation: 72.14, eq: 'B' },
    { from: 62.00, to: 62.99, transmutation: 72.86, eq: 'B' },
    { from: 63.00, to: 63.99, transmutation: 73.57, eq: 'B' },
    { from: 64.00, to: 64.99, transmutation: 74.29, eq: 'B' },
    { from: 65.00, to: 65.99, transmutation: 75.00, eq: 'D' },
    { from: 66.00, to: 66.99, transmutation: 75.71, eq: 'D' },
    { from: 67.00, to: 67.99, transmutation: 76.43, eq: 'D' },
    { from: 68.00, to: 68.99, transmutation: 77.14, eq: 'D' },
    { from: 69.00, to: 69.99, transmutation: 77.86, eq: 'D' },
    { from: 70.00, to: 70.99, transmutation: 78.57, eq: 'D' },
    { from: 71.00, to: 71.99, transmutation: 79.29, eq: 'D' },
    { from: 72.00, to: 72.99, transmutation: 80.00, eq: 'D' },
    { from: 73.00, to: 73.99, transmutation: 80.71, eq: 'D' },
    { from: 74.00, to: 74.99, transmutation: 81.43, eq: 'D' },
    { from: 75.00, to: 75.99, transmutation: 82.14, eq: 'AP' },
    { from: 76.00, to: 76.99, transmutation: 82.86, eq: 'AP' },
    { from: 77.00, to: 77.99, transmutation: 83.57, eq: 'AP' },
    { from: 78.00, to: 78.99, transmutation: 84.29, eq: 'AP' },
    { from: 79.00, to: 79.99, transmutation: 85.00, eq: 'AP' },
    { from: 80.00, to: 80.99, transmutation: 85.71, eq: 'AP' },
    { from: 81.00, to: 81.99, transmutation: 86.43, eq: 'AP' },
    { from: 82.00, to: 82.99, transmutation: 87.14, eq: 'AP' },
    { from: 83.00, to: 83.99, transmutation: 87.86, eq: 'AP' },
    { from: 84.00, to: 84.99, transmutation: 88.57, eq: 'P' },
    { from: 85.00, to: 85.99, transmutation: 89.29, eq: 'P' },
    { from: 86.00, to: 86.99, transmutation: 90.00, eq: 'P' },
    { from: 87.00, to: 87.99, transmutation: 90.71, eq: 'P' },
    { from: 88.00, to: 88.99, transmutation: 91.43, eq: 'P' },
    { from: 89.00, to: 89.99, transmutation: 92.14, eq: 'P' },
    { from: 90.00, to: 90.99, transmutation: 92.86, eq: 'P' },
    { from: 91.00, to: 91.99, transmutation: 93.57, eq: 'P' },
    { from: 92.00, to: 92.99, transmutation: 94.29, eq: 'P' },
    { from: 93.00, to: 93.99, transmutation: 95.00, eq: 'A' },
    { from: 94.00, to: 94.99, transmutation: 95.71, eq: 'A' },
    { from: 95.00, to: 95.99, transmutation: 96.43, eq: 'A' },
    { from: 96.00, to: 96.99, transmutation: 97.14, eq: 'A' },
    { from: 97.00, to: 97.50, transmutation: 97.86, eq: 'A' },
    { from: 97.51, to: 98.00, transmutation: 98.57, eq: 'A' },
    { from: 98.01, to: 99.00, transmutation: 99.29, eq: 'A' },
    { from: 99.01, to: 100.00, transmutation: 100.00, eq: 'A' }
  ],
  
  // EQ (Emotional Quotient) grading scale configuration
  EQ_GRADING_SCALE: {
    // Grade ranges and their corresponding EQ values (for transmuted grades - used in Character sheet)
    RANGES: [
      { min: 70, max: 74.44, value: 'NI', label: 'Needs Improvement' },
      { min: 74.45, max: 81.45, value: 'F', label: 'Fair' },
      { min: 81.45, max: 88.44, value: 'G', label: 'Good' },
      { min: 88.45, max: 94.44, value: 'VG', label: 'Very Good' },
      { min: 94.45, max: 100, value: 'O', label: 'Outstanding' }
    ]
  },
  
  // EQ grading scale for non-transmuted grades (used in MAPEH Final EQ)
  EQ_GRADING_SCALE_NON_TRANSMUTED: {
    RANGES: [
      { min: 70, max: 74.44, value: 'B', label: 'Below' },
      { min: 74.45, max: 81.44, value: 'D', label: 'Developing' },
      { min: 81.45, max: 88.44, value: 'AP', label: 'Approaching Proficient' },
      { min: 88.45, max: 94.44, value: 'P', label: 'Proficient' },
      { min: 94.45, max: 100, value: 'A', label: 'Advanced' }
    ]
  },
  
  // Alert messages for user operations
  MESSAGES: {
    // Success messages
    SUCCESS: {
      ASSIGNMENT_ADDED: 'Subject assigned',
      ASSIGNMENT_UPDATED: 'Subject updated',
      ASSIGNMENT_DELETED: 'Subject removed',
      SUBJECTS_BATCH_ADDED: '{total} subject(s) added',
      SUBJECTS_BATCH_DELETED: '{count} subject(s) removed',
      NO_SUBJECTS_TO_DELETE: 'No subjects to delete',
      ADVISORY_ADDED: 'Advisory assigned{deactivateMsg}',
      ADVISORY_DELETED: 'Advisory removed',
      ADVISORIES_BATCH_DELETED: '{count} advisory(ies) removed'
    },
    
    // Error messages
    ERROR: {
      TEMPLATE_GENERATION: 'Error generating template: {error}',
      TEMPLATE_EXISTS: 'Template file already exists!\n\nFile: {fileName}\nFolder: {folderName}\n\nPlease delete the existing file first if you want to regenerate it.\n\nExisting file: {fileUrl}',
      ASSIGNMENT_ADD: 'Error adding assignment: {error}',
      ASSIGNMENT_DELETE: 'Error deleting assignment: {error}',
      SUBJECTS_BATCH_ADD: 'Error adding subjects: {error}',
      SUBJECTS_BATCH_DELETE: 'Error deleting subjects: {error}',
      ADVISORY_ADD: 'Error adding advisory: {error}',
      ADVISORY_DELETE: 'Error deleting advisory: {error}',
      ADVISORIES_BATCH_DELETE: 'Error deleting advisories: {error}',
      SHEET_NOT_FOUND: '{sheetName} sheet not found',
      NOT_FOUND: '{item} not found',
      NO_ITEMS: 'No {items} provided',
      NO_MATCHES: 'No matching {items} found'
    },
    
    // Validation messages
    VALIDATION: {
      SUBJECT_ALREADY_ASSIGNED: '{gradeSection} - {subject} is already assigned to {teacher}. Cannot assign the same subject to a different teacher for the same class. Please deactivate the existing assignment first.',
      SUBJECTS_CONFLICT: 'Cannot assign subject(s) to a different teacher:\n\n{conflicts}\n\nPlease deactivate the existing assignment(s) first.',
      ADVISORY_ALREADY_ASSIGNED: '{gradeSection} already has an active advisory with {teacher}. Cannot assign another teacher to the same class. Please deactivate the existing advisory first.'
    }
  }
};

