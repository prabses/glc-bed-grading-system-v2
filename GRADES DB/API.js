/**
 * API.js - API Architecture Layer for Grades Database
 * This file contains all API-related functions for secure data operations
 * 
 * Functions in this file:
 * - doPost() - API endpoint handler
 * - callApi() - API client function
 * - Helper functions (getSpreadsheet, getSheet)
 * - Internal functions (_importGrades)
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
      case "importGrades":
        return response(200, _importGrades(
          payload.ogsTemplateUrl,
          payload.academicYearSheet
        ));
      case "getGradeInfo":
        return response(200, _getGradeInfo(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.subject
        ));
      case "updateGrades":
        return response(200, _updateGrades(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.subject,
          payload.gradeUpdates,
          payload.remarks,
          payload.userEmail
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
 * Extracts spreadsheet ID from Google Sheets URL
 * @param {string} url - The Google Sheets URL
 * @return {string} The spreadsheet ID
 */
function extractSpreadsheetId(url) {
  // Handle different URL formats:
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    throw new Error("Invalid Google Sheets URL. Could not extract spreadsheet ID.");
  }
  return match[1];
}

/**
 * Helper function to normalize grade level (removes "Grade " prefix)
 * @param {string} gradeLevel - The grade level (can be "Grade 1" or "1")
 * @return {string} Normalized grade level (just the number)
 */
function normalizeGradeLevel(gradeLevel) {
  if (!gradeLevel) return '';
  const str = String(gradeLevel).trim();
  const cleaned = str.replace(/^Grade\s+/i, '');
  const match = cleaned.match(/^\d+/);
  return match ? match[0] : cleaned;
}

/**
 * Internal function to import grades from OGS template
 * @param {string} ogsTemplateUrl - The URL of the OGS template Google Sheet
 * @param {string} academicYearSheet - The name of the target academic year sheet
 * @return {Object} Result object with success status and message
 */
