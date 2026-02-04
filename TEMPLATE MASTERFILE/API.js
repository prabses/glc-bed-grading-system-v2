/**
 * API.js - API Architecture Layer for Template Masterfile System
 * This file contains all API-related functions for secure data operations
 * 
 * Functions in this file:
 * - doPost() - API endpoint handler
 * - callApi() - API client function
 * - Helper functions (getSpreadsheet, getSheet)
 * - Internal functions (_generateOGSTemplate, _getActiveItems, etc.)
 */

/**
 * Helper function to get the active spreadsheet
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Helper function to get a sheet by name
 * @param {string} sheetName - The sheet name
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

/**
 * doPost handles API requests for writing data.
 * This runs as the script owner, bypassing sheet protections.
 * @param {Object} e - The event object from the POST request.
 * @return {ContentService.TextOutput} JSON response.
 */
function doPost(e) {
  console.log("Function doPost executed by: API/Script Owner");
  const response = (statusCode, message) =>
    ContentService.createTextOutput(
      JSON.stringify({
        statusCode,
        message,
      })
    ).setMimeType(ContentService.MimeType.JSON);

  try {
    const params = JSON.parse(e.postData.contents);
    const { apiKey, action, payload } = params;

    if (apiKey !== CONFIG.API_KEY) {
      return response(401, "Unauthorized: Invalid API Key.");
    }

    switch (action) {
      case "generateOGSTemplate":
        return response(200, _generateOGSTemplate(
          payload.schoolYear,
          payload.gradeLevel,
          payload.section,
          payload.teacher,
          payload.subjects || [],
          payload.userEmail
        ));
      case "addAssignment":
        return response(200, _addAssignment(
          payload.gradeLevel,
          payload.section,
          payload.teacher,
          payload.subject,
          payload.strand || CONFIG.SHS_DEFAULTS.STRAND,
          payload.category || CONFIG.SHS_DEFAULTS.CATEGORY,
          payload.semester || CONFIG.SHS_DEFAULTS.SEMESTER,
          payload.userEmail
        ));
      case "addSubjectsBatch":
        return response(200, _addSubjectsBatch(
          payload.gradeLevel,
          payload.section,
          payload.teacher,
          typeof payload.subjects === 'string' ? JSON.parse(payload.subjects) : payload.subjects,
          payload.userEmail
        ));
      case "getSubjects":
        return response(200, _getSubjects(
          payload.gradeLevel,
          payload.section
        ));
      case "deleteAssignment":
        return response(200, _deleteAssignment(
          payload.gradeLevel,
          payload.section,
          payload.teacher,
          payload.subject
        ));
      case "deleteSubjectsBatch":
        return response(200, _deleteSubjectsBatch(
          typeof payload.subjects === 'string' ? JSON.parse(payload.subjects) : payload.subjects
        ));
      case "addAdvisory":
        return response(200, _addAdvisory(
          payload.teacher,
          payload.gradeLevel,
          payload.section,
          payload.userEmail
        ));
      case "getAdvisories":
        return response(200, _getAdvisories(
          payload.teacher
        ));
      case "deleteAdvisory":
        return response(200, _deleteAdvisory(
          payload.teacher,
          payload.gradeLevel,
          payload.section
        ));
      case "deleteAdvisoriesBatch":
        return response(200, _deleteAdvisoriesBatch(
          typeof payload.advisories === 'string' ? JSON.parse(payload.advisories) : payload.advisories
        ));
      case "getSchoolYears":
        return response(200, _getSchoolYears());
      case "getGradeLevels":
        return response(200, _getGradeLevels());
      case "getSubjectsMetadata":
        return response(200, _getSubjectsMetadata(
          payload.subjectNames || []
        ));
      case "getSubjectMetadata":
        return response(200, _getSubjectMetadata(
          payload.subjectName
        ));
      case "getActiveSubjectsByLevel":
        return response(200, _getActiveSubjectsByLevel(
          payload.gradeLevel
        ));
      case "getActiveItems":
        return response(200, _getActiveItems(
          payload.sheetName,
          payload.columnIndex || 0
        ));
      case "getSectionsForGrade":
        return response(200, _getSectionsForGrade(
          payload.gradeLevel
        ));
      case "getAssignedTeachers":
        return response(200, _getAssignedTeachers(
          payload.gradeLevel,
          payload.section
        ));
      case "getAssignedSubjects":
        return response(200, _getAssignedSubjects(
          payload.gradeLevel,
          payload.section,
          payload.teacher
        ));
      default:
        return response(400, "Bad Request: Invalid action.");
    }
  } catch (error) {
    console.error("Error in doPost:", error);
    return response(500, `Internal Server Error: ${error.message}`);
  }
}

/**
 * Helper function to format message with placeholders
 * @param {string} template - Message template with {placeholder} syntax
 * @param {Object} values - Object with placeholder values
 * @return {string} Formatted message
 */
function _formatMessage(template, values = {}) {
  let message = template;
  for (const [key, value] of Object.entries(values)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return message;
}

/**
 * Routes a request to the doPost API.
 * @param {string} action - The action to perform.
 * @param {Object} payload - The data for the action.
 * @return {Object} The JSON response from the API.
 */
function callApi(action, payload) {
  console.log("Function callApi executed by: " + Session.getActiveUser().getEmail());
  const webAppUrl = CONFIG.WEB_APP_URL;
  
  // Check if Web App URL is configured
  if (!webAppUrl || webAppUrl === "YOUR_WEB_APP_URL_HERE") {
    throw new Error("Web App URL not configured. Please deploy the script as a web app and update CONFIG.WEB_APP_URL in Config.js");
  }
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      apiKey: CONFIG.API_KEY,
      action: action,
      payload: payload,
    }),
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken(),
    },
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(webAppUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    console.error(
      `API call failed with response code ${responseCode}. Response: ${responseText}`
    );
    throw new Error(
      `The server responded with an error (${responseCode}). Please check the logs for more details.`
    );
  }

  try {
    const result = JSON.parse(responseText);
    if (result.statusCode !== 200) {
      throw new Error(result.message);
    }
    return result.message;
  } catch (e) {
    console.error(`Failed to parse JSON response: ${responseText}`);
    throw new Error("Received an invalid response from the server.");
  }
}

/**
 * Internal function to get active items from any reference sheet
 * @param {string} sheetName - Name of the reference sheet
 * @param {number} columnIndex - Index of the column to retrieve (0-based)
 * @return {Array} Array of active items
 */
function _getActiveItems(sheetName, columnIndex = 0) {
  try {
    const sheet = getSheet(sheetName);
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
    console.error(`Error in _getActiveItems for ${sheetName}:`, error);
    return [];
  }
}

/**
 * Internal function to get subject metadata from SUBJECTS_REF sheet
 * @param {string} subjectName - The subject name to look up
 * @return {Object} Object with category, strand, semester, level or defaults if not found
 */
function _getSubjectMetadata(subjectName) {
  try {
    if (!CONFIG.IS_SHS) {
      // For non-SHS, return defaults
      return {
        category: CONFIG.SHS_DEFAULTS.CATEGORY,
        strand: CONFIG.SHS_DEFAULTS.STRAND,
        semester: CONFIG.SHS_DEFAULTS.SEMESTER,
        level: null
      };
    }
    
    const sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS_REF);
    if (!sheet) {
      console.warn('SUBJECTS_REF sheet not found');
      return {
        category: CONFIG.SHS_DEFAULTS.CATEGORY,
        strand: CONFIG.SHS_DEFAULTS.STRAND,
        semester: CONFIG.SHS_DEFAULTS.SEMESTER,
        level: null
      };
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= CONFIG.HEADER_ROWS) {
      return {
        category: CONFIG.SHS_DEFAULTS.CATEGORY,
        strand: CONFIG.SHS_DEFAULTS.STRAND,
        semester: CONFIG.SHS_DEFAULTS.SEMESTER,
        level: null
      };
    }
    
    const startRow = CONFIG.HEADER_ROWS + 1;
    const numRows = lastRow - CONFIG.HEADER_ROWS;
    
    // Read columns B-G (Subject Name, Category, Strand, Semester, Level, Active)
    // Column A is "No." and is ignored
    const data = sheet.getRange(startRow, 2, numRows, 6).getValues();
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowSubjectName = String(row[CONFIG.SUBJECTS_REF_COLUMNS.SUBJECT_NAME] || '').trim();
      const activeValue = row[CONFIG.SUBJECTS_REF_COLUMNS.ACTIVE];
      
      // Check if subject matches and is active
      if (rowSubjectName === subjectName && 
          (activeValue === true || activeValue === '✓' || activeValue === 'TRUE')) {
        return {
          category: String(row[CONFIG.SUBJECTS_REF_COLUMNS.CATEGORY] || '').trim() || CONFIG.SHS_DEFAULTS.CATEGORY,
          strand: String(row[CONFIG.SUBJECTS_REF_COLUMNS.STRAND] || '').trim() || CONFIG.SHS_DEFAULTS.STRAND,
          semester: String(row[CONFIG.SUBJECTS_REF_COLUMNS.SEMESTER] || '').trim() || CONFIG.SHS_DEFAULTS.SEMESTER,
          level: String(row[CONFIG.SUBJECTS_REF_COLUMNS.LEVEL] || '').trim() || null
        };
      }
    }
    
    // Subject not found, return defaults
    return {
      category: CONFIG.SHS_DEFAULTS.CATEGORY,
      strand: CONFIG.SHS_DEFAULTS.STRAND,
      semester: CONFIG.SHS_DEFAULTS.SEMESTER,
      level: null
    };
  } catch (error) {
    console.error('Error getting subject metadata:', error);
    return {
      category: CONFIG.SHS_DEFAULTS.CATEGORY,
      strand: CONFIG.SHS_DEFAULTS.STRAND,
      semester: CONFIG.SHS_DEFAULTS.SEMESTER,
      level: null
    };
  }
}

/**
 * Internal function to get metadata for multiple subjects at once
 * @param {Array} subjectNames - Array of subject names
 * @return {Object} Object mapping subject names to their metadata
 */
function _getSubjectsMetadata(subjectNames) {
  try {
    if (!CONFIG.IS_SHS || !subjectNames || subjectNames.length === 0) {
      // Return defaults for all subjects if not SHS
      const defaults = {
        category: CONFIG.SHS_DEFAULTS.CATEGORY,
        strand: CONFIG.SHS_DEFAULTS.STRAND,
        semester: CONFIG.SHS_DEFAULTS.SEMESTER,
        level: null
      };
      const result = {};
      subjectNames.forEach(name => {
        result[name] = defaults;
      });
      return result;
    }
    
    const sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS_REF);
    if (!sheet) {
      console.warn('SUBJECTS_REF sheet not found');
      const defaults = {
        category: CONFIG.SHS_DEFAULTS.CATEGORY,
        strand: CONFIG.SHS_DEFAULTS.STRAND,
        semester: CONFIG.SHS_DEFAULTS.SEMESTER,
        level: null
      };
      const result = {};
      subjectNames.forEach(name => {
        result[name] = defaults;
      });
      return result;
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= CONFIG.HEADER_ROWS) {
      const defaults = {
        category: CONFIG.SHS_DEFAULTS.CATEGORY,
        strand: CONFIG.SHS_DEFAULTS.STRAND,
        semester: CONFIG.SHS_DEFAULTS.SEMESTER,
        level: null
      };
      const result = {};
      subjectNames.forEach(name => {
        result[name] = defaults;
      });
      return result;
    }
    
    const startRow = CONFIG.HEADER_ROWS + 1;
    const numRows = lastRow - CONFIG.HEADER_ROWS;
    
    // Read columns B-G (Subject Name, Category, Strand, Semester, Level, Active)
    // Column A is "No." and is ignored
    const data = sheet.getRange(startRow, 2, numRows, 6).getValues();
    
    // Create a map for quick lookup
    const subjectMap = {};
    const subjectSet = new Set(subjectNames);
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowSubjectName = String(row[CONFIG.SUBJECTS_REF_COLUMNS.SUBJECT_NAME] || '').trim();
      const activeValue = row[CONFIG.SUBJECTS_REF_COLUMNS.ACTIVE];
      
      // Only process if subject is in our list and is active
      if (subjectSet.has(rowSubjectName) && 
          (activeValue === true || activeValue === '✓' || activeValue === 'TRUE')) {
        subjectMap[rowSubjectName] = {
          category: String(row[CONFIG.SUBJECTS_REF_COLUMNS.CATEGORY] || '').trim() || CONFIG.SHS_DEFAULTS.CATEGORY,
          strand: String(row[CONFIG.SUBJECTS_REF_COLUMNS.STRAND] || '').trim() || CONFIG.SHS_DEFAULTS.STRAND,
          semester: String(row[CONFIG.SUBJECTS_REF_COLUMNS.SEMESTER] || '').trim() || CONFIG.SHS_DEFAULTS.SEMESTER,
          level: String(row[CONFIG.SUBJECTS_REF_COLUMNS.LEVEL] || '').trim() || null
        };
      }
    }
    
    // Fill in defaults for subjects not found
    const defaults = {
      category: CONFIG.SHS_DEFAULTS.CATEGORY,
      strand: CONFIG.SHS_DEFAULTS.STRAND,
      semester: CONFIG.SHS_DEFAULTS.SEMESTER,
      level: null
    };
    
    subjectNames.forEach(name => {
      if (!subjectMap[name]) {
        subjectMap[name] = defaults;
      }
    });
    
    return subjectMap;
  } catch (error) {
    console.error('Error getting subjects metadata:', error);
    // Return defaults for all subjects on error
    const defaults = {
      category: CONFIG.SHS_DEFAULTS.CATEGORY,
      strand: CONFIG.SHS_DEFAULTS.STRAND,
      semester: CONFIG.SHS_DEFAULTS.SEMESTER,
      level: null
    };
    const result = {};
    subjectNames.forEach(name => {
      result[name] = defaults;
    });
    return result;
  }
}

/**
 * Internal function to get active subjects filtered by level from SUBJECTS_REF sheet
 * @param {string} gradeLevel - The grade level to filter by (e.g., "Grade 11" or "11")
 * @return {Array} Array of active subject names for the specified level
 */
function _getActiveSubjectsByLevel(gradeLevel) {
  try {
    if (!CONFIG.IS_SHS) {
      // For non-SHS, return all active subjects (no level filtering)
      return _getActiveItems(CONFIG.SHEET_NAMES.SUBJECTS_REF, 1);
    }
    
    const sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS_REF);
    if (!sheet) {
      console.warn('SUBJECTS_REF sheet not found');
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= CONFIG.HEADER_ROWS) {
      return [];
    }
    
    // Normalize grade level for comparison (extract just the number)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    const startRow = CONFIG.HEADER_ROWS + 1;
    const numRows = lastRow - CONFIG.HEADER_ROWS;
    
    // Read columns B-G (Subject Name, Category, Strand, Semester, Level, Active)
    // Column A is "No." and is ignored
    const data = sheet.getRange(startRow, 2, numRows, 6).getValues();
    
    const subjects = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowSubjectName = String(row[CONFIG.SUBJECTS_REF_COLUMNS.SUBJECT_NAME] || '').trim();
      const rowLevel = String(row[CONFIG.SUBJECTS_REF_COLUMNS.LEVEL] || '').trim();
      const activeValue = row[CONFIG.SUBJECTS_REF_COLUMNS.ACTIVE];
      
      // Check if subject is active
      if (!(activeValue === true || activeValue === '✓' || activeValue === 'TRUE')) {
        continue;
      }
      
      // If level is empty/null, include it (for backward compatibility or non-SHS subjects)
      // Otherwise, only include if level matches the selected grade level
      if (!rowLevel || rowLevel === '') {
        // Include subjects with no level specified (backward compatibility)
        if (rowSubjectName) {
          subjects.push(rowSubjectName);
        }
      } else {
        // Normalize row level for comparison
        const normalizedRowLevel = _normalizeGradeLevel(rowLevel);
        // Include if level matches
        if (normalizedRowLevel === normalizedGradeLevel && rowSubjectName) {
          subjects.push(rowSubjectName);
        }
      }
    }
    
    return subjects;
  } catch (error) {
    console.error('Error getting subjects by level:', error);
    // Fallback to all active subjects on error
    return _getActiveItems(CONFIG.SHEET_NAMES.SUBJECTS_REF, 1);
  }
}

/**
 * Helper function to normalize grade level for storage (removes "Grade " prefix)
 * Converts "Grade 1" or "1" to just "1"
 * @param {string} gradeLevel - The grade level (can be "Grade 1" or "1")
 * @return {string} Normalized grade level (just the number)
 */
function _normalizeGradeLevel(gradeLevel) {
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
function _formatGradeLevel(gradeLevel) {
  if (!gradeLevel) return '';
  const normalized = _normalizeGradeLevel(gradeLevel);
  return normalized ? `Grade ${normalized}` : gradeLevel;
}

/**
 * Internal function to get unique grade levels from SECTIONS_REF sheet
 * OPTIMIZED: Uses Set for O(1) duplicate detection and minimal data retrieval
 * Returns in the order they appear in the sheet (unsorted)
 * Sheet stores only numbers (1, 2, 3, 4), but returns formatted with "Grade " prefix for display
 * @return {Array} Array of unique grade levels formatted as "Grade 1", "Grade 2", etc.
 */
function _getGradeLevels() {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.SECTIONS_REF);
    if (!sheet) {
      console.warn('SECTIONS_REF sheet not found');
      return [];
    }
    
    const startRow = CONFIG.HEADER_ROWS + 1;
    const maxRows = 1000;
    const data = sheet.getRange(startRow, 2, maxRows, 1).getValues();
    
    // OPTIMIZATION 2: Use Set for O(1) duplicate detection
    const gradeLevelSet = new Set();
    const gradeLevels = []; // Preserve order
    
    // Process data - sheet stores just numbers, format for display
    for (let i = 0; i < data.length; i++) {
      const rawGradeLevel = String(data[i][0]).trim();
      if (!rawGradeLevel) continue;
      
      // Normalize to just the number
      const normalized = _normalizeGradeLevel(rawGradeLevel);
      
      if (!normalized || normalized === '') continue;
      
      const normalizedStr = String(normalized);
      if (!gradeLevelSet.has(normalizedStr)) {
        gradeLevelSet.add(normalizedStr);
        gradeLevels.push(_formatGradeLevel(normalizedStr));
      }
    }
    
    return gradeLevels;
  } catch (error) {
    console.error('Error in _getGradeLevels:', error);
    return [];
  }
}

/**
 * Internal function to get sections for a specific grade level
 * OPTIMIZED: Minimal data retrieval and efficient filtering
 * @param {string} gradeLevel - The grade level to filter by
 * @return {Array} Array of section names for the specified grade level
 */
function _getSectionsForGrade(gradeLevel) {
  try {
    // OPTIMIZATION: Early return if gradeLevel is empty
    if (!gradeLevel || gradeLevel.trim() === '') {
      return [];
    }
    
    // Normalize the input grade level for comparison (sheet stores just numbers)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    const sheet = getSheet(CONFIG.SHEET_NAMES.SECTIONS_REF);
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
      const rowGradeLevel = _normalizeGradeLevel(String(row[0] || '').trim());
      const section = String(row[1] || '').trim();
      
      // Match grade level (both normalized) and ensure section exists and not already added
      if (rowGradeLevel === normalizedGradeLevel && section && !sectionSet.has(section)) {
        sectionSet.add(section);
        sections.push(section);
      }
    }
    
    return sections;
  } catch (error) {
    console.error('Error in _getSectionsForGrade:', error);
    return [];
  }
}

/**
 * Internal function to get teachers assigned to a specific grade level and section
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Array} Array of teacher names
 */
