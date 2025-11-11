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

  ui.createMenu("Actions")
    .addItem("Generate OGS Template", "showOGSTemplateDialog")
    .addSeparator()
    .addItem("Manage Assignments", "showAssignmentDialog")
    .addItem("Manage Advisory Classes", "showAdvisoryDialog")
    .addToUi();
}

/**
 * Shows the OGS template generation dialog with HTML interface
 */
function showOGSTemplateDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("OGSTemplateDialog")
    .setWidth(500)
    .setHeight(600)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Generate OGS Template");
}

/**
 * Shows the assignment management dialog
 */
function showAdvisoryDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("AdvisoryDialog")
    .setWidth(600)
    .setHeight(700)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Manage Advisory Classes");
}

function showAssignmentDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("AssignmentDialog")
    .setWidth(600)
    .setHeight(700)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Manage Assignments");
}

/**
 * Gets active subjects from SUBJECTS_REFERENCE sheet
 * @return {Array} Array of active subject names
 */
function getActiveSubjects() {
  return getActiveItems(CONFIG.SHEET_NAMES.SUBJECTS_REFERENCE, 0);
}

/**
 * Gets active instructors from INSTRUCTORS_REFERENCE sheet
 * @return {Array} Array of active instructor names
 */
function getActiveInstructors() {
  return getActiveItems(CONFIG.SHEET_NAMES.INSTRUCTORS_REFERENCE, 0);
}

/**
 * Gets all dropdown data at once for performance optimization
 * @return {Object} Object containing gradeLevels, subjects, and instructors
 */
function getAllDropdownData() {
  try {
    // Add timeout protection and better error handling
    const gradeLevels = [];
    const subjects = [];
    const instructors = [];
    
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
      instructors.push(...getActiveInstructors());
    } catch (error) {
      console.error('Error getting instructors:', error);
      // Continue with empty array
    }
    
    return { 
      gradeLevels: gradeLevels,
      subjects: subjects,
      instructors: instructors
    };
  } catch (error) {
    console.error('Error loading dropdown data:', error);
    // Return empty arrays instead of throwing to prevent hanging
    return { 
      gradeLevels: [],
      subjects: [],
      instructors: []
    };
  }
}

/**
 * Gets instructors assigned to a specific grade level and section
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Array} Array of instructor names
 */
function getAssignedInstructors(gradeLevel, section) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.ASSIGNMENTS);
    if (!sheet) {
      return []; // Return empty if sheet doesn't exist
    }
    
    const data = sheet.getDataRange().getValues();
    const instructors = [];
    
    // Skip header row (row 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[CONFIG.ASSIGNMENTS_COLUMNS.GRADE_LEVEL] === gradeLevel &&
          row[CONFIG.ASSIGNMENTS_COLUMNS.SECTION] === section &&
          row[CONFIG.ASSIGNMENTS_COLUMNS.STATUS] === 'Active') {
        const instructor = row[CONFIG.ASSIGNMENTS_COLUMNS.INSTRUCTOR];
        if (instructor && !instructors.includes(instructor)) {
          instructors.push(instructor);
        }
      }
    }
    
    return instructors;
  } catch (error) {
    console.error('Error getting assigned instructors:', error);
    return [];
  }
}

/**
 * Gets subjects assigned to a specific instructor, grade level, and section
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} instructor - The instructor name
 * @return {Array} Array of subject names
 */