function _importGrades(ogsTemplateUrl, academicYearSheet) {
  try {
    // Validate inputs
    if (!ogsTemplateUrl || ogsTemplateUrl.toString().trim() === '') {
      return { success: false, message: 'OGS template URL cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }

    // Extract spreadsheet ID from URL
    const spreadsheetId = extractSpreadsheetId(ogsTemplateUrl);
    
    // Open the OGS template spreadsheet
    let ogsSpreadsheet;
    try {
      ogsSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
    } catch (error) {
      return { 
        success: false, 
        message: `Cannot access OGS template. Please ensure the spreadsheet is accessible and the URL is correct. Error: ${error.message}` 
      };
    }

    // Get all sheets from OGS template
    const ogsSheets = ogsSpreadsheet.getSheets();
    
    // Find subject sheets and info sheet
    // Subject sheets typically don't have names like "Attendance", "Character", "Characters", "MAPEH"
    const excludedSheetNames = ['Attendance', 'Character', 'Characters', 'MAPEH'];
    let infoSheet = null;
    let attendanceSheet = null;
    let subjectSheets = [];
    
    for (let i = 0; i < ogsSheets.length; i++) {
      const sheetName = ogsSheets[i].getName();
      if (sheetName === 'Attendance') {
        attendanceSheet = ogsSheets[i];
        // Attendance sheet is only used for info extraction, not as a subject sheet
      } else if (!excludedSheetNames.includes(sheetName)) {
        if (!infoSheet) {
          infoSheet = ogsSheets[i]; // Use first subject sheet for info
        }
        subjectSheets.push({
          name: sheetName,
          sheet: ogsSheets[i],
          isMAPEH: sheetName === 'MAPEH' // Flag to identify MAPEH sheet
        });
      }
    }

    // Use Attendance sheet for info if no subject sheets found, otherwise use first subject sheet
    if (!infoSheet && attendanceSheet) {
      infoSheet = attendanceSheet;
    }

    if (!infoSheet) {
      return { 
        success: false, 
        message: 'No subject sheets or Attendance sheet found in OGS template. Please ensure the template contains at least one subject sheet.' 
      };
    }

    if (subjectSheets.length === 0) {
      return { 
        success: false, 
        message: 'No subject sheets found in OGS template. Please ensure the template contains at least one subject sheet with grades.' 
      };
    }

    // Extract header information from the info sheet
    // For subject sheets: Row 2: Teacher Name, Row 3: School Year, Row 4: Level, Row 5: Section
    // For Attendance sheet: Row 1: Advisor Name, Row 2: School Year, Row 3: Level, Row 4: Section
    let startRow = 2; // Default for subject sheets
    if (infoSheet.getName() === 'Attendance') {
      startRow = 1; // Attendance sheet starts at row 1
    }
    
    const infoData = infoSheet.getRange(startRow, 1, 4, 2).getValues();
    
    let advisorName = '';
    let schoolYear = '';
    let level = '';
    let section = '';
    
    for (let i = 0; i < infoData.length; i++) {
      const label = String(infoData[i][0] || '').trim();
      const value = String(infoData[i][1] || '').trim();
      
      if (label.includes('Teacher Name') || label.includes('Advisor Name')) {
        advisorName = value;
      } else if (label.includes('School Year')) {
        schoolYear = value;
      } else if (label.includes('Level')) {
        level = value;
      } else if (label.includes('Section')) {
        section = value;
      }
    }

    // Validate extracted information
    if (!advisorName || !level || !section) {
      return { 
        success: false, 
        message: 'Could not extract required information from OGS template. Please ensure the template has proper headers (Advisor Name, Level, Section).' 
      };
    }

    // Normalize grade level
    const normalizedGradeLevel = normalizeGradeLevel(level);

    // Get target sheet in GRADES DB
    const targetSpreadsheet = getSpreadsheet();
    let targetSheet = getSheet(academicYearSheet);
    
    if (!targetSheet) {
      return { 
        success: false, 
        message: `Academic year sheet "${academicYearSheet}" not found in GRADES DB. Please ensure the sheet exists.` 
      };
    }

    // Get header row from target sheet (assuming row 1 has headers)
    const headerRow = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    const numColumns = headerRow.length;
    
    // Expected column count (minimum)
    const expectedColumnCount = 20;
    
    if (numColumns < expectedColumnCount) {
      return { 
        success: false, 
        message: `Target sheet should have at least ${expectedColumnCount} columns. Found ${numColumns} columns.` 
      };
    }

    const allRows = []; // Array of row data arrays
    // Create a map to track subject order (preserve OGS template sheet order)
    const subjectOrderMap = {};
    for (let i = 0; i < subjectSheets.length; i++) {
      subjectOrderMap[subjectSheets[i].name] = i;
    }
    
    for (let i = 0; i < subjectSheets.length; i++) {
      const subjectSheet = subjectSheets[i].sheet;
      const subjectName = subjectSheets[i].name;
      const isMAPEH = subjectSheets[i].isMAPEH || false;
      
      const lastRow = subjectSheet.getLastRow();
      if (lastRow < 9) continue; // Skip if no headers
      
      // Data starts at row 10 (row 9 is headers: "Student No", "Student Name", etc.)
      const dataStartRow = 10;
      if (lastRow < dataStartRow) continue; // Skip if no data
      
      if (isMAPEH) {
        // MAPEH: Only use Final Grading (column AF, index 30) and Final EQ (column AG, index 31)
        // For MAPEH, set grading periods to empty
        const numColumnsNeeded = 32; // MAPEH has 32 columns
        const dataRange = subjectSheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, numColumnsNeeded);
        const data = dataRange.getValues();
        
        for (let j = 0; j < data.length; j++) {
          const row = data[j];
          const studentNumber = String(row[0] || '').trim();
          const studentName = String(row[1] || '').trim();
          
          if (!studentNumber) continue; // Skip empty rows
          
          // Create row data in the expected format (linear columns)
          const rowData = new Array(numColumns);
          rowData[0] = studentNumber; // Student Number
          rowData[1] = studentName; // Full Name
          rowData[2] = normalizedGradeLevel; // Grade Level
          rowData[3] = section; // Section
          rowData[4] = subjectName; // Subject
          rowData[5] = advisorName; // Teacher
          // Grading periods (empty for MAPEH)
          rowData[6] = ''; // 1st Initial
          rowData[7] = ''; // 1st Transmuted
          rowData[8] = ''; // 1st EQ
          rowData[9] = ''; // 2nd Initial
          rowData[10] = ''; // 2nd Transmuted
          rowData[11] = ''; // 2nd EQ
          rowData[12] = ''; // 3rd Initial
          rowData[13] = ''; // 3rd Transmuted
          rowData[14] = ''; // 3rd EQ
          rowData[15] = ''; // 4th Initial
          rowData[16] = ''; // 4th Transmuted
          rowData[17] = ''; // 4th EQ
          rowData[18] = row[30] || ''; // Final Grading (column AF, index 30)
          rowData[19] = row[31] || ''; // Final EQ (column AG, index 31)
          
          allRows.push(rowData);
        }
      } else {
        const numColumnsNeeded = 28;
        const dataRange = subjectSheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, numColumnsNeeded);
        const data = dataRange.getValues();
        
        for (let j = 0; j < data.length; j++) {
          const row = data[j];
          const studentNumber = String(row[0] || '').trim();
          const studentName = String(row[1] || '').trim();
          
          if (!studentNumber) continue; // Skip empty rows
          
          // Create row data in the expected format (linear columns)
          const rowData = new Array(numColumns);
          rowData[0] = studentNumber; // Student Number
          rowData[1] = studentName; // Full Name
          rowData[2] = normalizedGradeLevel; // Grade Level
          rowData[3] = section; // Section
          rowData[4] = subjectName; // Subject
          rowData[5] = advisorName; // Teacher
          rowData[6] = row[5] || ''; // 1st Initial (column F, index 5)
          rowData[7] = row[6] || ''; // 1st Transmuted (column G, index 6)
          rowData[8] = row[7] || ''; // 1st EQ (column H, index 7)
          rowData[9] = row[11] || ''; // 2nd Initial (column L, index 11)
          rowData[10] = row[12] || ''; // 2nd Transmuted (column M, index 12)
          rowData[11] = row[13] || ''; // 2nd EQ (column N, index 13)
          rowData[12] = row[17] || ''; // 3rd Initial (column R, index 17)
          rowData[13] = row[18] || ''; // 3rd Transmuted (column S, index 18)
          rowData[14] = row[19] || ''; // 3rd EQ (column T, index 19)
          rowData[15] = row[23] || ''; // 4th Initial (column X, index 23)
          rowData[16] = row[24] || ''; // 4th Transmuted (column Y, index 24)
          rowData[17] = row[25] || ''; // 4th EQ (column Z, index 25)
          rowData[18] = row[26] || ''; // Final Grading (column AA, index 26)
          rowData[19] = row[27] || ''; // Final EQ (column AB, index 27)
          
          allRows.push(rowData);
        }
      }
    }

    if (allRows.length === 0) {
      return { 
        success: false, 
        message: 'No student grades found in OGS template. Please ensure the template contains student data.' 
      };
    }

    // Sort rows by Subject order (as they appear in OGS template), then by Student Number
    // This groups all students for the same subject together, preserving template order
    allRows.sort(function(a, b) {
      const subjectA = String(a[4] || '').trim();
      const subjectB = String(b[4] || '').trim();
      if (subjectA !== subjectB) {
        // Use the order from OGS template (subjectOrderMap)
        const orderA = subjectOrderMap.hasOwnProperty(subjectA) ? subjectOrderMap[subjectA] : 9999;
        const orderB = subjectOrderMap.hasOwnProperty(subjectB) ? subjectOrderMap[subjectB] : 9999;
        return orderA - orderB;
      }
      // If same subject, sort by student number
      const studentNumA = String(a[0] || '').trim();
      const studentNumB = String(b[0] || '').trim();
      return studentNumA.localeCompare(studentNumB);
    });

    // Get existing data to check for duplicates (Student Number + Subject combination)
    const lastRow = targetSheet.getLastRow();
    const existingKeys = new Map();
    
    if (lastRow > 1) {
      const existingRange = targetSheet.getRange(2, 1, lastRow - 1, numColumns);
      const existingValues = existingRange.getValues();
      
      for (let i = 0; i < existingValues.length; i++) {
        const studentNum = String(existingValues[i][0] || '').trim();
        const subject = String(existingValues[i][4] || '').trim();
        if (studentNum && subject) {
          existingKeys.set(`${studentNum}|${subject}`, i + 2);
        }
      }
    }

    // Prepare data for import/update
    const rowsToUpdate = [];
    const rowsToInsert = [];
    
    for (let i = 0; i < allRows.length; i++) {
      const rowData = allRows[i];
      const studentNumber = String(rowData[0] || '').trim();
      const subject = String(rowData[4] || '').trim();
      const key = `${studentNumber}|${subject}`;
      
      if (existingKeys.has(key)) {
        // Update existing row
        rowsToUpdate.push({
          row: existingKeys.get(key),
          data: rowData
        });
      } else {
        // Insert new row
        rowsToInsert.push(rowData);
      }
    }

    // Perform updates
    for (let i = 0; i < rowsToUpdate.length; i++) {
      const update = rowsToUpdate[i];
      targetSheet.getRange(update.row, 1, 1, numColumns).setValues([update.data]);
    }

    // Perform inserts
    if (rowsToInsert.length > 0) {
      const insertRow = lastRow + 1;
      targetSheet.getRange(insertRow, 1, rowsToInsert.length, numColumns).setValues(rowsToInsert);
    }

    const updatedCount = rowsToUpdate.length;
    const insertedCount = rowsToInsert.length;
    const totalSubjects = subjectSheets.length;

    return { 
      success: true, 
      message: `Successfully imported grades from ${totalSubjects} subject(s).\n\n` +
               `Updated: ${updatedCount} student(s)\n` +
               `Inserted: ${insertedCount} student(s)\n\n` +
               `Advisor: ${advisorName}\n` +
               `School Year: ${schoolYear}\n` +
               `Level: ${level}\n` +
               `Section: ${section}`
    };

  } catch (error) {
    console.error('Error importing grades:', error);
    return { 
      success: false, 
      message: `Error importing grades: ${error.toString()}` 
    };
  }
}

