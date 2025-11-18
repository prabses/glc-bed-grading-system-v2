/**
 * Google Apps Script for OGS Template Generation
 * This script provides functionality for generating Official Grade Sheet templates
 * Enhanced with API architecture for secure data operations
 * 
 * API functions are located in API.js
 */

/**
 * Creates the custom menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // Export OGS - directly runs the function (single item menu)
  ui.createMenu("Export OGS")
    .addItem("Export OGS", "showOGSTemplateDialog")
    .addToUi();

  // Menu submenu
  ui.createMenu("Menu")
    .addItem("Manage Subjects", "showAssignmentDialog")
    .addItem("Manage Advisory Classes", "showAdvisoryDialog")
    .addToUi();
}

/**
 * Shows the OGS template generation dialog with HTML interface
 */
function showOGSTemplateDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("OGSTemplateDialog")
    .setWidth(500)
    .setHeight(650)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Generate OGS Template");
}

/**
 * Shows the assignment management dialog
 */
function showAdvisoryDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("AdvisoryDialog")
    .setWidth(600)
    .setHeight(650)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Manage Advisory Classes");
}

function showAssignmentDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("AssignmentDialog")
    .setWidth(1100)
    .setHeight(650)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Manage Subjects");
}

/**
 * Gets active subjects from SUBJECTS_REF sheet
 * @return {Array} Array of active subject names
 */
function getActiveSubjects() {
  return getActiveItems(CONFIG.SHEET_NAMES.SUBJECTS_REF, 1);
}

/**
 * Gets active teachers from TEACHERS_REF sheet
 * @return {Array} Array of active teacher names
 */
function getActiveTeachers() {
  return getActiveItems(CONFIG.SHEET_NAMES.TEACHERS_REF, 1);
}

/**
 * Client-callable function to get all active teachers for autocomplete.
 * This function is called from the client-side HTML form.
 * @return {Array} Array of active teacher names
 */
function getTeachers() {
  try {
    return getActiveTeachers();
  } catch (error) {
    console.error('Error getting teachers:', error);
    return [];
  }
}

/**
 * Gets all dropdown data at once for performance optimization
 * @return {Object} Object containing gradeLevels, subjects, and teachers
 */
function getAllDropdownData() {
  try {
    // Add timeout protection and better error handling
    const gradeLevels = [];
    const subjects = [];
    const teachers = [];
    
    try {
      gradeLevels.push(...getGradeLevels());
    } catch (error) {
      console.error('Error getting grade levels:', error);
      // Continue with empty array
    }
    
    try {
      subjects.push(...getActiveSubjects());
    } catch (error) {
      console.error('Error getting subjects:', error);
      // Continue with empty array
    }
    
    try {
      teachers.push(...getActiveTeachers());
    } catch (error) {
      console.error('Error getting teachers:', error);
      // Continue with empty array
    }
    
    return { 
      gradeLevels: gradeLevels,
      subjects: subjects,
      teachers: teachers
    };
  } catch (error) {
    console.error('Error loading dropdown data:', error);
    // Return empty arrays instead of throwing to prevent hanging
    return { 
      gradeLevels: [],
      subjects: [],
      teachers: []
    };
  }
}

/**
 * Gets teachers assigned to a specific grade level and section
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Array} Array of teacher names
 */
function getAssignedTeachers(gradeLevel, section) {
  try {
    // Normalize grade level for comparison (sheet stores just numbers)
    const normalizedGradeLevel = normalizeGradeLevel(gradeLevel);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SUBJECTS);
    if (!sheet) {
      return []; // Return empty if sheet doesn't exist
    }
    
    const data = sheet.getDataRange().getValues();
    const teachers = [];
    
    // Skip header row (row 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = normalizeGradeLevel(String(row[CONFIG.SUBJECTS_COLUMNS.GRADE_LEVEL] || '').trim());
      if (rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.SUBJECTS_COLUMNS.SECTION] === section &&
          row[CONFIG.SUBJECTS_COLUMNS.STATUS] === 'Active') {
        const teacher = row[CONFIG.SUBJECTS_COLUMNS.TEACHER];
        if (teacher && !teachers.includes(teacher)) {
          teachers.push(teacher);
        }
      }
    }
    
    return teachers;
  } catch (error) {
    console.error('Error getting assigned teachers:', error);
    return [];
  }
}

