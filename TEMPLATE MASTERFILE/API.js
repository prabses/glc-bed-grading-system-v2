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
          payload.instructor,
          payload.subjects || []
        ));
      case "addAssignment":
        return response(200, _addAssignment(
          payload.gradeLevel,
          payload.section,
          payload.instructor,
          payload.subject
        ));
      case "addAssignmentsBatch":
        return response(200, _addAssignmentsBatch(
          payload.gradeLevel,
          payload.section,
          payload.instructor,
          typeof payload.subjects === 'string' ? JSON.parse(payload.subjects) : payload.subjects
        ));
      case "getAssignments":
        return response(200, _getAssignments(
          payload.gradeLevel,
          payload.section
        ));
      case "deleteAssignment":
        return response(200, _deleteAssignment(
          payload.gradeLevel,
          payload.section,
          payload.instructor,
          payload.subject
        ));
      case "deleteAssignmentsBatch":
        return response(200, _deleteAssignmentsBatch(
          typeof payload.assignments === 'string' ? JSON.parse(payload.assignments) : payload.assignments
        ));
      case "addAdvisory":
        return response(200, _addAdvisory(
          payload.instructor,
          payload.gradeLevel,
          payload.section,
          payload.schoolYear
        ));
      case "getAdvisories":
        return response(200, _getAdvisories(
          payload.instructor,
          payload.schoolYear
        ));
      case "deleteAdvisory":
        return response(200, _deleteAdvisory(
          payload.instructor,
          payload.gradeLevel,
          payload.section,
          payload.schoolYear
        ));
      case "deleteAdvisoriesBatch":
        return response(200, _deleteAdvisoriesBatch(
          typeof payload.advisories === 'string' ? JSON.parse(payload.advisories) : payload.advisories
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
  const sheet = getSheet(sheetName);
  if (!sheet) {
    throw new Error(`${sheetName} sheet not found`);
  }
  
  const data = sheet.getDataRange().getValues();
  const items = [];
  
  // Skip 2 header rows (parent header + column headers)
  for (let i = CONFIG.HEADER_ROWS; i < data.length; i++) {
    const row = data[i];
    const activeValue = row[row.length - 1]; // Last column is Active
    // Handle both checkboxes (TRUE/FALSE) and checkmarks (✓)
    const isActive = activeValue === true || activeValue === '✓' || activeValue === 'TRUE';
    if (isActive && row[columnIndex]) {
      items.push(row[columnIndex]);
    }
  }
  
  return items;
}

/**
 * Internal function to get the level (Elementary/JHS/SHS) for a specific grade level
 * @param {string} gradeLevel - The grade level to look up
 * @return {string} The level (Elementary, JHS, or SHS)
 */
function _getLevelForGrade(gradeLevel) {
  const sheet = getSheet(CONFIG.SHEET_NAMES.SECTIONS_REFERENCE);
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
 * Internal function to get grading weights for a subject
 * @param {string} subjectName - The subject name
 * @return {Object} Object with writtenWork, performanceTask, and assessment weights
 */
function _getGradingWeights(subjectName) {
  const sheet = getSheet(CONFIG.SHEET_NAMES.GRADING_REFERENCE);
  if (!sheet) {
    throw new Error('GRADING_REFERENCE sheet not found');
  }
  
  const data = sheet.getDataRange().getValues();
  
  // Skip 2 header rows (parent header + column headers)
  const dataRows = data.slice(CONFIG.HEADER_ROWS);
  
  // Helper function to check if active (handles both checkboxes and checkmarks)
  const isActive = (value) => value === true || value === '✓' || value === 'TRUE';
  
  // Priority 1: Exact subject match
  let match = dataRows.find(row => 
    row[CONFIG.GRADING_COLUMNS.SUBJECT_NAME] === subjectName && 
    isActive(row[CONFIG.GRADING_COLUMNS.ACTIVE])
  );
  
  // Priority 2: DEFAULT (fallback)
  if (!match) {
    match = dataRows.find(row => 
      row[CONFIG.GRADING_COLUMNS.SUBJECT_NAME] === 'DEFAULT' && 
      isActive(row[CONFIG.GRADING_COLUMNS.ACTIVE])
    );
  }
  
  if (!match) {
    throw new Error('No grading weights found. Please ensure GRADING_REFERENCE has a DEFAULT row.');
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
 * @param {string} instructor - The instructor name
 * @param {string} templateUrl - The URL of the generated template
 */
function _saveToMasterData(schoolYear, gradeLevel, section, instructor, templateUrl) {
  let sheet = getSheet(CONFIG.SHEET_NAMES.MASTER_DATA);
  if (!sheet) {
    // Create MASTER_DATA sheet if it doesn't exist
    const spreadsheet = getSpreadsheet();
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES.MASTER_DATA);
    
    // Set up headers (no parent header row)
    sheet.getRange(1, 1).setValue('School Year');
    sheet.getRange(1, 2).setValue('Grade Level');
    sheet.getRange(1, 3).setValue('Section');
    sheet.getRange(1, 4).setValue('Instructor');
    sheet.getRange(1, 5).setValue('Template Link');
    sheet.getRange(1, 6).setValue('Created');
    sheet.getRange(1, 7).setValue('Modified');
    sheet.getRange(1, 8).setValue('Created By');
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#d9d9d9');
  }
  
  const timestamp = new Date();
  const templateLink = `=HYPERLINK("${templateUrl}","Open Template")`;
  const userEmail = Session.getActiveUser().getEmail();
  
  // Append new row with all data (one row per template file)
  sheet.appendRow([
    schoolYear,                  // Column A: School_Year
    gradeLevel,                  // Column B: Grade_Level
    section,                     // Column C: Section
    instructor,                  // Column D: Instructor
    templateLink,                // Column E: Template_Link
    timestamp,                   // Column F: Created
    timestamp,                   // Column G: Modified
    userEmail                    // Column H: Created_By
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
 * @param {string} instructor - The instructor name
 * @param {Object} weights - Grading weights object
 * @param {Array} students - Array of student objects (optional)
 */
function _setupOGSTemplate(sheet, schoolYear, gradeLevel, section, subject, instructor, weights, students = []) {
  // Clear the sheet first
  sheet.clear();
  
  // Build all data in memory first for batch operations
  const numCols = 19; // Fixed number of columns: A-S (Student No, Student Name, 4 grading periods × 4 cols each, Final Grading)
  const allData = [];
  
  // Helper function to pad row to numCols
  const padRow = (row) => {
    const padded = [...row];
    while (padded.length < numCols) {
      padded.push('');
    }
    return padded.slice(0, numCols); // Ensure exactly numCols
  };
  
  // Row 1: Title
  allData.push(padRow(['OFFICIAL GRADE SHEET']));
  
  // Row 2: Empty
  allData.push(padRow(['']));
  
  // Row 3-8: Info rows (matching Excel format exactly)
  allData.push(padRow(['Instructor Name:', instructor]));
  allData.push(padRow(['School Year:', schoolYear]));
  allData.push(padRow(['Level:', gradeLevel]));
  allData.push(padRow(['Section:', section]));
  allData.push(padRow(['Total Student:', '']));
  allData.push(padRow(['Subject:', subject]));
  
  // Row 9: Grading period headers row (1ST GRADING, 2ND GRADING, 3RD GRADING, 4TH GRADING)
  const gradingHeadersRow = padRow([
    '', 
    '', 
    '1ST GRADING', '', '', '',  // Columns C-F (4 columns for 1ST GRADING - will be merged)
    '2ND GRADING', '', '', '',  // Columns G-J (4 columns for 2ND GRADING - will be merged)
    '3RD GRADING', '', '', '',  // Columns K-N (4 columns for 3RD GRADING - will be merged)
    '4TH GRADING', '', '', '',  // Columns O-R (4 columns for 4TH GRADING - will be merged)
    ''                            // Column S (Final Grading header is in row 10)
  ]);
  allData.push(gradingHeadersRow);
  
  // Row 10: Column headers (percentage row removed temporarily)
  const headerRow = [
    'Student No',
    'Student Name',
    // 1ST GRADING
    'TS1-Written',
    'TS1-Performance',
    'TS1-Assessment',
    '1st Transmuted',
    // 2ND GRADING
    'TS2-Written',
    'TS2-Performance',
    'TS2-Assessment',
    '2nd Transmuted',
    // 3RD GRADING
    'TS3-Written',
    'TS3-Performance',
    'TS3-Assessment',
    '3rd Transmuted',
    // 4TH GRADING
    'TS4-Written',
    'TS4-Performance',
    'TS4-Assessment',
    '4th Transmuted',
    // Final
    'Final Grading'
  ];
  allData.push(padRow(headerRow));
  
  // Write all data at once
  const numRows = allData.length;
  const dataRange = sheet.getRange(1, 1, numRows, numCols);
  dataRange.setValues(allData);
  
  // Title row
  sheet.getRange(1, 1, 1, numCols)
    .merge()
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Info rows (3-8)
  sheet.getRange(3, 1, 6, 1).setFontWeight('bold');
  sheet.getRange(3, 2, 2, 1).setBackground('#f3f3f3');
  sheet.getRange(6, 2, 3, 1).setBackground('#f3f3f3');
  
  // Row 9: Grading period headers
  sheet.getRange(9, 3, 1, 4).merge();
  sheet.getRange(9, 7, 1, 4).merge();
  sheet.getRange(9, 11, 1, 4).merge();
  sheet.getRange(9, 15, 1, 4).merge();
  sheet.getRange(9, 3, 1, 16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#e6e6e6');
  
  // Row 10: Column headers
  sheet.getRange(10, 1, 1, numCols)
    .setFontWeight('bold')
    .setBackground('#d9d9d9')
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true);
  
  // Set column widths
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 250);
  for (let c = 3; c <= 19; c++) {
    sheet.setColumnWidth(c, 130);
  }
  
  sheet.setFrozenRows(10);
  
  const hasStudents = students && students.length > 0;
  const numStudentRows = hasStudents ? Math.max(students.length, CONFIG.TEMPLATE.NUM_STUDENT_ROWS) : CONFIG.TEMPLATE.NUM_STUDENT_ROWS;
  const startRow = 11;
  
  if (numStudentRows > 0) {
    const ww = weights.writtenWork;
    const pt = weights.performanceTask;
    const as = weights.assessment;
    
    const studentValues = [];
    const formulaColumns = {
      6: [],  // Column F: 1st Transmuted
      10: [], // Column J: 2nd Transmuted
      14: [], // Column N: 3rd Transmuted
      18: [], // Column R: 4th Transmuted
      19: []  // Column S: Final Grading
    };
  
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
      
      formulaColumns[6].push([`=IF(AND(C${row}<>"",D${row}<>"",E${row}<>""),ROUND((C${row}*${ww}/100+D${row}*${pt}/100+E${row}*${as}/100),2),"")`]);
      formulaColumns[10].push([`=IF(AND(G${row}<>"",H${row}<>"",I${row}<>""),ROUND((G${row}*${ww}/100+H${row}*${pt}/100+I${row}*${as}/100),2),"")`]);
      formulaColumns[14].push([`=IF(AND(K${row}<>"",L${row}<>"",M${row}<>""),ROUND((K${row}*${ww}/100+L${row}*${pt}/100+M${row}*${as}/100),2),"")`]);
      formulaColumns[18].push([`=IF(AND(O${row}<>"",P${row}<>"",Q${row}<>""),ROUND((O${row}*${ww}/100+P${row}*${pt}/100+Q${row}*${as}/100),2),"")`]);
      formulaColumns[19].push([`=IF(AND(F${row}<>"",J${row}<>"",N${row}<>"",R${row}<>""),ROUND((F${row}+J${row}+N${row}+R${row})/4,2),"")`]);
    }
    
    sheet.getRange(startRow, 1, numStudentRows, 2).setValues(studentValues);
    
    const emptyRangeFull = sheet.getRange(startRow, 3, numStudentRows, 15);
    const emptyValuesBatch = Array(numStudentRows).fill(null).map(() => Array(15).fill(''));
    emptyRangeFull.setValues(emptyValuesBatch);
    
    const formulaColsList = [6, 10, 14, 18, 19];
    formulaColsList.forEach(col => {
      sheet.getRange(startRow, col, numStudentRows, 1).setFormulas(formulaColumns[col]);
    });
    
    // PROTECTION: Required for sharing with others (teachers/staff)
    // Protected: Student info (A-B), Headers (9-10), Formulas (F, J, N, R, S)
    // Editable by others: Grading input columns (C, D, E, G, H, I, K, L, M, O, P, Q)
    // Note: Protection operations are slow (~2-5 seconds each), resulting in ~90-100 second generation time
    const ENABLE_PROTECTIONS = true;
    
    if (ENABLE_PROTECTIONS) {
      const creatorEmail = Session.getActiveUser().getEmail();
      const endRow = startRow + numStudentRows - 1;
      const protectToRow = Math.max(endRow + 20, 50);
      
      const setProtectionWithOnlyCreator = (protection, creatorEmail) => {
        try {
          // Remove all existing editors (including script owner) to ensure only creator can edit
          const currentEditors = protection.getEditors();
          if (currentEditors.length > 0) {
            protection.removeEditors(currentEditors);
          }
          // Add only the creator as editor
          protection.addEditor(creatorEmail);
        } catch (e) {
          console.log('Note: Could not set protection editors:', e.message);
        }
      };
      
      const colABRange = sheet.getRange(1, 1, protectToRow, 2);
      const protection1 = colABRange.protect().setWarningOnly(false);
      setProtectionWithOnlyCreator(protection1, creatorEmail);
      
      const headerRowsRange = sheet.getRange(9, 1, 2, numCols);
      const protection2 = headerRowsRange.protect().setWarningOnly(false);
      setProtectionWithOnlyCreator(protection2, creatorEmail);
      
      const formulaCols = [6, 10, 14, 18, 19];
      const formulaProtections = [];
      formulaCols.forEach((col) => {
        const formulaRange = sheet.getRange(1, col, protectToRow, 1);
        const prot = formulaRange.protect().setWarningOnly(false);
        formulaProtections.push(prot);
      });
      formulaProtections.forEach(protection => {
        setProtectionWithOnlyCreator(protection, creatorEmail);
      });
    }
    
    const studentRange = sheet.getRange(startRow, 1, numStudentRows, numCols);
    studentRange.setBorder(true, true, true, true, true, true);
    sheet.getRange(startRow, 3, numStudentRows, 17).setNumberFormat('0.00');
    
    if (hasStudents) {
      sheet.getRange(7, 2).setValue(students.length).setHorizontalAlignment('left');
    }
  }
}

/**
 * Helper function to get instructor email from INSTRUCTORS_REFERENCE sheet
 * @param {string} instructorName - The instructor's full name
 * @return {string} The instructor's email, or empty string if not found
 */
function _getInstructorEmail(instructorName) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.INSTRUCTORS_REFERENCE);
    if (!sheet) {
      console.warn('INSTRUCTORS_REFERENCE sheet not found');
      return '';
    }
    
    // Read data starting from row 3 (after 2 header rows)
    const data = sheet.getDataRange().getValues();
    const startRow = CONFIG.DATA_START_ROW - 1; // Convert to 0-based index (row 3 = index 2)
    const dataRows = data.slice(startRow);
    
    // Find instructor by name (column A = 0, Email = column B = 1)
    const match = dataRows.find(row => row[0] === instructorName);
    
    if (match && match[1]) {
      return match[1].toString().trim(); // Return email (column B)
    }
    
    return '';
  } catch (error) {
    console.error('Error getting instructor email:', error);
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
 * OPTIMIZED function to fetch students from STUDENTS DB spreadsheet
 * Retrieves students for a specific grade level and section from the academic year sheet
 * Opens STUDENTS_DB by name from the same folder as Template Masterfile
 * @param {string} schoolYear - The school year (e.g., "2024-2025")
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @return {Array} Array of student objects [{ studentNumber, lastName, firstName, middleName }]
 */
function _getStudentsFromDB(schoolYear, gradeLevel, section) {
  try {
    // Get the current spreadsheet's folder
    const currentSpreadsheet = getSpreadsheet();
    const currentFile = DriveApp.getFileById(currentSpreadsheet.getId());
    const parentFolders = currentFile.getParents();
    
    if (!parentFolders.hasNext()) {
      console.warn('Unable to find parent folder. Returning empty student list.');
      return [];
    }
    
    const parentFolder = parentFolders.next();
    
    // Search for STUDENTS_DB spreadsheet in the same folder
    const studentsDbFiles = parentFolder.getFilesByName(CONFIG.STUDENTS_DB_NAME);
    
    if (!studentsDbFiles.hasNext()) {
      console.warn(`STUDENTS_DB spreadsheet not found in folder. Looking for: "${CONFIG.STUDENTS_DB_NAME}". Returning empty student list.`);
      return [];
    }
    
    const studentsDbFile = studentsDbFiles.next();
    const studentsSpreadsheet = SpreadsheetApp.openById(studentsDbFile.getId());
    
    // Convert school year to academic year sheet name format
    // e.g., "2024-2025" → "A.Y. 2024-2025"
    const academicYearSheet = `A.Y. ${schoolYear}`;
    
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
      
      // Filter by grade level and section
      if (rowGradeLevel === gradeLevel && rowSection === section) {
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
 * Internal function to generate OGS template based on provided parameters
 * Creates a new Google Sheet file with one sheet per subject for the instructor
 * Organizes files into folders: "YYYY-YYYY Grade XY" format
 * @param {string} schoolYear - The school year (e.g., "2024-2025")
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} instructor - The instructor name
 * @param {Array} subjects - Array of subject names to generate sheets for
 * @return {Object} Result object with success status and message
 */
function _generateOGSTemplate(schoolYear, gradeLevel, section, instructor, subjects) {
  try {
    const masterSpreadsheet = getSpreadsheet();
    
    // Generate template file name in format: OGS_GRADE1_A_2025-2026 - Teacher Name
    const sanitizedGradeLevel = gradeLevel.replace(/\s+/g, '').toUpperCase();
    const sanitizedSection = section.toUpperCase();
    const sanitizedYear = schoolYear.replace(/[^a-zA-Z0-9-]/g, '');
    const templateFileName = `OGS_${sanitizedGradeLevel}_${sanitizedSection}_${sanitizedYear} - ${instructor}`;
    
    // Get the parent folder of the master spreadsheet
    const masterFile = DriveApp.getFileById(masterSpreadsheet.getId());
    const parentFolders = masterFile.getParents();
    const baseFolder = parentFolders.hasNext() ? parentFolders.next() : DriveApp.getRootFolder();
    
    // OPTIMIZATION: Create folder structure: "YYYY-YYYY Grade XY"
    // Example: "2025-2026 Grade 1A"
    const folderName = `${schoolYear} ${gradeLevel}${section}`;
    const targetFolder = _findOrCreateFolder(baseFolder, folderName);
    
    // Check if template file already exists in the target folder
    const existingFiles = targetFolder.getFilesByName(templateFileName);
    if (existingFiles.hasNext()) {
      // File already exists - return error without creating or writing to MASTER_DATA
      const existingFile = existingFiles.next();
      const existingFileUrl = existingFile.getUrl();
      return {
        success: false,
        message: `Template file already exists!\n\nFile: ${templateFileName}\nFolder: ${folderName}\n\nPlease delete the existing file first if you want to regenerate it.\n\nExisting file: ${existingFileUrl}`,
        templateUrl: existingFileUrl,
        folderName: folderName
      };
    }
    
    // Create new Google Sheet file
    const templateSpreadsheet = SpreadsheetApp.create(templateFileName);
    const templateFile = DriveApp.getFileById(templateSpreadsheet.getId());
    
    // Set file permissions: Creator and instructor have edit access
    // Protected ranges will only allow creator to edit (instructor can edit unprotected cells)
    const creatorEmail = Session.getActiveUser().getEmail();
    
    // Get instructor email from INSTRUCTORS_REFERENCE sheet
    const instructorEmail = _getInstructorEmail(instructor);
    
    const editors = templateFile.getEditors();
    const viewers = templateFile.getViewers();
    
    // Batch remove all non-creator/non-instructor editors and all viewers
    const allowedEmails = [creatorEmail];
    if (instructorEmail) {
      allowedEmails.push(instructorEmail);
    }
    
    const editorsToRemove = editors.filter(editor => !allowedEmails.includes(editor.getEmail()));
    if (editorsToRemove.length > 0) {
      templateFile.removeEditors(editorsToRemove); // Single batch operation
    }
    if (viewers.length > 0) {
      templateFile.removeViewers(viewers); // Single batch operation
    }
    
    // Ensure creator and instructor have access (idempotent - safe to call even if already editor)
    templateFile.addEditor(creatorEmail);
    if (instructorEmail) {
      templateFile.addEditor(instructorEmail);
    }
    
    // NOTE: Protected ranges (student data, formulas, headers) are locked to only creator
    // Instructor can edit unprotected grading input columns (C, D, E, G, H, I, K, L, M, O, P, Q)
    
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
    _setupOGSTemplate(defaultSheet, schoolYear, gradeLevel, section, firstSubject, instructor, subjectWeights[firstSubject], students);
    
    // Create sheets for remaining subjects with same student data
    const createdSheets = [firstSubject];
    for (let i = 1; i < subjects.length; i++) {
      const subject = subjects[i];
      const newSheet = templateSpreadsheet.insertSheet(subject);
      _setupOGSTemplate(newSheet, schoolYear, gradeLevel, section, subject, instructor, subjectWeights[subject], students);
      createdSheets.push(subject);
    }
    
    // Get the template file URL
    const templateUrl = templateSpreadsheet.getUrl();
    
    // Save one row to MASTER_DATA (one row per template file, not per subject)
    _saveToMasterData(schoolYear, gradeLevel, section, instructor, templateUrl);
    
    const subjectsList = subjects.join(', ');
    const studentCountMsg = students.length > 0 ? `\nStudents: ${students.length} students loaded from STUDENTS DB` : '\nStudents: No students found (template generated with blank rows)';
    const message = `OGS Template generated successfully!\n\nFolder: ${folderName}\nTemplate: ${templateFileName}\nSchool Year: ${schoolYear}\nGrade Level: ${gradeLevel}\nSection: ${section}\nInstructor: ${instructor}${studentCountMsg}\n\nSubjects (${subjects.length} sheets):\n${subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    
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
      message: `Error generating template: ${error.toString()}` 
    };
  }
}

/**
 * Internal function to add an assignment
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} instructor - The instructor name
 * @param {string} subject - The subject name
 * @return {Object} Result object with success status
 */
function _addAssignment(gradeLevel, section, instructor, subject) {
  try {
    let sheet = getSheet(CONFIG.SHEET_NAMES.ASSIGNMENTS);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      const spreadsheet = getSpreadsheet();
      sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES.ASSIGNMENTS);
      
      // Set up headers (no parent header row)
      sheet.getRange(1, 1).setValue('Grade Level');
      sheet.getRange(1, 2).setValue('Section');
      sheet.getRange(1, 3).setValue('Instructor');
      sheet.getRange(1, 4).setValue('Subject');
      sheet.getRange(1, 5).setValue('Status');
      sheet.getRange(1, 6).setValue('Created');
      sheet.getRange(1, 7).setValue('Modified');
      sheet.getRange(1, 8).setValue('Created By');
      sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#d9d9d9');
    }
    
    const timestamp = new Date();
    const userEmail = Session.getActiveUser().getEmail();
    
    // Check if assignment already exists (skip header row 1)
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[CONFIG.ASSIGNMENTS_COLUMNS.GRADE_LEVEL] === gradeLevel &&
          row[CONFIG.ASSIGNMENTS_COLUMNS.SECTION] === section &&
          row[CONFIG.ASSIGNMENTS_COLUMNS.INSTRUCTOR] === instructor &&
          row[CONFIG.ASSIGNMENTS_COLUMNS.SUBJECT] === subject) {
        // Update existing assignment to active and update modified date
        sheet.getRange(i + 1, CONFIG.ASSIGNMENTS_COLUMNS.STATUS + 1).setValue('Active');
        sheet.getRange(i + 1, CONFIG.ASSIGNMENTS_COLUMNS.MODIFIED + 1).setValue(timestamp);
        return { success: true, message: 'Assignment updated successfully' };
      }
    }
    
    // Add new assignment with audit trail
    sheet.appendRow([gradeLevel, section, instructor, subject, 'Active', timestamp, timestamp, userEmail]);
    
    return { success: true, message: 'Assignment added successfully' };
  } catch (error) {
    console.error('Error adding assignment:', error);
    return { success: false, message: `Error adding assignment: ${error.toString()}` };
  }
}

/**
 * Internal function to add multiple assignments in batch (OPTIMIZED for performance)
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} instructor - The instructor name
 * @param {Array} subjects - Array of subject names
 * @return {Object} Result object with success status and counts
 */
function _addAssignmentsBatch(gradeLevel, section, instructor, subjects) {
  try {
    let sheet = getSheet(CONFIG.SHEET_NAMES.ASSIGNMENTS);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      const spreadsheet = getSpreadsheet();
      sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES.ASSIGNMENTS);
      
      // Set up headers (no parent header row)
      sheet.getRange(1, 1).setValue('Grade Level');
      sheet.getRange(1, 2).setValue('Section');
      sheet.getRange(1, 3).setValue('Instructor');
      sheet.getRange(1, 4).setValue('Subject');
      sheet.getRange(1, 5).setValue('Status');
      sheet.getRange(1, 6).setValue('Created');
      sheet.getRange(1, 7).setValue('Modified');
      sheet.getRange(1, 8).setValue('Created By');
      sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#d9d9d9');
    }
    
    const timestamp = new Date();
    const userEmail = Session.getActiveUser().getEmail();
    
    // Get all existing data once (batch read)
    const data = sheet.getDataRange().getValues();
    const existingAssignments = new Set();
    
    // Build set of existing assignments for fast lookup
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[CONFIG.ASSIGNMENTS_COLUMNS.GRADE_LEVEL] === gradeLevel &&
          row[CONFIG.ASSIGNMENTS_COLUMNS.SECTION] === section &&
          row[CONFIG.ASSIGNMENTS_COLUMNS.INSTRUCTOR] === instructor) {
        const subject = row[CONFIG.ASSIGNMENTS_COLUMNS.SUBJECT];
        existingAssignments.add(subject);
      }
    }
    
    // Separate new assignments from updates
    const newRows = [];
    const updateRows = [];
    
    subjects.forEach(subject => {
      if (existingAssignments.has(subject)) {
        // Find row index for update
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row[CONFIG.ASSIGNMENTS_COLUMNS.GRADE_LEVEL] === gradeLevel &&
              row[CONFIG.ASSIGNMENTS_COLUMNS.SECTION] === section &&
              row[CONFIG.ASSIGNMENTS_COLUMNS.INSTRUCTOR] === instructor &&
              row[CONFIG.ASSIGNMENTS_COLUMNS.SUBJECT] === subject) {
            updateRows.push({ rowIndex: i + 1, subject: subject });
            break;
          }
        }
      } else {
        // New assignment
        newRows.push([gradeLevel, section, instructor, subject, 'Active', timestamp, timestamp, userEmail]);
      }
    });
    
    // Batch update existing assignments (optimized - batch operations)
    if (updateRows.length > 0) {
      // Sort by row index to group contiguous rows for batch operations
      updateRows.sort((a, b) => a.rowIndex - b.rowIndex);
      
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
        sheet.getRange(startRow, CONFIG.ASSIGNMENTS_COLUMNS.STATUS + 1, numRows, 1).setValues(statusValues);
        // Batch update modified column
        sheet.getRange(startRow, CONFIG.ASSIGNMENTS_COLUMNS.MODIFIED + 1, numRows, 1).setValues(modifiedValues);
      });
    }
    
    // Batch insert new assignments (single API call instead of multiple appendRow calls)
    if (newRows.length > 0) {
      const lastRow = sheet.getLastRow();
      const targetRange = sheet.getRange(lastRow + 1, 1, newRows.length, 8);
      targetRange.setValues(newRows);
    }
    
    const totalProcessed = newRows.length + updateRows.length;
    const added = newRows.length;
    const updated = updateRows.length;
    
    return { 
      success: true, 
      message: `Successfully processed ${totalProcessed} assignment(s): ${added} added, ${updated} updated`,
      added: added,
      updated: updated,
      total: totalProcessed
    };
  } catch (error) {
    console.error('Error adding assignments batch:', error);
    return { success: false, message: `Error adding assignments: ${error.toString()}` };
  }
}

/**
 * Internal function to get assignments for a grade level and section
 * OPTIMIZED for performance with early returns and minimal data retrieval
 * @param {string} gradeLevel - The grade level (optional)
 * @param {string} section - The section (optional)
 * @return {Array} Array of assignment objects
 */
function _getAssignments(gradeLevel, section) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.ASSIGNMENTS);
    if (!sheet) {
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    
    // Early return if sheet only has headers (no data)
    if (lastRow <= 1) {
      return [];
    }
    
    // OPTIMIZATION 1: Only read necessary columns (A-E) instead of all columns
    // Columns: Grade Level (A), Section (B), Instructor (C), Subject (D), Status (E)
    const numCols = 5; // Only read first 5 columns (we only need these)
    const dataRange = sheet.getRange(2, 1, lastRow - 1, numCols); // Start from row 2 (skip header)
    const data = dataRange.getValues();
    
    // Pre-allocate array size for better performance (estimate)
    const assignments = [];
    
    // OPTIMIZATION 2: Use column indices directly (no CONFIG lookup in loop)
    const COL_GRADE = 0;
    const COL_SECTION = 1;
    const COL_INSTRUCTOR = 2;
    const COL_SUBJECT = 3;
    const COL_STATUS = 4;
    
    // OPTIMIZATION 3: Convert filters to boolean flags for faster checks
    const hasGradeFilter = Boolean(gradeLevel);
    const hasSectionFilter = Boolean(section);
    
    // OPTIMIZATION 4: Loop through data once with optimized filtering
    const dataLength = data.length;
    for (let i = 0; i < dataLength; i++) {
      const row = data[i];
      
      // OPTIMIZATION 5: Check status first (most likely to eliminate rows)
      if (row[COL_STATUS] !== 'Active') continue;
      
      // OPTIMIZATION 6: Early continue on filter mismatch (short-circuit evaluation)
      if (hasGradeFilter && row[COL_GRADE] !== gradeLevel) continue;
      if (hasSectionFilter && row[COL_SECTION] !== section) continue;
      
      // OPTIMIZATION 7: Direct object creation without intermediate variables
      assignments.push({
        gradeLevel: row[COL_GRADE],
        section: row[COL_SECTION],
        instructor: row[COL_INSTRUCTOR],
        subject: row[COL_SUBJECT]
      });
    }
    
    return assignments;
  } catch (error) {
    console.error('Error getting assignments:', error);
    return [];
  }
}

/**
 * Internal function to delete an assignment (set to inactive)
 * OPTIMIZED for performance with minimal data retrieval and batch updates
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} instructor - The instructor name
 * @param {string} subject - The subject name
 * @return {Object} Result object with success status
 */
function _deleteAssignment(gradeLevel, section, instructor, subject) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.ASSIGNMENTS);
    if (!sheet) {
      return { success: false, message: 'ASSIGNMENTS sheet not found' };
    }
    
    const lastRow = sheet.getLastRow();
    
    // Early return if sheet only has headers
    if (lastRow <= 1) {
      return { success: false, message: 'Assignment not found' };
    }
    
    // OPTIMIZATION 1: Only read necessary columns (A-D) instead of all columns
    // We only need: Grade Level, Section, Instructor, Subject
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 4); // Start from row 2
    const data = dataRange.getValues();
    
    // OPTIMIZATION 2: Use column indices directly
    const COL_GRADE = 0;
    const COL_SECTION = 1;
    const COL_INSTRUCTOR = 2;
    const COL_SUBJECT = 3;
    
    const timestamp = new Date();
    
    // OPTIMIZATION 3: Loop with early exit
    const dataLength = data.length;
    for (let i = 0; i < dataLength; i++) {
      const row = data[i];
      
      // OPTIMIZATION 4: Check all conditions in order of likelihood to fail
      // (most specific first for faster rejection)
      if (row[COL_SUBJECT] === subject &&
          row[COL_INSTRUCTOR] === instructor &&
          row[COL_SECTION] === section &&
          row[COL_GRADE] === gradeLevel) {
        
        // OPTIMIZATION 5: Batch update both cells at once
        const actualRow = i + 2; // +2 because data starts at row 2 (row 1 is header)
        const statusCol = CONFIG.ASSIGNMENTS_COLUMNS.STATUS + 1; // E column
        const modifiedCol = CONFIG.ASSIGNMENTS_COLUMNS.MODIFIED + 1; // G column
        
        // Batch update using setValues for better performance
        sheet.getRange(actualRow, statusCol, 1, 1).setValue('Inactive');
        sheet.getRange(actualRow, modifiedCol, 1, 1).setValue(timestamp);
        
        return { success: true, message: 'Assignment deleted successfully' };
      }
    }
    
    return { success: false, message: 'Assignment not found' };
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return { success: false, message: `Error deleting assignment: ${error.toString()}` };
  }
}

/**
 * Internal function to delete multiple assignments in batch (OPTIMIZED)
 * Much faster than calling _deleteAssignment multiple times
 * @param {Array} assignments - Array of assignment objects to delete
 * @return {Object} Result object with success status and counts
 */
function _deleteAssignmentsBatch(assignments) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.ASSIGNMENTS);
    if (!sheet) {
      return { success: false, message: 'ASSIGNMENTS sheet not found', deleted: 0, failed: 0 };
    }
    
    const lastRow = sheet.getLastRow();
    
    // Early return if sheet only has headers
    if (lastRow <= 1 || !assignments || assignments.length === 0) {
      return { success: true, message: 'No assignments to delete', deleted: 0, failed: 0 };
    }
    
    // OPTIMIZATION 1: Read all data once
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 4);
    const data = dataRange.getValues();
    
    // OPTIMIZATION 2: Create a lookup set for fast matching
    const assignmentKeys = new Set();
    assignments.forEach(a => {
      const key = `${a.gradeLevel}|${a.section}|${a.instructor}|${a.subject}`;
      assignmentKeys.add(key);
    });
    
    // OPTIMIZATION 3: Find all matching rows in one pass
    const rowsToUpdate = [];
    const timestamp = new Date();
    
    const COL_GRADE = 0;
    const COL_SECTION = 1;
    const COL_INSTRUCTOR = 2;
    const COL_SUBJECT = 3;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const key = `${row[COL_GRADE]}|${row[COL_SECTION]}|${row[COL_INSTRUCTOR]}|${row[COL_SUBJECT]}`;
      
      if (assignmentKeys.has(key)) {
        rowsToUpdate.push(i + 2); // +2 because data starts at row 2
      }
    }
    
    // OPTIMIZATION 4: Batch update all rows at once
    if (rowsToUpdate.length > 0) {
      const statusCol = CONFIG.ASSIGNMENTS_COLUMNS.STATUS + 1;
      const modifiedCol = CONFIG.ASSIGNMENTS_COLUMNS.MODIFIED + 1;
      
      // Update each row (Google Apps Script doesn't support non-contiguous ranges efficiently)
      // But we still optimize by minimizing API calls
      rowsToUpdate.forEach(rowNum => {
        sheet.getRange(rowNum, statusCol).setValue('Inactive');
        sheet.getRange(rowNum, modifiedCol).setValue(timestamp);
      });
      
      return { 
        success: true, 
        message: `Successfully deleted ${rowsToUpdate.length} assignment(s)`,
        deleted: rowsToUpdate.length,
        failed: assignments.length - rowsToUpdate.length
      };
    }
    
    return { 
      success: false, 
      message: 'No matching assignments found',
      deleted: 0,
      failed: assignments.length
    };
  } catch (error) {
    console.error('Error deleting assignments batch:', error);
    return { 
      success: false, 
      message: `Error deleting assignments: ${error.toString()}`,
      deleted: 0,
      failed: assignments.length
    };
  }
}

/**
 * Internal function to add an advisory class
 * @param {string} instructor - The instructor name
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} schoolYear - The school year
 * @return {Object} Result object with success status
 */
function _addAdvisory(instructor, gradeLevel, section, schoolYear) {
  try {
    let sheet = getSheet(CONFIG.SHEET_NAMES.ADVISORY);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      const spreadsheet = getSpreadsheet();
      sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES.ADVISORY);
      
      // Set up headers (no parent header row)
      sheet.getRange(1, 1).setValue('Instructor');
      sheet.getRange(1, 2).setValue('Grade Level');
      sheet.getRange(1, 3).setValue('Section');
      sheet.getRange(1, 4).setValue('School Year');
      sheet.getRange(1, 5).setValue('Status');
      sheet.getRange(1, 6).setValue('Created');
      sheet.getRange(1, 7).setValue('Modified');
      sheet.getRange(1, 8).setValue('Created By');
      sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#d9d9d9');
    }
    
    const timestamp = new Date();
    const userEmail = Session.getActiveUser().getEmail();
    
    // Check if advisory already exists (skip header row 1)
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[CONFIG.ADVISORY_COLUMNS.INSTRUCTOR] === instructor &&
          row[CONFIG.ADVISORY_COLUMNS.GRADE_LEVEL] === gradeLevel &&
          row[CONFIG.ADVISORY_COLUMNS.SECTION] === section &&
          row[CONFIG.ADVISORY_COLUMNS.SCHOOL_YEAR] === schoolYear) {
        // Update existing advisory to active and update modified date
        sheet.getRange(i + 1, CONFIG.ADVISORY_COLUMNS.STATUS + 1).setValue('Active');
        sheet.getRange(i + 1, CONFIG.ADVISORY_COLUMNS.MODIFIED + 1).setValue(timestamp);
        return { success: true, message: 'Advisory updated successfully' };
      }
    }
    
    // Add new advisory with audit trail
    sheet.appendRow([instructor, gradeLevel, section, schoolYear, 'Active', timestamp, timestamp, userEmail]);
    
    return { success: true, message: 'Advisory added successfully' };
  } catch (error) {
    console.error('Error adding advisory:', error);
    return { success: false, message: `Error adding advisory: ${error.toString()}` };
  }
}

/**
 * Internal function to get advisories (OPTIMIZED)
 * @param {string} instructor - The instructor name (optional filter)
 * @param {string} schoolYear - The school year (optional filter)
 * @return {Array} Array of advisory objects
 */
function _getAdvisories(instructor = null, schoolYear = null) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.ADVISORY);
    
    if (!sheet) {
      return [];
    }
    
    // OPTIMIZATION: Read only necessary columns (A-H)
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return []; // Only header row or empty
    }
    
    const advisories = [];
    const hasInstructorFilter = instructor !== null && instructor !== '';
    const hasSchoolYearFilter = schoolYear !== null && schoolYear !== '';
    
    // OPTIMIZATION: Single pass filtering
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowInstructor = row[CONFIG.ADVISORY_COLUMNS.INSTRUCTOR];
      const rowSchoolYear = row[CONFIG.ADVISORY_COLUMNS.SCHOOL_YEAR];
      
      // Apply filters
      if (hasInstructorFilter && rowInstructor !== instructor) continue;
      if (hasSchoolYearFilter && rowSchoolYear !== schoolYear) continue;
      
      advisories.push({
        instructor: rowInstructor || '',
        gradeLevel: row[CONFIG.ADVISORY_COLUMNS.GRADE_LEVEL] || '',
        section: row[CONFIG.ADVISORY_COLUMNS.SECTION] || '',
        schoolYear: rowSchoolYear || '',
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
 * @param {string} instructor - The instructor name
 * @param {string} gradeLevel - The grade level
 * @param {string} section - The section
 * @param {string} schoolYear - The school year
 * @return {Object} Result object with success status
 */
function _deleteAdvisory(instructor, gradeLevel, section, schoolYear) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.ADVISORY);
    
    if (!sheet) {
      return { success: false, message: 'ADVISORY sheet not found' };
    }
    
    // OPTIMIZATION: Read only necessary columns (A-D for matching, E for status)
    const data = sheet.getDataRange().getValues();
    const timestamp = new Date();
    
    // OPTIMIZATION: Single pass search and update
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[CONFIG.ADVISORY_COLUMNS.INSTRUCTOR] === instructor &&
          row[CONFIG.ADVISORY_COLUMNS.GRADE_LEVEL] === gradeLevel &&
          row[CONFIG.ADVISORY_COLUMNS.SECTION] === section &&
          row[CONFIG.ADVISORY_COLUMNS.SCHOOL_YEAR] === schoolYear) {
        // Update status to Inactive and modified date
        const statusCol = CONFIG.ADVISORY_COLUMNS.STATUS + 1; // E column
        const modifiedCol = CONFIG.ADVISORY_COLUMNS.MODIFIED + 1; // G column
        sheet.getRange(i + 1, statusCol).setValue('Inactive');
        sheet.getRange(i + 1, modifiedCol).setValue(timestamp);
        return { success: true, message: 'Advisory deleted successfully' };
      }
    }
    
    return { success: false, message: 'Advisory not found' };
  } catch (error) {
    console.error('Error deleting advisory:', error);
    return { success: false, message: `Error deleting advisory: ${error.toString()}` };
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
      return { success: false, message: 'ADVISORY sheet not found', deleted: 0, failed: 0 };
    }
    
    if (!advisories || advisories.length === 0) {
      return { success: false, message: 'No advisories provided', deleted: 0, failed: 0 };
    }
    
    // OPTIMIZATION: Read all data once
    const data = sheet.getDataRange().getValues();
    const timestamp = new Date();
    
    // OPTIMIZATION: Build Set for fast lookup
    const advisoryKeys = new Set();
    advisories.forEach(adv => {
      const key = `${adv.instructor}|||${adv.gradeLevel}|||${adv.section}|||${adv.schoolYear}`;
      advisoryKeys.add(key);
    });
    
    // OPTIMIZATION: Single pass - collect rows to update
    const rowsToUpdate = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const key = `${row[CONFIG.ADVISORY_COLUMNS.INSTRUCTOR]}|||${row[CONFIG.ADVISORY_COLUMNS.GRADE_LEVEL]}|||${row[CONFIG.ADVISORY_COLUMNS.SECTION]}|||${row[CONFIG.ADVISORY_COLUMNS.SCHOOL_YEAR]}`;
      
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
        message: `Successfully deleted ${rowsToUpdate.length} advisory(ies)`,
        deleted: rowsToUpdate.length,
        failed: advisories.length - rowsToUpdate.length
      };
    }
    
    return { 
      success: false, 
      message: 'No matching advisories found',
      deleted: 0,
      failed: advisories.length
    };
  } catch (error) {
    console.error('Error deleting advisories batch:', error);
    return { 
      success: false, 
      message: `Error deleting advisories: ${error.toString()}`,
      deleted: 0,
      failed: advisories.length
    };
  }
}