function _getAssignedTeachers(gradeLevel, section) {
  try {
    // Normalize grade level for comparison (sheet stores just numbers)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    const sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS);
    if (!sheet) {
      return []; // Return empty if sheet doesn't exist
    }
    
    const data = sheet.getDataRange().getValues();
    const teachers = [];
    const teacherSet = new Set(); // Use Set for O(1) duplicate detection
    
    // Skip header row (row 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.SUBJECTS_COLUMNS.GRADE_LEVEL] || '').trim());
      if (rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.SUBJECTS_COLUMNS.SECTION] === section &&
          row[CONFIG.SUBJECTS_COLUMNS.STATUS] === 'Active') {
        const teacher = row[CONFIG.SUBJECTS_COLUMNS.TEACHER];
        if (teacher && !teacherSet.has(teacher)) {
          teacherSet.add(teacher);
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
 * Internal function to get subjects assigned to a specific teacher, grade level, and section
 * Returns objects with subject, strand, category, semester for SHS filtering in OGS dialog
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @return {Array} Array of { subject, strand, category, semester } (strand/category/semester from SUBJECTS sheet)
 */
function _getAssignedSubjects(gradeLevel, section, teacher) {
  try {
    // Normalize grade level for comparison (sheet stores just numbers)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    const sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS);
    if (!sheet) {
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const assignments = [];
    
    // Skip header row (row 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.SUBJECTS_COLUMNS.GRADE_LEVEL] || '').trim());
      if (rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.SUBJECTS_COLUMNS.SECTION] === section &&
          row[CONFIG.SUBJECTS_COLUMNS.TEACHER] === teacher &&
          row[CONFIG.SUBJECTS_COLUMNS.STATUS] === 'Active') {
        const subject = row[CONFIG.SUBJECTS_COLUMNS.SUBJECT];
        if (subject) {
          const strand = String(row[CONFIG.SUBJECTS_COLUMNS.STRAND] || '').trim() || CONFIG.SHS_DEFAULTS.STRAND;
          const category = String(row[CONFIG.SUBJECTS_COLUMNS.CATEGORY] || '').trim() || CONFIG.SHS_DEFAULTS.CATEGORY;
          const semester = String(row[CONFIG.SUBJECTS_COLUMNS.SEMESTER] || '').trim() || CONFIG.SHS_DEFAULTS.SEMESTER;
          assignments.push({ subject: subject, strand: strand, category: category, semester: semester });
        }
      }
    }
    
    return assignments;
  } catch (error) {
    console.error('Error getting assigned subjects:', error);
    return [];
  }
}

/**
 * Internal function to get the level (Elementary/JHS/SHS) for a specific grade level
 * @param {string} gradeLevel - The grade level to look up (can be "Grade 1" or "1")
 * @return {string} The level (Elementary, JHS, or SHS)
 */
function _getLevelForGrade(gradeLevel) {
  const sheet = getSheet(CONFIG.SHEET_NAMES.SECTIONS_REF);
  if (!sheet) {
    throw new Error('SECTIONS_REF sheet not found');
  }
  
  const data = sheet.getDataRange().getValues();
  
  // Normalize the input grade level for comparison
  const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
  
  // Skip 2 header rows (parent header + column headers)
  for (let i = CONFIG.HEADER_ROWS; i < data.length; i++) {
    const rowGradeLevel = _normalizeGradeLevel(data[i][1]);
    if (rowGradeLevel === normalizedGradeLevel && data[i][3]) {
      return data[i][3];
    }
  }
  
  // Default to empty string if not found
  return '';
}

/**
 * Helper function to convert column number (1-based) to column letter(s)
 * Handles columns beyond Z (AA, AB, AC, etc.)
 * @param {number} colNum - Column number (1-based, where 1 = A, 27 = AA, etc.)
 * @return {string} Column letter(s) (e.g., "A", "Z", "AA", "AB")
 */
function _columnNumberToLetter(colNum) {
  let result = '';
  let num = colNum;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 * Internal function to get grading weights for a subject
 * @param {string} subjectName - The subject name
 * @return {Object} Object with writtenWork, performanceTask, and assessment weights
 */
function _getGradingWeights(subjectName) {
  const sheet = getSheet(CONFIG.SHEET_NAMES.GRADING_REF);
  if (!sheet) {
    throw new Error('GRADING_REF sheet not found');
  }
  
  const data = sheet.getDataRange().getValues();
  
  // Skip 2 header rows (parent header + column headers)
  const dataRows = data.slice(CONFIG.HEADER_ROWS);
  
  // Helper function to check if active (handles both checkboxes and checkmarks)
  const isActive = (value) => value === true || value === '✓' || value === 'TRUE';
  
  // Normalize subject name for comparison (trim whitespace, but keep case for exact match)
  const normalizedSubjectName = String(subjectName || '').trim();
  
  // Priority 1: Exact subject match (trimmed, case-sensitive)
  let match = dataRows.find(row => {
    const rowSubjectName = String(row[CONFIG.GRADING_COLUMNS.SUBJECT_NAME] || '').trim();
    return rowSubjectName === normalizedSubjectName && 
           isActive(row[CONFIG.GRADING_COLUMNS.ACTIVE]);
  });
  
  // Priority 2: DEFAULT (fallback)
  if (!match) {
    match = dataRows.find(row => {
      const rowSubjectName = String(row[CONFIG.GRADING_COLUMNS.SUBJECT_NAME] || '').trim();
      return rowSubjectName === 'DEFAULT' && 
             isActive(row[CONFIG.GRADING_COLUMNS.ACTIVE]);
    });
  }
  
  if (!match) {
    // Debug: Log available subjects for troubleshooting
    const availableSubjects = dataRows
      .filter(row => isActive(row[CONFIG.GRADING_COLUMNS.ACTIVE]))
      .map(row => String(row[CONFIG.GRADING_COLUMNS.SUBJECT_NAME] || '').trim())
      .filter(name => name !== '');
    console.log('Available active subjects in GRADING_REF:', availableSubjects);
    console.log('Looking for subject:', normalizedSubjectName);
    throw new Error('No grading weights found. Please ensure GRADING_REF has a DEFAULT row or a matching subject row with Active checked.');
  }
  
  return {
    writtenWork: match[CONFIG.GRADING_COLUMNS.WRITTEN_WORK],
    performanceTask: match[CONFIG.GRADING_COLUMNS.PERFORMANCE_TASK],
    assessment: match[CONFIG.GRADING_COLUMNS.ASSESSMENT]
  };
}

/**
 * Internal function to save template data to MASTER_DATA sheet
 * Saves only one row per template file (not per subject)
 * @param {string} schoolYear - The school year
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @param {string} templateUrl - The URL of the generated template
 * @param {string} userEmail - The email of the user creating the template (passed from client)
 * @param {string} templateFileName - The name of the template file (optional, defaults to "Open Template")
 */
function _saveToMasterData(schoolYear, gradeLevel, section, teacher, templateUrl, userEmail, templateFileName) {
  let sheet = getSheet(CONFIG.SHEET_NAMES.MASTER_DATA);
  if (!sheet) {
    // Create MASTER_DATA sheet if it doesn't exist
    const spreadsheet = getSpreadsheet();
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES.MASTER_DATA);
    
    // Set up headers (no parent header row)
    sheet.getRange(1, 1).setValue('School Year');
    sheet.getRange(1, 2).setValue('Grade Level');
    sheet.getRange(1, 3).setValue('Section');
    sheet.getRange(1, 4).setValue('Teacher');
    sheet.getRange(1, 5).setValue('Template Link');
    sheet.getRange(1, 6).setValue('Created');
    sheet.getRange(1, 7).setValue('Modified');
    sheet.getRange(1, 8).setValue('Created By');
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground(CONFIG.COLORS.DARK_GRAY);
  }
  
  const timestamp = new Date();
  // Use template file name if provided, otherwise use "Open Template" for backward compatibility
  const linkText = templateFileName || 'Open Template';
  const templateLink = `=HYPERLINK("${templateUrl}","${linkText}")`;
  // Use passed userEmail, or fallback to Session.getActiveUser() if not provided (for backward compatibility)
  const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
  
  // Normalize grade level for storage (sheet stores just numbers)
  const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
  
  // Append new row with all data (one row per template file)
  sheet.appendRow([
    schoolYear,                  // Column A: School_Year
    normalizedGradeLevel,        // Column B: Grade_Level (just the number)
    section,                     // Column C: Section
    teacher,                  // Column D: Teacher
    templateLink,                // Column E: Template_Link
    timestamp,                   // Column F: Created
    timestamp,                   // Column G: Modified
    actualUserEmail             // Column H: Created_By
  ]);
  
  // Background color removed - no green coloring
}

/**
 * Internal function to set up the OGS template structure in the provided sheet
 * Creates 4-quarter grading structure matching the Excel format
 * @param {Sheet} sheet - The target sheet
 * @param {string} schoolYear - The school year
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} subject - The subject
 * @param {string} teacher - The teacher name
 * @param {Object} weights - Grading weights object
 * @param {Array} students - Array of student objects (optional)
 */
function _setupOGSTemplate(sheet, schoolYear, gradeLevel, section, subject, teacher, weights, students = [], userEmail = null) {
  // Clear the sheet first
  sheet.clear();
  
  const isSHS = CONFIG.IS_SHS;
  const numCols = isSHS ? 16 : 28; // SHS: 2 periods (Mastery, Final) × 6 + 2 = 16. Non-SHS: 4 periods × 6 + 2 = 28
  const allData = [];
  
  const padRow = (row) => {
    const padded = [...row];
    while (padded.length < numCols) {
      padded.push('');
    }
    return padded.slice(0, numCols);
  };
  
  allData.push(padRow(['OFFICIAL GRADE SHEET']));
  allData.push(padRow(['Teacher Name:', teacher]));
  allData.push(padRow(['School Year:', schoolYear]));
  const formattedGradeLevel = _formatGradeLevel(gradeLevel);
  allData.push(padRow(['Level:', formattedGradeLevel]));
  allData.push(padRow(['Section:', section]));
  allData.push(padRow(['Total Student:', '']));
  allData.push(padRow(['Subject:', subject]));
  
  if (isSHS) {
    const subjectMeta = _getSubjectMetadata(subject);
    const strandDisplay = subjectMeta.strand || CONFIG.SHS_DEFAULTS.STRAND;
    const semesterDisplay = subjectMeta.semester || CONFIG.SHS_DEFAULTS.SEMESTER;
    allData.push(padRow(['Strand:', strandDisplay]));
    allData.push(padRow(['Semester:', semesterDisplay]));
  }
  
  const gradingRowNum = isSHS ? 10 : 8;
  let gradingHeadersRow;
  let headerRow;
  if (isSHS) {
    gradingHeadersRow = padRow([
      '', '',
      'MASTERY', '', '', '', '', '',  // Columns C-H (6 cols)
      'FINAL', '', '', '', '', '',    // Columns I-N (6 cols)
      '', ''                           // Columns O-P: Final Grading, Final EQ
    ]);
    headerRow = [
      'Student No', 'Student Name',
      'TS1-Written', 'TS1-Performance', 'TS1-Assessment', '1st Initial', '1st Transmuted', '1st EQ',
      'TS2-Written', 'TS2-Performance', 'TS2-Assessment', '2nd Initial', '2nd Transmuted', '2nd EQ',
      'Final Grading', 'Final EQ'
    ];
  } else {
    gradingHeadersRow = padRow([
      '', '',
      '1ST GRADING', '', '', '', '', '',
      '2ND GRADING', '', '', '', '', '',
      '3RD GRADING', '', '', '', '', '',
      '4TH GRADING', '', '', '', '', '',
      '', ''
    ]);
    headerRow = [
      'Student No', 'Student Name',
      'TS1-Written', 'TS1-Performance', 'TS1-Assessment', '1st Initial', '1st Transmuted', '1st EQ',
      'TS2-Written', 'TS2-Performance', 'TS2-Assessment', '2nd Initial', '2nd Transmuted', '2nd EQ',
      'TS3-Written', 'TS3-Performance', 'TS3-Assessment', '3rd Initial', '3rd Transmuted', '3rd EQ',
      'TS4-Written', 'TS4-Performance', 'TS4-Assessment', '4th Initial', '4th Transmuted', '4th EQ',
      'Final Grading', 'Final EQ'
    ];
  }
  allData.push(gradingHeadersRow);
  allData.push(padRow(headerRow));
  
  // Write all data at once
  const numRows = allData.length;
  const dataRange = sheet.getRange(1, 1, numRows, numCols);
  dataRange.setValues(allData);
  
  // OPTIMIZATION: Batch formatting operations to reduce API calls
  // Title row (row 1)
  const titleRange = sheet.getRange(1, 1, 1, numCols);
  titleRange.merge()
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Info rows: rows 2-7 (non-SHS) or 2-9 (SHS: includes Subject, Strand, Semester)
  const headerRowNum = gradingRowNum + 1;
  const infoRowsCount = isSHS ? 8 : 6;  // 8 rows (2-9) when SHS, 6 rows (2-7) when not
  sheet.getRange(2, 1, infoRowsCount, 1).setFontWeight('bold');
  sheet.getRange(2, 2, infoRowsCount, 1).setBackground(CONFIG.COLORS.LIGHT_GRAY);
  
  // Grading period headers - batch merges and formatting
  if (isSHS) {
    sheet.getRange(gradingRowNum, 3, 1, 6).merge();   // MASTERY (cols C-H)
    sheet.getRange(gradingRowNum, 9, 1, 6).merge();  // FINAL (cols I-N)
    const gradingRange = sheet.getRange(gradingRowNum, 3, 1, 14);
    gradingRange.setFontWeight('bold').setHorizontalAlignment('center').setBackground(CONFIG.COLORS.MEDIUM_GRAY);
  } else {
    sheet.getRange(gradingRowNum, 3, 1, 6).merge();   // 1ST GRADING
    sheet.getRange(gradingRowNum, 9, 1, 6).merge();   // 2ND GRADING
    sheet.getRange(gradingRowNum, 15, 1, 6).merge(); // 3RD GRADING
    sheet.getRange(gradingRowNum, 21, 1, 6).merge(); // 4TH GRADING
    const gradingRange = sheet.getRange(gradingRowNum, 3, 1, 26);
    gradingRange.setFontWeight('bold').setHorizontalAlignment('center').setBackground(CONFIG.COLORS.MEDIUM_GRAY);
  }
  
  // Column headers - single batch operation
  const headerRange = sheet.getRange(headerRowNum, 1, 1, numCols);
  headerRange.setFontWeight('bold')
    .setBackground(CONFIG.COLORS.DARK_GRAY)
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true);
  
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 250);
  for (let c = 3; c <= numCols; c++) {
    sheet.setColumnWidth(c, 130);
  }
  
  const frozenRowsCount = isSHS ? 11 : 9;
  sheet.setFrozenRows(frozenRowsCount);
  
  const hasStudents = students && students.length > 0;
  const numStudentRows = hasStudents ? Math.max(students.length, CONFIG.TEMPLATE.NUM_STUDENT_ROWS) : CONFIG.TEMPLATE.NUM_STUDENT_ROWS;
  const startRow = headerRowNum + 1;
  
  if (numStudentRows > 0) {
    const ww = weights.writtenWork;
    const pt = weights.performanceTask;
    const as = weights.assessment;
    
    const studentValues = [];
    const formulaColumns = isSHS
      ? { 6: [], 7: [], 8: [], 12: [], 13: [], 14: [], 15: [], 16: [] }
      : { 6: [], 7: [], 8: [], 12: [], 13: [], 14: [], 18: [], 19: [], 20: [], 24: [], 25: [], 26: [], 27: [], 28: [] };
  
    for (let i = 0; i < numStudentRows; i++) {
      const row = startRow + i;
      let studentNumber = '';
      let studentName = '';
      if (hasStudents && i < students.length) {
        const student = students[i];
        studentNumber = student.studentNumber || '';
        const lastName = student.lastName || '';
        const firstName = student.firstName || '';
        const middleName = student.middleName || '';
        studentName = `${lastName}${firstName ? ', ' + firstName : ''}${middleName ? ' ' + middleName : ''}`.trim();
      }
      studentValues.push([studentNumber, studentName]);
      
      if (isSHS) {
        // Mastery: C,D,E -> F (Initial), G (Transmuted), H (EQ)
        const masteryAvg = `ROUND((C${row}*${ww}/100+D${row}*${pt}/100+E${row}*${as}/100),2)`;
        const masteryInitialFormula = `=IF(AND(C${row}<>"",D${row}<>"",E${row}<>""),${masteryAvg},"")`;
        formulaColumns[6].push([masteryInitialFormula]);
        formulaColumns[7].push([_generateTransmutationFormula(masteryInitialFormula.replace('=', ''))]);
        formulaColumns[8].push([_generateEQFromTransmutation(7, row)]);
        // Final: I,J,K -> L (Initial), M (Transmuted), N (EQ)
        const finalAvg = `ROUND((I${row}*${ww}/100+J${row}*${pt}/100+K${row}*${as}/100),2)`;
        const finalInitialFormula = `=IF(AND(I${row}<>"",J${row}<>"",K${row}<>""),${finalAvg},"")`;
        formulaColumns[12].push([finalInitialFormula]);
        formulaColumns[13].push([_generateTransmutationFormula(finalInitialFormula.replace('=', ''))]);
        formulaColumns[14].push([_generateEQFromTransmutation(13, row)]);
        // Final Grading: average of Mastery (G) and Final (M) transmuted
        formulaColumns[15].push([`=IF(AND(G${row}<>"",M${row}<>""),ROUND((G${row}+M${row})/2,2),"")`]);
        formulaColumns[16].push([_generateEQFromNonTransmutedGrade(15, row)]);
      } else {
        const weightedAvg1 = `ROUND((C${row}*${ww}/100+D${row}*${pt}/100+E${row}*${as}/100),2)`;
        const weightedAvg1Formula = `=IF(AND(C${row}<>"",D${row}<>"",E${row}<>""),${weightedAvg1},"")`;
        formulaColumns[6].push([weightedAvg1Formula]);
        formulaColumns[7].push([_generateTransmutationFormula(weightedAvg1Formula.replace('=', ''))]);
        formulaColumns[8].push([_generateEQFromTransmutation(7, row)]);
        const weightedAvg2 = `ROUND((I${row}*${ww}/100+J${row}*${pt}/100+K${row}*${as}/100),2)`;
        const weightedAvg2Formula = `=IF(AND(I${row}<>"",J${row}<>"",K${row}<>""),${weightedAvg2},"")`;
        formulaColumns[12].push([weightedAvg2Formula]);
        formulaColumns[13].push([_generateTransmutationFormula(weightedAvg2Formula.replace('=', ''))]);
        formulaColumns[14].push([_generateEQFromTransmutation(13, row)]);
        const weightedAvg3 = `ROUND((O${row}*${ww}/100+P${row}*${pt}/100+Q${row}*${as}/100),2)`;
        const weightedAvg3Formula = `=IF(AND(O${row}<>"",P${row}<>"",Q${row}<>""),${weightedAvg3},"")`;
        formulaColumns[18].push([weightedAvg3Formula]);
        formulaColumns[19].push([_generateTransmutationFormula(weightedAvg3Formula.replace('=', ''))]);
        formulaColumns[20].push([_generateEQFromTransmutation(19, row)]);
        const weightedAvg4 = `ROUND((U${row}*${ww}/100+V${row}*${pt}/100+W${row}*${as}/100),2)`;
        const weightedAvg4Formula = `=IF(AND(U${row}<>"",V${row}<>"",W${row}<>""),${weightedAvg4},"")`;
        formulaColumns[24].push([weightedAvg4Formula]);
        formulaColumns[25].push([_generateTransmutationFormula(weightedAvg4Formula.replace('=', ''))]);
        formulaColumns[26].push([_generateEQFromTransmutation(25, row)]);
        formulaColumns[27].push([`=IF(AND(G${row}<>"",M${row}<>"",S${row}<>"",Y${row}<>""),ROUND((G${row}+M${row}+S${row}+Y${row})/4,2),"")`]);
        formulaColumns[28].push([_generateEQFromNonTransmutedGrade(27, row)]);
      }
    }
    
    // OPTIMIZATION: Combine student data and empty cells into single batch write
    // Build complete row data: [studentNumber, studentName, empty*15]
    const allStudentRows = [];
    for (let i = 0; i < numStudentRows; i++) {
      const row = new Array(numCols).fill('');
      // Set student data (columns A-B)
      if (i < studentValues.length) {
        row[0] = studentValues[i][0]; // Student Number
        row[1] = studentValues[i][1]; // Student Name
      }
      allStudentRows.push(row);
    }
    
    // OPTIMIZATION: Single batch write for all student data (reduces from 2 API calls to 1)
    const studentDataRange = sheet.getRange(startRow, 1, numStudentRows, numCols);
    studentDataRange.setValues(allStudentRows);
    
    const formulaColsList = isSHS ? [6, 7, 8, 12, 13, 14, 15, 16] : [6, 7, 8, 12, 13, 14, 18, 19, 20, 24, 25, 26, 27, 28];
    formulaColsList.forEach(col => {
      const range = sheet.getRange(startRow, col, numStudentRows, 1);
      range.setFormulas(formulaColumns[col]);
      range.setBackground(CONFIG.COLORS.MEDIUM_GRAY);
      range.setHorizontalAlignment('center');
    });
    
    const gradeInputColsForAlignment = isSHS ? [3, 4, 5, 9, 10, 11] : [3, 4, 5, 9, 10, 11, 15, 16, 17, 21, 22, 23];
    gradeInputColsForAlignment.forEach(col => {
      sheet.getRange(startRow, col, numStudentRows, 1).setHorizontalAlignment('center');
    });
    
    // PROTECTION: Required for sharing with others (teachers/staff)
    // Protected: Student info (A-B), Headers (9-10), Formulas (F, G, K, L, P, Q, U, V, W, X)
    // Editable by others: Grading input columns (C, D, E, H, I, J, M, N, O, R, S, T)
    // Note: Protection operations are slow (~2-5 seconds each), resulting in ~90-100 second generation time
    // Configure via CONFIG.TEMPLATE.ENABLE_PROTECTIONS in Config.js
    if (CONFIG.TEMPLATE.ENABLE_PROTECTIONS) {
      const protectionEditorEmails = Array.isArray(CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS) 
        ? CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS 
        : (CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS ? [CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS] : []);
      
      const emailsToUse = protectionEditorEmails.length > 0 
        ? protectionEditorEmails 
        : (userEmail ? [userEmail] : [Session.getActiveUser().getEmail()]);
      
      const validEmails = emailsToUse.filter(email => email && email.trim() !== '');
      
      if (validEmails.length === 0) {
        console.log('Note: Skipping protection - no valid emails available');
        return;
      }
      
      const endRow = startRow + numStudentRows - 1;
      const protectToRow = Math.max(endRow + 20, 50);
      
      const setProtectionWithEditors = (protection, emails) => {
        try {
          if (!emails || emails.length === 0) {
            console.log('Note: Skipping protection editor - no emails provided');
            return;
          }
          const currentEditors = protection.getEditors();
          if (currentEditors.length > 0) {
            protection.removeEditors(currentEditors);
          }
          emails.forEach(email => {
            if (email && email.trim() !== '') {
              protection.addEditor(email.trim());
            }
          });
        } catch (e) {
          console.log('Note: Could not set protection editors:', e.message);
        }
      };
      
      // Get protected ranges from config
      const protectedRanges = CONFIG.TEMPLATE.PROTECTED_RANGES.SUBJECT_SHEETS;
      
      // Protect student info columns (from config)
      if (protectedRanges.STUDENT_INFO_COLUMNS && protectedRanges.STUDENT_INFO_COLUMNS.length >= 2) {
        const startCol = protectedRanges.STUDENT_INFO_COLUMNS[0];
        const numColsProtect = protectedRanges.STUDENT_INFO_COLUMNS[1] - protectedRanges.STUDENT_INFO_COLUMNS[0] + 1;
        const colABRange = sheet.getRange(1, startCol, protectToRow, numColsProtect);
        const protection1 = colABRange.protect().setWarningOnly(false);
        setProtectionWithEditors(protection1, validEmails);
      }
      
      // Protect header rows: SHS uses rows 10-11 (grading + column headers), non-SHS uses rows 8-9
      const subjectHeaderRows = CONFIG.IS_SHS ? [10, 11] : [8, 9];
      if (subjectHeaderRows.length > 0) {
        const headerStartRow = Math.min(...subjectHeaderRows);
        const headerNumRows = Math.max(...subjectHeaderRows) - headerStartRow + 1;
        const headerRowsRange = sheet.getRange(headerStartRow, 1, headerNumRows, numCols);
        const protection2 = headerRowsRange.protect().setWarningOnly(false);
        setProtectionWithEditors(protection2, validEmails);
      }
      
      const formulaColsToProtect = isSHS ? [6, 7, 8, 12, 13, 14, 15, 16] : (protectedRanges.FORMULA_COLUMNS || []);
      if (formulaColsToProtect.length > 0) {
        const formulaCols = [...formulaColsToProtect].sort((a, b) => a - b);
        const formulaProtections = [];
        
        // Group consecutive columns together
        let startCol = formulaCols[0];
        let endCol = formulaCols[0];
        
        for (let i = 1; i < formulaCols.length; i++) {
          if (formulaCols[i] === endCol + 1) {
            // Consecutive column - extend the range
            endCol = formulaCols[i];
          } else {
            // Non-consecutive - protect the current range and start a new one
            const numCols = endCol - startCol + 1;
            const formulaRange = sheet.getRange(1, startCol, protectToRow, numCols);
            const prot = formulaRange.protect().setWarningOnly(false);
            formulaProtections.push(prot);
            startCol = formulaCols[i];
            endCol = formulaCols[i];
          }
        }
        
        // Protect the last range
        const numCols = endCol - startCol + 1;
        const formulaRange = sheet.getRange(1, startCol, protectToRow, numCols);
        const prot = formulaRange.protect().setWarningOnly(false);
        formulaProtections.push(prot);
        
        // Set editors for all protections
        formulaProtections.forEach(protection => {
          setProtectionWithEditors(protection, validEmails);
        });
      }
    }
    
    // OPTIMIZATION: Batch formatting operations
    const studentRange = sheet.getRange(startRow, 1, numStudentRows, numCols);
    studentRange.setBorder(true, true, true, true, true, true);
    
    const gradeInputCols = isSHS ? [3, 4, 5, 9, 10, 11] : [3, 4, 5, 9, 10, 11, 15, 16, 17, 21, 22, 23];
    gradeInputCols.forEach(col => {
      sheet.getRange(startRow, col, numStudentRows, 1).setNumberFormat('0.##');
    });
    
    const numberFormatCols = isSHS ? [6, 7, 12, 13, 15] : [6, 7, 12, 13, 18, 19, 24, 25, 27];
    numberFormatCols.forEach(col => {
      sheet.getRange(startRow, col, numStudentRows, 1).setNumberFormat('0.00');
    });
    
    const inputCols = isSHS ? [3, 4, 5, 9, 10, 11] : [3, 4, 5, 9, 10, 11, 15, 16, 17, 21, 22, 23];
    const minGrade = CONFIG.TEMPLATE.MIN_GRADE;
    const maxGrade = CONFIG.TEMPLATE.MAX_GRADE;
    const allRules = [];
    
    inputCols.forEach(col => {
      const inputRange = sheet.getRange(startRow, col, numStudentRows, 1);
      const rule1 = SpreadsheetApp.newConditionalFormatRule()
        .setRanges([inputRange])
        .whenNumberLessThan(minGrade)
        .setBackground(CONFIG.COLORS.LIGHT_RED)
        .build();
      const rule2 = SpreadsheetApp.newConditionalFormatRule()
        .setRanges([inputRange])
        .whenNumberGreaterThan(maxGrade)
        .setBackground(CONFIG.COLORS.LIGHT_RED)
        .build();
      allRules.push(rule1, rule2);
    });
    
    const initialCols = isSHS ? [6, 12] : [6, 12, 18, 24];
    const transmutedGradeCols = isSHS ? [7, 13] : [7, 13, 19, 25];
    const finalGradingCol = isSHS ? 15 : 27;
    const passingGrade = 75;
    
    [...initialCols, ...transmutedGradeCols, finalGradingCol].forEach(col => {
      const range = sheet.getRange(startRow, col, numStudentRows, 1);
      const rule = SpreadsheetApp.newConditionalFormatRule()
        .setRanges([range])
        .whenNumberLessThan(passingGrade)
        .setBackground(CONFIG.COLORS.LIGHT_RED)
        .build();
      allRules.push(rule);
    });
    
    // Apply all conditional formatting rules in a single batch operation
    if (allRules.length > 0) {
      const existingRules = sheet.getConditionalFormatRules();
      existingRules.push.apply(existingRules, allRules);
      sheet.setConditionalFormatRules(existingRules);
    }
    
    if (hasStudents) {
      sheet.getRange(6, 2).setValue(students.length).setHorizontalAlignment('left');
    }
  }
}