/**
 * Gets subjects assigned to a specific teacher, grade level, and section
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @return {Array} Array of subject names
 */
function getAssignedSubjects(gradeLevel, section, teacher) {
  try {
    // Normalize grade level for comparison (sheet stores just numbers)
    const normalizedGradeLevel = normalizeGradeLevel(gradeLevel);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SUBJECTS);
    if (!sheet) {
      return []; // Return empty if sheet doesn't exist
    }
    
    const data = sheet.getDataRange().getValues();
    const subjects = [];
    
    // Skip header row (row 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = normalizeGradeLevel(String(row[CONFIG.SUBJECTS_COLUMNS.GRADE_LEVEL] || '').trim());
      if (rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.SUBJECTS_COLUMNS.SECTION] === section &&
          row[CONFIG.SUBJECTS_COLUMNS.TEACHER] === teacher &&
          row[CONFIG.SUBJECTS_COLUMNS.STATUS] === 'Active') {
        const subject = row[CONFIG.SUBJECTS_COLUMNS.SUBJECT];
        if (subject) {
          subjects.push(subject);
        }
      }
    }
    
    return subjects;
  } catch (error) {
    console.error('Error getting assigned subjects:', error);
    return [];
  }
}

/**
 * Helper function to normalize grade level for storage (removes "Grade " prefix)
 * Converts "Grade 1" or "1" to just "1"
 * @param {string} gradeLevel - The grade level (can be "Grade 1" or "1")
 * @return {string} Normalized grade level (just the number)
 */
function normalizeGradeLevel(gradeLevel) {
  if (!gradeLevel) return '';
  const str = String(gradeLevel).trim();
  // Remove "Grade " prefix if present, then extract just the number
  const cleaned = str.replace(/^Grade\s+/i, '');
  // Extract number (handles cases like "1", "10", etc.)
  const match = cleaned.match(/^\d+/);
  return match ? match[0] : cleaned;
}

/**
 * Helper function to format grade level for display (adds "Grade " prefix)
 * Converts "1" to "Grade 1"
 * @param {string} gradeLevel - The grade level (should be just the number)
 * @return {string} Formatted grade level with "Grade " prefix
 */
function formatGradeLevel(gradeLevel) {
  if (!gradeLevel) return '';
  const normalized = normalizeGradeLevel(gradeLevel);
  return normalized ? `Grade ${normalized}` : gradeLevel;
}

/**
 * Gets unique grade levels from SECTIONS_REF sheet
 * OPTIMIZED: Uses Set for O(1) duplicate detection and minimal data retrieval
 * Returns in the order they appear in the sheet (unsorted)
 * Sheet stores only numbers (1, 2, 3, 4), but returns formatted with "Grade " prefix for display
 * @return {Array} Array of unique grade levels formatted as "Grade 1", "Grade 2", etc.
 */
function getGradeLevels() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SECTIONS_REF);
    if (!sheet) {
      console.warn('SECTIONS_REF sheet not found');
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= CONFIG.HEADER_ROWS) {
      return []; // No data rows
    }
    
    // OPTIMIZATION 1: Only read column B (Grade Level - stores just numbers)
    const maxRows = Math.min(lastRow, CONFIG.HEADER_ROWS + 1000);
    const startRow = CONFIG.HEADER_ROWS + 1;
    const numRows = maxRows - CONFIG.HEADER_ROWS;
    const data = sheet.getRange(startRow, 2, numRows, 1).getValues();
    
    // OPTIMIZATION 2: Use Set for O(1) duplicate detection
    const gradeLevelSet = new Set();
    const gradeLevels = []; // Preserve order
    
    // Process data - sheet stores just numbers, format for display
    for (let i = 0; i < data.length; i++) {
      const rawGradeLevel = String(data[i][0]).trim();
      if (!rawGradeLevel) continue;
      
      // Normalize to just the number
      const normalized = normalizeGradeLevel(rawGradeLevel);
      
      // Format with "Grade " prefix for display and check for duplicates
      if (normalized && !gradeLevelSet.has(normalized)) {
        gradeLevelSet.add(normalized);
        gradeLevels.push(formatGradeLevel(normalized)); // Return "Grade 1", "Grade 2", etc.
      }
    }
    
    return gradeLevels;
  } catch (error) {
    console.error('Error in getGradeLevels:', error);
    return [];
  }
}

