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

  // Manage submenu
  ui.createMenu("Manage")
    .addItem("Manage Subjects", "showAssignmentDialog")
    .addItem("Manage Advisory Classes", "showAdvisoryDialog")
    .addToUi();

  ui.createMenu("Manual")
    .addItem("Open Working Instruction", "showWorkingInstructions")
    .addToUi();
}

/**
 * Shows the OGS template generation dialog with HTML interface
 */
function showOGSTemplateDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("OGSTemplateDialog")
    .setWidth(1200)
    .setHeight(700)
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
    return callApi("getAssignedTeachers", {
      gradeLevel: gradeLevel,
      section: section
    });
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
    return callApi("getAssignedSubjects", {
      gradeLevel: gradeLevel,
      section: section,
      teacher: teacher
    });
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
 * @return {Array} Array of unique grade levels formatted as "Grade 1", "Grade 2", etc.
 */
function getGradeLevels() {
  try {
    return callApi("getGradeLevels", {});
  } catch (error) {
    console.error('Error in getGradeLevels:', error);
    return [];
  }
}

/**
 * Gets sections for a specific grade level
 * @param {string} gradeLevel - The grade level to filter by
 * @return {Array} Array of section names for the specified grade level
 */
function getSectionsForGrade(gradeLevel) {
  try {
    return callApi("getSectionsForGrade", {
      gradeLevel: gradeLevel
    });
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
  try {
    // Note: This function is not currently exposed via API, but it's only used server-side
    // If needed, we can add an API endpoint for it
    // For now, we'll use a try-catch to handle the case where it's called from web app context
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
  } catch (error) {
    console.error('Error in getLevelForGrade:', error);
    return '';
  }
}

/**
 * Gets active items from any reference sheet
 * @param {string} sheetName - Name of the reference sheet
 * @param {number} columnIndex - Index of the column to retrieve (0-based)
 * @return {Array} Array of active items
 */
function getActiveItems(sheetName, columnIndex = 0) {
  try {
    return callApi("getActiveItems", {
      sheetName: sheetName,
      columnIndex: columnIndex
    });
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
  const userEmail = _getRunningUserEmail();
  console.log(
    "Function generateOGSTemplate executed by: " + (userEmail || '(unknown)')
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

function _getRunningUserEmail() {
  let email = '';
  try { email = (Session.getActiveUser().getEmail() || '').trim(); } catch (e) {}
  if (!email) {
    try { email = (Session.getEffectiveUser().getEmail() || '').trim(); } catch (e) {}
  }
  return email;
}

/**
 * Client-callable function to generate multiple OGS templates in batch.
 * Generates templates sequentially to ensure MASTER_DATA rows are added chronologically.
 * @param {string} schoolYear - The school year (e.g., "2024-2025")
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {Array} teachersWithSubjects - Array of objects with {teacher: string, subjects: Array}
 * @return {Object} Result object with success status and message
 */
function generateOGSTemplatesBatch(schoolYear, gradeLevel, section, teachersWithSubjects) {
  const userEmail = _getRunningUserEmail();
  console.log("Function generateOGSTemplatesBatch executed by: " + (userEmail || '(unknown)'));
  
  if (!teachersWithSubjects || teachersWithSubjects.length === 0) {
    return {
      success: false,
      message: "No teachers selected"
    };
  }
  
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (let i = 0; i < teachersWithSubjects.length; i++) {
    const item = teachersWithSubjects[i];
    const result = generateOGSTemplate(
      schoolYear,
      gradeLevel,
      section,
      item.teacher,
      item.subjects
    );
    
    results.push({
      teacher: item.teacher,
      result: result
    });
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
  }
  
  // Build one line per failed teacher with their actual reason (e.g. "template
  // already exists", "not an active teacher", "no ATTENDANCE_REF data") instead
  // of just naming who failed - the per-teacher result.message from
  // generateOGSTemplate already has this detail, it was previously discarded here.
  const failureLines = results
    .filter(r => !r.result.success)
    .map(r => `- ${r.teacher}: ${r.result.message}`);

  let message = '';
  if (successCount > 0 && failureCount === 0) {
    message = `Successfully generated ${successCount} template(s)`;
  } else if (successCount > 0 && failureCount > 0) {
    message = `Generated ${successCount} template(s), ${failureCount} failed:\n${failureLines.join('\n')}`;
  } else {
    message = `Failed to generate templates:\n${failureLines.join('\n')}`;
  }

  return {
    success: failureCount === 0,
    message: message,
    results: results
  };
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

/**
 * Client-callable function to get school years from STUDENTS DB via API
 * @return {Array} Array of school year sheet names (e.g., ["2024-2025", "2023-2024"])
 */
function getSchoolYears() {
  //EBA changed calling var
  //return callApi("getSchoolYears", {});

  return _getSchoolYears();

}

function showWorkingInstructions() {
  const url = CONFIG.WORKING_INSTRUCTIONS_URL;
  
  if (!url) {
    SpreadsheetApp.getUi().alert(
      'Configuration Error',
      'Working Instructions URL is not configured in Config.js',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            text-align: center;
          }
          .message {
            margin-bottom: 30px;
            color: #333;
            font-size: 16px;
          }
          button {
            background-color: #4285f4;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            border-radius: 4px;
            font-weight: bold;
          }
          button:hover {
            background-color: #357ae8;
          }
          button:active {
            background-color: #2a5fcf;
          }
        </style>
      </head>
      <body>
        <div class="message">
          <p>Click the button below to open the Working Instructions in a new tab.</p>
        </div>
        <button onclick="openInstructions()">Open Working Instructions</button>
        <script>
          function openInstructions() {
            window.open('${url}', '_blank');
            google.script.host.close();
          }
        </script>
      </body>
    </html>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(400)
    .setHeight(200)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Working Instructions");
}