/**
 * Internal function to get grade information for a student-subject combination.
 * @param {string} studentNumber - The student number
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} subject - The subject name
 * @return {Object} Result object with grade data or error
 */
function _getGradeInfo(studentNumber, academicYearSheet, subject) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    if (!subject || subject.toString().trim() === '') {
      return { success: false, message: 'Subject must be specified' };
    }
    
    const targetSheet = getSheet(academicYearSheet);
    
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found' };
    }
    
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No grade data found in the sheet' };
    }
    
    // Get header row to find column indices
    const headerRow = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    
    // Expected column order: Student Number (0), Full Name (1), Grade Level (2), Section (3), 
    // Subject (4), Teacher (5), 1st Initial (6), 1st Transmuted (7), 1st EQ (8),
    // 2nd Initial (9), 2nd Transmuted (10), 2nd EQ (11),
    // 3rd Initial (12), 3rd Transmuted (13), 3rd EQ (14),
    // 4th Initial (15), 4th Transmuted (16), 4th EQ (17),
    // Final Grading (18), Final EQ (19)
    
    // Get all data starting from row 2
    const dataRange = targetSheet.getRange(2, 1, lastRow - 1, headerRow.length);
    const data = dataRange.getValues();
    
    // Find the row matching student number and subject
    for (let i = 0; i < data.length; i++) {
      const rowStudentNum = String(data[i][0] || '').trim();
      const rowSubject = String(data[i][4] || '').trim();
      
      if (rowStudentNum === studentNumber.toString().trim() && 
          rowSubject === subject.toString().trim()) {
        return {
          success: true,
          gradeData: {
            'Student Number': data[i][0],
            'Full Name': data[i][1],
            'Grade Level': data[i][2],
            'Section': data[i][3],
            'Subject': data[i][4],
            'Teacher': data[i][5],
            '1st Initial': data[i][6] || '',
            '1st Transmuted': data[i][7] || '',
            '1st EQ': data[i][8] || '',
            '2nd Initial': data[i][9] || '',
            '2nd Transmuted': data[i][10] || '',
            '2nd EQ': data[i][11] || '',
            '3rd Initial': data[i][12] || '',
            '3rd Transmuted': data[i][13] || '',
            '3rd EQ': data[i][14] || '',
            '4th Initial': data[i][15] || '',
            '4th Transmuted': data[i][16] || '',
            '4th EQ': data[i][17] || '',
            'Final Grading': data[i][18] || '',
            'Final EQ': data[i][19] || ''
          },
          rowIndex: i + 2 // Actual row number in sheet (1-based, +1 for header)
        };
      }
    }
    
    return { success: false, message: 'Grade record not found for the specified student and subject' };
    
  } catch (error) {
    console.error('Error getting grade info:', error);
    return { 
      success: false, 
      message: `Error retrieving grade data: ${error.toString()}` 
    };
  }
}