/**
 * Helper function to get teacher email from TEACHERS_REF sheet
 * @param {string} teacherName - The teacher's full name
 * @return {string} The teacher's email, or empty string if not found
 */
function _getTeacherEmail(teacherName) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.TEACHERS_REF);
    if (!sheet) {
      console.warn('TEACHERS_REF sheet not found');
      return '';
    }
    
    // Read data starting from row 3 (after 2 header rows)
    const data = sheet.getDataRange().getValues();
    const startRow = CONFIG.DATA_START_ROW - 1; // Convert to 0-based index (row 3 = index 2)
    const dataRows = data.slice(startRow);
    
    const match = dataRows.find(row => row[1] === teacherName);
    
    if (match && match[2]) {
      return match[2].toString().trim(); // Return email (Column C)
    }
    
    return '';
  } catch (error) {
    console.error('Error getting teacher email:', error);
    return '';
  }
}

/**
 * Helper function to find or create a folder by name within a parent folder
 * @param {Folder} parentFolder - The parent folder to search in
 * @param {string} folderName - The name of the folder to find or create
 * @return {Folder} The found or created folder
 */
function _findOrCreateFolder(parentFolder, folderName) {
  // Search for existing folder with the exact name
  const folders = parentFolder.getFoldersByName(folderName);
  
  if (folders.hasNext()) {
    // Folder exists, return it
    return folders.next();
  } else {
    // Folder doesn't exist, create it
    return parentFolder.createFolder(folderName);
  }
}

/**
 * Helper function to extract spreadsheet ID from a Google Sheets URL
 * @param {string} url - The Google Sheets URL or spreadsheet ID
 * @return {string} The spreadsheet ID
 */
function _extractSpreadsheetId(url) {
  if (!url || !url.trim()) {
    throw new Error('STUDENTS_DB_URL is not configured');
  }
  
  const trimmedUrl = url.trim();
  
  // If it's already just an ID (no slashes), return it
  if (!trimmedUrl.includes('/')) {
    return trimmedUrl;
  }
  
  // Extract ID from URL pattern: https://docs.google.com/spreadsheets/d/ID/edit...
  const match = trimmedUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  throw new Error('Invalid STUDENTS_DB_URL format. Expected a Google Sheets URL or spreadsheet ID');
}

/**
 * OPTIMIZED function to fetch students from STUDENTS DB spreadsheet
 * Retrieves students for a specific grade level and section from the academic year sheet
 * Opens STUDENTS_DB by URL from CONFIG
 * @param {string} schoolYear - The school year (e.g., "2024-2025")
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Array} Array of student objects [{ studentNumber, lastName, firstName, middleName }]
 */
function _getStudentsFromDB(schoolYear, gradeLevel, section) {
  try {
    if (!CONFIG.STUDENTS_DB_URL || !CONFIG.STUDENTS_DB_URL.trim()) {
      console.warn('STUDENTS_DB_URL is not configured. Returning empty student list.');
      return [];
    }
    
    const spreadsheetId = _extractSpreadsheetId(CONFIG.STUDENTS_DB_URL);
    const studentsSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
    
    // Use school year directly as the sheet name (e.g., "2024-2025")
    const academicYearSheet = schoolYear;
    
    // Get the sheet
    const sheet = studentsSpreadsheet.getSheetByName(academicYearSheet);
    if (!sheet) {
      console.warn(`Academic year sheet not found: ${academicYearSheet}`);
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    
    // OPTIMIZATION: Early return if no data
    if (lastRow < 3) {  // Row 3 is where data starts (after 2 header rows)
      return [];
    }
    
    // OPTIMIZATION: Only read necessary columns (A-F)
    // A: Student Number, B: Last Name, C: First Name, D: Middle Name, E: Grade Level, F: Section
    const startRow = 3;  // Data starts at row 3
    const numRows = lastRow - 2;
    const data = sheet.getRange(startRow, 1, numRows, 6).getValues();
    
    const students = [];
    
    // OPTIMIZATION: Single pass filtering
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = row[4]; // Column E (Grade Level)
      const rowSection = row[5];    // Column F (Section)
      
      // Normalize grade levels for comparison (sheet stores just numbers)
      const normalizedRowGradeLevel = _normalizeGradeLevel(String(rowGradeLevel || '').trim());
      const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
      
      // Filter by grade level and section
      if (normalizedRowGradeLevel === normalizedGradeLevel && rowSection === section) {
        students.push({
          studentNumber: row[0] || '', // Column A
          lastName: row[1] || '',      // Column B
          firstName: row[2] || '',     // Column C
          middleName: row[3] || ''     // Column D
        });
      }
    }
    
    // Sort students by student number for consistent ordering
    students.sort((a, b) => {
      const numA = String(a.studentNumber);
      const numB = String(b.studentNumber);
      return numA.localeCompare(numB);
    });
    
    return students;
  } catch (error) {
    console.error('Error fetching students from STUDENTS DB:', error);
    return [];
  }
}

/**
 * Internal function to get list of school years (sheet names) from STUDENTS DB
 * Returns sheets that match the YYYY-YYYY format (e.g., "2024-2025")
 * @return {Array} Array of school year sheet names
 */
function _getSchoolYears() {
  try {
    if (!CONFIG.STUDENTS_DB_URL || !CONFIG.STUDENTS_DB_URL.trim()) {
      console.warn('STUDENTS_DB_URL is not configured. Returning empty school years list.');
      return [];
    }
    
    const spreadsheetId = _extractSpreadsheetId(CONFIG.STUDENTS_DB_URL);
    const studentsSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheets = studentsSpreadsheet.getSheets();
    const schoolYears = [];
    
    // Regular expression to match YYYY-YYYY format (4 digits, hyphen, 4 digits)
    const yearPattern = /^\d{4}-\d{4}$/;
    
    for (let i = 0; i < sheets.length; i++) {
      const sheetName = sheets[i].getName();
      // Only include sheets that match the YYYY-YYYY format
      if (yearPattern.test(sheetName)) {
        schoolYears.push(sheetName);
      }
    }
    
    return schoolYears;
  } catch (error) {
    console.error('Error getting school years:', error);
    return [];
  }
}

/**
 * Helper function to check if teacher is an advisor for the given class
 * @param {string} teacher - The teacher name
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {boolean} True if teacher is an active advisor for this class
 */
function _isTeacherAdvisor(teacher, gradeLevel, section) {
  try {
    // Normalize grade level for comparison (sheet stores just numbers)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    const advisories = _getAdvisories(teacher);
    return advisories.some(adv => {
      const advGradeLevel = _normalizeGradeLevel(adv.gradeLevel);
      return adv.teacher === teacher &&
             advGradeLevel === normalizedGradeLevel &&
             adv.section === section &&
             adv.status === 'Active';
    });
  } catch (error) {
    console.error('Error checking if teacher is advisor:', error);
    return false;
  }
}

/**
 * Helper function to get monthly school days from ATTENDANCE_REF sheet
 * @param {string} schoolYear - The school year (e.g., "2024-2025")
 * @return {Object} Object with month names as keys and school days as values
 */
function _getMonthlySchoolDays(schoolYear) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.ATTENDANCE_REF);
    if (!sheet) {
      console.warn('ATTENDANCE_REF sheet not found');
      return {};
    }
    
    // Read data starting from row 3 (after 2 header rows)
    const data = sheet.getDataRange().getValues();
    const startRow = CONFIG.DATA_START_ROW - 1; // Convert to 0-based index (row 3 = index 2)
    const dataRows = data.slice(startRow);
    
    const monthlyDays = {};
    
    // Filter by school year and build month -> days mapping
    dataRows.forEach(row => {
      const rowSchoolYear = row[1]; // Column B: School Year
      const month = row[2]; // Column C: Month
      const days = row[3]; // Column D: Number of School Days
      
      if (rowSchoolYear === schoolYear && month && days) {
        // Normalize month name (handle variations like "June", "Jun", etc.)
        const monthKey = month.toString().trim();
        monthlyDays[monthKey] = days;
      }
    });
    
    return monthlyDays;
  } catch (error) {
    console.error('Error getting monthly school days:', error);
    return {};
  }
}

/**
 * Internal function to set up the MAPEH sheet structure
 * @param {Sheet} sheet - The target sheet
 * @param {Spreadsheet} templateSpreadsheet - The template spreadsheet (to reference other subject sheets)
 * @param {string} schoolYear - The school year
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher/advisor name
 * @param {Array} students - Array of student objects
 * @param {string} userEmail - Email of the user creating the template
 */
function _setupMAPEHSheet(sheet, templateSpreadsheet, schoolYear, gradeLevel, section, teacher, students = [], userEmail = null) {
  // Clear the sheet first
  sheet.clear();
  
  // Find the Music, Arts, PE, and Health sheets
  const musicSheet = templateSpreadsheet.getSheetByName('Music');
  const artsSheet = templateSpreadsheet.getSheetByName('Arts') || templateSpreadsheet.getSheetByName('Art');
  const peSheet = templateSpreadsheet.getSheetByName('PE') || templateSpreadsheet.getSheetByName('Physical Education');
  const healthSheet = templateSpreadsheet.getSheetByName('Health');
  
  if (!musicSheet || !artsSheet || !peSheet || !healthSheet) {
    console.warn('MAPEH sheet: One or more required subject sheets not found');
    return;
  }
  
  // Get actual sheet names for formula references
  const musicSheetName = musicSheet.getName();
  const artsSheetName = artsSheet.getName();
  const peSheetName = peSheet.getName();
  const healthSheetName = healthSheet.getName();
  
  // Build all data in memory first for batch operations
  const numCols = 28; // Student No, Student Name, 4 grading periods × 6 cols each (Music, Arts, PE, Health, AVE, AVE EQ), Final Grading, Final EQ
  const allData = [];
  
  // Helper function to pad row to numCols
  const padRow = (row) => {
    const padded = [...row];
    while (padded.length < numCols) {
      padded.push('');
    }
    return padded.slice(0, numCols);
  };
  
  // Row 1: Title
  allData.push(padRow(['OFFICIAL GRADE SHEET']));
  
  // Row 2-7: Info rows (matching Excel format exactly)
  allData.push(padRow(['Teacher Name:', teacher]));
  allData.push(padRow(['School Year:', schoolYear]));
  const formattedGradeLevel = _formatGradeLevel(gradeLevel);
  allData.push(padRow(['Level:', formattedGradeLevel]));
  allData.push(padRow(['Section:', section]));
  allData.push(padRow(['Total Student:', '']));
  allData.push(padRow(['Subject:', 'MAPEH']));
  
  // Row 8: Grading period headers row
  const gradingHeadersRow = padRow([
    '', 
    '', 
    '1ST GRADING', '', '', '', '', '',  // Columns C-H (6 columns for 1ST GRADING)
    '2ND GRADING', '', '', '', '', '',  // Columns I-N (6 columns for 2ND GRADING)
    '3RD GRADING', '', '', '', '', '',  // Columns O-T (6 columns for 3RD GRADING)
    '4TH GRADING', '', '', '', '', '',  // Columns U-Z (6 columns for 4TH GRADING)
    '', ''  // Columns AA-AB (Final Grading and Final EQ headers are in row 9)
  ]);
  allData.push(gradingHeadersRow);
  
  // Row 9: Column headers
  const headerRow = [
    'Student No',
    'Student Name',
    // 1ST GRADING
    'Music', 'Arts', 'PE', 'Health', 'AVE', 'AVE EQ',
    // 2ND GRADING
    'Music', 'Arts', 'PE', 'Health', 'AVE', 'AVE EQ',
    // 3RD GRADING
    'Music', 'Arts', 'PE', 'Health', 'AVE', 'AVE EQ',
    // 4TH GRADING
    'Music', 'Arts', 'PE', 'Health', 'AVE', 'AVE EQ',
    // Final
    'Final Grading',
    'Final EQ'
  ];
  allData.push(padRow(headerRow));
  
  // Write all data at once
  const numRows = allData.length;
  const dataRange = sheet.getRange(1, 1, numRows, numCols);
  dataRange.setValues(allData);
  
  // OPTIMIZATION: Batch formatting operations
  // Title row (row 1)
  const titleRange = sheet.getRange(1, 1, 1, numCols);
  titleRange.merge()
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Info rows (rows 2-7): Batch format column A (bold) and column B (background)
  sheet.getRange(2, 1, 6, 1).setFontWeight('bold');
  sheet.getRange(2, 2, 6, 1).setBackground(CONFIG.COLORS.LIGHT_GRAY);
  
  // Row 8: Grading period headers - batch merges and formatting
  sheet.getRange(8, 3, 1, 7).merge();   // 1ST GRADING
  sheet.getRange(8, 10, 1, 7).merge(); // 2ND GRADING
  sheet.getRange(8, 17, 1, 7).merge(); // 3RD GRADING
  sheet.getRange(8, 24, 1, 7).merge(); // 4TH GRADING
  
  // Format grading period headers
  const gradingHeaderRanges = [
    sheet.getRange(8, 3, 1, 7),
    sheet.getRange(8, 10, 1, 7),
    sheet.getRange(8, 17, 1, 7),
    sheet.getRange(8, 24, 1, 7)
  ];
  gradingHeaderRanges.forEach(range => {
    range.setBackground(CONFIG.COLORS.MEDIUM_GRAY)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  });
  
  // Row 9: Column headers - format
  sheet.getRange(9, 1, 1, numCols).setFontWeight('bold')
    .setBackground(CONFIG.COLORS.DARK_GRAY)
    .setHorizontalAlignment('center');
  
  // Freeze rows 1-9
  sheet.setFrozenRows(9);
  
  // Set column widths
  sheet.setColumnWidth(1, 100); // Student No
  sheet.setColumnWidth(2, 200); // Student Name
  for (let col = 3; col <= numCols; col++) {
    sheet.setColumnWidth(col, 80);
  }
  
  // Get number of student rows
  const hasStudents = students && students.length > 0;
  const numStudentRows = hasStudents ? Math.max(students.length, CONFIG.TEMPLATE.NUM_STUDENT_ROWS) : CONFIG.TEMPLATE.NUM_STUDENT_ROWS;
  const startRow = 10;
  
  // Prepare student data and formulas
  const studentValues = [];
  const formulaColumns = {
    3: [], 4: [], 5: [], 6: [], 7: [], 8: [],  // 1ST GRADING: Music, Arts, PE, Health, AVE, AVE EQ
    9: [], 10: [], 11: [], 12: [], 13: [], 14: [],  // 2ND GRADING
    15: [], 16: [], 17: [], 18: [], 19: [], 20: [],  // 3RD GRADING
    21: [], 22: [], 23: [], 24: [], 25: [], 26: [],  // 4TH GRADING
    27: [], 28: []  // Final Grading, Final EQ
  };
  
  // Transmuted column positions in subject sheets (1-based, but we'll use column letters)
  // Column G (7) = 1st Transmuted, M (13) = 2nd Transmuted, S (19) = 3rd Transmuted, Y (25) = 4th Transmuted
  const transmutedCols = [7, 13, 19, 25]; // Columns G, M, S, Y
  
      for (let i = 0; i < numStudentRows; i++) {
        const row = startRow + i;
    let studentNumber = '';
    let studentName = '';
    
    if (hasStudents && i < students.length) {
      const student = students[i];
      studentNumber = student.studentNumber || '';
      const lastName = student.lastName || '';
      const firstName = student.firstName || '';
      const middleName = student.middleName || '';
      studentName = `${lastName}${firstName ? ', ' + firstName : ''}${middleName ? ' ' + middleName : ''}`.trim();
    }
    
    studentValues.push([studentNumber, studentName]);
    
    // For each grading period (1st, 2nd, 3rd, 4th)
    for (let period = 0; period < 4; period++) {
      const baseCol = 3 + (period * 6); // Starting column for this period (3, 9, 15, 21)
      const transmutedCol = transmutedCols[period]; // Column in subject sheets (7, 13, 19, 25)
      const transmutedColLetter = _columnNumberToLetter(transmutedCol); // G, M, S, Y
      
      // Music, Arts, PE, Health formulas: Reference transmuted columns from respective subject sheets
      const musicFormula = `=IF('${musicSheetName}'!${transmutedColLetter}${row}="","",'${musicSheetName}'!${transmutedColLetter}${row})`;
      const artsFormula = `=IF('${artsSheetName}'!${transmutedColLetter}${row}="","",'${artsSheetName}'!${transmutedColLetter}${row})`;
      const peFormula = `=IF('${peSheetName}'!${transmutedColLetter}${row}="","",'${peSheetName}'!${transmutedColLetter}${row})`;
      const healthFormula = `=IF('${healthSheetName}'!${transmutedColLetter}${row}="","",'${healthSheetName}'!${transmutedColLetter}${row})`;
      
      // AVE formula: Average of Music, Arts, PE, Health
      const musicColLetter = _columnNumberToLetter(baseCol);
      const artsColLetter = _columnNumberToLetter(baseCol + 1);
      const peColLetter = _columnNumberToLetter(baseCol + 2);
      const healthColLetter = _columnNumberToLetter(baseCol + 3);
      const aveFormula = `=IF(AND(${musicColLetter}${row}<>"",${artsColLetter}${row}<>"",${peColLetter}${row}<>"",${healthColLetter}${row}<>""),ROUND(AVERAGE(${musicColLetter}${row},${artsColLetter}${row},${peColLetter}${row},${healthColLetter}${row}),2),"")`;
      
      // AVE EQ formula: EQ based on AVE (non-transmuted) value
      const aveEQFormula = _generateEQFromNonTransmutedGrade(baseCol + 4, row);
      
      formulaColumns[baseCol].push([musicFormula]);      // Music
      formulaColumns[baseCol + 1].push([artsFormula]);   // Arts
      formulaColumns[baseCol + 2].push([peFormula]);     // PE
      formulaColumns[baseCol + 3].push([healthFormula]); // Health
      formulaColumns[baseCol + 4].push([aveFormula]);    // AVE
      formulaColumns[baseCol + 5].push([aveEQFormula]);   // AVE EQ
    }
    
    // Final Grading: Average of the 4 AVE columns (columns 7, 13, 19, 25) - no transmutation needed
    const ave1ColLetter = _columnNumberToLetter(7);  // Column G (1st AVE)
    const ave2ColLetter = _columnNumberToLetter(13); // Column M (2nd AVE)
    const ave3ColLetter = _columnNumberToLetter(19); // Column S (3rd AVE)
    const ave4ColLetter = _columnNumberToLetter(25); // Column Y (4th AVE)
    const finalGradingFormula = `=IF(AND(${ave1ColLetter}${row}<>"",${ave2ColLetter}${row}<>"",${ave3ColLetter}${row}<>"",${ave4ColLetter}${row}<>""),ROUND(AVERAGE(${ave1ColLetter}${row},${ave2ColLetter}${row},${ave3ColLetter}${row},${ave4ColLetter}${row}),2),"")`;
    
    // Final EQ: Based on Final Grading (non-transmuted) using EQ_GRADING_SCALE_NON_TRANSMUTED
    // Column 27 = Final Grading (average), Column 28 = Final EQ
    const finalEQFormula = _generateEQFromNonTransmutedGrade(27, row);
    
    formulaColumns[27].push([finalGradingFormula]);
    formulaColumns[28].push([finalEQFormula]);
  }
  
  // Write student data
  if (studentValues.length > 0) {
    sheet.getRange(startRow, 1, numStudentRows, 2).setValues(studentValues);
  }
  
  // OPTIMIZATION: Batch set all formulas at once
  const formulaColsList = Object.keys(formulaColumns).map(Number).sort((a, b) => a - b);
  formulaColsList.forEach(col => {
    if (formulaColumns[col].length > 0) {
      sheet.getRange(startRow, col, numStudentRows, 1).setFormulas(formulaColumns[col]);
    }
  });
  
  // Apply gray background to formula columns with different colors
  // Music, Arts, PE, Health columns: LIGHT_GRAY
  const musicArtsPEColumns = [3, 4, 5, 6, 9, 10, 11, 12, 15, 16, 17, 18, 21, 22, 23, 24]; // All Music, Arts, PE, Health columns
  musicArtsPEColumns.forEach(col => {
    sheet.getRange(startRow, col, numStudentRows, 1).setBackground(CONFIG.COLORS.LIGHT_GRAY);
  });
  
  // AVE, AVE EQ, Final Grading, Final EQ columns: MEDIUM_GRAY
  const aveAndEQColumns = [7, 8, 13, 14, 19, 20, 25, 26, 27, 28]; // AVE, AVE EQ for each period, plus Final Grading, Final EQ
  aveAndEQColumns.forEach(col => {
    sheet.getRange(startRow, col, numStudentRows, 1).setBackground(CONFIG.COLORS.MEDIUM_GRAY);
  });
  
  // Center align all grade columns (Music, Arts, PE, Health, AVE, Final Grading)
  const gradeCols = [3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 27];
  gradeCols.forEach(col => {
    sheet.getRange(startRow, col, numStudentRows, 1).setHorizontalAlignment('center');
  });
  
  // Center align EQ columns (AVE EQ and Final EQ)
  const eqCols = [8, 14, 20, 26, 28]; // 1st AVE EQ, 2nd AVE EQ, 3rd AVE EQ, 4th AVE EQ, Final EQ
  eqCols.forEach(col => {
    sheet.getRange(startRow, col, numStudentRows, 1).setHorizontalAlignment('center');
  });
  
  // Number format for numeric columns (Music, Arts, PE, Health, AVE, Final Grading)
  const numberFormatCols = [3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 27];
  numberFormatCols.forEach(col => {
    sheet.getRange(startRow, col, numStudentRows, 1).setNumberFormat('0.00');
  });
  
  // Apply borders
  const studentRange = sheet.getRange(startRow, 1, numStudentRows, numCols);
  studentRange.setBorder(true, true, true, true, true, true);
  
  // Add conditional formatting for Final Grading: Red if less than 75
  const finalGradingCol = 27; // Column AA (Final Grading)
  const passingGrade = 75;
  const allRules = [];
  
  const range = sheet.getRange(startRow, finalGradingCol, numStudentRows, 1);
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .setRanges([range])
    .whenNumberLessThan(passingGrade)
    .setBackground(CONFIG.COLORS.LIGHT_RED)
    .build();
  allRules.push(rule);
  
  // Apply conditional formatting rules
  if (allRules.length > 0) {
    const existingRules = sheet.getConditionalFormatRules();
    existingRules.push.apply(existingRules, allRules);
    sheet.setConditionalFormatRules(existingRules);
  }
  
  // Set total student count
  if (hasStudents) {
    sheet.getRange(6, 2).setValue(students.length).setHorizontalAlignment('left');
  }
  
  // PROTECTION: All columns are formulas, so all should be protected
  if (CONFIG.TEMPLATE.ENABLE_PROTECTIONS) {
    const protectionEditorEmails = Array.isArray(CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS) 
      ? CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS 
      : (CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS ? [CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS] : []);
    
    const emailsToUse = protectionEditorEmails.length > 0 
      ? protectionEditorEmails 
      : (userEmail ? [userEmail] : [Session.getActiveUser().getEmail()]);
    
    const validEmails = emailsToUse.filter(email => email && email.trim() !== '');
    
    if (validEmails.length === 0) {
      console.log('Note: Skipping protection - no valid emails available');
      return;
    }
    
    const endRow = startRow + numStudentRows - 1;
    const protectToRow = Math.max(endRow + 20, 50);
    
    const setProtectionWithEditors = (protection, emails) => {
      try {
        if (!emails || emails.length === 0) {
          console.log('Note: Skipping protection editor - no emails provided');
          return;
        }
        const currentEditors = protection.getEditors();
        if (currentEditors.length > 0) {
          protection.removeEditors(currentEditors);
        }
        emails.forEach(email => {
          if (email && email.trim() !== '') {
            protection.addEditor(email.trim());
          }
        });
      } catch (e) {
        console.log('Note: Could not set protection editors:', e.message);
      }
    };
    
    // Get protected ranges from config
    const protectedRanges = CONFIG.TEMPLATE.PROTECTED_RANGES.MAPEH_SHEET;
    
    // Protect student info columns (from config)
    if (protectedRanges.STUDENT_INFO_COLUMNS && protectedRanges.STUDENT_INFO_COLUMNS.length >= 2) {
      const startCol = protectedRanges.STUDENT_INFO_COLUMNS[0];
      const numColsInfo = protectedRanges.STUDENT_INFO_COLUMNS[1] - protectedRanges.STUDENT_INFO_COLUMNS[0] + 1;
      const colABRange = sheet.getRange(1, startCol, protectToRow, numColsInfo);
      const protection1 = colABRange.protect().setWarningOnly(false);
      setProtectionWithEditors(protection1, validEmails);
    }
    
    // Protect header rows (from config)
    if (protectedRanges.HEADER_ROWS && protectedRanges.HEADER_ROWS.length > 0) {
      const startRowHeader = Math.min(...protectedRanges.HEADER_ROWS);
      const numRowsHeader = Math.max(...protectedRanges.HEADER_ROWS) - startRowHeader + 1;
      const headerRowsRange = sheet.getRange(startRowHeader, 1, numRowsHeader, numCols);
      const protection2 = headerRowsRange.protect().setWarningOnly(false);
      setProtectionWithEditors(protection2, validEmails);
    }
    
    // Protect formula columns (from config)
    // OPTIMIZATION: Combine consecutive formula columns into single protection ranges to reduce API calls
    if (protectedRanges.FORMULA_COLUMNS && Array.isArray(protectedRanges.FORMULA_COLUMNS) && protectedRanges.FORMULA_COLUMNS.length > 0) {
      const formulaCols = [...protectedRanges.FORMULA_COLUMNS].sort((a, b) => a - b);
      const formulaProtections = [];
      
      // Group consecutive columns together
      let startCol = formulaCols[0];
      let endCol = formulaCols[0];
      
      for (let i = 1; i < formulaCols.length; i++) {
        if (formulaCols[i] === endCol + 1) {
          // Consecutive column - extend the range
          endCol = formulaCols[i];
        } else {
          // Non-consecutive - protect the current range and start a new one
          const numCols = endCol - startCol + 1;
          const formulaRange = sheet.getRange(1, startCol, protectToRow, numCols);
          const prot = formulaRange.protect().setWarningOnly(false);
          formulaProtections.push(prot);
          startCol = formulaCols[i];
          endCol = formulaCols[i];
        }
      }
      
      // Protect the last range
      const numCols = endCol - startCol + 1;
      const formulaRange = sheet.getRange(1, startCol, protectToRow, numCols);
      const prot = formulaRange.protect().setWarningOnly(false);
      formulaProtections.push(prot);
      
      // Set editors for all protections
      formulaProtections.forEach(protection => {
        setProtectionWithEditors(protection, validEmails);
      });
    }
    
  }
}

