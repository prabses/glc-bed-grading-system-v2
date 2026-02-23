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

function getAttendanceSpreadsheet() {
  const url = CONFIG.ATTENDANCE_DB_SHEET_URL;
  if (!url) return null;
  try {
    return SpreadsheetApp.openById(extractSpreadsheetId(url));
  } catch (e) {
    return null;
  }
}

function getCharacterSpreadsheet() {
  const url = CONFIG.CHARACTER_DB_SHEET_URL;
  if (!url) return null;
  try {
    return SpreadsheetApp.openById(extractSpreadsheetId(url));
  } catch (e) {
    return null;
  }
}

function getAttendanceSheet(sheetName) {
  const ss = getAttendanceSpreadsheet();
  return ss ? ss.getSheetByName(sheetName) : null;
}

function getCharacterSheet(sheetName) {
  const ss = getCharacterSpreadsheet();
  return ss ? ss.getSheetByName(sheetName) : null;
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
      case "getAllGradeInfo":
        return response(200, _getAllGradeInfo(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.gradeLevel
        ));
      case "updateMultipleGrades":
        return response(200, _updateMultipleGrades(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.updates,
          payload.userEmail
        ));
      case "importAttendance":
        return response(200, _importAttendance(
          payload.ogsTemplateUrl,
          payload.academicYearSheet,
          payload.userEmail
        ));
      case "getAttendanceInfo":
        return response(200, _getAttendanceInfo(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.section,
          payload.month
        ));
      case "updateAttendance":
        return response(200, _updateAttendance(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.section,
          payload.month,
          payload.schoolDays,
          payload.daysPresent,
          payload.daysAbsent,
          payload.remarks,
          payload.userEmail
        ));
      case "importCharacters":
        return response(200, _importCharacters(
          payload.ogsTemplateUrl,
          payload.academicYearSheet,
          payload.userEmail
        ));
      case "getCharacterInfo":
        return response(200, _getCharacterInfo(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.section,
          payload.trait
        ));
      case "updateCharacter":
        return response(200, _updateCharacter(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.section,
          payload.trait,
          payload.firstGrade,
          payload.secondGrade,
          payload.thirdGrade,
          payload.fourthGrade,
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
    
    const infoData = infoSheet.getRange(startRow, 1, startRow + 3, 2).getValues();
    
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

    if (!section || section.toString().trim() === '') {
      section = 'ALL';
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

    // Detect SHS from OGS template filename (GRADE-11 or GRADE-12 in name)
    const isSHS = /GRADE-11|GRADE-12/i.test(ogsSpreadsheetName || '');

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
    
    // Expected column count: Student#(0), Full Name(1), Grade Level(2), Section(3), Subject(4),
    // Semester(5), Strand(6), Teacher(7), 1st-4th Initial/Transmuted/EQ(8-19), Final Grading(20), Final EQ(21)
    const expectedColumnCount = 22;
    
    if (numColumns < expectedColumnCount) {
      return { 
        success: false, 
        message: `Target sheet should have at least ${expectedColumnCount} columns. Found ${numColumns} columns.` 
      };
    }

    const allRows = []; // Array of row data arrays
    const subjectOrderMap = {};
    let firstStrand = '';
    let firstSemester = '';
    for (let i = 0; i < subjectSheets.length; i++) {
      subjectOrderMap[subjectSheets[i].name] = i;
    }
    
    for (let i = 0; i < subjectSheets.length; i++) {
      const subjectSheet = subjectSheets[i].sheet;
      const subjectName = subjectSheets[i].name;
      const isMAPEH = subjectSheets[i].isMAPEH || false;
      
      let strandVal = '';
      let semesterVal = '';
      if (isSHS && !isMAPEH) {
        const strandCell = subjectSheet.getRange(8, 2).getValue();
        const semesterCell = subjectSheet.getRange(9, 2).getValue();
        strandVal = String(strandCell || '').trim();
        semesterVal = String(semesterCell || '').trim();
        if (!firstStrand && strandVal) firstStrand = strandVal;
        if (!firstSemester && semesterVal) firstSemester = semesterVal;
      }
      
      const dataStartRow = isSHS ? 12 : 10;
      const lastRow = subjectSheet.getLastRow();
      if (lastRow < (isSHS ? 11 : 9)) continue;
      if (lastRow < dataStartRow) continue;
      
      if (isMAPEH) {
        const numColumnsNeeded = 32;
        const dataRange = subjectSheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, numColumnsNeeded);
        const data = dataRange.getValues();
        
        for (let j = 0; j < data.length; j++) {
          const row = data[j];
          const studentNumber = String(row[0] || '').trim();
          const studentName = String(row[1] || '').trim();
          if (!studentNumber) continue;
          
          const rowData = new Array(expectedColumnCount);
          rowData[0] = studentNumber;
          rowData[1] = studentName;
          rowData[2] = normalizedGradeLevel;
          rowData[3] = section;
          rowData[4] = subjectName;
          rowData[5] = 'N/A';
          rowData[6] = 'N/A';
          rowData[7] = advisorName;
          for (let k = 8; k < expectedColumnCount; k++) rowData[k] = '';
          allRows.push(rowData);
        }
      } else if (isSHS) {
        const numColumnsNeeded = 16;
        const dataRange = subjectSheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, numColumnsNeeded);
        const data = dataRange.getValues();
        
        for (let j = 0; j < data.length; j++) {
          const row = data[j];
          const studentNumber = String(row[0] || '').trim();
          const studentName = String(row[1] || '').trim();
          if (!studentNumber) continue;
          
          const rowData = new Array(expectedColumnCount);
          rowData[0] = studentNumber;
          rowData[1] = studentName;
          rowData[2] = normalizedGradeLevel;
          rowData[3] = section;
          rowData[4] = subjectName;
          rowData[5] = semesterVal || 'N/A';
          rowData[6] = strandVal || 'N/A';
          rowData[7] = advisorName;
          rowData[8] = row[5] || '';
          rowData[9] = '';
          rowData[10] = '';
          rowData[11] = row[11] || '';
          rowData[12] = '';
          rowData[13] = '';
          rowData[14] = '';
          rowData[15] = '';
          rowData[16] = '';
          rowData[17] = '';
          rowData[18] = '';
          rowData[19] = '';
          rowData[20] = '';
          rowData[21] = '';
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
          if (!studentNumber) continue;
          
          const rowData = new Array(expectedColumnCount);
          rowData[0] = studentNumber;
          rowData[1] = studentName;
          rowData[2] = normalizedGradeLevel;
          rowData[3] = section;
          rowData[4] = subjectName;
          rowData[5] = 'N/A';
          rowData[6] = 'N/A';
          rowData[7] = advisorName;
          rowData[8] = row[5] || '';
          rowData[9] = '';
          rowData[10] = '';
          rowData[11] = row[11] || '';
          rowData[12] = '';
          rowData[13] = '';
          rowData[14] = row[17] || '';
          rowData[15] = '';
          rowData[16] = '';
          rowData[17] = row[23] || '';
          rowData[18] = '';
          rowData[19] = '';
          rowData[20] = '';
          rowData[21] = '';
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
        
        // Always compare grades before updating (1st, 2nd, 3rd, 4th Initial - cols 8, 11, 14, 17)
        const gradeColumns = [8, 11, 14, 17];
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
               `Section: ${section}`,
      gradeLevel: normalizedGradeLevel,
      section: section,
      teacher: advisorName,
      semester: firstSemester || 'N/A',
      strand: firstStrand || 'N/A'
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
    // Subject (4), Semester (5), Strand (6), Teacher (7),
    // 1st Initial (8), 1st Transmuted (9), 1st EQ (10),
    // 2nd Initial (11), 2nd Transmuted (12), 2nd EQ (13),
    // 3rd Initial (14), 3rd Transmuted (15), 3rd EQ (16),
    // 4th Initial (17), 4th Transmuted (18), 4th EQ (19),
    // Final Grading (20), Final EQ (21)
    
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
            'Semester': data[i][5] || '',
            'Strand': data[i][6] || '',
            'Teacher': data[i][7],
            '1st Initial': data[i][8] || '',
            '1st Transmuted': data[i][9] || '',
            '1st EQ': data[i][10] || '',
            '2nd Initial': data[i][11] || '',
            '2nd Transmuted': data[i][12] || '',
            '2nd EQ': data[i][13] || '',
            '3rd Initial': data[i][14] || '',
            '3rd Transmuted': data[i][15] || '',
            '3rd EQ': data[i][16] || '',
            '4th Initial': data[i][17] || '',
            '4th Transmuted': data[i][18] || '',
            '4th EQ': data[i][19] || '',
            'Final Grading': data[i][20] || '',
            'Final EQ': data[i][21] || ''
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
    
    // Column mapping for initial grades (0-based indices, after Semester/Strand columns)
    const columnMap = {
      '1st Initial': 8,
      '2nd Initial': 11,
      '3rd Initial': 14,
      '4th Initial': 17
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

function _importLogHyperlink(url, label) {
  if (!url || !label) return '';
  return '=HYPERLINK("' + String(url).replace(/"/g, '""') + '","' + String(label).replace(/"/g, '""') + '")';
}

/**
 * Appends one row to the IMPORT LOG sheet (created if missing).
 * @param {string} ogsTemplateUrl - OGS template sheet URL
 * @param {string} academicYearSheet - Academic year sheet name
 * @param {string} userEmail - User who ran the import
 * @param {string} [gradeLevel] - Grade level from OGS template
 * @param {string} [section] - Section from OGS template
 * @param {string} [semester] - Semester (SHS) or N/A
 * @param {string} [strand] - Strand (SHS) or N/A
 * @param {string} [teacher] - Teacher/Advisor name from OGS template
 * @param {string} [spreadsheetId] - Grades DB spreadsheet ID (use when active spreadsheet is not set, e.g. when run from dialog)
 */
function logImport(ogsTemplateUrl, academicYearSheet, userEmail, gradeLevel, section, semester, strand, teacher, spreadsheetId) {
  try {
    const spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : getSpreadsheet();
    let logSheet = spreadsheet.getSheetByName('IMPORT LOG');
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('IMPORT LOG');
      const headers = ['Timestamp', 'Imported By', 'Academic Year', 'Grade Level', 'Section', 'Semester', 'Strand', 'Teacher', 'OGS Template Link', 'Grades DB Link', 'Attendance DB Link', 'Character DB Link'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    const timestamp = new Date();
    const ogsLink = _importLogHyperlink(ogsTemplateUrl, 'OGS Template');
    const gradesDbLink = _importLogHyperlink(CONFIG.GRADES_DB_SHEET_URL || '', CONFIG.GRADES_DB_SHEET_LABEL || 'Grades DB');
    const attendanceDbLink = _importLogHyperlink(CONFIG.ATTENDANCE_DB_SHEET_URL || '', CONFIG.ATTENDANCE_DB_SHEET_LABEL || 'Attendance DB');
    const characterDbLink = _importLogHyperlink(CONFIG.CHARACTER_DB_SHEET_URL || '', CONFIG.CHARACTER_DB_SHEET_LABEL || 'Character DB');
    const logEntry = [
      timestamp,
      userEmail || '',
      academicYearSheet || '',
      gradeLevel || '',
      section || '',
      semester || '',
      strand || '',
      teacher || '',
      ogsLink,
      gradesDbLink,
      attendanceDbLink,
      characterDbLink
    ];
    const lastRow = logSheet.getLastRow();
    const nextRow = lastRow + 1;
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setValues([logEntry]);
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setHorizontalAlignment('left');
    logSheet.getRange(nextRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  } catch (error) {
    console.error('Error logging import:', error);
  }
}

function logAttendanceUpdate(studentNumber, fullName, academicYear, month, period, originalValue, updatedValue, remarks, userEmail) {
  try {
    const spreadsheet = getAttendanceSpreadsheet();
    if (!spreadsheet) return;
    let logSheet = spreadsheet.getSheetByName('UPDATE LOG');
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('UPDATE LOG');
      const headers = ['Timestamp', 'Updated By', 'Student Number', 'Full Name', 'School Year', 'Month', 'Period', 'Original Value', 'Updated Value', 'Remarks'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const logEntry = [new Date(), actualUserEmail, studentNumber, fullName, academicYear, month || '', period || '', originalValue, updatedValue, remarks || ''];
    const nextRow = logSheet.getLastRow() + 1;
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setValues([logEntry]);
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setHorizontalAlignment('left');
    logSheet.getRange(nextRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  } catch (error) {
    console.error('Error logging attendance update:', error);
  }
}

function _importAttendance(ogsTemplateUrl, academicYearSheet, userEmail) {
  const expectedColumnCount = 9;
  try {
    if (!ogsTemplateUrl || ogsTemplateUrl.toString().trim() === '') {
      return { success: false, message: 'OGS template URL cannot be empty' };
    }
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    const spreadsheetId = extractSpreadsheetId(ogsTemplateUrl);
    let ogsSpreadsheet;
    let ogsSpreadsheetName = '';
    try {
      ogsSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
      ogsSpreadsheetName = ogsSpreadsheet.getName();
    } catch (error) {
      return { success: false, message: `Cannot access OGS template. Error: ${error.message}` };
    }
    const attendanceSheet = ogsSpreadsheet.getSheetByName('Attendance');
    if (!attendanceSheet) {
      return { success: false, message: 'Attendance sheet not found in OGS template.' };
    }
    const infoData = attendanceSheet.getRange(1, 1, 5, 2).getValues();
    let advisorName = '';
    let schoolYear = '';
    let level = '';
    let section = '';
    for (let i = 0; i < infoData.length; i++) {
      const label = String(infoData[i][0] || '').trim();
      const value = String(infoData[i][1] || '').trim();
      if (label.includes('Advisor Name') || label.includes('Teacher Name')) advisorName = value;
      else if (label.includes('School Year')) schoolYear = value;
      else if (label.includes('Level')) level = value;
      else if (label.includes('Section')) section = value;
    }
    if (!section || section.toString().trim() === '') section = 'ALL';
    if (!advisorName || !level || !section) {
      return { success: false, message: 'Could not extract required information from Attendance sheet.' };
    }
    const normalizedGradeLevel = normalizeGradeLevel(level);
    const lastCol = attendanceSheet.getLastColumn();
    const lastRow = attendanceSheet.getLastRow();
    if (lastRow < 8) {
      return { success: false, message: 'No student attendance data found in Attendance sheet.' };
    }
    const monthRow = attendanceSheet.getRange(6, 1, 6, lastCol).getValues()[0];
    const ogsMonths = [];
    for (let c = 2; c < lastCol; c += 3) {
      const monthVal = String(monthRow[c] || '').trim();
      if (monthVal) ogsMonths.push({ name: monthVal, ogsStartCol: c });
    }
    if (ogsMonths.length === 0) {
      return { success: false, message: 'No month columns found in Attendance sheet (row 6).' };
    }
    const targetSheet = getAttendanceSheet(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: `Academic year sheet "${academicYearSheet}" not found in Attendance DB.` };
    }
    const headerRow = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    const numColumns = headerRow.length;
    if (numColumns < expectedColumnCount) {
      return { success: false, message: `Target sheet should have at least ${expectedColumnCount} columns. Found ${numColumns}.` };
    }
    const dataStartRow = 8;
    const studentData = attendanceSheet.getRange(dataStartRow, 1, lastRow, lastCol).getValues();
    const allRows = [];
    for (let j = 0; j < studentData.length; j++) {
      const row = studentData[j];
      const studentNumber = String(row[0] || '').trim();
      const studentName = String(row[1] || '').trim();
      if (!studentNumber) continue;
      for (let m = 0; m < ogsMonths.length; m++) {
        const ogsCol = ogsMonths[m].ogsStartCol;
        const schoolDays = row[ogsCol] !== null && row[ogsCol] !== undefined ? String(row[ogsCol]).trim() : '';
        const daysPresent = row[ogsCol + 1] !== null && row[ogsCol + 1] !== undefined ? String(row[ogsCol + 1]).trim() : '';
        allRows.push([studentNumber, studentName, normalizedGradeLevel, section, advisorName, ogsMonths[m].name, schoolDays, daysPresent, '']);
      }
    }
    if (allRows.length === 0) {
      return { success: false, message: 'No student attendance records found in Attendance sheet.' };
    }
    allRows.sort((a, b) => String(a[0] || '').localeCompare(String(b[0] || '')));
    const sheetLastRow = targetSheet.getLastRow();
    const rangeEnd = Math.max(2, sheetLastRow);
    const studentNumberColumn = targetSheet.getRange(2, 1, rangeEnd, 1).getValues();
    const lastRowFormulas = targetSheet.getRange(2, 1, rangeEnd, 1).getFormulas();
    let lastDataRow = 1;
    for (let i = studentNumberColumn.length - 1; i >= 0; i--) {
      if (lastRowFormulas[i][0] && typeof lastRowFormulas[i][0] === 'string' && lastRowFormulas[i][0].includes('HYPERLINK')) continue;
      const studentNum = String(studentNumberColumn[i][0] || '').trim();
      if (studentNum) { lastDataRow = i + 2; break; }
    }
    const existingKeys = new Map();
    const existingDataMap = new Map();
    let isReImport = false;
    let existingDividerRow = null;
    let existingImportEndRow = null;
    if (lastDataRow > 1) {
      const existingRange = targetSheet.getRange(2, 1, lastDataRow, numColumns);
      const existingValues = existingRange.getValues();
      const existingFormulas = targetSheet.getRange(2, 1, lastDataRow, 1).getFormulas();
      const normalizedImportUrl = ogsTemplateUrl.trim().split('#')[0].replace(/\/$/, '').toLowerCase();
      for (let i = 0; i < existingFormulas.length; i++) {
        const formula = existingFormulas[i][0];
        if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
          const urlMatch = formula.match(/HYPERLINK\("([^"]+)"/) || formula.match(/HYPERLINK\('([^']+)'/);
          if (urlMatch && urlMatch[1]) {
            const extractedUrl = urlMatch[1].trim().replace(/^["']|["']$/g, '');
            const normalizedExistingUrl = extractedUrl.split('#')[0].replace(/\/$/, '').toLowerCase();
            const importId = extractSpreadsheetId(ogsTemplateUrl);
            const existingId = extractedUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
            if (normalizedExistingUrl === normalizedImportUrl || (importId && existingId && importId === existingId)) {
              isReImport = true;
              existingDividerRow = i + 2;
              existingImportEndRow = lastDataRow + 1;
              for (let j = i + 1; j < existingFormulas.length; j++) {
                if (existingFormulas[j][0] && typeof existingFormulas[j][0] === 'string' && existingFormulas[j][0].includes('HYPERLINK')) {
                  existingImportEndRow = j + 2;
                  break;
                }
              }
              break;
            }
          }
        }
      }
      for (let i = 0; i < existingValues.length; i++) {
        const studentNum = String(existingValues[i][0] || '').trim();
        const rowSection = String(existingValues[i][3] || '').trim();
        const month = String(existingValues[i][5] || '').trim();
        if (studentNum && rowSection && month) {
          existingKeys.set(`${studentNum}|${rowSection}|${month}`, i + 2);
          existingDataMap.set(`${studentNum}|${rowSection}|${month}`, existingValues[i]);
        }
      }
    }
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const rowsToUpdate = [];
    const rowsToInsert = [];
    const attendanceChangesToLog = [];
    for (let i = 0; i < allRows.length; i++) {
      const rowData = allRows[i];
      const studentNumber = String(rowData[0] || '').trim();
      const month = String(rowData[5] || '').trim();
      const key = `${studentNumber}|${section}|${month}`;
      if (existingKeys.has(key)) {
        const existingRowNum = existingKeys.get(key);
        const existingRow = existingDataMap.get(key);
        const isFromSameImport = isReImport && existingDividerRow && existingImportEndRow && existingRowNum > existingDividerRow && existingRowNum < existingImportEndRow;
        let hasChanges = false;
        const changes = [];
        for (let col = 6; col < 8; col++) {
          const oldVal = existingRow[col] !== null && existingRow[col] !== undefined ? String(existingRow[col]).trim() : '';
          const newVal = rowData[col] !== null && rowData[col] !== undefined ? String(rowData[col]).trim() : '';
          if (oldVal !== newVal) {
            hasChanges = true;
            if (isFromSameImport) changes.push({ period: ['School DAYS', 'Days PRESENT'][col - 6], oldValue: oldVal, newValue: newVal });
          }
        }
        if (hasChanges) {
          const dataToWrite = rowData.slice();
          dataToWrite[8] = existingRow[8] !== undefined ? existingRow[8] : '';
          rowsToUpdate.push({ row: existingRowNum, data: dataToWrite });
          if (isFromSameImport && changes.length > 0) {
            changes.forEach(c => {
              attendanceChangesToLog.push({ studentNumber, fullName: String(rowData[1] || '').trim(), month, period: c.period, oldValue: c.oldValue, newValue: c.newValue });
            });
          }
        }
      } else {
        rowsToInsert.push(rowData);
      }
    }
    for (let i = 0; i < rowsToUpdate.length; i++) {
      const update = rowsToUpdate[i];
      const padData = update.data.slice();
      while (padData.length < numColumns) padData.push('');
      targetSheet.getRange(update.row, 1, 1, numColumns).setValues([padData.slice(0, numColumns)]);
    }
    for (let i = 0; i < attendanceChangesToLog.length; i++) {
      const c = attendanceChangesToLog[i];
      logAttendanceUpdate(c.studentNumber, c.fullName, academicYearSheet, c.month, c.period, c.oldValue, c.newValue, `Re-imported from: ${ogsSpreadsheetName || 'OGS Template'}`, actualUserEmail);
    }
    if (rowsToInsert.length > 0) {
      const insertRow = lastDataRow + 1;
      const linkLabel = ogsSpreadsheetName || 'OGS Template';
      const dividerRow = new Array(numColumns).fill('');
      targetSheet.getRange(insertRow, 1, 1, numColumns).setValues([dividerRow]);
      targetSheet.getRange(insertRow, 1, 1, numColumns).merge();
      targetSheet.getRange(insertRow, 1).setFormula(`=HYPERLINK("${ogsTemplateUrl}","${linkLabel}")`);
      targetSheet.getRange(insertRow, 1).setBackground('#d9d9d9').setFontStyle('italic').setFontColor('#1155cc').setFontSize(10).setHorizontalAlignment('left').setVerticalAlignment('middle');
      targetSheet.setRowHeight(insertRow, 25);
      const dataInsertRow = insertRow + 1;
      const paddedRows = rowsToInsert.map(r => { const arr = r.slice(); while (arr.length < numColumns) arr.push(''); return arr.slice(0, numColumns); });
      targetSheet.getRange(dataInsertRow, 1, paddedRows.length, numColumns).setValues(paddedRows);
    }
    return { success: true, message: `Successfully imported attendance.\n\nUpdated: ${rowsToUpdate.length} row(s)\nInserted: ${rowsToInsert.length} row(s)\n\nAdvisor: ${advisorName}\nSchool Year: ${schoolYear}\nLevel: ${level}\nSection: ${section}` };
  } catch (error) {
    console.error('Error importing attendance:', error);
    return { success: false, message: `Error importing attendance: ${error.toString()}` };
  }
}

function _getAttendanceInfo(studentNumber, academicYearSheet, section, month) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') return { success: false, message: 'Student number cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };
    if (!section || section.toString().trim() === '') return { success: false, message: 'Section must be specified' };
    if (!month || month.toString().trim() === '') return { success: false, message: 'Month must be specified' };
    const targetSheet = getAttendanceSheet(academicYearSheet);
    if (!targetSheet) return { success: false, message: 'Academic year sheet not found' };
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'No attendance data found in the sheet' };
    const numCols = Math.max(9, targetSheet.getLastColumn());
    const data = targetSheet.getRange(2, 1, lastRow, numCols).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
    const studentNum = studentNumber.toString().trim();
    const sectionTrim = section.toString().trim();
    const monthTrim = month.toString().trim();
    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
      const row = data[i];
      if (String(row[0] || '').trim() === studentNum && String(row[3] || '').trim() === sectionTrim && String(row[5] || '').trim() === monthTrim) {
        return { success: true, attendanceData: { 'Student Number': row[0], 'Full Name': row[1], 'Grade Level': row[2], 'Section': row[3], 'Advisor': row[4], 'Month': row[5], 'School DAYS': row[6] || '', 'Days PRESENT': row[7] || '', 'Days ABSENT': row[8] || '' }, rowIndex: i + 2 };
      }
    }
    return { success: false, message: 'Attendance record not found for the specified student, section, and month' };
  } catch (error) {
    console.error('Error getting attendance info:', error);
    return { success: false, message: `Error retrieving attendance: ${error.toString()}` };
  }
}

function _updateAttendance(studentNumber, academicYearSheet, section, month, schoolDays, daysPresent, daysAbsent, remarks, userEmail) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') return { success: false, message: 'Student number cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };
    if (!section || section.toString().trim() === '') return { success: false, message: 'Section must be specified' };
    if (!month || month.toString().trim() === '') return { success: false, message: 'Month must be specified' };
    const info = _getAttendanceInfo(studentNumber, academicYearSheet, section, month);
    if (!info.success) return info;
    const targetSheet = getAttendanceSheet(academicYearSheet);
    const rowIndex = info.rowIndex;
    const updates = [];
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    if (schoolDays !== undefined && schoolDays !== null) {
      const oldVal = String(info.attendanceData['School DAYS'] || '').trim();
      const newVal = String(schoolDays).trim();
      if (oldVal !== newVal) {
        targetSheet.getRange(rowIndex, 7).setValue(newVal);
        logAttendanceUpdate(studentNumber, info.attendanceData['Full Name'], academicYearSheet, info.attendanceData['Month'], 'School DAYS', oldVal, newVal, remarks || '', actualUserEmail);
        updates.push('School DAYS');
      }
    }
    if (daysPresent !== undefined && daysPresent !== null) {
      const oldVal = String(info.attendanceData['Days PRESENT'] || '').trim();
      const newVal = String(daysPresent).trim();
      if (oldVal !== newVal) {
        targetSheet.getRange(rowIndex, 8).setValue(newVal);
        logAttendanceUpdate(studentNumber, info.attendanceData['Full Name'], academicYearSheet, info.attendanceData['Month'], 'Days PRESENT', oldVal, newVal, remarks || '', actualUserEmail);
        updates.push('Days PRESENT');
      }
    }
    if (updates.length === 0) return { success: false, message: 'No changes detected. All values are the same as current values.' };
    return { success: true, message: `Successfully updated: ${updates.join(', ')}` };
  } catch (error) {
    console.error('Error updating attendance:', error);
    return { success: false, message: `Error updating attendance: ${error.toString()}` };
  }
}

const CHAR_EXPECTED_COLS = 16;
const CHAR_HEADER_ROW = ['Student#', 'Full Name', 'Grade Level', 'Section', 'Advisor', 'Trait', '1st Grade', '1st EQ', '2nd Grade', '2nd EQ', '3rd Grade', '3rd EQ', '4th Grade', '4th EQ', 'Final Grading', 'Final EQ'];

function logCharacterUpdate(studentNumber, fullName, academicYear, trait, period, originalValue, updatedValue, remarks, userEmail) {
  try {
    const spreadsheet = getCharacterSpreadsheet();
    if (!spreadsheet) return;
    let logSheet = spreadsheet.getSheetByName('UPDATE LOG');
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('UPDATE LOG');
      const headers = ['Timestamp', 'Updated By', 'Student Number', 'Full Name', 'School Year', 'Trait', 'Period', 'Original Value', 'Updated Value', 'Remarks'];
      logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      logSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const logEntry = [new Date(), actualUserEmail, studentNumber, fullName, academicYear, trait || '', period || '', originalValue, updatedValue, remarks || ''];
    const nextRow = logSheet.getLastRow() + 1;
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setValues([logEntry]);
    logSheet.getRange(nextRow, 1, 1, logEntry.length).setHorizontalAlignment('left');
    logSheet.getRange(nextRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  } catch (error) {
    console.error('Error logging character update:', error);
  }
}

function _importCharacters(ogsTemplateUrl, academicYearSheet, userEmail) {
  try {
    if (!ogsTemplateUrl || ogsTemplateUrl.toString().trim() === '') return { success: false, message: 'OGS template URL cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };
    const spreadsheetId = extractSpreadsheetId(ogsTemplateUrl);
    let ogsSpreadsheet;
    let ogsSpreadsheetName = '';
    try {
      ogsSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
      ogsSpreadsheetName = ogsSpreadsheet.getName();
    } catch (error) {
      return { success: false, message: `Cannot access OGS template. Error: ${error.message}` };
    }
    const characterSheet = ogsSpreadsheet.getSheetByName('Character');
    if (!characterSheet) return { success: false, message: 'Character sheet not found in OGS template.' };
    const infoData = characterSheet.getRange(1, 1, 5, 2).getValues();
    let advisorName = '';
    let schoolYear = '';
    let level = '';
    let section = '';
    for (let i = 0; i < infoData.length; i++) {
      const label = String(infoData[i][0] || '').trim();
      const value = String(infoData[i][1] || '').trim();
      if (label.includes('Advisor Name') || label.includes('Teacher Name')) advisorName = value;
      else if (label.includes('School Year')) schoolYear = value;
      else if (label.includes('Level')) level = value;
      else if (label.includes('Section')) section = value;
    }
    if (!section || section.toString().trim() === '') section = 'ALL';
    if (!advisorName || !level || !section) return { success: false, message: 'Could not extract required information from Character sheet.' };
    const normalizedGradeLevel = normalizeGradeLevel(level);
    const lastCol = characterSheet.getLastColumn();
    const lastRow = characterSheet.getLastRow();
    if (lastRow < 8) return { success: false, message: 'No student character data found in Character sheet.' };
    const isSHS = (lastCol === 9);
    const dataStartRow = 8;
    const studentData = characterSheet.getRange(dataStartRow, 1, lastRow, lastCol).getValues();
    const allRows = [];
    for (let j = 0; j < studentData.length; j++) {
      const row = studentData[j];
      const studentNumber = String(row[0] || '').trim();
      const studentName = String(row[1] || '').trim();
      const trait = String(row[2] || '').trim();
      if (!studentNumber || !trait) continue;
      const targetRow = new Array(CHAR_EXPECTED_COLS);
      targetRow[0] = studentNumber; targetRow[1] = studentName; targetRow[2] = normalizedGradeLevel; targetRow[3] = section; targetRow[4] = advisorName; targetRow[5] = trait;
      targetRow[7] = ''; targetRow[9] = ''; targetRow[11] = ''; targetRow[13] = ''; targetRow[14] = ''; targetRow[15] = '';
      if (isSHS) {
        targetRow[6] = row[3] !== undefined ? String(row[3]).trim() : '';
        targetRow[8] = row[5] !== undefined ? String(row[5]).trim() : '';
        targetRow[10] = ''; targetRow[12] = '';
      } else {
        targetRow[6] = row[3] !== undefined ? String(row[3]).trim() : '';
        targetRow[8] = row[5] !== undefined ? String(row[5]).trim() : '';
        targetRow[10] = row[7] !== undefined ? String(row[7]).trim() : '';
        targetRow[12] = row[9] !== undefined ? String(row[9]).trim() : '';
      }
      allRows.push(targetRow);
    }
    if (allRows.length === 0) return { success: false, message: 'No student character records found in Character sheet.' };
    allRows.sort((a, b) => { const sn = String(a[0] || '').localeCompare(String(b[0] || '')); if (sn !== 0) return sn; return String(a[5] || '').localeCompare(String(b[5] || '')); });
    const targetSheet = getCharacterSheet(academicYearSheet);
    if (!targetSheet) return { success: false, message: `Academic year sheet "${academicYearSheet}" not found in Character DB.` };
    if (targetSheet.getLastRow() < 1) {
      targetSheet.getRange(1, 1, 1, CHAR_EXPECTED_COLS).setValues([CHAR_HEADER_ROW]);
      targetSheet.getRange(1, 1, 1, CHAR_EXPECTED_COLS).setFontWeight('bold');
    }
    const headerRow = targetSheet.getRange(1, 1, 1, Math.max(targetSheet.getLastColumn(), CHAR_EXPECTED_COLS)).getValues()[0];
    const numColumns = Math.max(headerRow.length, CHAR_EXPECTED_COLS);
    if (numColumns < CHAR_EXPECTED_COLS) return { success: false, message: `Target sheet should have at least ${CHAR_EXPECTED_COLS} columns. Found ${numColumns}.` };
    const rangeEnd = Math.max(2, targetSheet.getLastRow());
    const studentNumberColumn = targetSheet.getRange(2, 1, rangeEnd, 1).getValues();
    const lastRowFormulas = targetSheet.getRange(2, 1, rangeEnd, 1).getFormulas();
    let lastDataRow = 1;
    for (let i = studentNumberColumn.length - 1; i >= 0; i--) {
      if (lastRowFormulas[i][0] && typeof lastRowFormulas[i][0] === 'string' && lastRowFormulas[i][0].includes('HYPERLINK')) continue;
      const studentNum = String(studentNumberColumn[i][0] || '').trim();
      if (studentNum) { lastDataRow = i + 2; break; }
    }
    const existingKeys = new Map();
    const existingDataMap = new Map();
    let isReImport = false;
    let existingDividerRow = null;
    let existingImportEndRow = null;
    if (lastDataRow > 1) {
      const existingRange = targetSheet.getRange(2, 1, lastDataRow, numColumns);
      const existingValues = existingRange.getValues();
      const existingFormulas = targetSheet.getRange(2, 1, lastDataRow, 1).getFormulas();
      const normalizedImportUrl = ogsTemplateUrl.trim().split('#')[0].replace(/\/$/, '').toLowerCase();
      for (let i = 0; i < existingFormulas.length; i++) {
        const formula = existingFormulas[i][0];
        if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
          const urlMatch = formula.match(/HYPERLINK\("([^"]+)"/) || formula.match(/HYPERLINK\('([^']+)'/);
          if (urlMatch && urlMatch[1]) {
            const extractedUrl = urlMatch[1].trim().replace(/^["']|["']$/g, '');
            const normalizedExistingUrl = extractedUrl.split('#')[0].replace(/\/$/, '').toLowerCase();
            const importId = extractSpreadsheetId(ogsTemplateUrl);
            const existingId = extractedUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
            if (normalizedExistingUrl === normalizedImportUrl || (importId && existingId && importId === existingId)) {
              isReImport = true;
              existingDividerRow = i + 2;
              existingImportEndRow = lastDataRow + 1;
              for (let j = i + 1; j < existingFormulas.length; j++) {
                if (existingFormulas[j][0] && typeof existingFormulas[j][0] === 'string' && existingFormulas[j][0].includes('HYPERLINK')) { existingImportEndRow = j + 2; break; }
              }
              break;
            }
          }
        }
      }
      for (let i = 0; i < existingValues.length; i++) {
        const studentNum = String(existingValues[i][0] || '').trim();
        const rowSection = String(existingValues[i][3] || '').trim();
        const trait = String(existingValues[i][5] || '').trim();
        if (studentNum && rowSection && trait) {
          existingKeys.set(`${studentNum}|${rowSection}|${trait}`, i + 2);
          existingDataMap.set(`${studentNum}|${rowSection}|${trait}`, existingValues[i]);
        }
      }
    }
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const rowsToUpdate = [];
    const rowsToInsert = [];
    const characterChangesToLog = [];
    const gradeColIndices = [6, 8, 10, 12];
    const gradeNames = ['1st Grade', '2nd Grade', '3rd Grade', '4th Grade'];
    for (let i = 0; i < allRows.length; i++) {
      const rowData = allRows[i];
      const studentNumber = String(rowData[0] || '').trim();
      const trait = String(rowData[5] || '').trim();
      const key = `${studentNumber}|${section}|${trait}`;
      if (existingKeys.has(key)) {
        const existingRowNum = existingKeys.get(key);
        const existingRow = existingDataMap.get(key);
        const isFromSameImport = isReImport && existingDividerRow && existingImportEndRow && existingRowNum > existingDividerRow && existingRowNum < existingImportEndRow;
        let hasChanges = false;
        const dataToWrite = rowData.slice();
        for (let g = 0; g < gradeColIndices.length; g++) {
          const col = gradeColIndices[g];
          const oldVal = existingRow[col] !== null && existingRow[col] !== undefined ? String(existingRow[col]).trim() : '';
          const newVal = rowData[col] !== null && rowData[col] !== undefined ? String(rowData[col]).trim() : '';
          if (oldVal !== newVal) {
            hasChanges = true;
            if (isFromSameImport) characterChangesToLog.push({ studentNumber, fullName: String(rowData[1] || '').trim(), trait, period: gradeNames[g], oldValue: oldVal, newValue: newVal });
          }
        }
        for (let c = 7; c <= 15; c += 2) if (existingRow[c] !== undefined) dataToWrite[c] = existingRow[c];
        if (existingRow[14] !== undefined) dataToWrite[14] = existingRow[14];
        if (existingRow[15] !== undefined) dataToWrite[15] = existingRow[15];
        if (hasChanges) rowsToUpdate.push({ row: existingRowNum, data: dataToWrite });
      } else {
        rowsToInsert.push(rowData);
      }
    }
    for (let i = 0; i < rowsToUpdate.length; i++) {
      const update = rowsToUpdate[i];
      const padData = update.data.slice();
      while (padData.length < numColumns) padData.push('');
      targetSheet.getRange(update.row, 1, 1, numColumns).setValues([padData.slice(0, numColumns)]);
    }
    for (let i = 0; i < characterChangesToLog.length; i++) {
      const c = characterChangesToLog[i];
      logCharacterUpdate(c.studentNumber, c.fullName, academicYearSheet, c.trait, c.period, c.oldValue, c.newValue, `Re-imported from: ${ogsSpreadsheetName || 'OGS Template'}`, actualUserEmail);
    }
    if (rowsToInsert.length > 0) {
      const insertRow = lastDataRow + 1;
      const linkLabel = ogsSpreadsheetName || 'OGS Template';
      const dividerRow = new Array(numColumns).fill('');
      targetSheet.getRange(insertRow, 1, 1, numColumns).setValues([dividerRow]);
      targetSheet.getRange(insertRow, 1, 1, numColumns).merge();
      targetSheet.getRange(insertRow, 1).setFormula(`=HYPERLINK("${ogsTemplateUrl}","${linkLabel}")`);
      targetSheet.getRange(insertRow, 1).setBackground('#d9d9d9').setFontStyle('italic').setFontColor('#1155cc').setFontSize(10).setHorizontalAlignment('left').setVerticalAlignment('middle');
      targetSheet.setRowHeight(insertRow, 25);
      const dataInsertRow = insertRow + 1;
      const paddedRows = rowsToInsert.map(r => { const arr = r.slice(); while (arr.length < numColumns) arr.push(''); return arr.slice(0, numColumns); });
      targetSheet.getRange(dataInsertRow, 1, paddedRows.length, numColumns).setValues(paddedRows);
    }
    return { success: true, message: `Successfully imported character data.\n\nUpdated: ${rowsToUpdate.length} row(s)\nInserted: ${rowsToInsert.length} row(s)\n\nAdvisor: ${advisorName}\nSchool Year: ${schoolYear}\nLevel: ${level}\nSection: ${section}` };
  } catch (error) {
    console.error('Error importing characters:', error);
    return { success: false, message: `Error importing character data: ${error.toString()}` };
  }
}

function _getCharacterInfo(studentNumber, academicYearSheet, section, trait) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') return { success: false, message: 'Student number cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };
    if (!section || section.toString().trim() === '') return { success: false, message: 'Section must be specified' };
    if (!trait || trait.toString().trim() === '') return { success: false, message: 'Trait must be specified' };
    const targetSheet = getCharacterSheet(academicYearSheet);
    if (!targetSheet) return { success: false, message: 'Academic year sheet not found' };
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'No character data found in the sheet' };
    const numCols = Math.max(CHAR_EXPECTED_COLS, targetSheet.getLastColumn());
    const data = targetSheet.getRange(2, 1, lastRow, numCols).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
    const studentNum = studentNumber.toString().trim();
    const sectionTrim = section.toString().trim();
    const traitTrim = trait.toString().trim();
    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
      const row = data[i];
      if (String(row[0] || '').trim() === studentNum && String(row[3] || '').trim() === sectionTrim && String(row[5] || '').trim() === traitTrim) {
        return { success: true, characterData: { 'Student Number': row[0], 'Full Name': row[1], 'Grade Level': row[2], 'Section': row[3], 'Advisor': row[4], 'Trait': row[5], '1st Grade': row[6] || '', '1st EQ': row[7] || '', '2nd Grade': row[8] || '', '2nd EQ': row[9] || '', '3rd Grade': row[10] || '', '3rd EQ': row[11] || '', '4th Grade': row[12] || '', '4th EQ': row[13] || '', 'Final Grading': row[14] || '', 'Final EQ': row[15] || '' }, rowIndex: i + 2 };
      }
    }
    return { success: false, message: 'Character record not found for the specified student, section, and trait' };
  } catch (error) {
    console.error('Error getting character info:', error);
    return { success: false, message: `Error retrieving character data: ${error.toString()}` };
  }
}

