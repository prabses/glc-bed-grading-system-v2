/**
 * Configuration file for Template Masterfile System
 * This centralizes all configuration constants for easy maintenance
 */

const CONFIG = {
  // Web App URL - Update this after deploying the script as a web app
  // To deploy: Deploy > New deployment > Select type: Web app > Execute as: Me > Who has access: Anyone
  // Then copy the Web App URL (the one ending with /exec) and paste it below
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxS2Gi9OUCOoJcN_lA89f7NuLWk5GjwbeyYBRHbt2dn3b-KdQ20mCzk12U6ve3A7wW1/exec", // Replace with your /exec URL after deployment
  
  // API Key for securing the API - This is a unique identifier
  // Keep this secret and don't share it publicly
  API_KEY: "YTM0NzhkODItZmU4Zi00YjczLWI5ZGQtZGVhNjYxZGI4ZmFi",
  
  // Spreadsheet ID - Will use the active spreadsheet
  // This is determined dynamically, no need to hardcode
  get SPREADSHEET_ID() {
    return SpreadsheetApp.getActiveSpreadsheet().getId();
  },
  
  // STUDENTS DB Spreadsheet Name - Located in the same folder as Template Masterfile
  STUDENTS_DB_NAME: "STUDENTS DB",
  
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
  
  // Background colors for status
  COLORS: {
    ACTIVE: '#d9ead3',    // Green background
    ARCHIVED: '#efefef'   // Gray background
  },
  
  // Template configuration
  TEMPLATE: {
    NUM_STUDENT_ROWS: 30,           // Number of student rows to pre-create
    PASSING_GRADE: 75,               // Minimum passing grade
    STUDENT_COLUMNS: [               // Standard student information columns
      'Student Number',
      'Last Name',
      'First Name',
      'Middle Name'
    ],
    // Protection settings
    // Set to false to disable sheet protections (much faster generation, ~5-15 seconds vs ~90-100 seconds)
    // Set to true to enable protections (required for sharing with others - protects student info, headers, and formulas)
    ENABLE_PROTECTIONS: false
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