/**
 * Internal function to set up the Attendance sheet structure
 * @param {Sheet} sheet - The target sheet
 * @param {string} schoolYear - The school year
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher/advisor name
 * @param {Array} students - Array of student objects
 */
function _setupAttendanceSheet(sheet, schoolYear, gradeLevel, section, teacher, students = [], masterSpreadsheetId = null) {
  sheet.clear();
  
  if (!masterSpreadsheetId) {
    const masterSpreadsheet = getSpreadsheet();
    masterSpreadsheetId = masterSpreadsheet.getId();
  }
  const attendanceRefSheetName = CONFIG.SHEET_NAMES.ATTENDANCE_REF;
  
  const monthlyDays = _getMonthlySchoolDays(schoolYear);
  
  // Only use months that exist in the monthlyDays sheet for this school year
  // Extract months from the monthlyDays object and sort them in typical school year order
  const monthOrder = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
  
  // Build list of months that exist in monthlyDays, preserving order
  const monthsToUse = [];
  monthOrder.forEach(month => {
    // Check if this month exists in monthlyDays (try exact match and variations)
    const monthKey = Object.keys(monthlyDays).find(key => {
      const keyLower = key.toLowerCase().trim();
      const monthLower = month.toLowerCase();
      return keyLower === monthLower || 
             keyLower.startsWith(monthLower.substring(0, 3)) ||
             monthLower.startsWith(keyLower.substring(0, 3));
    });
    
    if (monthKey) {
      monthsToUse.push(monthKey); // Use the actual key from the sheet to preserve exact formatting
    }
  });
  
  // If no months found in sheet, return empty (don't create attendance sheet with default months)
  if (monthsToUse.length === 0) {
    console.warn(`No monthly school days found for school year ${schoolYear} in ATTENDANCE_REF sheet`);
    // Still create the sheet structure but with no months
  }
  
  const numCols = 2 + (monthsToUse.length * 3); // Student No + Name + (3 cols per month)
  const allData = [];
  
  // Helper function to pad row to numCols
  const padRow = (row) => {
    const padded = [...row];
    while (padded.length < numCols) {
      padded.push('');
    }
    return padded.slice(0, numCols);
  };
  
  // Row 1-5: Info rows (matching subject sheet format - no title row, no empty row after)
  allData.push(padRow(['Advisor Name:', teacher]));
  allData.push(padRow(['School Year:', schoolYear]));
  // Format grade level for display (add "Grade " prefix)
  const formattedGradeLevel = _formatGradeLevel(gradeLevel);
  allData.push(padRow(['Level:', formattedGradeLevel]));
  allData.push(padRow(['Section:', section]));
  allData.push(padRow(['Total Student:', students.length > 0 ? students.length : '']));
  
  // Row 6: Month headers (merged across 3 columns each)
  const monthHeaderRow = ['', ''];
  monthsToUse.forEach(() => {
    monthHeaderRow.push('', '', ''); // Placeholder for merged cells
  });
  allData.push(padRow(monthHeaderRow));
  
  // Row 7: Column headers (Student No, Student Name, then for each month: School DAYS, Days PRESENT, Days ABSENT)
  const headerRow = ['Student No', 'Student Name'];
  monthsToUse.forEach(() => {
    headerRow.push('School DAYS', 'Days PRESENT', 'Days ABSENT');
  });
  allData.push(padRow(headerRow));
  
  // Write all data at once
  const numRows = allData.length;
  const dataRange = sheet.getRange(1, 1, numRows, numCols);
  dataRange.setValues(allData);
  
  // Info rows (1-5) - matching subject sheet format
  sheet.getRange(1, 1, 5, 1).setFontWeight('bold');
  sheet.getRange(1, 2, 2, 1).setBackground(CONFIG.COLORS.LIGHT_GRAY); // Advisor Name, School Year
  sheet.getRange(3, 2, 1, 1).setBackground(CONFIG.COLORS.LIGHT_GRAY); // Level
  sheet.getRange(4, 2, 2, 1).setBackground(CONFIG.COLORS.LIGHT_GRAY); // Section, Total Student
  
  // Total Student value should be left-aligned
  sheet.getRange(5, 2).setHorizontalAlignment('left');
  
  // OPTIMIZATION: Batch month header operations - combine merge, value, and formatting
  // Row 6: Merge month headers across 3 columns each (matching subject sheet format)
  let colIndex = 3; // Start at column C
  monthsToUse.forEach((monthKey) => {
    // Use the exact month name from the sheet (not abbreviated)
    const monthRange = sheet.getRange(6, colIndex, 1, 3);
    monthRange.merge();
    const mergedCell = sheet.getRange(6, colIndex);
    mergedCell.setValue(monthKey)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground(CONFIG.COLORS.MEDIUM_GRAY);
    colIndex += 3;
  });
  
  // Row 7: Format column headers (matching subject sheet format)
  sheet.getRange(7, 1, 1, numCols)
    .setFontWeight('bold')
    .setBackground(CONFIG.COLORS.DARK_GRAY)
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true);
  
  // Set column widths (matching subject sheet format)
  sheet.setColumnWidth(1, 120); // Student No
  sheet.setColumnWidth(2, 250); // Student Name
  for (let c = 3; c <= numCols; c++) {
    sheet.setColumnWidth(c, 130); // Attendance columns
  }
  
  // Freeze rows at row 7 (matching subject sheet format)
  sheet.setFrozenRows(7);
  
  // Add student data
  const hasStudents = students && students.length > 0;
  const numStudentRows = hasStudents ? Math.max(students.length, CONFIG.TEMPLATE.NUM_STUDENT_ROWS) : CONFIG.TEMPLATE.NUM_STUDENT_ROWS;
  const startRow = 8;
  
  if (hasStudents) {
    const studentValues = [];
    for (let i = 0; i < numStudentRows; i++) {
      let studentNumber = '';
      let studentName = '';
      
      if (i < students.length) {
        const student = students[i];
        studentNumber = student.studentNumber || '';
        const lastName = student.lastName || '';
        const firstName = student.firstName || '';
        const middleName = student.middleName || '';
        studentName = `${lastName}${firstName ? ', ' + firstName : ''}${middleName ? ' ' + middleName : ''}`.trim();
      }
      
      const row = [studentNumber, studentName];
      // Add empty cells for each month (3 columns each)
      monthsToUse.forEach(() => {
        row.push('', '', ''); // School DAYS, Days PRESENT, Days ABSENT
      });
      studentValues.push(padRow(row));
  }
  
  // Write student data
    const studentRange = sheet.getRange(startRow, 1, numStudentRows, numCols);
    studentRange.setValues(studentValues);
    
    colIndex = 3;
    const schoolDaysCols = [];
    const absentFormulaCols = [];
    monthsToUse.forEach((monthKey) => {
      const schoolDaysCol = colIndex;
      const daysPresentCol = colIndex + 1;
      const daysAbsentCol = colIndex + 2;
      
      const monthHeaderColLetter = _columnNumberToLetter(colIndex);
      const schoolYearRow = 2;
      const monthHeaderRow = 6;
      
      const schoolDaysFormulas = [];
      const schoolYearColLetter = _columnNumberToLetter(2);
      for (let r = 0; r < numStudentRows; r++) {
        const rowNum = startRow + r;
        const formula = `=INDEX(IMPORTRANGE("${masterSpreadsheetId}","${attendanceRefSheetName}!D:D"), MATCH(1, (IMPORTRANGE("${masterSpreadsheetId}","${attendanceRefSheetName}!B:B")=$${schoolYearColLetter}$${schoolYearRow})*(IMPORTRANGE("${masterSpreadsheetId}","${attendanceRefSheetName}!C:C")=${monthHeaderColLetter}$${monthHeaderRow}), 0))`;
        schoolDaysFormulas.push([formula]);
      }
      sheet.getRange(startRow, schoolDaysCol, numStudentRows, 1).setFormulas(schoolDaysFormulas);
      schoolDaysCols.push(schoolDaysCol);
      
      const schoolDaysColLetter = _columnNumberToLetter(schoolDaysCol);
      const daysPresentColLetter = _columnNumberToLetter(daysPresentCol);
      const absentFormulas = [];
      for (let r = 0; r < numStudentRows; r++) {
        const rowNum = startRow + r;
        const formula = `=IF(OR(${schoolDaysColLetter}${rowNum}="",${daysPresentColLetter}${rowNum}=""),"",${schoolDaysColLetter}${rowNum}-${daysPresentColLetter}${rowNum})`;
        absentFormulas.push([formula]);
      }
      sheet.getRange(startRow, daysAbsentCol, numStudentRows, 1).setFormulas(absentFormulas);
      absentFormulaCols.push(daysAbsentCol);
      
      colIndex += 3;
    });
    
    if (schoolDaysCols.length > 0) {
      schoolDaysCols.forEach(col => {
        const range = sheet.getRange(startRow, col, numStudentRows, 1);
        range.setBackground(CONFIG.COLORS.LIGHT_GRAY);
        range.setHorizontalAlignment('center');
      });
    }
    
    if (absentFormulaCols.length > 0) {
      absentFormulaCols.forEach(col => {
        const range = sheet.getRange(startRow, col, numStudentRows, 1);
        range.setBackground(CONFIG.COLORS.MEDIUM_GRAY);
        range.setHorizontalAlignment('center');
      });
    }
    
    colIndex = 3;
    const daysPresentColsForAlignment = [];
    monthsToUse.forEach(() => {
      const daysPresentCol = colIndex + 1;
      daysPresentColsForAlignment.push(daysPresentCol);
      colIndex += 3;
    });
    
    if (daysPresentColsForAlignment.length > 0) {
      daysPresentColsForAlignment.forEach(col => {
        sheet.getRange(startRow, col, numStudentRows, 1).setHorizontalAlignment('center');
      });
    }
    
    // OPTIMIZATION: Batch all conditional formatting rules at once
    // Days PRESENT should not exceed School DAYS and should not be less than 0
    colIndex = 3; // Reset to start at column C
    const daysPresentCols = []; // Track Days PRESENT columns for validation
    monthsToUse.forEach(() => {
      const schoolDaysCol = colIndex;
      const daysPresentCol = colIndex + 1;
      daysPresentCols.push({ presentCol: daysPresentCol, schoolDaysCol: schoolDaysCol });
      colIndex += 3; // Move to next month
    });
    
    const allRules = [];
    daysPresentCols.forEach(({ presentCol, schoolDaysCol }) => {
      const presentRange = sheet.getRange(startRow, presentCol, numStudentRows, 1);
      const schoolDaysColLetter = _columnNumberToLetter(schoolDaysCol);
      const presentColLetter = _columnNumberToLetter(presentCol);
      
      // Rule 1: Red if Days PRESENT is less than 0
      const rule1 = SpreadsheetApp.newConditionalFormatRule()
        .setRanges([presentRange])
        .whenNumberLessThan(0)
        .setBackground(CONFIG.COLORS.LIGHT_RED)
        .build();
      
      // Rule 2: Red if Days PRESENT exceeds School DAYS (using formula)
      const rule2Formula = `=AND(${presentColLetter}${startRow}<>"",${schoolDaysColLetter}${startRow}<>"",${presentColLetter}${startRow}>${schoolDaysColLetter}${startRow})`;
      const rule2 = SpreadsheetApp.newConditionalFormatRule()
        .setRanges([presentRange])
        .whenFormulaSatisfied(rule2Formula)
        .setBackground(CONFIG.COLORS.LIGHT_RED)
        .build();
      
      allRules.push(rule1, rule2);
    });
    
    // Apply all conditional formatting rules in a single batch operation
    if (allRules.length > 0) {
      const existingRules = sheet.getConditionalFormatRules();
      existingRules.push.apply(existingRules, allRules);
      sheet.setConditionalFormatRules(existingRules);
    }
  } else {
    // No students - create empty rows
    const emptyValues = [];
      for (let i = 0; i < numStudentRows; i++) {
      const row = ['', '']; // Empty student number and name
      monthsToUse.forEach(() => {
        row.push('', '', ''); // Empty attendance data
      });
      emptyValues.push(padRow(row));
    }
    const studentRange = sheet.getRange(startRow, 1, numStudentRows, numCols);
    studentRange.setValues(emptyValues);
    
    // Add Days ABSENT formulas for empty rows as well
    colIndex = 3;
    const schoolDaysCols = [];
    const absentFormulaCols = [];
    monthsToUse.forEach((monthKey) => {
      const schoolDaysCol = colIndex;
      const daysPresentCol = colIndex + 1;
      const daysAbsentCol = colIndex + 2;
      
      const monthHeaderColLetter = _columnNumberToLetter(colIndex);
      const schoolYearRow = 2;
      const monthHeaderRow = 6;
      const schoolYearColLetter = _columnNumberToLetter(2);
      
      const schoolDaysFormulas = [];
      for (let r = 0; r < numStudentRows; r++) {
        const rowNum = startRow + r;
        const formula = `=INDEX(IMPORTRANGE("${masterSpreadsheetId}","${attendanceRefSheetName}!D:D"), MATCH(1, (IMPORTRANGE("${masterSpreadsheetId}","${attendanceRefSheetName}!B:B")=$${schoolYearColLetter}$${schoolYearRow})*(IMPORTRANGE("${masterSpreadsheetId}","${attendanceRefSheetName}!C:C")=${monthHeaderColLetter}$${monthHeaderRow}), 0))`;
        schoolDaysFormulas.push([formula]);
      }
      sheet.getRange(startRow, schoolDaysCol, numStudentRows, 1).setFormulas(schoolDaysFormulas);
      schoolDaysCols.push(schoolDaysCol);
      
      const schoolDaysColLetter = _columnNumberToLetter(schoolDaysCol);
      const daysPresentColLetter = _columnNumberToLetter(daysPresentCol);
      const absentFormulas = [];
      for (let r = 0; r < numStudentRows; r++) {
        const rowNum = startRow + r;
        const formula = `=IF(OR(${schoolDaysColLetter}${rowNum}="",${daysPresentColLetter}${rowNum}=""),"",${schoolDaysColLetter}${rowNum}-${daysPresentColLetter}${rowNum})`;
        absentFormulas.push([formula]);
      }
      sheet.getRange(startRow, daysAbsentCol, numStudentRows, 1).setFormulas(absentFormulas);
      absentFormulaCols.push(daysAbsentCol);
      
      colIndex += 3;
    });
    
    if (schoolDaysCols.length > 0) {
      schoolDaysCols.forEach(col => {
        const range = sheet.getRange(startRow, col, numStudentRows, 1);
        range.setBackground(CONFIG.COLORS.LIGHT_GRAY);
        range.setHorizontalAlignment('center');
      });
    }
    
    if (absentFormulaCols.length > 0) {
      absentFormulaCols.forEach(col => {
        const range = sheet.getRange(startRow, col, numStudentRows, 1);
        range.setBackground(CONFIG.COLORS.MEDIUM_GRAY);
        range.setHorizontalAlignment('center');
      });
    }
    
    colIndex = 3;
    const daysPresentColsForAlignment = [];
    monthsToUse.forEach(() => {
      const daysPresentCol = colIndex + 1;
      daysPresentColsForAlignment.push(daysPresentCol);
      colIndex += 3;
    });
    
    if (daysPresentColsForAlignment.length > 0) {
      daysPresentColsForAlignment.forEach(col => {
        sheet.getRange(startRow, col, numStudentRows, 1).setHorizontalAlignment('center');
      });
    }
    
    // OPTIMIZATION: Batch all conditional formatting rules at once
    // Days PRESENT should not exceed School DAYS and should not be less than 0
    colIndex = 3; // Reset to start at column C
    const daysPresentCols = []; // Track Days PRESENT columns for validation
    monthsToUse.forEach(() => {
      const schoolDaysCol = colIndex;
      const daysPresentCol = colIndex + 1;
      daysPresentCols.push({ presentCol: daysPresentCol, schoolDaysCol: schoolDaysCol });
      colIndex += 3; // Move to next month
    });
    
    const allRules = [];
    daysPresentCols.forEach(({ presentCol, schoolDaysCol }) => {
      const presentRange = sheet.getRange(startRow, presentCol, numStudentRows, 1);
      const schoolDaysColLetter = _columnNumberToLetter(schoolDaysCol);
      const presentColLetter = _columnNumberToLetter(presentCol);
      
      // Rule 1: Red if Days PRESENT is less than 0
      const rule1 = SpreadsheetApp.newConditionalFormatRule()
        .setRanges([presentRange])
        .whenNumberLessThan(0)
        .setBackground(CONFIG.COLORS.LIGHT_RED)
        .build();
      
      // Rule 2: Red if Days PRESENT exceeds School DAYS (using formula)
      const rule2Formula = `=AND(${presentColLetter}${startRow}<>"",${schoolDaysColLetter}${startRow}<>"",${presentColLetter}${startRow}>${schoolDaysColLetter}${startRow})`;
      const rule2 = SpreadsheetApp.newConditionalFormatRule()
        .setRanges([presentRange])
        .whenFormulaSatisfied(rule2Formula)
        .setBackground(CONFIG.COLORS.LIGHT_RED)
        .build();
      
      allRules.push(rule1, rule2);
    });
    
    // Apply all conditional formatting rules in a single batch operation
    if (allRules.length > 0) {
      const existingRules = sheet.getConditionalFormatRules();
      existingRules.push.apply(existingRules, allRules);
      sheet.setConditionalFormatRules(existingRules);
    }
  }
  
  // Format borders for student data (matching subject sheet format)
  const studentRange = sheet.getRange(startRow, 1, numStudentRows, numCols);
  studentRange.setBorder(true, true, true, true, true, true);
  
  // PROTECTION: Required for sharing with others (teachers/staff)
  // Protected: Student info (A-B), Headers (rows 6-7), Days ABSENT formulas
  // Editable by others: School DAYS and Days PRESENT input columns
  // Note: Protection operations are slow (~2-5 seconds each)
  // Configure via CONFIG.TEMPLATE.ENABLE_PROTECTIONS in Config.js
  if (CONFIG.TEMPLATE.ENABLE_PROTECTIONS) {
    // Get protection editor emails from config (can be array or single string)
    const protectionEditorEmails = Array.isArray(CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS) 
      ? CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS 
      : (CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS ? [CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS] : []);
    
    // Fallback to Session.getActiveUser() if no emails in config
    const emailsToUse = protectionEditorEmails.length > 0 
      ? protectionEditorEmails 
      : [Session.getActiveUser().getEmail()];
    
    // Filter out empty or invalid emails
    const validEmails = emailsToUse.filter(email => email && email.trim() !== '');
    
    // Skip protection if no valid emails
    if (validEmails.length === 0) {
      console.log('Note: Skipping protection - no valid emails available');
      return;
    }
    
    const endRow = startRow + numStudentRows - 1;
    const protectToRow = Math.max(endRow + 20, 50);
    
    const setProtectionWithEditors = (protection, emails) => {
      try {
        if (!emails || emails.length === 0) {
          console.log('Note: Skipping protection editor - no emails provided');
          return;
        }
        // Remove all existing editors
        const currentEditors = protection.getEditors();
        if (currentEditors.length > 0) {
          protection.removeEditors(currentEditors);
        }
        // Add all protection editor emails
        emails.forEach(email => {
          if (email && email.trim() !== '') {
            protection.addEditor(email.trim());
          }
        });
      } catch (e) {
        console.log('Note: Could not set protection editors:', e.message);
      }
    };
    
    // Get protected ranges from config
    const protectedRanges = CONFIG.TEMPLATE.PROTECTED_RANGES.ATTENDANCE_SHEET;
    
    // Protect student info columns (from config)
    if (protectedRanges.STUDENT_INFO_COLUMNS && protectedRanges.STUDENT_INFO_COLUMNS.length >= 2) {
      const startCol = protectedRanges.STUDENT_INFO_COLUMNS[0];
      const numColsInfo = protectedRanges.STUDENT_INFO_COLUMNS[1] - protectedRanges.STUDENT_INFO_COLUMNS[0] + 1;
      const colABRange = sheet.getRange(1, startCol, protectToRow, numColsInfo);
      const protection1 = colABRange.protect().setWarningOnly(false);
      setProtectionWithEditors(protection1, validEmails);
    }
    
    // Protect header rows (from config)
    if (protectedRanges.HEADER_ROWS && protectedRanges.HEADER_ROWS.length > 0) {
      const startRowHeader = Math.min(...protectedRanges.HEADER_ROWS);
      const numRowsHeader = Math.max(...protectedRanges.HEADER_ROWS) - startRowHeader + 1;
      const headerRowsRange = sheet.getRange(startRowHeader, 1, numRowsHeader, numCols);
      const protection2 = headerRowsRange.protect().setWarningOnly(false);
      setProtectionWithEditors(protection2, validEmails);
    }
    
    // Protect columns based on pattern (School DAYS and Days ABSENT)
    if (protectedRanges.PROTECTED_COLUMN_PATTERN) {
      const pattern = protectedRanges.PROTECTED_COLUMN_PATTERN;
      const protectedCols = [];
      for (let i = 0; i < monthsToUse.length; i++) {
        const baseCol = pattern.START_COL + (i * pattern.STEP);
        pattern.COLUMNS.forEach(relativePos => {
          const col = baseCol + relativePos;
          if (!protectedCols.includes(col)) {
            protectedCols.push(col);
          }
        });
      }
      
      // Protect all calculated columns
      const columnProtections = [];
      protectedCols.forEach((col) => {
        const colRange = sheet.getRange(1, col, protectToRow, 1);
        const prot = colRange.protect().setWarningOnly(false);
        columnProtections.push(prot);
      });
      columnProtections.forEach(protection => {
        setProtectionWithEditors(protection, validEmails);
      });
    }
  }
}