function _updateCharacter(studentNumber, academicYearSheet, section, trait, firstGrade, secondGrade, thirdGrade, fourthGrade, remarks, userEmail) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') return { success: false, message: 'Student number cannot be empty' };
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') return { success: false, message: 'Academic year must be specified' };
    if (!section || section.toString().trim() === '') return { success: false, message: 'Section must be specified' };
    if (!trait || trait.toString().trim() === '') return { success: false, message: 'Trait must be specified' };
    const info = _getCharacterInfo(studentNumber, academicYearSheet, section, trait);
    if (!info.success) return info;
    const targetSheet = getCharacterSheet(academicYearSheet);
    const rowIndex = info.rowIndex;
    const updates = [];
    const actualUserEmail = userEmail || Session.getActiveUser().getEmail();
    const gradeUpdates = [{ col: 7, key: '1st Grade', value: firstGrade }, { col: 9, key: '2nd Grade', value: secondGrade }, { col: 11, key: '3rd Grade', value: thirdGrade }, { col: 13, key: '4th Grade', value: fourthGrade }];
    for (let u = 0; u < gradeUpdates.length; u++) {
      const g = gradeUpdates[u];
      if (g.value === undefined || g.value === null) continue;
      const oldVal = String(info.characterData[g.key] || '').trim();
      const newVal = String(g.value).trim();
      if (oldVal !== newVal) {
        targetSheet.getRange(rowIndex, g.col).setValue(newVal);
        logCharacterUpdate(studentNumber, info.characterData['Full Name'], academicYearSheet, info.characterData['Trait'], g.key, oldVal, newVal, remarks || '', actualUserEmail);
        updates.push(g.key);
      }
    }
    if (updates.length === 0) return { success: false, message: 'No changes detected. All values are the same as current values.' };
    return { success: true, message: `Successfully updated: ${updates.join(', ')}` };
  } catch (error) {
    console.error('Error updating character:', error);
    return { success: false, message: `Error updating character: ${error.toString()}` };
  }
}