/**
 * Gets sections for a specific grade level
 * OPTIMIZED: Minimal data retrieval and efficient filtering
 * @param {string} gradeLevel - The grade level to filter by
 * @return {Array} Array of section names for the specified grade level
 */
function getSectionsForGrade(gradeLevel) {
  try {
    // OPTIMIZATION: Early return if gradeLevel is empty
    if (!gradeLevel || gradeLevel.trim() === '') {
      return [];
    }
    
    // Normalize the input grade level for comparison (sheet stores just numbers)
    const normalizedGradeLevel = normalizeGradeLevel(gradeLevel);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SECTIONS_REF);
    if (!sheet) {
      console.warn('SECTIONS_REF sheet not found');
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= CONFIG.HEADER_ROWS) {
      return [];
    }
    
    // OPTIMIZATION 1: Only read columns B-C (Grade Level, Section)
    const startRow = CONFIG.HEADER_ROWS + 1;
    const numRows = lastRow - CONFIG.HEADER_ROWS;
    const data = sheet.getRange(startRow, 2, numRows, 2).getValues();
    
    // OPTIMIZATION 2: Use Set for O(1) duplicate detection and faster lookups
    const sectionSet = new Set();
    const sections = [];
    
    // OPTIMIZATION 3: Single pass with efficient condition and duplicate prevention
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = normalizeGradeLevel(String(row[0] || '').trim());
      const section = String(row[1] || '').trim();
      
      // Match grade level (both normalized) and ensure section exists and not already added
      if (rowGradeLevel === normalizedGradeLevel && section && !sectionSet.has(section)) {
        sectionSet.add(section);
        sections.push(section);
      }
    }
    
    return sections;
  } catch (error) {
    console.error('Error in getSectionsForGrade:', error);
    return [];
  }
}

/**
 * Gets the level (Elementary/JHS/SHS) for a specific grade level
 * @param {string} gradeLevel - The grade level to look up
 * @return {string} The level (Elementary, JHS, or SHS)
 */
function getLevelForGrade(gradeLevel) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SECTIONS_REF);
  if (!sheet) {
    throw new Error('SECTIONS_REF sheet not found');
  }
  
  // Normalize the input grade level for comparison
  const normalizedGradeLevel = normalizeGradeLevel(gradeLevel);
  
  const data = sheet.getDataRange().getValues();
  
  // Skip 2 header rows (parent header + column headers)
  for (let i = CONFIG.HEADER_ROWS; i < data.length; i++) {
    const rowGradeLevel = normalizeGradeLevel(String(data[i][1] || '').trim());
    if (rowGradeLevel === normalizedGradeLevel && data[i][3]) {
      return data[i][3];
    }
  }
  
  // Default to empty string if not found
  return '';
}

/**
 * Gets active items from any reference sheet
 * OPTIMIZED: Minimal data retrieval - only reads target column and Active column
 * @param {string} sheetName - Name of the reference sheet
 * @param {number} columnIndex - Index of the column to retrieve (0-based)
 * @return {Array} Array of active items
 */
function getActiveItems(sheetName, columnIndex = 0) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      console.warn(`${sheetName} sheet not found`);
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow <= CONFIG.HEADER_ROWS || lastCol === 0) {
      return [];
    }
    
    // OPTIMIZATION 1: Only read 2 columns - target column and Active column
    const maxRows = Math.min(lastRow, CONFIG.HEADER_ROWS + 1000);
    const startRow = CONFIG.HEADER_ROWS + 1;
    const numRows = maxRows - CONFIG.HEADER_ROWS;
    
    // Read target column (columnIndex + 1) and Active column (lastCol)
    const targetColData = sheet.getRange(startRow, columnIndex + 1, numRows, 1).getValues();
    const activeColData = sheet.getRange(startRow, lastCol, numRows, 1).getValues();
    
    const items = [];
    
    // OPTIMIZATION 2: Parallel array processing
    for (let i = 0; i < targetColData.length; i++) {
      const activeValue = activeColData[i][0];
      
      // OPTIMIZATION 3: Simplified active check
      if ((activeValue === true || activeValue === '✓' || activeValue === 'TRUE') && targetColData[i][0]) {
        const item = String(targetColData[i][0]).trim();
        if (item) {
          items.push(item);
        }
      }
    }
    
    return items;
  } catch (error) {
    console.error(`Error in getActiveItems for ${sheetName}:`, error);
    return [];
  }
}