/**
 * Helper function to get active traits from CHARACTERS_REF sheet
 * @return {Array} Array of active trait names
 */
function _getActiveTraits() {
  try {
    return _getActiveItems(CONFIG.SHEET_NAMES.CHARACTERS_REF, 1);
  } catch (error) {
    console.error('Error getting active traits:', error);
    return [];
  }
}

/**
 * Helper function to generate EQ formula based on grade column
 * @param {number} gradeCol - Column number (1-based) for the grade column
 * @param {number} row - Row number (1-based) for the formula
 * @return {string} EQ formula string
 */
function _generateEQFormula(gradeCol, row) {
  const ranges = CONFIG.EQ_GRADING_SCALE.RANGES;
  const colLetter = _columnNumberToLetter(gradeCol); // Convert column number to letter
  const cellRef = `${colLetter}${row}`;
  
  // Build nested IF formula checking from highest to lowest range
  // Formula: IF(grade="","",IF(grade>=94.45,"O",IF(grade>=88.45,"VG",IF(grade>=81.45,"G",IF(grade>=74.45,"F","NI")))))
  let formula = `=IF(${cellRef}="",""`;
  
  // Sort ranges by max value descending (highest first)
  const sortedRanges = [...ranges].sort((a, b) => b.max - a.max);
  
  // Build nested IF from highest to lowest
  for (let i = 0; i < sortedRanges.length; i++) {
    const range = sortedRanges[i];
    if (i === sortedRanges.length - 1) {
      // Last condition (lowest range) - this is the final else
      formula += `,"${range.value}")`;
    } else {
      // Check if grade is >= min of this range
      formula += `,IF(${cellRef}>=${range.min},"${range.value}"`;
    }
  }
  
  // Close all remaining IF statements
  for (let i = 0; i < sortedRanges.length - 1; i++) {
    formula += ')';
  }
  
  return formula;
}

/**
 * Helper function to generate transmutation formula based on weighted average
 * @param {string} weightedAvgFormula - The weighted average formula string (e.g., "ROUND((C10*30/100+D10*40/100+E10*30/100),2)")
 * @return {string} Transmutation formula string with nested IF statements
 */
function _generateTransmutationFormula(weightedAvgFormula) {
  const table = CONFIG.TRANSMUTATION_TABLE;
  
  // Build nested IF formula checking from highest to lowest range
  // Formula structure: IF(weightedAvg="","",IF(AND(weightedAvg>=99.01,weightedAvg<=100),100,IF(AND(weightedAvg>=98.01,weightedAvg<=99),99.29,...)))
  let formula = `=IF(${weightedAvgFormula}="",""`;
  
  // Sort table by 'from' value descending (highest first)
  const sortedTable = [...table].sort((a, b) => b.from - a.from);
  
  // Build nested IF from highest to lowest
  for (let i = 0; i < sortedTable.length; i++) {
    const entry = sortedTable[i];
    if (i === sortedTable.length - 1) {
      // Last condition (lowest range) - this is the final else
      formula += `,${entry.transmutation})`;
    } else {
      // Check if weightedAvg is within this range (from <= weightedAvg <= to)
      formula += `,IF(AND(${weightedAvgFormula}>=${entry.from},${weightedAvgFormula}<=${entry.to}),${entry.transmutation}`;
    }
  }
  
  // Close all remaining IF statements
  for (let i = 0; i < sortedTable.length - 1; i++) {
    formula += ')';
  }
  
  return formula;
}

/**
 * Helper function to generate EQ formula based on transmuted grade column
 * @param {number} transmutedCol - Column number (1-based) for the transmuted grade column
 * @param {number} row - Row number (1-based) for the formula
 * @return {string} EQ formula string
 */
function _generateEQFromTransmutation(transmutedCol, row) {
  const table = CONFIG.TRANSMUTATION_TABLE;
  const colLetter = _columnNumberToLetter(transmutedCol); // Convert column number to letter
  const cellRef = `${colLetter}${row}`;
  
  // Build nested IF formula checking transmuted grade against transmutation values
  // Since each transmutation value is unique, we check for exact matches
  // Formula structure: IF(transmuted="","",IF(transmuted=100,"A",IF(transmuted=99.29,"A",...)))
  let formula = `=IF(${cellRef}="",""`;
  
  // Sort table by transmutation value descending (highest first)
  const sortedTable = [...table].sort((a, b) => b.transmutation - a.transmutation);
  
  // Build nested IF from highest to lowest transmutation value
  for (let i = 0; i < sortedTable.length; i++) {
    const entry = sortedTable[i];
    if (i === sortedTable.length - 1) {
      // Last condition (lowest transmutation) - this is the final else
      const eqValue = entry.eq || '';
      formula += `,${eqValue ? `"${eqValue}"` : '""'})`;
    } else {
      // Check if transmuted grade equals this transmutation value
      const eqValue = entry.eq || '';
      formula += `,IF(${cellRef}=${entry.transmutation},${eqValue ? `"${eqValue}"` : '""'}`;
    }
  }
  
  // Close all remaining IF statements
  for (let i = 0; i < sortedTable.length - 1; i++) {
    formula += ')';
  }
  
  return formula;
}

/**
 * Internal function to generate EQ formula from non-transmuted grade (for MAPEH Final EQ)
 * @param {number} gradeCol - Column number (1-based) containing the grade
 * @param {number} row - Row number
 * @return {string} EQ formula string
 */
function _generateEQFromNonTransmutedGrade(gradeCol, row) {
  const table = CONFIG.EQ_GRADING_SCALE_NON_TRANSMUTED.RANGES;
  const colLetter = _columnNumberToLetter(gradeCol); // Convert column number to letter
  const cellRef = `${colLetter}${row}`;
  
  // Build nested IF formula checking grade against ranges
  // Formula structure: IF(grade="","",IF(AND(grade>=70,grade<=74.44),"B",IF(AND(grade>=74.45,grade<=81.44),"D",...)))
  let formula = `=IF(${cellRef}="",""`;
  
  // Sort table by min value descending (highest first)
  const sortedTable = [...table].sort((a, b) => b.min - a.min);
  
  // Build nested IF from highest to lowest range
  for (let i = 0; i < sortedTable.length; i++) {
    const entry = sortedTable[i];
    if (i === sortedTable.length - 1) {
      // Last condition (lowest range) - this is the final else
      const eqValue = entry.value || '';
      formula += `,${eqValue ? `"${eqValue}"` : '""'})`;
    } else {
      // Check if grade is within this range (min <= grade <= max)
      const eqValue = entry.value || '';
      formula += `,IF(AND(${cellRef}>=${entry.min},${cellRef}<=${entry.max}),${eqValue ? `"${eqValue}"` : '""'}`;
    }
  }
  
  // Close all remaining IF statements
  for (let i = 0; i < sortedTable.length - 1; i++) {
    formula += ')';
  }
  
  return formula;
}

/**
 * Internal function to set up the Characters sheet structure
 * @param {Sheet} sheet - The target sheet
 * @param {string} schoolYear - The school year
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher/advisor name
 * @param {Array} students - Array of student objects
 */
function _setupCharactersSheet(sheet, schoolYear, gradeLevel, section, teacher, students = []) {
  sheet.clear();
  const traits = _getActiveTraits();
  const isSHS = CONFIG.IS_SHS;
  const numCols = isSHS ? 9 : 13; // SHS: 1st, 2nd, Final only. Non-SHS: 1st–4th, Final
  const allData = [];
  
  const padRow = (row) => {
    const padded = [...row];
    while (padded.length < numCols) {
      padded.push('');
    }
    return padded.slice(0, numCols);
  };
  
  allData.push(padRow(['Advisor Name:', teacher]));
  allData.push(padRow(['School Year:', schoolYear]));
  const formattedGradeLevel = _formatGradeLevel(gradeLevel);
  allData.push(padRow(['Level:', formattedGradeLevel]));
  allData.push(padRow(['Section:', section]));
  allData.push(padRow(['Total Student:', students.length > 0 ? students.length : '']));
  
  const legendText = CONFIG.EQ_GRADING_SCALE.RANGES.map(range => 
    `${range.min}-${range.max}: ${range.value} (${range.label})`
  ).join(' | ');
  allData.push(padRow(['EQ Legend:', legendText]));
  
  const headerRow = isSHS
    ? ['Student No', 'Student Name', 'TRAITS', '1st Grade', '1st EQ', '2nd Grade', '2nd EQ', 'Final Grading', 'Final EQ']
    : ['Student No', 'Student Name', 'TRAITS', '1st Grade', '1st EQ', '2nd Grade', '2nd EQ', '3rd Grade', '3rd EQ', '4th Grade', '4th EQ', 'Final Grading', 'Final EQ'];
  allData.push(padRow(headerRow));
  
  // Write all data at once
  const numRows = allData.length;
  const dataRange = sheet.getRange(1, 1, numRows, numCols);
  dataRange.setValues(allData);
  
  // OPTIMIZATION: Batch info row formatting
  // Info rows (1-5) - matching subject sheet format
  sheet.getRange(1, 1, 5, 1).setFontWeight('bold');
  sheet.getRange(1, 2, 2, 1).setBackground(CONFIG.COLORS.LIGHT_GRAY); // Advisor Name, School Year
  sheet.getRange(3, 2, 1, 1).setBackground(CONFIG.COLORS.LIGHT_GRAY); // Level
  sheet.getRange(4, 2, 2, 1).setBackground(CONFIG.COLORS.LIGHT_GRAY); // Section, Total Student
  
  // Total Student value should be left-aligned
  sheet.getRange(5, 2).setHorizontalAlignment('left');
  
  sheet.getRange(6, 1, 1, 1).setFontWeight('bold');
  sheet.getRange(6, 2, 1, isSHS ? 8 : 4).merge(); // Merge legend: SHS B6:I6, non-SHS B6:E6
  sheet.getRange(6, 2, 1, 1).setBackground(CONFIG.COLORS.LIGHT_GRAY);
  
  // Row 7: Format column headers (matching subject sheet format)
  sheet.getRange(7, 1, 1, numCols)
    .setFontWeight('bold')
    .setBackground(CONFIG.COLORS.DARK_GRAY)
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true);
  
  // Set column widths (matching subject sheet format)
  sheet.setColumnWidth(1, 120); // Student No
  sheet.setColumnWidth(2, 250); // Student Name
  // TRAITS column will be auto-resized after data is written
  for (let c = 4; c <= numCols; c++) {
    sheet.setColumnWidth(c, 130); // Grade and EQ columns
  }
  
  // Freeze rows at row 7 (matching subject sheet format)
  sheet.setFrozenRows(7);
  
  // Add student data - each student gets one row per active trait
  const hasStudents = students && students.length > 0;
  const hasTraits = traits && traits.length > 0;
  const startRow = 8;
  
  if (hasStudents && hasTraits) {
    const studentValues = [];
    
    // For each student, create one row per active trait
    students.forEach((student) => {
      const studentNumber = student.studentNumber || '';
      const lastName = student.lastName || '';
      const firstName = student.firstName || '';
      const middleName = student.middleName || '';
      const studentName = `${lastName}${firstName ? ', ' + firstName : ''}${middleName ? ' ' + middleName : ''}`.trim();
      
      traits.forEach((trait) => {
        const row = isSHS
          ? [studentNumber, studentName, trait, '', '', '', '', '', ''] // 1st Grade, 1st EQ, 2nd Grade, 2nd EQ, Final Grading, Final EQ
          : [studentNumber, studentName, trait, '', '', '', '', '', '', '', '', '', '']; // 1st–4th, Final
        studentValues.push(padRow(row));
      });
    });
    
    // Add empty rows if needed to reach minimum
    const totalRows = studentValues.length;
    const minRows = CONFIG.TEMPLATE.NUM_STUDENT_ROWS * (hasTraits ? traits.length : 1);
    if (totalRows < minRows) {
      const emptyRowsNeeded = minRows - totalRows;
      for (let i = 0; i < emptyRowsNeeded; i++) {
        studentValues.push(padRow(new Array(numCols).fill('')));
      }
    }
    
    // Write student data
    const numStudentRows = studentValues.length;
    const studentRange = sheet.getRange(startRow, 1, numStudentRows, numCols);
    studentRange.setValues(studentValues);
    
    const eqFormulas = [];
    const finalGradingFormulas = []; // Final Grading = avg of grade columns (2 for SHS, 4 for non-SHS)
    for (let r = 0; r < numStudentRows; r++) {
      const rowNum = startRow + r;
      const rowFormulas = [];
      if (isSHS) {
        rowFormulas[4] = _generateEQFormula(4, rowNum);   // 1st EQ (E) from 1st Grade (D)
        rowFormulas[6] = _generateEQFormula(6, rowNum);   // 2nd EQ (G) from 2nd Grade (F)
        rowFormulas[8] = _generateEQFormula(8, rowNum);  // Final EQ (I) from Final Grading (H)
        finalGradingFormulas.push([`=IF(AND(D${rowNum}<>"",F${rowNum}<>""),ROUND((D${rowNum}+F${rowNum})/2,2),"")`]);
      } else {
        rowFormulas[4] = _generateEQFormula(4, rowNum);
        rowFormulas[6] = _generateEQFormula(6, rowNum);
        rowFormulas[8] = _generateEQFormula(8, rowNum);
        rowFormulas[10] = _generateEQFormula(10, rowNum);
        rowFormulas[12] = _generateEQFormula(12, rowNum);
        finalGradingFormulas.push([`=IF(AND(D${rowNum}<>"",F${rowNum}<>"",H${rowNum}<>"",J${rowNum}<>""),ROUND((D${rowNum}+F${rowNum}+H${rowNum}+J${rowNum})/4,2),"")`]);
      }
      eqFormulas.push(rowFormulas);
    }
    
    const eqCols = isSHS ? [5, 7, 9] : [5, 7, 9, 11, 13];
    eqCols.forEach((col) => {
      const formulas = eqFormulas.map(row => row[col - 1] || '');
      sheet.getRange(startRow, col, numStudentRows, 1).setFormulas(formulas.map(f => [f]));
    });
    if (finalGradingFormulas.length > 0) {
      const finalGradingCol = isSHS ? 8 : 12;
      sheet.getRange(startRow, finalGradingCol, numStudentRows, 1).setFormulas(finalGradingFormulas);
    }
    
    const gradeCols = isSHS ? [4, 6] : [4, 6, 8, 10];
    gradeCols.forEach((col) => {
      sheet.getRange(startRow, col, numStudentRows, 1).setHorizontalAlignment('center');
    });
    
    eqCols.forEach((col) => {
      const range = sheet.getRange(startRow, col, numStudentRows, 1);
      range.setBackground(CONFIG.COLORS.MEDIUM_GRAY);
      range.setHorizontalAlignment('center');
    });
    const finalGradingCol = isSHS ? 8 : 12;
    sheet.getRange(startRow, finalGradingCol, numStudentRows, 1).setBackground(CONFIG.COLORS.MEDIUM_GRAY).setHorizontalAlignment('center');
    
    // Auto-resize TRAITS column (column 3) based on content
    sheet.autoResizeColumn(3);
    const currentWidth = sheet.getColumnWidth(3);
    sheet.setColumnWidth(3, currentWidth + 50); // Add 50 pixels of extra width
    
    // Format borders for student data (matching subject sheet format)
    studentRange.setBorder(true, true, true, true, true, true);
  } else {
    const numStudentRows = CONFIG.TEMPLATE.NUM_STUDENT_ROWS * (hasTraits ? traits.length : 1);
    const emptyValues = [];
    for (let i = 0; i < numStudentRows; i++) {
      emptyValues.push(padRow(new Array(numCols).fill('')));
    }
    const studentRange = sheet.getRange(startRow, 1, numStudentRows, numCols);
    studentRange.setValues(emptyValues);
    
    const eqFormulasEmpty = [];
    const finalGradingFormulasEmpty = [];
    for (let r = 0; r < numStudentRows; r++) {
      const rowNum = startRow + r;
      const rowFormulas = [];
      if (isSHS) {
        rowFormulas[4] = _generateEQFormula(4, rowNum);
        rowFormulas[6] = _generateEQFormula(6, rowNum);
        rowFormulas[8] = _generateEQFormula(8, rowNum);
        finalGradingFormulasEmpty.push([`=IF(AND(D${rowNum}<>"",F${rowNum}<>""),ROUND((D${rowNum}+F${rowNum})/2,2),"")`]);
      } else {
        rowFormulas[4] = _generateEQFormula(4, rowNum);
        rowFormulas[6] = _generateEQFormula(6, rowNum);
        rowFormulas[8] = _generateEQFormula(8, rowNum);
        rowFormulas[10] = _generateEQFormula(10, rowNum);
        rowFormulas[12] = _generateEQFormula(12, rowNum);
        finalGradingFormulasEmpty.push([`=IF(AND(D${rowNum}<>"",F${rowNum}<>"",H${rowNum}<>"",J${rowNum}<>""),ROUND((D${rowNum}+F${rowNum}+H${rowNum}+J${rowNum})/4,2),"")`]);
      }
      eqFormulasEmpty.push(rowFormulas);
    }
    
    const eqColsEmpty = isSHS ? [5, 7, 9] : [5, 7, 9, 11, 13];
    eqColsEmpty.forEach((col) => {
      const formulas = eqFormulasEmpty.map(row => row[col - 1] || '');
      sheet.getRange(startRow, col, numStudentRows, 1).setFormulas(formulas.map(f => [f]));
    });
    if (finalGradingFormulasEmpty.length > 0) {
      const finalGradingColEmpty = isSHS ? 8 : 12;
      sheet.getRange(startRow, finalGradingColEmpty, numStudentRows, 1).setFormulas(finalGradingFormulasEmpty);
    }
    
    const gradeColsEmpty = isSHS ? [4, 6] : [4, 6, 8, 10];
    gradeColsEmpty.forEach((col) => {
      sheet.getRange(startRow, col, numStudentRows, 1).setHorizontalAlignment('center');
    });
    
    eqColsEmpty.forEach((col) => {
      const range = sheet.getRange(startRow, col, numStudentRows, 1);
      range.setBackground(CONFIG.COLORS.MEDIUM_GRAY);
      range.setHorizontalAlignment('center');
    });
    const finalGradingColEmpty = isSHS ? 8 : 12;
    sheet.getRange(startRow, finalGradingColEmpty, numStudentRows, 1).setBackground(CONFIG.COLORS.MEDIUM_GRAY).setHorizontalAlignment('center');
    
    studentRange.setBorder(true, true, true, true, true, true);
    
    const gradeInputCols = isSHS ? [4, 6] : [4, 6, 8, 10];
    const minGrade = CONFIG.TEMPLATE.MIN_GRADE;
    const maxGrade = CONFIG.TEMPLATE.MAX_GRADE;
    const allRules = [];
    
    gradeInputCols.forEach(col => {
      const inputRange = sheet.getRange(startRow, col, numStudentRows, 1);
      
      // Rule 1: Red if value is less than minimum grade
      const rule1 = SpreadsheetApp.newConditionalFormatRule()
        .setRanges([inputRange])
        .whenNumberLessThan(minGrade)
        .setBackground(CONFIG.COLORS.LIGHT_RED)
        .build();
      
      // Rule 2: Red if value is greater than maximum grade
      const rule2 = SpreadsheetApp.newConditionalFormatRule()
        .setRanges([inputRange])
        .whenNumberGreaterThan(maxGrade)
        .setBackground(CONFIG.COLORS.LIGHT_RED)
        .build();
      
      allRules.push(rule1, rule2);
    });
    
    // Apply all conditional formatting rules in a single batch operation
    if (allRules.length > 0) {
      const existingRules = sheet.getConditionalFormatRules();
      existingRules.push.apply(existingRules, allRules);
      sheet.setConditionalFormatRules(existingRules);
    }
  }
  
  // PROTECTION: Required for sharing with others (teachers/staff)
  // Protected: Student info (A-B), Headers (row 7), EQ formulas (E, G, I, K, M)
  // Editable by others: Grade input columns (D, F, H, J, L)
  // Note: Protection operations are slow (~2-5 seconds each)
  // Configure via CONFIG.TEMPLATE.ENABLE_PROTECTIONS in Config.js
  if (CONFIG.TEMPLATE.ENABLE_PROTECTIONS) {
    // Get protection editor emails from config (can be array or single string)
    const protectionEditorEmails = Array.isArray(CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS) 
      ? CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS 
      : (CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS ? [CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS] : []);
    
    // Fallback to Session.getActiveUser() if no emails in config
    const emailsToUse = protectionEditorEmails.length > 0 
      ? protectionEditorEmails 
      : [Session.getActiveUser().getEmail()];
    
    // Filter out empty or invalid emails
    const validEmails = emailsToUse.filter(email => email && email.trim() !== '');
    
    if (validEmails.length === 0) {
      console.log('Note: Skipping protection - no valid emails available');
      return;
    }
    const numStudentRows = CONFIG.TEMPLATE.NUM_STUDENT_ROWS * (hasTraits ? traits.length : 1);
    const startRow = 8;
    const endRow = startRow + numStudentRows - 1;
    const protectToRow = Math.max(endRow + 20, 50);
    
    const setProtectionWithEditors = (protection, emails) => {
      try {
        if (!emails || emails.length === 0) {
          console.log('Note: Skipping protection editor - no emails provided');
          return;
        }
        const currentEditors = protection.getEditors();
        if (currentEditors.length > 0) {
          protection.removeEditors(currentEditors);
        }
        emails.forEach(email => {
          if (email && email.trim() !== '') {
            protection.addEditor(email.trim());
          }
        });
      } catch (e) {
        console.log('Note: Could not set protection editors:', e.message);
      }
    };
    
    const protectedRanges = CONFIG.TEMPLATE.PROTECTED_RANGES.CHARACTER_SHEET;
    const charNumCols = isSHS ? 9 : 13;
    
    if (protectedRanges.STUDENT_INFO_COLUMNS && protectedRanges.STUDENT_INFO_COLUMNS.length >= 2) {
      const startCol = protectedRanges.STUDENT_INFO_COLUMNS[0];
      const numColsProtect = protectedRanges.STUDENT_INFO_COLUMNS[1] - protectedRanges.STUDENT_INFO_COLUMNS[0] + 1;
      const colABRange = sheet.getRange(1, startCol, protectToRow, numColsProtect);
      const protection1 = colABRange.protect().setWarningOnly(false);
      setProtectionWithEditors(protection1, validEmails);
    }
    
    if (protectedRanges.HEADER_ROW) {
      const headerRowRange = sheet.getRange(protectedRanges.HEADER_ROW, 1, 1, charNumCols);
      const protection2 = headerRowRange.protect().setWarningOnly(false);
      setProtectionWithEditors(protection2, validEmails);
    }
    
    const charFormulaCols = isSHS ? [5, 7, 8, 9] : (protectedRanges.FORMULA_COLUMNS || []);
    if (charFormulaCols.length > 0) {
      const eqFormulaCols = [...charFormulaCols].sort((a, b) => a - b);
      const eqFormulaProtections = [];
      
      // Group consecutive columns together
      let startCol = eqFormulaCols[0];
      let endCol = eqFormulaCols[0];
      
      for (let i = 1; i < eqFormulaCols.length; i++) {
        if (eqFormulaCols[i] === endCol + 1) {
          // Consecutive column - extend the range
          endCol = eqFormulaCols[i];
        } else {
          // Non-consecutive - protect the current range and start a new one
          const numCols = endCol - startCol + 1;
          const formulaRange = sheet.getRange(1, startCol, protectToRow, numCols);
          const prot = formulaRange.protect().setWarningOnly(false);
          eqFormulaProtections.push(prot);
          startCol = eqFormulaCols[i];
          endCol = eqFormulaCols[i];
        }
      }
      
      // Protect the last range
      const numCols = endCol - startCol + 1;
      const formulaRange = sheet.getRange(1, startCol, protectToRow, numCols);
      const prot = formulaRange.protect().setWarningOnly(false);
      eqFormulaProtections.push(prot);
      
      // Set editors for all protections
      eqFormulaProtections.forEach(protection => {
        setProtectionWithEditors(protection, validEmails);
      });
    }
  }
}

