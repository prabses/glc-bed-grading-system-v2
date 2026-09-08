/**
 * Configuration file for Template Masterfile System
 * This centralizes all configuration constants for easy maintenance
 */

const CONFIG = {
  // Web App URL - Update this after deploying the script as a web app
  // To deploy: Deploy > New deployment > Select type: Web app > Execute as: Me > Who has access: Anyone
  // Then copy the Web App URL (the one ending with /exec) and paste it below
  WEB_APP_URL: "https://script.google.com/a/macros/goldenlink.ph/s/AKfycbxVRV4ZxAIu0efimkBgAT7vvUB3htPWUtexNPK3IrIljl7STTSHfN-H2gnxNlabSXIDiQ/exec",
  //"https://script.google.com/a/macros/goldenlink.ph/s/AKfycbyapoAltdUJ3VWwxBZJqYYlb82F2P3lYmcRMsSY5JW6pxbUlajJ7TaI0VwHRiQ5zjUefA/exec",
  //"https://script.google.com/a/macros/goldenlink.ph/s/AKfycbzWWXxNIx5PwZuGqDyqeQzHxZ3kqq9ya8SJLefVINkn1uS8XRbgLubF5A2gxqcCaFnjOQ/exec", // Replace with your /exec URL after deployment
  
  // API Key for securing the API - This is a unique identifier
  // Keep this secret and don't share it publicly
  API_KEY: "YTM0NzhkODItZmU4Zi00YjczLWI5ZGQtZGVhNjYxZGI4ZmFi",
  
  // Spreadsheet ID - Will use the active spreadsheet
  // This is determined dynamically, no need to hardcode
  get SPREADSHEET_ID() {
    return SpreadsheetApp.getActiveSpreadsheet().getId();
  },
  
  // STUDENTS DB Spreadsheet URL - Full URL to the students database spreadsheet
  STUDENTS_DB_URL: "https://docs.google.com/spreadsheets/d/1Yx2YepcY1EId2tleMJN-Z9jh_CLRh7npt79ycK0gaIg/edit?gid=1882876298#gid=1882876298",
  
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
    CHARACTERS_REF: 'CHARACTERS_REF',
    TRANSMUTATION_REF: 'TRANSMUTATION_REF'
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
    DARK_GRAY: '#d9d9d9',  // Dark gray for headers and formula columns
    MEDIUM_GRAY: '#e6e6e6', // Medium gray for grading period headers
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
        FORMULA_COLUMNS: [6, 7, 8, 12, 13, 14, 18, 19, 20, 21, 22]  // Columns F, G, H, L, M, N, R, S, T, U, V
      },
      // Character sheet protection ranges
      CHARACTER_SHEET: {
        STUDENT_INFO_COLUMNS: [1, 2],  // Columns A-B
        HEADER_ROW: 7,  // Row 7 (column headers)
        FORMULA_COLUMNS: [3, 5, 7, 9, 11]  // Columns C, E, G, I, K
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
        FORMULA_COLUMNS: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
      }
    }
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
      ATTENDANCE_REF_MISSING: 'Cannot generate template: no school days are set up for school year {schoolYear} in ATTENDANCE_REF.\n\nThis teacher is an advisor for Grade {gradeLevel}{section}, so an Attendance sheet must be included. Please add the monthly school days for {schoolYear} to ATTENDANCE_REF first.',
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
      ADVISORY_ALREADY_ASSIGNED: '{gradeSection} already has an active advisory with {teacher}. Cannot assign another teacher to the same class. Please deactivate the existing advisory first.',
      TEACHER_NOT_FOUND: '"{teacher}" is not an active teacher in TEACHERS_REF. Please select a teacher from the list.'
    }
  },
  
  WORKING_INSTRUCTIONS_URL: "https://template-masterfile.vercel.app/"
};

