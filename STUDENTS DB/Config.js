/**
 * Configuration file for Student Database System
 * This centralizes all configuration constants for easy maintenance
 */

const CONFIG = {
  // Web App URL - Update this after deploying the script as a web app
  // To deploy: Deploy > New deployment > Select type: Web app > Execute as: Me > Who has access: Anyone
  // Then copy the Web App URL (the one ending with /exec) and paste it below
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycby73j38q05Dq30giz18WazbEsybDzciLJP1abnh4alWPrtmeMxc4iMrkbSmsGYGmhMoHQ/exec", // Replace with your /exec URL after deployment
  
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
    STRAND: 6,
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
    'Strand',
    'Gender'
  ],
  
  // Student fields that can be updated (excludes Student Number)
  UPDATABLE_FIELDS: [
    'Last Name',
    'First Name',
    'Middle Name',
    'Grade Level',
    'Section',
    'Strand',
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
    'Strand': 7,
    'Gender': 8
  },
  
  // Sheet names
  SHEET_NAMES: {
    UPDATE_LOG: 'Update Log'
  },
  
  // Data row configuration
  DATA_START_ROW: 3, // Student data starts from row 3
  HEADER_ROWS: 2, // Rows 1-2 contain headers
  
  // Working Instructions HTML file name (without .html extension)
  WORKING_INSTRUCTIONS_HTML: "Working_Instructions"
};