/**
 * Helper function to get all subjects for a grade level and section (from all teachers)
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Array} Array of subject names
 */
function _getAllSubjectsForClass(gradeLevel, section) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS);
    if (!sheet) {
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }
    
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    const subjects = [];
    const seenSubjects = new Set();
    
    // Normalize grade level for comparison (sheet stores just numbers)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.SUBJECTS_COLUMNS.GRADE_LEVEL] || '').trim());
      if (rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.SUBJECTS_COLUMNS.SECTION] === section &&
          row[CONFIG.SUBJECTS_COLUMNS.STATUS] === 'Active') {
        const subject = String(row[CONFIG.SUBJECTS_COLUMNS.SUBJECT] || '').trim();
        if (subject && !seenSubjects.has(subject)) {
          subjects.push(subject);
          seenSubjects.add(subject);
        }
      }
    }
    
    return subjects;
  } catch (error) {
    console.error('Error getting all subjects for class:', error);
    return [];
  }
}

/**
 * Internal function to set up the QR (Quarterly Report) sheet structure
 * Based on the CSV format from 1A-Grades-4th-AY-2024-2025-Rojo, R.-as of May 3, 2025.csv
 * @param {Sheet} sheet - The target sheet
 * @param {string} schoolYear - The school year
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher/advisor name
 * @param {Array} students - Array of student objects
 * @param {Spreadsheet} templateSpreadsheet - The template spreadsheet (to reference Attendance sheet)
 */
function _setupQRSheet(sheet, schoolYear, gradeLevel, section, teacher, students = [], templateSpreadsheet) {
  // Clear the sheet first
  sheet.clear();
  
  // Get all subjects for this class (from all teachers)
  const allSubjects = _getAllSubjectsForClass(gradeLevel, section);
  
  // Get months from ATTENDANCE_REF for the school year
  const monthlyDays = _getMonthlySchoolDays(schoolYear);
  
  // Sort months in typical school year order
  const monthOrder = ['August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
  const monthsToUse = [];
  monthOrder.forEach(month => {
    // Check if this month exists in monthlyDays (try exact match and variations)
    const monthKey = Object.keys(monthlyDays).find(key => {
      const keyLower = key.toLowerCase().trim();
      const monthLower = month.toLowerCase();
      return keyLower === monthLower || 
             keyLower.startsWith(monthLower.substring(0, 3)) ||
             monthLower.startsWith(keyLower.substring(0, 3));
    });
    if (monthKey) {
      monthsToUse.push(monthKey);
    }
  });
  
  // Build the QR sheet structure - compact layout
  const allData = [];
  // Calculate number of columns needed: Learning Areas (1) + spacing (3) + Periodic Assessment (5) + spacing (1) + STUDENT NAME/QUARTER (2) = 12
  // Plus attendance months (dynamic) - but we'll use a reasonable max
  const maxAttendanceCols = Math.max(monthsToUse.length + 3, 12); // At least 12, or months + 3 for ATTENDANCE label + spacing + TOTAL
  const numCols = Math.max(15, maxAttendanceCols); // Use at least 15 columns, or more if needed for attendance
  
  // Helper function to pad row to numCols
  const padRow = (row) => {
    const padded = [...row];
    while (padded.length < numCols) {
      padded.push('');
    }
    return padded.slice(0, numCols);
  };
  
  // Row 1: GOLDEN LINK COLLEGE (with STUDENT NAME in top right)
  // Merge A-O for school name, then STUDENT NAME in P-Q
  allData.push(padRow(['GOLDEN LINK COLLEGE', '', '', '', '', '', '', '', '', '', '', '', '', '', 'STUDENT NAME', '']));
  
  // Row 2: Address line 1 (with QUARTER and ALL in top right)
  allData.push(padRow(['Waling-waling St., Brgy. 177 Camarin', '', '', '', '', '', '', '', '', '', '', '', '', '', 'QUARTER', 'ALL']));
  
  // Row 3: Address line 2
  allData.push(padRow(['Caloocan City, Philippines']));
  
  // Row 4: Empty
  allData.push(padRow(['']));
  
  // Row 5: Basic Education Department
  allData.push(padRow(['Basic Education Department']));
  
  // Row 6: Elementary Progress Report
  allData.push(padRow(['Elementary Progress Report']));
  
  // Row 7: Empty
  allData.push(padRow(['']));
  
  // Row 8: Name :, (empty), (student name placeholder), (empty), Age :, (empty), (age placeholder)
  allData.push(padRow(['Name :', '', '', '', 'Age :', '', '']));
  
  // Row 9: Date of birth :, (empty), (date placeholder), (empty), Sex :, (empty), (sex placeholder)
  allData.push(padRow(['Date of birth :', '', '', '', 'Sex :', '', '']));
  
  // Row 10: School Year :, (empty), schoolYear, (empty), Grade :, (empty), gradeLevel
  allData.push(padRow(['School Year :', '', schoolYear, '', 'Grade :', '', gradeLevel]));
  
  // Row 11: Empty
  allData.push(padRow(['']));
  
  // Row 12: LEARNING AREAS, (empty), (empty), (empty), Periodic Assessment
  allData.push(padRow(['LEARNING AREAS', '', '', '', 'Periodic Assessment']));
  
  // Row 13: Sub-headers (empty, empty, empty, empty, 1, empty, 2, empty, 3, empty, 4, empty, Final)
  allData.push(padRow(['', '', '', '', '1', '', '2', '', '3', '', '4', '', 'Final']));
  
  // Rows 14+: Subject rows (each subject with empty cells for grades in columns E, G, I, K, M)
  allSubjects.forEach((subject) => {
    allData.push(padRow([subject, '', '', '', '', '', '', '', '', '', '', '', '']));
  });
  
  // General Average row (after all subjects)
  allData.push(padRow(['General Average', '', '', '', '', '', '', '', '', '', '', '', '']));
  
  // Empty row
  allData.push(padRow(['']));
  
  // Attendance section
  // Row: ATTENDANCE header with months in the same row
  const monthHeaderRow = ['ATTENDANCE', ''];
  monthsToUse.forEach((month) => {
    monthHeaderRow.push(month.substring(0, 3).toUpperCase()); // Abbreviate month (AUG, SEP, etc.)
  });
  monthHeaderRow.push('TOTAL');
  allData.push(padRow(monthHeaderRow));
  
  // Days of School row
  const daysOfSchoolRow = ['Days of School', ''];
  monthsToUse.forEach((month) => {
    daysOfSchoolRow.push(monthlyDays[month] || '');
  });
  // Calculate total
  const totalDays = monthsToUse.reduce((sum, month) => sum + (monthlyDays[month] || 0), 0);
  daysOfSchoolRow.push(totalDays || '');
  allData.push(padRow(daysOfSchoolRow));
  
  // Days Present row
  const daysPresentRow = ['Days Present', ''];
  monthsToUse.forEach(() => {
    daysPresentRow.push('');
  });
  daysPresentRow.push(''); // Total (will be calculated by formula or manual entry)
  allData.push(padRow(daysPresentRow));
  
  // Days Absent row
  const daysAbsentRow = ['Days Absent', ''];
  monthsToUse.forEach(() => {
    daysAbsentRow.push('');
  });
  daysAbsentRow.push(''); // Total (will be calculated by formula or manual entry)
  allData.push(padRow(daysAbsentRow));
  
  // Empty row
  allData.push(padRow(['']));
  
  // Separator line row (dashes) - will be merged
  allData.push(padRow(['---------------------------------------------------------------------------------------------------------------------']));
  
  // Acknowledgment section
  // Row: "This is to acknowledge receipt of the periodical progress report of [STUDENT NAME] for the ______ period of school year [SCHOOL YEAR]."
  const ackText = `This is to acknowledge receipt of the periodical progress report of  for the ______ period  of school year ${schoolYear} .`;
  allData.push(padRow([ackText]));
  
  // Empty rows (3 empty rows)
  allData.push(padRow(['']));
  allData.push(padRow(['']));
  allData.push(padRow(['']));
  
  // Parent's Name / Signature and Date row
  allData.push(padRow(['Parent\'s Name / Signature', '', '', '', '', '', '', '', '', '', '', '', '', 'Date', '']));
  
  // Write all data
  const numRows = allData.length;
  const dataRange = sheet.getRange(1, 1, numRows, numCols);
  dataRange.setValues(allData);
  
  // Formatting
  // Row 1: School name - merge A-O (15 columns), then format STUDENT NAME in column P
  sheet.getRange(1, 1, 1, 15).merge().setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(1, 15, 1, 1).setFontWeight('bold'); // STUDENT NAME in column O (15)
  
  // Row 2: Address line 1 - merge A-O, then format QUARTER and ALL
  sheet.getRange(2, 1, 1, 15).merge().setFontSize(10).setHorizontalAlignment('center');
  sheet.getRange(2, 15, 1, 1).setFontWeight('bold'); // QUARTER in column O
  sheet.getRange(2, 16, 1, 1).setFontWeight('bold'); // ALL in column P
  
  // Row 3: Address line 2 - merge and format
  sheet.getRange(3, 1, 1, 15).merge().setFontSize(10).setHorizontalAlignment('center');
  
  // Row 5: Basic Education Department - merge and format
  sheet.getRange(5, 1, 1, 15).merge().setFontSize(12).setHorizontalAlignment('center');
  
  // Row 6: Elementary Progress Report - merge and format with border
  const progressReportRange = sheet.getRange(6, 1, 1, 15);
  progressReportRange.merge()
    .setFontSize(14)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true);
  
  // Row 8-10: Student info - format labels and values
  sheet.getRange(8, 1, 3, 1).setFontWeight('bold'); // Name, Date of birth, School Year labels
  sheet.getRange(8, 5, 3, 1).setFontWeight('bold'); // Age, Sex, Grade labels
  
  // Row 12: Learning Areas header - merge A-D and format E
  sheet.getRange(12, 1, 1, 4).merge().setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(12, 5, 1, 1).setFontWeight('bold').setHorizontalAlignment('center');
  
  // Row 13: Sub-headers (1, 2, 3, 4, Final) - format with spacing
  const subHeaderCols = [5, 7, 9, 11, 13]; // Columns E, G, I, K, M for 1, 2, 3, 4, Final
  subHeaderCols.forEach((col, index) => {
    const headerText = index < 4 ? String(index + 1) : 'Final';
    sheet.getRange(13, col).setValue(headerText)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground(CONFIG.COLORS.DARK_GRAY);
  });
  
  // Subject rows - format first column (subject names)
  const subjectStartRow = 14;
  const subjectEndRow = subjectStartRow + allSubjects.length - 1;
  if (subjectEndRow >= subjectStartRow && allSubjects.length > 0) {
    sheet.getRange(subjectStartRow, 1, allSubjects.length, 1).setFontWeight('bold');
  }
  
  // General Average row
  const generalAvgRowNum = subjectEndRow + 1;
  if (generalAvgRowNum > subjectEndRow) {
    sheet.getRange(generalAvgRowNum, 1, 1, 1).setFontWeight('bold');
  }
  
  // Attendance section
  const attendanceHeaderRowNum = generalAvgRowNum + 2;
  
  // Month headers row - format ATTENDANCE header and month columns
  const monthHeaderRowNum = attendanceHeaderRowNum;
  sheet.getRange(monthHeaderRowNum, 1, 1, 1).setFontWeight('bold'); // ATTENDANCE in column A only
  
  // Format month headers (starting from column C)
  const monthStartCol = 3;
  monthsToUse.forEach((month, index) => {
    sheet.getRange(monthHeaderRowNum, monthStartCol + index, 1, 1)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground(CONFIG.COLORS.DARK_GRAY);
  });
  // TOTAL column (after all months)
  if (monthsToUse.length > 0) {
    sheet.getRange(monthHeaderRowNum, monthStartCol + monthsToUse.length, 1, 1)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground(CONFIG.COLORS.DARK_GRAY);
  }
  
  // Days of School, Days Present, Days Absent rows
  const daysOfSchoolRowNum = monthHeaderRowNum + 1;
  const daysPresentRowNum = daysOfSchoolRowNum + 1;
  const daysAbsentRowNum = daysPresentRowNum + 1;
  
  // Labels are in column A only (not merged)
  sheet.getRange(daysOfSchoolRowNum, 1, 1, 1).setFontWeight('bold');
  sheet.getRange(daysPresentRowNum, 1, 1, 1).setFontWeight('bold');
  sheet.getRange(daysAbsentRowNum, 1, 1, 1).setFontWeight('bold');
  
  // Right-align numeric values in attendance section
  const attendanceDataStartCol = 3;
  if (monthsToUse.length > 0) {
    sheet.getRange(daysOfSchoolRowNum, attendanceDataStartCol, 1, monthsToUse.length + 1)
      .setHorizontalAlignment('right');
    sheet.getRange(daysPresentRowNum, attendanceDataStartCol, 1, monthsToUse.length + 1)
      .setHorizontalAlignment('right');
    sheet.getRange(daysAbsentRowNum, attendanceDataStartCol, 1, monthsToUse.length + 1)
      .setHorizontalAlignment('right');
  }
  
  // Separator line row
  const separatorRow = daysAbsentRowNum + 1;
  sheet.getRange(separatorRow, 1, 1, numCols).merge();
  
  // Acknowledgment section
  const ackRow = separatorRow + 1;
  sheet.getRange(ackRow, 1, 1, numCols).merge().setHorizontalAlignment('left');
  
  // Parent's Name / Signature and Date
  const parentSigRow = ackRow + 4;
  sheet.getRange(parentSigRow, 1, 1, 1).setFontWeight('bold');
  // Date column - find it dynamically (should be near the end)
  const dateCol = Math.min(numCols - 1, 15);
  sheet.getRange(parentSigRow, dateCol, 1, 1).setFontWeight('bold');
  
  // Set column widths - compact layout
  sheet.setColumnWidth(1, 200); // Learning Areas column
  sheet.setColumnWidth(2, 30);  // Spacing
  sheet.setColumnWidth(3, 30);  // Spacing
  sheet.setColumnWidth(4, 30);  // Spacing
  // Periodic Assessment columns (5, 7, 9, 11, 13) - wider for grades
  sheet.setColumnWidth(5, 70);  // Column E for "1"
  sheet.setColumnWidth(6, 30);  // Spacing
  sheet.setColumnWidth(7, 70);  // Column G for "2"
  sheet.setColumnWidth(8, 30);  // Spacing
  sheet.setColumnWidth(9, 70);  // Column I for "3"
  sheet.setColumnWidth(10, 30); // Spacing
  sheet.setColumnWidth(11, 70); // Column K for "4"
  sheet.setColumnWidth(12, 30); // Spacing
  sheet.setColumnWidth(13, 70); // Column M for "Final"
  // STUDENT NAME/QUARTER columns
  sheet.setColumnWidth(15, 120); // STUDENT NAME / QUARTER
  sheet.setColumnWidth(16, 80);  // ALL / student name value
  // Attendance and remaining columns
  for (let c = 14; c <= numCols; c++) {
    if (c !== 15 && c !== 16) { // Skip already set columns
      sheet.setColumnWidth(c, 60);
    }
  }
}

/**
 * Internal function to generate OGS template based on provided parameters
 * Creates a new Google Sheet file with one sheet per subject for the teacher
 * Organizes files into folders: "YYYY-YYYY Grade XY" format
 * @param {string} schoolYear - The school year (e.g., "2024-2025")
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @param {Array} subjects - Array of subject names to generate sheets for
 * @param {string} userEmail - The email of the user creating the template (passed from client)
 * @return {Object} Result object with success status and message
 */