function _getAllGradeInfo(studentNumber, academicYearSheet, gradeLevel) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    if (!gradeLevel || gradeLevel.toString().trim() === '') {
      return { success: false, message: 'Grade level must be specified' };
    }
    
    const targetSheet = getSheet(academicYearSheet);
    
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found' };
    }
    
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No grade data found in the sheet' };
    }
    
    const headerRow = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    const dataRange = targetSheet.getRange(2, 1, lastRow - 1, headerRow.length);
    const data = dataRange.getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();
    
    const gradeLevelTrim = gradeLevel.toString().trim();
    const allGradeData = [];
    let studentInfo = null;
    
    for (let i = 0; i < data.length; i++) {
      const formula = formulas[i][0];
      if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
        continue;
      }
      
      const rowStudentNum = String(data[i][0] || '').trim();
      const rowGradeLevel = String(data[i][2] || '').trim();
      const rowSubject = String(data[i][4] || '').trim();
      
      if (rowStudentNum === studentNumber.toString().trim() && rowGradeLevel === gradeLevelTrim && rowSubject) {
        if (!studentInfo) {
          studentInfo = {
            'Student Number': data[i][0],
            'Full Name': data[i][1],
            'Grade Level': data[i][2],
            'Section': data[i][3],
            'Strand': data[i][6] || ''
          };
        }
        
        allGradeData.push({
          'Subject': data[i][4],
          'Semester': data[i][5] || '',
          'Strand': data[i][6] || '',
          'Teacher': data[i][7],
          '1st Initial': data[i][8] || '',
          '1st Transmuted': data[i][9] || '',
          '1st EQ': data[i][10] || '',
          '2nd Initial': data[i][11] || '',
          '2nd Transmuted': data[i][12] || '',
          '2nd EQ': data[i][13] || '',
          '3rd Initial': data[i][14] || '',
          '3rd Transmuted': data[i][15] || '',
          '3rd EQ': data[i][16] || '',
          '4th Initial': data[i][17] || '',
          '4th Transmuted': data[i][18] || '',
          '4th EQ': data[i][19] || '',
          'Final Grading': data[i][20] || '',
          'Final EQ': data[i][21] || ''
        });
      }
    }
    
    if (allGradeData.length === 0) {
      return { success: false, message: 'No grade records found for the specified student and grade level' };
    }
    
    return {
      success: true,
      studentInfo: studentInfo,
      gradeData: allGradeData
    };
    
  } catch (error) {
    console.error('Error getting all grade info:', error);
    return { 
      success: false, 
      message: `Error retrieving grade data: ${error.toString()}` 
    };
  }
}