function getAssignedSubjects(gradeLevel, section, instructor) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.ASSIGNMENTS);
    if (!sheet) {
      return []; // Return empty if sheet doesn't exist
    }
    
    const data = sheet.getDataRange().getValues();
    const subjects = [];
    
    // Skip header row (row 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[CONFIG.ASSIGNMENTS_COLUMNS.GRADE_LEVEL] === gradeLevel &&
          row[CONFIG.ASSIGNMENTS_COLUMNS.SECTION] === section &&
          row[CONFIG.ASSIGNMENTS_COLUMNS.INSTRUCTOR] === instructor &&
          row[CONFIG.ASSIGNMENTS_COLUMNS.STATUS] === 'Active') {
        const subject = row[CONFIG.ASSIGNMENTS_COLUMNS.SUBJECT];
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
 * Gets unique grade levels from SECTIONS_REFERENCE sheet
 * OPTIMIZED: Uses Set for O(1) duplicate detection and minimal data retrieval
 * Returns in the order they appear in the sheet (unsorted)
 * @return {Array} Array of unique grade levels
 */
function getGradeLevels() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SECTIONS_REFERENCE);
    if (!sheet) {
      console.warn('SECTIONS_REFERENCE sheet not found');
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= CONFIG.HEADER_ROWS) {
      return []; // No data rows
    }
    
    // OPTIMIZATION 1: Only read column A (Grade Level)
    const maxRows = Math.min(lastRow, CONFIG.HEADER_ROWS + 1000);
    const startRow = CONFIG.HEADER_ROWS + 1;
    const numRows = maxRows - CONFIG.HEADER_ROWS;
    const data = sheet.getRange(startRow, 1, numRows, 1).getValues(); // Only column A
    
    // OPTIMIZATION 2: Use Set for O(1) duplicate detection
    const gradeLevelSet = new Set();
    const gradeLevels = []; // Preserve order
    
    // Process data
    for (let i = 0; i < data.length; i++) {
      const gradeLevel = String(data[i][0]).trim();
      
      // OPTIMIZATION 3: Single condition check
      if (gradeLevel && !gradeLevelSet.has(gradeLevel)) {
        gradeLevelSet.add(gradeLevel);
        gradeLevels.push(gradeLevel);
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
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SECTIONS_REFERENCE);
    if (!sheet) {
      console.warn('SECTIONS_REFERENCE sheet not found');
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= CONFIG.HEADER_ROWS) {
      return [];
    }
    
    // OPTIMIZATION 1: Only read columns A-B (Grade Level, Section)
    const startRow = CONFIG.HEADER_ROWS + 1;
    const numRows = lastRow - CONFIG.HEADER_ROWS;
    const data = sheet.getRange(startRow, 1, numRows, 2).getValues();
    
    // OPTIMIZATION 2: Use Set for O(1) duplicate detection and faster lookups
    const sectionSet = new Set();
    const sections = [];
    
    // OPTIMIZATION 3: Single pass with efficient condition and duplicate prevention
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = String(row[0] || '').trim();
      const section = String(row[1] || '').trim();
      
      // Match grade level and ensure section exists and not already added
      if (rowGradeLevel === gradeLevel && section && !sectionSet.has(section)) {
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAMES.SECTIONS_REFERENCE);
  if (!sheet) {
    throw new Error('SECTIONS_REFERENCE sheet not found');
  }
  
  const data = sheet.getDataRange().getValues();
  
  // Skip 2 header rows (parent header + column headers)
  for (let i = CONFIG.HEADER_ROWS; i < data.length; i++) {
    if (data[i][0] === gradeLevel && data[i][2]) {
      return data[i][2]; // Column C (Level)
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
 * @param {string} instructor - The instructor name
 * @param {Array} subjects - Array of subject names
 * @return {Object} Result object with success status and message
 */
function generateOGSTemplate(schoolYear, gradeLevel, section, instructor, subjects) {
  console.log(
    "Function generateOGSTemplate executed by: " + Session.getActiveUser().getEmail()
  );
  return callApi("generateOGSTemplate", { 
    schoolYear, 
    gradeLevel, 
    section, 
    instructor,
    subjects 
  });
}

/**
 * Client-callable function to add an assignment via API
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} instructor - The instructor name
 * @param {string} subject - The subject name
 * @return {Object} Result object with success status
 */
function addAssignment(gradeLevel, section, instructor, subject) {
  return callApi("addAssignment", {
    gradeLevel,
    section,
    instructor,
    subject
  });
}

/**
 * Client-callable function to add multiple assignments in batch via API (OPTIMIZED)
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} instructor - The instructor name
 * @param {Array} subjects - Array of subject names
 * @return {Object} Result object with success status and counts
 */
function addAssignmentsBatch(gradeLevel, section, instructor, subjects) {
  return callApi("addAssignmentsBatch", {
    gradeLevel,
    section,
    instructor,
    subjects: JSON.stringify(subjects) // Serialize array for API
  });
}

/**
 * Client-callable function to get assignments via API
 * @param {string} gradeLevel - The grade level (optional)
 * @param {string} section - The section (optional)
 * @return {Array} Array of assignment objects
 */
function getAssignments(gradeLevel, section) {
  return callApi("getAssignments", {
    gradeLevel: gradeLevel || null,
    section: section || null
  });
}

/**
 * Client-callable function to delete an assignment via API
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} instructor - The instructor name
 * @param {string} subject - The subject name
 * @return {Object} Result object with success status
 */
function deleteAssignment(gradeLevel, section, instructor, subject) {
  return callApi("deleteAssignment", {
    gradeLevel,
    section,
    instructor,
    subject
  });
}

/**
 * Client-callable function to delete multiple assignments in batch via API (OPTIMIZED)
 * Much faster than calling deleteAssignment multiple times
 * @param {Array} assignments - Array of assignment objects to delete
 * @return {Object} Result object with success status and counts
 */
function deleteAssignmentsBatch(assignments) {
  return callApi("deleteAssignmentsBatch", {
    assignments: JSON.stringify(assignments)
  });
}

/**
 * Client-callable function to add an advisory via API
 * @param {string} instructor - The instructor name
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Object} Result object with success status
 */
function addAdvisory(instructor, gradeLevel, section) {
  return callApi("addAdvisory", {
    instructor,
    gradeLevel,
    section
  });
}

/**
 * Client-callable function to get advisories via API
 * @param {string} instructor - The instructor name (optional filter)
 * @return {Array} Array of advisory objects
 */
function getAdvisories(instructor) {
  return callApi("getAdvisories", {
    instructor: instructor || null
  });
}

/**
 * Client-callable function to delete an advisory via API
 * @param {string} instructor - The instructor name
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Object} Result object with success status
 */
function deleteAdvisory(instructor, gradeLevel, section) {
  return callApi("deleteAdvisory", {
    instructor,
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