/**
 * Internal function to update grades and log the changes.
 * @param {string} studentNumber - The student number
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} subject - The subject name
 * @param {Object} gradeUpdates - Object with period keys (1st Initial, 2nd Initial, etc.) and new values
 * @param {string} remarks - Optional remarks about the update
 * @param {string} userEmail - The email of the user making the update
 * @return {Object} Result object with success status and message
 */
function _updateGrades(studentNumber, academicYearSheet, subject, gradeUpdates, remarks, userEmail) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    if (!subject || subject.toString().trim() === '') {
      return { success: false, message: 'Subject must be specified' };
    }
    
    if (!gradeUpdates || Object.keys(gradeUpdates).length === 0) {
      return { success: false, message: 'No grade updates provided' };
    }
    
    const targetSheet = getSheet(academicYearSheet);
    
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found' };
    }
    
    // Get current grade information
    const gradeInfo = _getGradeInfo(studentNumber, academicYearSheet, subject);
    
    if (!gradeInfo.success) {
      return gradeInfo;
    }
    
    // Column mapping for initial grades (0-based indices)
    const columnMap = {
      '1st Initial': 6,
      '2nd Initial': 9,
      '3rd Initial': 12,
      '4th Initial': 15
    };
    
    const updatedPeriods = [];
    const rowIndex = gradeInfo.rowIndex;
    
    // Update each grade period that was provided
    for (const period in gradeUpdates) {
      if (!columnMap.hasOwnProperty(period)) {
        continue; // Skip invalid periods
      }
      
      const newValue = gradeUpdates[period];
      const trimmedNewValue = newValue !== null && newValue !== undefined ? String(newValue).trim() : '';
      const oldValue = gradeInfo.gradeData[period] || '';
      const trimmedOldValue = oldValue !== null && oldValue !== undefined ? String(oldValue).trim() : '';
      
      // Check if the value is actually changing
      if (trimmedOldValue === trimmedNewValue) {
        continue; // Skip if no change
      }
      
      // Update the cell
      const columnIndex = columnMap[period] + 1; // Convert to 1-based index
      targetSheet.getRange(rowIndex, columnIndex).setValue(trimmedNewValue);
      targetSheet.getRange(rowIndex, columnIndex).setHorizontalAlignment('left');
      
      // Log the update
      logUpdate(
        studentNumber,
        gradeInfo.gradeData['Full Name'],
        academicYearSheet,
        subject,
        period,
        trimmedOldValue,
        trimmedNewValue,
        remarks || '',
        userEmail
      );
      
      updatedPeriods.push(period);
    }
    
    if (updatedPeriods.length === 0) {
      return { success: false, message: 'No grades were updated. All values are the same as current values.' };
    }
    
    return { 
      success: true, 
      message: `Successfully updated ${updatedPeriods.length} grade period(s) for ${subject}:\n${updatedPeriods.join(', ')}` 
    };
    
  } catch (error) {
    console.error('Error updating grades:', error);
    return { 
      success: false, 
      message: `Error updating grades: ${error.toString()}` 
    };
  }
}

