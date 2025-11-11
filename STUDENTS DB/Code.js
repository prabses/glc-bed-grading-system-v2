/**
 * Google Apps Script for Student Data Import
 * This script provides a menu option to import student data
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
    .addItem("Import Student Data", "showImportDialog")
    .addItem("Update Student Information", "showUpdateDialog")
    .addToUi();
}

/**
 * Shows the import dialog with HTML interface
 * Only works on sheets containing "A.Y."
 */
function showImportDialog() {
  const activeSheet = SpreadsheetApp.getActiveSheet();
  const sheetName = activeSheet.getName();
  
  // Check if current sheet contains "A.Y." (case-insensitive)
  if (!sheetName.toLowerCase().includes('a.y.')) {
    SpreadsheetApp.getUi().alert(
      'Access Denied',
      'This function can only be used on sheets containing "A.Y." in the name.\n\nCurrent sheet: ' + sheetName,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  
  const htmlOutput = HtmlService.createHtmlOutputFromFile("StudentImportDialog")
    .setWidth(500)
    .setHeight(450)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Import Student Data");
}

/**
 * Gets the list of sheets containing "A.Y." (case-insensitive)
 * @return {Array} Array of valid academic year sheet names
 */
function getStudentSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();
  const validAcademicYearSheets = [];
  
  for (let i = 0; i < sheets.length; i++) {
    const sheetName = sheets[i].getName();
    if (sheetName.toLowerCase().includes('a.y.')) {
      validAcademicYearSheets.push(sheetName);
    }
  }
  
  return validAcademicYearSheets;
}

/**
 * Client-callable function to import student data via API.
 * This function is called from the client-side HTML form.
 * @param {string} csvContent - The CSV content as a string
 * @param {string} academicYearSheet - The name of the target sheet
 * @return {Object} Result object with success status and message
 */
function importStudentData(csvContent, academicYearSheet) {
  console.log(
    "Function importStudentData executed by: " + Session.getActiveUser().getEmail()
  );
  return callApi("importStudentData", { csvContent, academicYearSheet });
}

/**
 * Gets existing student numbers from column A of the sheet (starting from row 3)
 * @param {Sheet} sheet - The target sheet
 * @return {Array} Array of existing student numbers
 */
function getExistingStudentNumbers(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) {
    return []; // No data rows exist
  }
  
  // Get all student numbers from column A (starting from row 3)
  const studentNumberRange = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.HEADER_ROWS, 1);
  const studentNumbers = studentNumberRange.getValues();
  
  // Flatten the array and filter out empty values
  return studentNumbers
    .map(row => row[0])
    .filter(value => value && value.toString().trim() !== '');
}

/**
 * Parses a single CSV line with proper handling of commas and quotes
 * @param {string} line - The CSV line to parse
 * @return {Array} Array of parsed values
 */
function parseCSVLine(line) {
  const row = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  
  return row;
}

/**
 * Shows the update student information dialog
 * Only works on sheets containing "A.Y."
 */
function showUpdateDialog() {
  const activeSheet = SpreadsheetApp.getActiveSheet();
  const sheetName = activeSheet.getName();
  
  // Check if current sheet contains "A.Y." (case-insensitive)
  if (!sheetName.toLowerCase().includes('a.y.')) {
    SpreadsheetApp.getUi().alert(
      'Access Denied',
      'This function can only be used on sheets containing "A.Y." in the name.\n\nCurrent sheet: ' + sheetName,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  
  const htmlOutput = HtmlService.createHtmlOutputFromFile("StudentUpdateDialog")
    .setWidth(500)
    .setHeight(600)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Update Student Information");
}

/**
 * Gets the list of available student fields (column headers)
 * @return {Array} Array of field names
 */
function getStudentFields() {
  // Standard student information fields based on the expected format
  return CONFIG.UPDATABLE_FIELDS;
}

/**
 * Client-callable function to get student information via API.
 * This function is called from the client-side HTML form.
 * @param {string} studentNumber - The student number to search for
 * @param {string} academicYearSheet - The academic year sheet name
 * @return {Object} Result object with student data or error
 */
function getStudentInfo(studentNumber, academicYearSheet) {
  console.log(
    "Function getStudentInfo executed by: " + Session.getActiveUser().getEmail()
  );
  return callApi("getStudentInfo", { studentNumber, academicYearSheet });
}

/**
 * Client-callable function to get student numbers from an academic year sheet.
 * This function is called from the client-side HTML form.
 * @param {string} academicYearSheet - The academic year sheet name
 * @return {Array} Array of student numbers
 */
function getStudentNumbers(academicYearSheet) {
  try {
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return [];
    }
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
    
    if (!targetSheet) {
      return [];
    }
    
    return getExistingStudentNumbers(targetSheet);
  } catch (error) {
    console.error('Error getting student numbers:', error);
    return [];
  }
}

/**
 * Client-callable function to update student information via API.
 * This function is called from the client-side HTML form.
 * @param {string} studentNumber - The student number
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} fieldToUpdate - The field name to update
 * @param {string} newValue - The new value
 * @param {string} remarks - Optional remarks about the update
 * @return {Object} Result object with success status and message
 */
function updateStudentInfo(studentNumber, academicYearSheet, fieldToUpdate, newValue, remarks) {
  const userEmail = Session.getActiveUser().getEmail();
  console.log("Function updateStudentInfo executed by: " + userEmail);
  
  return callApi("updateStudentInfo", {
    studentNumber,
    academicYearSheet,
    fieldToUpdate,
    newValue,
    remarks,
    userEmail
  });
}

/**
 * Logs the update to the Update Log sheet
 * @param {string} studentNumber - The student number
 * @param {string} academicYear - The academic year
 * @param {string} fieldUpdated - The field that was updated
 * @param {string} oldValue - The old value
 * @param {string} newValue - The new value
 * @param {string} remarks - Optional remarks
 * @param {string} userEmail - The email of the user making the update (passed from API)
 */
function logUpdate(studentNumber, academicYear, fieldUpdated, oldValue, newValue, remarks, userEmail) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAMES.UPDATE_LOG);
    
    // If Update Log sheet doesn't exist, create it
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES.UPDATE_LOG);
      // Add headers
      const headers = ['Timestamp', 'Updated By', 'Student Number', 'Academic Year', 'Field Updated', 'Old Value', 'New Value', 'Remarks'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    
    // Use the passed userEmail parameter (from API) instead of Session.getActiveUser()
    // If userEmail is not provided (for backward compatibility), fall back to Session
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    
    // Prepare log entry
    const timestamp = new Date();
    const logEntry = [
      timestamp,
      actualUserEmail,
      studentNumber,
      academicYear,
      fieldUpdated,
      oldValue,
      newValue,
      remarks || ''
    ];
    
    // Find the next empty row and append the log entry
    const lastRow = logSheet.getLastRow();
    const nextRow = lastRow + 1;
    
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setValues([logEntry]);
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setHorizontalAlignment('left');
    
    // Format timestamp column
    logSheet.getRange(nextRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
    
  } catch (error) {
    console.error('Error logging update:', error);
    // Don't throw error, just log it - the update itself was successful
  }
}