/**
 * Client-callable function to generate OGS template via API.
 * This function is called from the client-side HTML form.
 * @param {string} schoolYear - The school year (e.g., "2024-2025")
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @param {Array} subjects - Array of subject names
 * @return {Object} Result object with success status and message
 */
function generateOGSTemplate(schoolYear, gradeLevel, section, teacher, subjects) {
  const userEmail = Session.getActiveUser().getEmail();
  console.log(
    "Function generateOGSTemplate executed by: " + userEmail
  );
  return callApi("generateOGSTemplate", { 
    schoolYear, 
    gradeLevel, 
    section, 
    teacher,
    subjects,
    userEmail: userEmail
  });
}

/**
 * Client-callable function to add an assignment via API
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @param {string} subject - The subject name
 * @return {Object} Result object with success status
 */
function addAssignment(gradeLevel, section, teacher, subject) {
  const userEmail = Session.getActiveUser().getEmail();
  return callApi("addAssignment", {
    gradeLevel,
    section,
    teacher,
    subject,
    userEmail: userEmail
  });
}

/**
 * Client-callable function to add multiple subjects in batch via API (OPTIMIZED)
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @param {Array} subjects - Array of subject names
 * @return {Object} Result object with success status and counts
 */
function addSubjectsBatch(gradeLevel, section, teacher, subjects) {
  const userEmail = Session.getActiveUser().getEmail();
  return callApi("addSubjectsBatch", {
    gradeLevel,
    section,
    teacher,
    subjects: JSON.stringify(subjects), // Serialize array for API
    userEmail: userEmail
  });
}

/**
 * Client-callable function to get subjects via API
 * @param {string} gradeLevel - The grade level (optional)
 * @param {string} section - The section (optional)
 * @return {Array} Array of assignment objects
 */
function getSubjects(gradeLevel, section) {
  return callApi("getSubjects", {
    gradeLevel: gradeLevel || null,
    section: section || null
  });
}

/**
 * Client-callable function to delete an assignment via API
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @param {string} subject - The subject name
 * @return {Object} Result object with success status
 */
function deleteAssignment(gradeLevel, section, teacher, subject) {
  return callApi("deleteAssignment", {
    gradeLevel,
    section,
    teacher,
    subject
  });
}

/**
 * Client-callable function to delete multiple subjects in batch via API (OPTIMIZED)
 * Much faster than calling deleteAssignment multiple times
 * @param {Array} subjects - Array of assignment objects to delete
 * @return {Object} Result object with success status and counts
 */
function deleteSubjectsBatch(subjects) {
  return callApi("deleteSubjectsBatch", {
    subjects: JSON.stringify(subjects)
  });
}

/**
 * Client-callable function to add an advisory via API
 * @param {string} teacher - The teacher name
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Object} Result object with success status
 */
function addAdvisory(teacher, gradeLevel, section) {
  const userEmail = Session.getActiveUser().getEmail();
  return callApi("addAdvisory", {
    teacher,
    gradeLevel,
    section,
    userEmail: userEmail
  });
}

/**
 * Client-callable function to get advisories via API
 * @param {string} teacher - The teacher name (optional filter)
 * @return {Array} Array of advisory objects
 */
function getAdvisories(teacher) {
  return callApi("getAdvisories", {
    teacher: teacher || null
  });
}

/**
 * Client-callable function to delete an advisory via API
 * @param {string} teacher - The teacher name
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Object} Result object with success status
 */
function deleteAdvisory(teacher, gradeLevel, section) {
  return callApi("deleteAdvisory", {
    teacher,
    gradeLevel,
    section
  });
}

/**
 * Client-callable function to delete multiple advisories in batch via API (OPTIMIZED)
 * Much faster than calling deleteAdvisory multiple times
 * @param {Array} advisories - Array of advisory objects to delete
 * @return {Object} Result object with success status and counts
 */
function deleteAdvisoriesBatch(advisories) {
  return callApi("deleteAdvisoriesBatch", {
    advisories: JSON.stringify(advisories)
  });
}