function _generateOGSTemplate(schoolYear, gradeLevel, section, teacher, subjects, userEmail) {
  try {
    const masterSpreadsheet = getSpreadsheet();
    
    // Normalize grade level for folder/file naming (extract just the number)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    // Generate template file name: SHS adds strand and semester; otherwise same as before
    const sanitizedSection = section.toUpperCase();
    const sanitizedYear = schoolYear.replace(/[^a-zA-Z0-9-]/g, '');
    let templateFileName;
    if (CONFIG.IS_SHS && subjects && subjects.length > 0) {
      const meta = _getSubjectMetadata(subjects[0]);
      const strand = (meta.strand || CONFIG.SHS_DEFAULTS.STRAND).replace(/[^a-zA-Z0-9]/g, '');
      const semester = (meta.semester || CONFIG.SHS_DEFAULTS.SEMESTER).replace(/[^a-zA-Z0-9]/g, '');
      templateFileName = `OGS-GRADE-${normalizedGradeLevel}-${sanitizedSection}-${strand}-${semester} Quarter-${sanitizedYear} - ${teacher}`;
    } else {
      templateFileName = `OGS-GRADE-${normalizedGradeLevel}${sanitizedSection}-${sanitizedYear} - ${teacher}`;
    }
    
    // Get the parent folder of the master spreadsheet
    const masterFile = DriveApp.getFileById(masterSpreadsheet.getId());
    const parentFolders = masterFile.getParents();
    const baseFolder = parentFolders.hasNext() ? parentFolders.next() : DriveApp.getRootFolder();
    
    // OPTIMIZATION: Create folder structure: "YYYY-YYYY Grade XY"
    // Example: "2025-2026 Grade 1A"
    // Format grade level for display in folder name
    const formattedGradeLevel = _formatGradeLevel(normalizedGradeLevel);
    const folderName = `${schoolYear} ${formattedGradeLevel}${section}`;
    const targetFolder = _findOrCreateFolder(baseFolder, folderName);
    
    // Check if template file already exists in the target folder
    const existingFiles = targetFolder.getFilesByName(templateFileName);
    if (existingFiles.hasNext()) {
      // File already exists - return error without creating or writing to MASTER_DATA
      const existingFile = existingFiles.next();
      const existingFileUrl = existingFile.getUrl();
      return {
        success: false,
        message: _formatMessage(CONFIG.MESSAGES.ERROR.TEMPLATE_EXISTS, {
          fileName: templateFileName,
          folderName: folderName,
          fileUrl: existingFileUrl
        }),
        templateUrl: existingFileUrl,
        folderName: folderName
      };
    }
    
    // Create new Google Sheet file
    const templateSpreadsheet = SpreadsheetApp.create(templateFileName);
    const templateFile = DriveApp.getFileById(templateSpreadsheet.getId());
    const protectionEditorEmails = Array.isArray(CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS) 
      ? CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS 
      : (CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS ? [CONFIG.TEMPLATE.PROTECTION_EDITOR_EMAILS] : []);
    
    // Get teacher email from TEACHERS_REF sheet
    const teacherEmail = _getTeacherEmail(teacher);
    
    // Collect all emails to add (avoid duplicates)
    const emailsToAdd = new Set();
    
    // Add protection editor emails from config
    protectionEditorEmails.forEach(email => {
      if (email && email.trim() !== '') {
        emailsToAdd.add(email.trim());
      }
    });
    
    // Add creator's email (the person who generated the template)
    if (userEmail && userEmail.trim() !== '') {
      emailsToAdd.add(userEmail.trim());
    }
    
    // Add teacher email
    if (teacherEmail && teacherEmail.trim() !== '') {
      emailsToAdd.add(teacherEmail.trim());
    }
    
    // Add all unique emails as editors
    emailsToAdd.forEach(email => {
      try {
        templateFile.addEditor(email);
      } catch (e) {
        console.log('Note: Could not add email as editor:', e.message);
      }
    });
    
    // NOTE: Protected ranges (student data, formulas, headers) are locked to only creator
    // Teacher can edit unprotected grading input columns (C, D, E, G, H, I, K, L, M, O, P, Q)
    
    // Move the new file to the target folder (always move from root)
      targetFolder.addFile(templateFile);
      DriveApp.getRootFolder().removeFile(templateFile); // Remove from root folder
    
    // OPTIMIZATION: Fetch students from STUDENTS DB (single API call)
    const students = _getStudentsFromDB(schoolYear, gradeLevel, section);
    
    // OPTIMIZATION: Pre-fetch all grading weights at once to reduce API calls
    const subjectWeights = {};
    subjects.forEach(subject => {
      subjectWeights[subject] = _getGradingWeights(subject);
    });
    
    // Get the default sheet and rename it to the first subject
    const defaultSheet = templateSpreadsheet.getActiveSheet();
    const firstSubject = subjects[0];
    defaultSheet.setName(firstSubject);
    
    // Set up the first OGS template sheet with student data
    _setupOGSTemplate(defaultSheet, schoolYear, gradeLevel, section, firstSubject, teacher, subjectWeights[firstSubject], students, userEmail);
    
    // Create sheets for remaining subjects with same student data
    const createdSheets = [firstSubject];
    for (let i = 1; i < subjects.length; i++) {
      const subject = subjects[i];
      const newSheet = templateSpreadsheet.insertSheet(subject);
      _setupOGSTemplate(newSheet, schoolYear, gradeLevel, section, subject, teacher, subjectWeights[subject], students, userEmail);
      createdSheets.push(subject);
    }
    
    // Check if MAPEH sheet should be created (all four subjects must be present)
    // Normalize subjects for comparison (trim whitespace and convert to lowercase)
    const normalizedSubjects = subjects.map(s => s.trim().toLowerCase());
    
    // Check for each required subject (case-insensitive, trimmed)
    const hasMusic = normalizedSubjects.includes('music');
    const hasArts = normalizedSubjects.some(s => s === 'art' || s === 'arts');
    const hasPE = normalizedSubjects.some(s => s === 'pe' || s === 'physical education');
    const hasHealth = normalizedSubjects.includes('health');
    
    // Create MAPEH sheet only if all four subjects are present
    if (hasMusic && hasArts && hasPE && hasHealth) {
      const mapehWeights = {
        writtenWork: 25,
        performanceTask: 25,
        assessment: 50
      };
      
      // Determine the Health sheet position so MAPEH can be inserted right after it
      const healthSubjectName = subjects.find(subject => subject.trim().toLowerCase() === 'health');
      const healthSheet = healthSubjectName ? templateSpreadsheet.getSheetByName(healthSubjectName) : null;
      const healthIndex = healthSheet ? healthSheet.getIndex() : templateSpreadsheet.getSheets().length;
      const insertIndex = Math.min(healthIndex + 1, templateSpreadsheet.getSheets().length + 1);
      
      const mapehSheet = templateSpreadsheet.insertSheet('MAPEH', insertIndex);
      _setupMAPEHSheet(mapehSheet, templateSpreadsheet, schoolYear, gradeLevel, section, teacher, students, userEmail);
      createdSheets.push('MAPEH');
    }
    
    // Check if teacher is advisor for this class - if yes, add Attendance and Character sheets
    const isAdvisor = _isTeacherAdvisor(teacher, gradeLevel, section);
    if (isAdvisor) {
      const attendanceSheet = templateSpreadsheet.insertSheet('Attendance');
      _setupAttendanceSheet(attendanceSheet, schoolYear, gradeLevel, section, teacher, students, masterSpreadsheet.getId());
      // Add color to Attendance sheet tab to distinguish from subject sheets
      attendanceSheet.setTabColor(CONFIG.COLORS.BLUE);
      
      const charactersSheet = templateSpreadsheet.insertSheet('Character');
      _setupCharactersSheet(charactersSheet, schoolYear, gradeLevel, section, teacher, students);
      // Add color to Character sheet tab to distinguish from subject sheets
      charactersSheet.setTabColor(CONFIG.COLORS.BLUE);
      
      // QR sheet - commented out for now
      // const qrSheet = templateSpreadsheet.insertSheet('QR');
      // _setupQRSheet(qrSheet, schoolYear, gradeLevel, section, teacher, students, templateSpreadsheet);
    }
    
    // Get the template file URL
    const templateUrl = templateSpreadsheet.getUrl();
    
    // Save one row to MASTER_DATA (one row per template file, not per subject)
    _saveToMasterData(schoolYear, gradeLevel, section, teacher, templateUrl, userEmail, templateFileName);
    
    const subjectsList = subjects.join(', ');
    const studentCountMsg = students.length > 0 ? ` (${students.length} students)` : '';
    const advisorSheetsMsg = isAdvisor ? ' (Advisor sheets included)' : '';
    const message = `Template generated: ${templateFileName}${studentCountMsg}${advisorSheetsMsg}`;
    
    return { 
      success: true, 
      message: message,
      templateUrl: templateUrl,
      subjects: subjects,
      folderName: folderName,
      studentCount: students.length
    };
    
  } catch (error) {
    console.error('Error generating OGS template:', error);
    return { 
      success: false, 
      message: _formatMessage(CONFIG.MESSAGES.ERROR.TEMPLATE_GENERATION, {
        error: error.toString()
      })
    };
  }
}

/**
 * Internal function to add an assignment
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @param {string} subject - The subject name
 * @param {string} userEmail - The email of the user creating the assignment (passed from client)
 * @return {Object} Result object with success status
 */
function _addAssignment(gradeLevel, section, teacher, subject, strand, category, semester, userEmail) {
  try {
    // Normalize grade level for storage (sheet stores just numbers)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    // Set defaults if not provided
    const actualStrand = strand || CONFIG.SHS_DEFAULTS.STRAND;
    const actualCategory = category || CONFIG.SHS_DEFAULTS.CATEGORY;
    const actualSemester = semester || CONFIG.SHS_DEFAULTS.SEMESTER;
    
    let sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      const spreadsheet = getSpreadsheet();
      sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES.SUBJECTS);
      
      // Set up headers (no parent header row) - Updated with new columns
      sheet.getRange(1, 1).setValue('Grade Level');
      sheet.getRange(1, 2).setValue('Section');
      sheet.getRange(1, 3).setValue('Teacher');
      sheet.getRange(1, 4).setValue('Subject');
      sheet.getRange(1, 5).setValue('Strand');
      sheet.getRange(1, 6).setValue('Category');
      sheet.getRange(1, 7).setValue('Semester');
      sheet.getRange(1, 8).setValue('Status');
      sheet.getRange(1, 9).setValue('Created');
      sheet.getRange(1, 10).setValue('Modified');
      sheet.getRange(1, 11).setValue('Created By');
      sheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground(CONFIG.COLORS.DARK_GRAY);
    }
    
    const timestamp = new Date();
    // Use passed userEmail, or fallback to Session.getActiveUser() if not provided (for backward compatibility)
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    
    // Check if assignment already exists (skip header row 1)
    const data = sheet.getDataRange().getValues();
    
    // First, check if exact match exists (same teacher, grade, section, subject, strand, category, semester)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.SUBJECTS_COLUMNS.GRADE_LEVEL] || '').trim());
      const rowStrand = String(row[CONFIG.SUBJECTS_COLUMNS.STRAND] || '').trim() || CONFIG.SHS_DEFAULTS.STRAND;
      const rowCategory = String(row[CONFIG.SUBJECTS_COLUMNS.CATEGORY] || '').trim() || CONFIG.SHS_DEFAULTS.CATEGORY;
      const rowSemester = String(row[CONFIG.SUBJECTS_COLUMNS.SEMESTER] || '').trim() || CONFIG.SHS_DEFAULTS.SEMESTER;
      
      if (rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.SUBJECTS_COLUMNS.SECTION] === section &&
          row[CONFIG.SUBJECTS_COLUMNS.TEACHER] === teacher &&
          row[CONFIG.SUBJECTS_COLUMNS.SUBJECT] === subject &&
          rowStrand === actualStrand &&
          rowCategory === actualCategory &&
          rowSemester === actualSemester) {
        // Update existing assignment to active and update modified date
        sheet.getRange(i + 1, CONFIG.SUBJECTS_COLUMNS.STATUS + 1).setValue('Active');
        sheet.getRange(i + 1, CONFIG.SUBJECTS_COLUMNS.MODIFIED + 1).setValue(timestamp);
        // If Created By is empty, set it (for existing data that might not have it)
        const createdByCol = CONFIG.SUBJECTS_COLUMNS.CREATED_BY + 1; // Column K
        const existingCreatedBy = sheet.getRange(i + 1, createdByCol).getValue();
        if (!existingCreatedBy || existingCreatedBy.toString().trim() === '') {
          sheet.getRange(i + 1, createdByCol).setValue(actualUserEmail);
        }
        return { success: true, message: CONFIG.MESSAGES.SUCCESS.ASSIGNMENT_UPDATED };
      }
    }
    
    // VALIDATION: Prevent same grade level + section + subject + strand + category + semester from being assigned to different teachers
    // Check if this subject already exists for this grade/section/strand/category/semester with a different teacher (and is Active)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.SUBJECTS_COLUMNS.GRADE_LEVEL] || '').trim());
      const rowStrand = String(row[CONFIG.SUBJECTS_COLUMNS.STRAND] || '').trim() || CONFIG.SHS_DEFAULTS.STRAND;
      const rowCategory = String(row[CONFIG.SUBJECTS_COLUMNS.CATEGORY] || '').trim() || CONFIG.SHS_DEFAULTS.CATEGORY;
      const rowSemester = String(row[CONFIG.SUBJECTS_COLUMNS.SEMESTER] || '').trim() || CONFIG.SHS_DEFAULTS.SEMESTER;
      
      if (rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.SUBJECTS_COLUMNS.SECTION] === section &&
          row[CONFIG.SUBJECTS_COLUMNS.SUBJECT] === subject &&
          rowStrand === actualStrand &&
          rowCategory === actualCategory &&
          rowSemester === actualSemester &&
          row[CONFIG.SUBJECTS_COLUMNS.STATUS] === 'Active') {
        const existingTeacher = row[CONFIG.SUBJECTS_COLUMNS.TEACHER];
        if (existingTeacher !== teacher) {
          const formattedGradeLevel = _formatGradeLevel(gradeLevel);
          return { 
            success: false, 
            message: _formatMessage(CONFIG.MESSAGES.VALIDATION.SUBJECT_ALREADY_ASSIGNED, {
              gradeSection: `${formattedGradeLevel}${section}`,
              subject: subject,
              teacher: existingTeacher
            })
          };
        }
      }
    }
    
    // Add new assignment with audit trail (store normalized grade level)
    sheet.appendRow([normalizedGradeLevel, section, teacher, subject, actualStrand, actualCategory, actualSemester, 'Active', timestamp, timestamp, actualUserEmail]);
    
    return { success: true, message: CONFIG.MESSAGES.SUCCESS.ASSIGNMENT_ADDED };
  } catch (error) {
    console.error('Error adding assignment:', error);
    return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.ASSIGNMENT_ADD, {
      error: error.toString()
    }) };
  }
}

/**
 * Internal function to add multiple subjects in batch (OPTIMIZED for performance)
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @param {Array} subjects - Array of subject objects with {subject, strand, category, semester} or strings (for backward compatibility)
 * @param {string} userEmail - The email of the user creating the subjects (passed from client)
 * @return {Object} Result object with success status and counts
 */
function _addSubjectsBatch(gradeLevel, section, teacher, subjects, userEmail) {
  try {
    // Normalize grade level for storage (sheet stores just numbers)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    let sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      const spreadsheet = getSpreadsheet();
      sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES.SUBJECTS);
      
      // Set up headers (no parent header row) - Updated with new columns
      sheet.getRange(1, 1).setValue('Grade Level');
      sheet.getRange(1, 2).setValue('Section');
      sheet.getRange(1, 3).setValue('Teacher');
      sheet.getRange(1, 4).setValue('Subject');
      sheet.getRange(1, 5).setValue('Strand');
      sheet.getRange(1, 6).setValue('Category');
      sheet.getRange(1, 7).setValue('Semester');
      sheet.getRange(1, 8).setValue('Status');
      sheet.getRange(1, 9).setValue('Created');
      sheet.getRange(1, 10).setValue('Modified');
      sheet.getRange(1, 11).setValue('Created By');
      sheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground(CONFIG.COLORS.DARK_GRAY);
    }
    
    const timestamp = new Date();
    // Use passed userEmail, or fallback to Session.getActiveUser() if not provided (for backward compatibility)
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    
    // Normalize subjects array - handle both old format (strings) and new format (objects)
    const normalizedSubjects = subjects.map(subj => {
      if (typeof subj === 'string') {
        // Backward compatibility: old format (just subject name)
        return {
          subject: subj,
          strand: CONFIG.SHS_DEFAULTS.STRAND,
          category: CONFIG.SHS_DEFAULTS.CATEGORY,
          semester: CONFIG.SHS_DEFAULTS.SEMESTER
        };
      } else {
        // New format: object with subject, strand, category, semester
        return {
          subject: subj.subject || subj,
          strand: subj.strand || CONFIG.SHS_DEFAULTS.STRAND,
          category: subj.category || CONFIG.SHS_DEFAULTS.CATEGORY,
          semester: subj.semester || CONFIG.SHS_DEFAULTS.SEMESTER
        };
      }
    });
    
    // Get all existing data once (batch read)
    const data = sheet.getDataRange().getValues();
    const existingSubjects = new Set();
    
    // Build set of existing subjects for fast lookup (same teacher only)
    // Use composite key: subject|strand|category|semester
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.SUBJECTS_COLUMNS.GRADE_LEVEL] || '').trim());
      if (rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.SUBJECTS_COLUMNS.SECTION] === section &&
          row[CONFIG.SUBJECTS_COLUMNS.TEACHER] === teacher) {
        const subject = String(row[CONFIG.SUBJECTS_COLUMNS.SUBJECT] || '').trim();
        const strand = String(row[CONFIG.SUBJECTS_COLUMNS.STRAND] || '').trim() || CONFIG.SHS_DEFAULTS.STRAND;
        const category = String(row[CONFIG.SUBJECTS_COLUMNS.CATEGORY] || '').trim() || CONFIG.CATEGORIES.CORE;
        const semester = String(row[CONFIG.SUBJECTS_COLUMNS.SEMESTER] || '').trim() || CONFIG.SEMESTERS.FIRST;
        const key = `${subject}|${strand}|${category}|${semester}`;
        existingSubjects.add(key);
      }
    }
    
    // VALIDATION: Check for conflicts - same grade/section/subject/strand/category/semester with different teacher
    const conflictErrors = [];
    const formattedGradeLevel = _formatGradeLevel(gradeLevel);
    normalizedSubjects.forEach(subj => {
      const key = `${subj.subject}|${subj.strand}|${subj.category}|${subj.semester}`;
      // Only check if this is a new subject (not already assigned to this teacher)
      if (!existingSubjects.has(key)) {
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.SUBJECTS_COLUMNS.GRADE_LEVEL] || '').trim());
          const rowStrand = String(row[CONFIG.SUBJECTS_COLUMNS.STRAND] || '').trim() || CONFIG.SHS_DEFAULTS.STRAND;
          const rowCategory = String(row[CONFIG.SUBJECTS_COLUMNS.CATEGORY] || '').trim() || CONFIG.SHS_DEFAULTS.CATEGORY;
          const rowSemester = String(row[CONFIG.SUBJECTS_COLUMNS.SEMESTER] || '').trim() || CONFIG.SHS_DEFAULTS.SEMESTER;
          
          if (rowGradeLevel === normalizedGradeLevel &&
              row[CONFIG.SUBJECTS_COLUMNS.SECTION] === section &&
              row[CONFIG.SUBJECTS_COLUMNS.SUBJECT] === subj.subject &&
              rowStrand === subj.strand &&
              rowCategory === subj.category &&
              rowSemester === subj.semester &&
              row[CONFIG.SUBJECTS_COLUMNS.STATUS] === 'Active') {
            const existingTeacher = row[CONFIG.SUBJECTS_COLUMNS.TEACHER];
            if (existingTeacher !== teacher) {
              conflictErrors.push(`${formattedGradeLevel}${section} - ${subj.subject} (${subj.strand}, ${subj.category}, ${subj.semester}) is already assigned to ${existingTeacher}`);
              break;
            }
          }
        }
      }
    });
    
    // If there are conflicts, return error
    if (conflictErrors.length > 0) {
      return {
        success: false,
        message: _formatMessage(CONFIG.MESSAGES.VALIDATION.SUBJECTS_CONFLICT, {
          conflicts: conflictErrors.join('\n')
        })
      };
    }
    
    // Separate new subjects from updates
    const newRows = [];
    const updateRows = [];
    
    normalizedSubjects.forEach(subj => {
      const key = `${subj.subject}|${subj.strand}|${subj.category}|${subj.semester}`;
      if (existingSubjects.has(key)) {
        // Find row index for update
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.SUBJECTS_COLUMNS.GRADE_LEVEL] || '').trim());
          const rowStrand = String(row[CONFIG.SUBJECTS_COLUMNS.STRAND] || '').trim() || CONFIG.SHS_DEFAULTS.STRAND;
          const rowCategory = String(row[CONFIG.SUBJECTS_COLUMNS.CATEGORY] || '').trim() || CONFIG.SHS_DEFAULTS.CATEGORY;
          const rowSemester = String(row[CONFIG.SUBJECTS_COLUMNS.SEMESTER] || '').trim() || CONFIG.SHS_DEFAULTS.SEMESTER;
          
          if (rowGradeLevel === normalizedGradeLevel &&
              row[CONFIG.SUBJECTS_COLUMNS.SECTION] === section &&
              row[CONFIG.SUBJECTS_COLUMNS.TEACHER] === teacher &&
              row[CONFIG.SUBJECTS_COLUMNS.SUBJECT] === subj.subject &&
              rowStrand === subj.strand &&
              rowCategory === subj.category &&
              rowSemester === subj.semester) {
            updateRows.push({ rowIndex: i + 1, subject: subj.subject });
            break;
          }
        }
      } else {
        // New assignment (store normalized grade level)
        newRows.push([normalizedGradeLevel, section, teacher, subj.subject, subj.strand, subj.category, subj.semester, 'Active', timestamp, timestamp, actualUserEmail]);
      }
    });
    
    // Batch update existing subjects (optimized - batch operations)
    if (updateRows.length > 0) {
      // Sort by row index to group contiguous rows for batch operations
      updateRows.sort((a, b) => a.rowIndex - b.rowIndex);
      
      // Update Created By for existing subjects if empty
      const createdByCol = CONFIG.SUBJECTS_COLUMNS.CREATED_BY + 1; // Column K
      updateRows.forEach(({ rowIndex }) => {
        const existingCreatedBy = sheet.getRange(rowIndex, createdByCol).getValue();
        if (!existingCreatedBy || existingCreatedBy.toString().trim() === '') {
          sheet.getRange(rowIndex, createdByCol).setValue(actualUserEmail);
        }
      });
      
      // Group contiguous rows for batch updates
      let currentGroup = [updateRows[0]];
      const groups = [];
      
      for (let i = 1; i < updateRows.length; i++) {
        if (updateRows[i].rowIndex === currentGroup[currentGroup.length - 1].rowIndex + 1) {
          // Contiguous row - add to current group
          currentGroup.push(updateRows[i]);
        } else {
          // Non-contiguous - save current group and start new one
          groups.push(currentGroup);
          currentGroup = [updateRows[i]];
        }
      }
      groups.push(currentGroup);
      
      // Batch update each contiguous group
      groups.forEach(group => {
        const startRow = group[0].rowIndex;
        const numRows = group.length;
        const statusValues = Array(numRows).fill(['Active']);
        const modifiedValues = Array(numRows).fill([timestamp]);
        
        // Batch update status column
        sheet.getRange(startRow, CONFIG.SUBJECTS_COLUMNS.STATUS + 1, numRows, 1).setValues(statusValues);
        // Batch update modified column
        sheet.getRange(startRow, CONFIG.SUBJECTS_COLUMNS.MODIFIED + 1, numRows, 1).setValues(modifiedValues);
      });
    }
    
    // Batch insert new subjects (single API call instead of multiple appendRow calls)
    if (newRows.length > 0) {
      const lastRow = sheet.getLastRow();
      const targetRange = sheet.getRange(lastRow + 1, 1, newRows.length, 11);
      targetRange.setValues(newRows);
    }
    
    const totalProcessed = newRows.length + updateRows.length;
    const added = newRows.length;
    const updated = updateRows.length;
    
    return { 
      success: true, 
      message: _formatMessage(CONFIG.MESSAGES.SUCCESS.SUBJECTS_BATCH_ADDED, {
        total: totalProcessed,
        added: added,
        updated: updated
      }),
      added: added,
      updated: updated,
      total: totalProcessed
    };
  } catch (error) {
    console.error('Error adding subjects batch:', error);
    return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.SUBJECTS_BATCH_ADD, {
      error: error.toString()
    }) };
  }
}