function _updateMultipleGrades(studentNumber, academicYearSheet, updates, userEmail) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return { success: false, message: 'No updates provided' };
    }
    
    const results = [];
    let totalUpdated = 0;
    let totalPeriodsUpdated = 0;
    
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      const { subject, gradeUpdates, remarks } = update;
      
      if (!subject || !gradeUpdates || Object.keys(gradeUpdates).length === 0) {
        continue;
      }
      
      const updateResult = _updateGrades(
        studentNumber,
        academicYearSheet,
        subject,
        gradeUpdates,
        remarks || '',
        userEmail
      );
      
      if (updateResult.success) {
        totalUpdated++;
        const periodCount = Object.keys(gradeUpdates).length;
        totalPeriodsUpdated += periodCount;
        results.push({
          subject: subject,
          success: true,
          message: updateResult.message
        });
      } else {
        results.push({
          subject: subject,
          success: false,
          message: updateResult.message
        });
      }
    }
    
    if (totalUpdated === 0) {
      return { 
        success: false, 
        message: 'No grades were updated. Please check your input values.' 
      };
    }
    
    return {
      success: true,
      message: `Successfully updated ${totalPeriodsUpdated} grade period(s) across ${totalUpdated} subject(s)`,
      results: results
    };
    
  } catch (error) {
    console.error('Error updating multiple grades:', error);
    return { 
      success: false, 
      message: `Error updating grades: ${error.toString()}` 
    };
  }
}

