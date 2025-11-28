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
          payload.academicYearSheet,
          payload.userEmail
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
 * @param {string} userEmail - The email of the user making the import
 * @return {Object} Result object with success status and message
 */
function _importGrades(ogsTemplateUrl, academicYearSheet, userEmail) {
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
    let ogsSpreadsheetName = '';
    try {
      ogsSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
      ogsSpreadsheetName = ogsSpreadsheet.getName();
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
          
          const rowData = new Array(numColumns);
          rowData[0] = studentNumber;
          rowData[1] = studentName;
          rowData[2] = normalizedGradeLevel;
          rowData[3] = section;
          rowData[4] = subjectName;
          rowData[5] = advisorName;
          rowData[6] = '';
          rowData[7] = '';
          rowData[8] = '';
          rowData[9] = '';
          rowData[10] = '';
          rowData[11] = '';
          rowData[12] = '';
          rowData[13] = '';
          rowData[14] = '';
          rowData[15] = '';
          rowData[16] = '';
          rowData[17] = '';
          rowData[18] = '';
          rowData[19] = '';
          
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
          
          const rowData = new Array(numColumns);
          rowData[0] = studentNumber;
          rowData[1] = studentName;
          rowData[2] = normalizedGradeLevel;
          rowData[3] = section;
          rowData[4] = subjectName;
          rowData[5] = advisorName;
          rowData[6] = row[5] || '';
          rowData[7] = '';
          rowData[8] = '';
          rowData[9] = row[11] || '';
          rowData[10] = '';
          rowData[11] = '';
          rowData[12] = row[17] || '';
          rowData[13] = '';
          rowData[14] = '';
          rowData[15] = row[23] || '';
          rowData[16] = '';
          rowData[17] = '';
          rowData[18] = '';
          rowData[19] = '';
          
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
    // Find the actual last row with data (check column A for Student Number)
    const maxRows = targetSheet.getMaxRows();
    const studentNumberColumn = targetSheet.getRange(2, 1, maxRows - 1, 1).getValues();
    let lastDataRow = 1;
    
    for (let i = studentNumberColumn.length - 1; i >= 0; i--) {
      const studentNum = String(studentNumberColumn[i][0] || '').trim();
      if (studentNum) {
        lastDataRow = i + 2;
        break;
      }
    }
    
    const existingKeys = new Map();
    const existingDataMap = new Map();
    
    // Check if this OGS template was already imported (check for existing divider with same URL)
    let isReImport = false;
    let existingDividerRow = null;
    let existingImportEndRow = null;
    
    if (lastDataRow > 1) {
      const existingRange = targetSheet.getRange(2, 1, lastDataRow - 1, numColumns);
      const existingValues = existingRange.getValues();
      const existingFormulas = targetSheet.getRange(2, 1, lastDataRow - 1, 1).getFormulas();
      
      // Check for existing divider with same URL
      // Normalize URLs for comparison (remove trailing slashes, fragments, etc.)
      const normalizedImportUrl = ogsTemplateUrl.trim().split('#')[0].replace(/\/$/, '').toLowerCase();
      
      for (let i = 0; i < existingFormulas.length; i++) {
        const formula = existingFormulas[i][0];
        if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
          // Try multiple regex patterns to extract URL
          let urlMatch = formula.match(/HYPERLINK\("([^"]+)"/);
          if (!urlMatch) {
            urlMatch = formula.match(/HYPERLINK\('([^']+)'/);
          }
          if (!urlMatch) {
            urlMatch = formula.match(/HYPERLINK\(([^,]+)/);
          }
          if (urlMatch && urlMatch[1]) {
            let extractedUrl = urlMatch[1].trim();
            // Remove quotes if present
            extractedUrl = extractedUrl.replace(/^["']|["']$/g, '');
            const normalizedExistingUrl = extractedUrl.split('#')[0].replace(/\/$/, '').toLowerCase();
            
            // Compare URLs (handle both full URLs and spreadsheet IDs)
            const importSpreadsheetId = extractSpreadsheetId(ogsTemplateUrl);
            const existingSpreadsheetId = extractSpreadsheetId(extractedUrl);
            const urlMatches = normalizedExistingUrl === normalizedImportUrl || 
                              (importSpreadsheetId && existingSpreadsheetId && importSpreadsheetId === existingSpreadsheetId);
            
            if (urlMatches) {
              isReImport = true;
              existingDividerRow = i + 2;
              // Find the end of this import block (next divider or end of data)
              existingImportEndRow = lastDataRow + 1;
              for (let j = i + 1; j < existingFormulas.length; j++) {
                const nextFormula = existingFormulas[j][0];
                if (nextFormula && typeof nextFormula === 'string' && nextFormula.includes('HYPERLINK')) {
                  // Found next divider, so this import ends at row j+1 (before the next divider)
                  existingImportEndRow = j + 2;
                  break;
                }
              }
              break;
            }
          }
        }
      }
      
      // Build maps of existing data
      for (let i = 0; i < existingValues.length; i++) {
        const studentNum = String(existingValues[i][0] || '').trim();
        const subject = String(existingValues[i][4] || '').trim();
        if (studentNum && subject) {
          const key = `${studentNum}|${subject}`;
          existingKeys.set(key, i + 2);
          existingDataMap.set(key, existingValues[i]);
        }
      }
    }

    // Use the passed userEmail parameter (from API) instead of Session.getActiveUser()
    // doPost runs as script owner, so Session.getActiveUser() would return owner's email
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();

    // Prepare data for import/update
    const rowsToUpdate = [];
    const rowsToInsert = [];
    const gradeChangesToLog = [];
    
    for (let i = 0; i < allRows.length; i++) {
      const rowData = allRows[i];
      const studentNumber = String(rowData[0] || '').trim();
      const subject = String(rowData[4] || '').trim();
      const key = `${studentNumber}|${subject}`;
      
      if (existingKeys.has(key)) {
        const existingRowNum = existingKeys.get(key);
        const existingRow = existingDataMap.get(key);
        
        // Check if this is a re-import of the same OGS template
        const isFromSameImport = isReImport && existingDividerRow && existingImportEndRow &&
                                 existingRowNum > existingDividerRow && 
                                 existingRowNum < existingImportEndRow;
        
        // Always compare grades before updating (even if not from same import, to avoid unnecessary overwrites)
        const gradeColumns = [6, 9, 12, 15];
        const periodNames = ['1st Initial', '2nd Initial', '3rd Initial', '4th Initial'];
        let hasChanges = false;
        const changes = [];
        
        for (let j = 0; j < gradeColumns.length; j++) {
          const colIndex = gradeColumns[j];
          const oldValueRaw = existingRow[colIndex];
          const newValueRaw = rowData[colIndex];
          const oldValue = oldValueRaw !== null && oldValueRaw !== undefined ? String(oldValueRaw).trim() : '';
          const newValue = newValueRaw !== null && newValueRaw !== undefined ? String(newValueRaw).trim() : '';
          
          // Compare values (handle numbers and strings)
          // Convert to numbers if possible, otherwise compare as strings
          let valuesDifferent = false;
          if (oldValue && newValue) {
            const oldNum = parseFloat(oldValue);
            const newNum = parseFloat(newValue);
            if (!isNaN(oldNum) && !isNaN(newNum)) {
              valuesDifferent = Math.abs(oldNum - newNum) > 0.0001;
            } else {
              valuesDifferent = oldValue !== newValue;
            }
          } else if (oldValue !== newValue) {
            valuesDifferent = true;
          }
          
          if (valuesDifferent) {
            hasChanges = true;
            if (isFromSameImport) {
              changes.push({
                period: periodNames[j],
                oldValue: oldValue || '',
                newValue: newValue || ''
              });
            }
          }
        }
        
        if (hasChanges) {
          rowsToUpdate.push({
            row: existingRowNum,
            data: rowData
          });
          
          // Only log if it's from the same import (re-import scenario)
          if (isFromSameImport && changes.length > 0) {
            const fullName = String(rowData[1] || '').trim();
            for (let k = 0; k < changes.length; k++) {
              gradeChangesToLog.push({
                studentNumber: studentNumber,
                fullName: fullName,
                subject: subject,
                period: changes[k].period,
                oldValue: changes[k].oldValue,
                newValue: changes[k].newValue
              });
            }
          }
        }
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
    
    // Log grade changes from re-import
    for (let i = 0; i < gradeChangesToLog.length; i++) {
      const change = gradeChangesToLog[i];
      logUpdate(
        change.studentNumber,
        change.fullName,
        academicYearSheet,
        change.subject,
        change.period,
        change.oldValue,
        change.newValue,
        `Re-imported from: ${ogsSpreadsheetName || 'OGS Template'}`,
        actualUserEmail
      );
    }

    // Perform inserts
    if (rowsToInsert.length > 0) {
      const insertRow = lastDataRow + 1;
      
      // Add divider row with imported file link before the new data
      const linkLabel = ogsSpreadsheetName || 'OGS Template';
      const dividerRow = new Array(numColumns);
      dividerRow[0] = '';
      for (let i = 1; i < numColumns; i++) {
        dividerRow[i] = '';
      }
      
      // Insert divider row
      targetSheet.getRange(insertRow, 1, 1, numColumns).setValues([dividerRow]);
      targetSheet.getRange(insertRow, 1, 1, numColumns).merge();
      
      // Set hyperlink formula in the merged cell
      const hyperlinkFormula = `=HYPERLINK("${ogsTemplateUrl}","${linkLabel}")`;
      targetSheet.getRange(insertRow, 1).setFormula(hyperlinkFormula);
      
      // Style the divider row
      targetSheet.getRange(insertRow, 1).setBackground('#d9d9d9');
      targetSheet.getRange(insertRow, 1).setFontStyle('italic');
      targetSheet.getRange(insertRow, 1).setFontColor('#1155cc');
      targetSheet.getRange(insertRow, 1).setFontSize(10);
      targetSheet.getRange(insertRow, 1).setHorizontalAlignment('left');
      targetSheet.getRange(insertRow, 1).setVerticalAlignment('middle');
      targetSheet.setRowHeight(insertRow, 25);
      
      // Insert data rows after the divider
      const dataInsertRow = insertRow + 1;
      targetSheet.getRange(dataInsertRow, 1, rowsToInsert.length, numColumns).setValues(rowsToInsert);
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
    
    // Period order for chronological logging
    const periodOrder = ['1st Initial', '2nd Initial', '3rd Initial', '4th Initial'];
    
    const updatedPeriods = [];
    const rowIndex = gradeInfo.rowIndex;
    const updatesToLog = []; // Collect updates to log in chronological order
    
    // Process updates in chronological order
    for (let i = 0; i < periodOrder.length; i++) {
      const period = periodOrder[i];
      
      if (!gradeUpdates.hasOwnProperty(period) || !columnMap.hasOwnProperty(period)) {
        continue; // Skip if not provided or invalid
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
      
      // Store update for logging in chronological order
      updatesToLog.push({
        period: period,
        oldValue: trimmedOldValue,
        newValue: trimmedNewValue
      });
      
      updatedPeriods.push(period);
    }
    
    // Log updates in chronological order
    for (let i = 0; i < updatesToLog.length; i++) {
      const update = updatesToLog[i];
      logUpdate(
        studentNumber,
        gradeInfo.gradeData['Full Name'],
        academicYearSheet,
        subject,
        update.period,
        update.oldValue,
        update.newValue,
        remarks || '',
        userEmail
      );
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