/**
 * Logs the grade update to the UPDATE LOG sheet
 * @param {string} studentNumber - The student number
 * @param {string} fullName - The student's full name
 * @param {string} academicYear - The academic year (sheet name)
 * @param {string} subject - The subject name
 * @param {string} period - The grading period (1st Initial, 2nd Initial, etc.)
 * @param {string} originalGrade - The original grade value
 * @param {string} updatedGrade - The updated grade value
 * @param {string} remarks - Optional remarks
 * @param {string} userEmail - The email of the user making the update
 */
function logUpdate(studentNumber, fullName, academicYear, subject, period, originalGrade, updatedGrade, remarks, userEmail) {
  try {
    const spreadsheet = getSpreadsheet();
    let logSheet = spreadsheet.getSheetByName('UPDATE LOG');
    
    // If UPDATE LOG sheet doesn't exist, create it
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('UPDATE LOG');
      // Add headers
      const headers = ['Timestamp', 'Updated By', 'Student Number', 'Full Name', 'School Year', 'Subject', 'Period', 'Original Grade', 'Updated Grade', 'Remarks'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    
    // Use the passed userEmail parameter (from API) instead of Session.getActiveUser()
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    
    // Prepare log entry
    const timestamp = new Date();
    const logEntry = [
      timestamp,
      actualUserEmail,
      studentNumber,
      fullName,
      academicYear,
      subject,
      period,
      originalGrade,
      updatedGrade,
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