/**
 * Internal function to get subjects for a grade level and section
 * OPTIMIZED for performance with early returns and minimal data retrieval
 * @param {string} gradeLevel - The grade level (optional)
 * @param {string} section - The section (optional)
 * @return {Array} Array of assignment objects
 */
function _getSubjects(gradeLevel, section) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS);
    if (!sheet) {
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    
    // Early return if sheet only has headers (no data)
    if (lastRow <= 1) {
      return [];
    }
    
    // OPTIMIZATION 1: Read all columns needed (A-H) - Updated to include new columns
    // Columns: Grade Level (A), Section (B), Teacher (C), Subject (D), Strand (E), Category (F), Semester (G), Status (H)
    const numCols = 8; // Read first 8 columns (we need these for display)
    const dataRange = sheet.getRange(2, 1, lastRow - 1, numCols); // Start from row 2 (skip header)
    const data = dataRange.getValues();
    
    // Pre-allocate array size for better performance (estimate)
    const subjects = [];
    
    // OPTIMIZATION 2: Use column indices directly (no CONFIG lookup in loop)
    const COL_GRADE = 0;
    const COL_SECTION = 1;
    const COL_TEACHER = 2;
    const COL_SUBJECT = 3;
    const COL_STRAND = 4;
    const COL_CATEGORY = 5;
    const COL_SEMESTER = 6;
    const COL_STATUS = 7;
    
    // OPTIMIZATION 3: Convert filters to boolean flags for faster checks
    const hasGradeFilter = Boolean(gradeLevel);
    const hasSectionFilter = Boolean(section);
    
    // Normalize grade level filter for comparison (sheet stores just numbers)
    const normalizedGradeLevel = hasGradeFilter ? _normalizeGradeLevel(gradeLevel) : null;
    
    // OPTIMIZATION 4: Loop through data once with optimized filtering
    const dataLength = data.length;
    for (let i = 0; i < dataLength; i++) {
      const row = data[i];
      
      // OPTIMIZATION 5: Check status first (most likely to eliminate rows)
      if (row[COL_STATUS] !== 'Active') continue;
      
      // OPTIMIZATION 6: Early continue on filter mismatch (short-circuit evaluation)
      // Normalize row grade level for comparison
      if (hasGradeFilter) {
        const rowGradeLevel = _normalizeGradeLevel(String(row[COL_GRADE] || '').trim());
        if (rowGradeLevel !== normalizedGradeLevel) continue;
      }
      if (hasSectionFilter && row[COL_SECTION] !== section) continue;
      
      // OPTIMIZATION 7: Direct object creation without intermediate variables
      // Format grade level for display (add "Grade " prefix)
      // Extract values with defaults for backward compatibility
        const strand = String(row[COL_STRAND] || '').trim() || CONFIG.SHS_DEFAULTS.STRAND;
        const category = String(row[COL_CATEGORY] || '').trim() || CONFIG.SHS_DEFAULTS.CATEGORY;
        const semester = String(row[COL_SEMESTER] || '').trim() || CONFIG.SHS_DEFAULTS.SEMESTER;
      
      subjects.push({
        gradeLevel: _formatGradeLevel(row[COL_GRADE]), // Format for display
        section: row[COL_SECTION],
        teacher: row[COL_TEACHER],
        subject: row[COL_SUBJECT],
        strand: strand,
        category: category,
        semester: semester,
        status: row[COL_STATUS]
      });
    }
    
    return subjects;
  } catch (error) {
    console.error('Error getting subjects:', error);
    return [];
  }
}

/**
 * Internal function to delete an assignment (set to inactive)
 * OPTIMIZED for performance with minimal data retrieval and batch updates
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} teacher - The teacher name
 * @param {string} subject - The subject name
 * @return {Object} Result object with success status
 */
function _deleteAssignment(gradeLevel, section, teacher, subject) {
  try {
    // Normalize grade level for comparison (sheet stores just numbers)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    const sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS);
    if (!sheet) {
      return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.SHEET_NOT_FOUND, {
        sheetName: 'SUBJECTS'
      }) };
    }
    
    const lastRow = sheet.getLastRow();
    
    // Early return if sheet only has headers
    if (lastRow <= 1) {
      return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.NOT_FOUND, {
        item: 'Assignment'
      }) };
    }
    
    // OPTIMIZATION 1: Only read necessary columns (A-D) instead of all columns
    // We only need: Grade Level, Section, Teacher, Subject
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 4); // Start from row 2
    const data = dataRange.getValues();
    
    // OPTIMIZATION 2: Use column indices directly
    const COL_GRADE = 0;
    const COL_SECTION = 1;
    const COL_TEACHER = 2;
    const COL_SUBJECT = 3;
    
    const timestamp = new Date();
    
    // OPTIMIZATION 3: Loop with early exit
    const dataLength = data.length;
    for (let i = 0; i < dataLength; i++) {
      const row = data[i];
      
      // OPTIMIZATION 4: Check all conditions in order of likelihood to fail
      // (most specific first for faster rejection)
      // Normalize grade level for comparison
      const rowGradeLevel = _normalizeGradeLevel(String(row[COL_GRADE] || '').trim());
      if (row[COL_SUBJECT] === subject &&
          row[COL_TEACHER] === teacher &&
          row[COL_SECTION] === section &&
          rowGradeLevel === normalizedGradeLevel) {
        
        // OPTIMIZATION 5: Batch update both cells at once
        const actualRow = i + 2; // +2 because data starts at row 2 (row 1 is header)
        const statusCol = CONFIG.SUBJECTS_COLUMNS.STATUS + 1; // E column
        const modifiedCol = CONFIG.SUBJECTS_COLUMNS.MODIFIED + 1; // G column
        
        // Batch update using setValues for better performance
        sheet.getRange(actualRow, statusCol, 1, 1).setValue('Inactive');
        sheet.getRange(actualRow, modifiedCol, 1, 1).setValue(timestamp);
        
        return { success: true, message: CONFIG.MESSAGES.SUCCESS.ASSIGNMENT_DELETED };
      }
    }
    
    return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.NOT_FOUND, {
      item: 'Assignment'
    }) };
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.ASSIGNMENT_DELETE, {
      error: error.toString()
    }) };
  }
}

/**
 * Internal function to delete multiple subjects in batch (OPTIMIZED)
 * Much faster than calling _deleteAssignment multiple times
 * @param {Array} subjects - Array of assignment objects to delete
 * @return {Object} Result object with success status and counts
 */
function _deleteSubjectsBatch(subjects) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.SUBJECTS);
    if (!sheet) {
      return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.SHEET_NOT_FOUND, {
        sheetName: 'SUBJECTS'
      }), deleted: 0, failed: 0 };
    }
    
    const lastRow = sheet.getLastRow();
    
    // Early return if sheet only has headers
    if (lastRow <= 1 || !subjects || subjects.length === 0) {
      return { success: true, message: CONFIG.MESSAGES.SUCCESS.NO_SUBJECTS_TO_DELETE, deleted: 0, failed: 0 };
    }
    
    // OPTIMIZATION 1: Read all data once
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 4);
    const data = dataRange.getValues();
    
    // OPTIMIZATION 2: Create a lookup set for fast matching (normalize grade levels)
    const assignmentKeys = new Set();
    subjects.forEach(a => {
      const normalizedGrade = _normalizeGradeLevel(a.gradeLevel);
      const key = `${normalizedGrade}|${a.section}|${a.teacher}|${a.subject}`;
      assignmentKeys.add(key);
    });
    
    // OPTIMIZATION 3: Find all matching rows in one pass
    const rowsToUpdate = [];
    const timestamp = new Date();
    
    const COL_GRADE = 0;
    const COL_SECTION = 1;
    const COL_TEACHER = 2;
    const COL_SUBJECT = 3;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[COL_GRADE] || '').trim());
      const key = `${rowGradeLevel}|${row[COL_SECTION]}|${row[COL_TEACHER]}|${row[COL_SUBJECT]}`;
      
      if (assignmentKeys.has(key)) {
        rowsToUpdate.push(i + 2); // +2 because data starts at row 2
      }
    }
    
    // OPTIMIZATION 4: Batch update all rows at once
    if (rowsToUpdate.length > 0) {
      const statusCol = CONFIG.SUBJECTS_COLUMNS.STATUS + 1;
      const modifiedCol = CONFIG.SUBJECTS_COLUMNS.MODIFIED + 1;
      
      // Update each row (Google Apps Script doesn't support non-contiguous ranges efficiently)
      // But we still optimize by minimizing API calls
      rowsToUpdate.forEach(rowNum => {
        sheet.getRange(rowNum, statusCol).setValue('Inactive');
        sheet.getRange(rowNum, modifiedCol).setValue(timestamp);
      });
      
      return {
        success: true, 
        message: _formatMessage(CONFIG.MESSAGES.SUCCESS.SUBJECTS_BATCH_DELETED, {
          count: rowsToUpdate.length
        }),
        deleted: rowsToUpdate.length,
        failed: subjects.length - rowsToUpdate.length
      };
    }
    
    return { 
      success: false, 
      message: _formatMessage(CONFIG.MESSAGES.ERROR.NO_MATCHES, {
        items: 'subjects'
      }),
      deleted: 0,
      failed: subjects.length
    };
  } catch (error) {
    console.error('Error deleting subjects batch:', error);
    return { 
      success: false, 
      message: _formatMessage(CONFIG.MESSAGES.ERROR.SUBJECTS_BATCH_DELETE, {
        error: error.toString()
      }),
      deleted: 0,
      failed: subjects.length
    };
  }
}

/**
 * Internal function to add an advisory class
 * @param {string} teacher - The teacher name
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} userEmail - The email of the user creating the advisory (passed from client)
 * @return {Object} Result object with success status
 */
function _addAdvisory(teacher, gradeLevel, section, userEmail) {
  try {
    let sheet = getSheet(CONFIG.SHEET_NAMES.ADVISORY);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      const spreadsheet = getSpreadsheet();
      sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES.ADVISORY);
      
      // Set up headers (no parent header row)
      sheet.getRange(1, 1).setValue('Teacher');
      sheet.getRange(1, 2).setValue('Grade Level');
      sheet.getRange(1, 3).setValue('Section');
      sheet.getRange(1, 4).setValue('Status');
      sheet.getRange(1, 5).setValue('Created');
      sheet.getRange(1, 6).setValue('Modified');
      sheet.getRange(1, 7).setValue('Created By');
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground(CONFIG.COLORS.DARK_GRAY);
    }
    
    const timestamp = new Date();
    // Use passed userEmail, or fallback to Session.getActiveUser() if not provided (for backward compatibility)
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    
    // OPTIMIZATION: Read all data once
    const data = sheet.getDataRange().getValues();
    const statusCol = CONFIG.ADVISORY_COLUMNS.STATUS + 1;
    const modifiedCol = CONFIG.ADVISORY_COLUMNS.MODIFIED + 1;
    
    // Normalize grade level for storage (sheet stores just numbers)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    // Check if exact advisory already exists (same teacher, grade, section)
    let exactMatchRow = null;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.ADVISORY_COLUMNS.GRADE_LEVEL] || '').trim());
      if (row[CONFIG.ADVISORY_COLUMNS.TEACHER] === teacher &&
          rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.ADVISORY_COLUMNS.SECTION] === section) {
        exactMatchRow = i + 1; // Store 1-based row number
        break;
      }
    }
    
    // VALIDATION: Prevent another teacher from being assigned to a class that already has an active advisory
    // Check if this class (grade + section) already has an active advisory with a different teacher
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.ADVISORY_COLUMNS.GRADE_LEVEL] || '').trim());
      if (rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.ADVISORY_COLUMNS.SECTION] === section &&
          row[CONFIG.ADVISORY_COLUMNS.STATUS] === 'Active') {
        const existingTeacher = row[CONFIG.ADVISORY_COLUMNS.TEACHER];
        if (existingTeacher !== teacher) {
          const formattedGradeLevel = _formatGradeLevel(gradeLevel);
          return { 
            success: false, 
            message: _formatMessage(CONFIG.MESSAGES.VALIDATION.ADVISORY_ALREADY_ASSIGNED, {
              gradeSection: `${formattedGradeLevel}${section}`,
              teacher: existingTeacher
            }) 
          };
        }
      }
    }
    
    // ONE-TO-ONE RULE: Teacher can only have one active advisory
    // Set all other active advisories for this teacher to Inactive (including the exact match if it exists)
    const rowsToDeactivate = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[CONFIG.ADVISORY_COLUMNS.TEACHER] === teacher &&
          row[CONFIG.ADVISORY_COLUMNS.STATUS] === 'Active') {
        // Deactivate all active advisories for this teacher, even if it's the exact match
        rowsToDeactivate.push(i + 1); // Store 1-based row number
      }
    }
    
    // Batch deactivate previous advisories
    if (rowsToDeactivate.length > 0) {
      rowsToDeactivate.forEach(rowNum => {
        sheet.getRange(rowNum, statusCol).setValue('Inactive');
        sheet.getRange(rowNum, modifiedCol).setValue(timestamp);
      });
    }
    
    // If exact match exists, reactivate it; otherwise add new advisory
    if (exactMatchRow) {
      // Reactivate the exact match
      sheet.getRange(exactMatchRow, statusCol).setValue('Active');
      sheet.getRange(exactMatchRow, modifiedCol).setValue(timestamp);
      // If Created By is empty, set it (for existing data that might not have it)
      const createdByCol = CONFIG.ADVISORY_COLUMNS.CREATED_BY + 1; // Column G
      const existingCreatedBy = sheet.getRange(exactMatchRow, createdByCol).getValue();
      if (!existingCreatedBy || existingCreatedBy.toString().trim() === '') {
        sheet.getRange(exactMatchRow, createdByCol).setValue(actualUserEmail);
      }
    } else {
      // Add new advisory with audit trail (store normalized grade level)
      sheet.appendRow([teacher, normalizedGradeLevel, section, 'Active', timestamp, timestamp, actualUserEmail]);
    }
    
    const deactivateMsg = rowsToDeactivate.length > 0 
      ? ` (Previous advisory set to Inactive)` 
      : '';
    
    return { 
      success: true, 
      message: _formatMessage(CONFIG.MESSAGES.SUCCESS.ADVISORY_ADDED, {
        deactivateMsg: deactivateMsg
      })
    };
  } catch (error) {
    console.error('Error adding advisory:', error);
    return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.ADVISORY_ADD, {
      error: error.toString()
    }) };
  }
}

/**
 * Internal function to get advisories (OPTIMIZED)
 * @param {string} teacher - The teacher name (optional filter)
 * @return {Array} Array of advisory objects
 */
function _getAdvisories(teacher = null) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.ADVISORY);
    
    if (!sheet) {
      return [];
    }
    
    // OPTIMIZATION: Read only necessary columns (A-G)
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return []; // Only header row or empty
    }
    
    const advisories = [];
    const hasTeacherFilter = teacher !== null && teacher !== '';
    
    // OPTIMIZATION: Single pass filtering
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowTeacher = row[CONFIG.ADVISORY_COLUMNS.TEACHER];
      
      // Apply filter
      if (hasTeacherFilter && rowTeacher !== teacher) continue;
      
      // Format grade level for display (add "Grade " prefix)
      const rawGradeLevel = row[CONFIG.ADVISORY_COLUMNS.GRADE_LEVEL] || '';
      advisories.push({
        teacher: rowTeacher || '',
        gradeLevel: _formatGradeLevel(rawGradeLevel), // Format for display
        section: row[CONFIG.ADVISORY_COLUMNS.SECTION] || '',
        status: row[CONFIG.ADVISORY_COLUMNS.STATUS] || '',
        created: row[CONFIG.ADVISORY_COLUMNS.CREATED] || '',
        modified: row[CONFIG.ADVISORY_COLUMNS.MODIFIED] || '',
        createdBy: row[CONFIG.ADVISORY_COLUMNS.CREATED_BY] || ''
      });
    }
    
    return advisories;
  } catch (error) {
    console.error('Error getting advisories:', error);
    return [];
  }
}

/**
 * Internal function to delete an advisory
 * @param {string} teacher - The teacher name
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Object} Result object with success status
 */
function _deleteAdvisory(teacher, gradeLevel, section) {
  try {
    // Normalize grade level for comparison (sheet stores just numbers)
    const normalizedGradeLevel = _normalizeGradeLevel(gradeLevel);
    
    const sheet = getSheet(CONFIG.SHEET_NAMES.ADVISORY);
    
    if (!sheet) {
      return { success: false, message: 'ADVISORY sheet not found' };
    }
    
    // OPTIMIZATION: Read only necessary columns (A-C for matching, D for status)
    const data = sheet.getDataRange().getValues();
    const timestamp = new Date();
    
    // OPTIMIZATION: Single pass search and update
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.ADVISORY_COLUMNS.GRADE_LEVEL] || '').trim());
      if (row[CONFIG.ADVISORY_COLUMNS.TEACHER] === teacher &&
          rowGradeLevel === normalizedGradeLevel &&
          row[CONFIG.ADVISORY_COLUMNS.SECTION] === section) {
        // Update status to Inactive and modified date
        const statusCol = CONFIG.ADVISORY_COLUMNS.STATUS + 1; // D column
        const modifiedCol = CONFIG.ADVISORY_COLUMNS.MODIFIED + 1; // F column
        sheet.getRange(i + 1, statusCol).setValue('Inactive');
        sheet.getRange(i + 1, modifiedCol).setValue(timestamp);
        return { success: true, message: CONFIG.MESSAGES.SUCCESS.ADVISORY_DELETED };
      }
    }
    
    return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.NOT_FOUND, {
      item: 'Advisory'
    }) };
  } catch (error) {
    console.error('Error deleting advisory:', error);
    return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.ADVISORY_DELETE, {
      error: error.toString()
    }) };
  }
}

/**
 * Internal function to delete multiple advisories in batch (OPTIMIZED)
 * @param {Array} advisories - Array of advisory objects to delete
 * @return {Object} Result object with success status and counts
 */
function _deleteAdvisoriesBatch(advisories) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.ADVISORY);
    
    if (!sheet) {
      return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.SHEET_NOT_FOUND, {
        sheetName: 'ADVISORY'
      }), deleted: 0, failed: 0 };
    }
    
    if (!advisories || advisories.length === 0) {
      return { success: false, message: _formatMessage(CONFIG.MESSAGES.ERROR.NO_ITEMS, {
        items: 'advisories'
      }), deleted: 0, failed: 0 };
    }
    
    // OPTIMIZATION: Read all data once
    const data = sheet.getDataRange().getValues();
    const timestamp = new Date();
    
    // OPTIMIZATION: Build Set for fast lookup (normalize grade levels)
    const advisoryKeys = new Set();
    advisories.forEach(adv => {
      const normalizedGrade = _normalizeGradeLevel(adv.gradeLevel);
      const key = `${adv.teacher}|||${normalizedGrade}|||${adv.section}`;
      advisoryKeys.add(key);
    });
    
    // OPTIMIZATION: Single pass - collect rows to update
    const rowsToUpdate = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGradeLevel = _normalizeGradeLevel(String(row[CONFIG.ADVISORY_COLUMNS.GRADE_LEVEL] || '').trim());
      const key = `${row[CONFIG.ADVISORY_COLUMNS.TEACHER]}|||${rowGradeLevel}|||${row[CONFIG.ADVISORY_COLUMNS.SECTION]}`;
      
      if (advisoryKeys.has(key) && row[CONFIG.ADVISORY_COLUMNS.STATUS] === 'Active') {
        rowsToUpdate.push(i + 1); // Store 1-based row number
      }
    }
    
    // OPTIMIZATION: Batch update status and modified date
    if (rowsToUpdate.length > 0) {
      const statusValues = rowsToUpdate.map(() => ['Inactive']);
      const modifiedValues = rowsToUpdate.map(() => [timestamp]);
      
      const statusCol = CONFIG.ADVISORY_COLUMNS.STATUS + 1;
      const modifiedCol = CONFIG.ADVISORY_COLUMNS.MODIFIED + 1;
      
      // Batch update each column
      rowsToUpdate.forEach((rowNum, index) => {
        sheet.getRange(rowNum, statusCol).setValue('Inactive');
        sheet.getRange(rowNum, modifiedCol).setValue(timestamp);
      });
      
      return {
        success: true, 
        message: _formatMessage(CONFIG.MESSAGES.SUCCESS.ADVISORIES_BATCH_DELETED, {
          count: rowsToUpdate.length
        }),
        deleted: rowsToUpdate.length,
        failed: advisories.length - rowsToUpdate.length
      };
    }
    
    return { 
      success: false, 
      message: _formatMessage(CONFIG.MESSAGES.ERROR.NO_MATCHES, {
        items: 'advisories'
      }),
      deleted: 0,
      failed: advisories.length
    };
  } catch (error) {
    console.error('Error deleting advisories batch:', error);
    return { 
      success: false, 
      message: _formatMessage(CONFIG.MESSAGES.ERROR.ADVISORIES_BATCH_DELETE, {
        error: error.toString()
      }),
      deleted: 0,
      failed: advisories.length
    };
  }
}

