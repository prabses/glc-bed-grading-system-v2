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
    // Subject sheets typically don't have names like "Attendance", "Characters", "MAPEH"
    const excludedSheetNames = ['Attendance', 'Characters', 'MAPEH'];
    let infoSheet = null;
    let attendanceSheet = null;
    let subjectSheets = [];
    
    for (let i = 0; i < ogsSheets.length; i++) {
      const sheetName = ogsSheets[i].getName();
      if (sheetName === 'Attendance') {
        attendanceSheet = ogsSheets[i];
      } else if (!excludedSheetNames.includes(sheetName)) {
        if (!infoSheet) {
          infoSheet = ogsSheets[i]; // Use first subject sheet for info
        }
        subjectSheets.push({
          name: sheetName,
          sheet: ogsSheets[i]
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
    if (!advisorName || !schoolYear || !level || !section) {
      return { 
        success: false, 
        message: 'Could not extract required information from OGS template. Please ensure the template has proper headers (Advisor Name, School Year, Level, Section).' 
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
    
    // Find column indices
    const columnMap = {};
    for (let i = 0; i < headerRow.length; i++) {
      const header = String(headerRow[i] || '').trim();
      columnMap[header] = i;
    }

    // Required columns
    const requiredColumns = ['Student Number', 'Full Name', 'Grade Level', 'Section', 'Teacher', 'School Year'];
    for (let i = 0; i < requiredColumns.length; i++) {
      if (!columnMap.hasOwnProperty(requiredColumns[i])) {
        return { 
          success: false, 
          message: `Required column "${requiredColumns[i]}" not found in target sheet. Please ensure the sheet has the correct structure.` 
        };
      }
    }

    // Collect grades from all subject sheets
    // Data starts at row 10 (after headers)
    // Student Number is column A (index 0)
    // Student Name is column B (index 1)
    // Final Grading is column AA (index 26)
    const studentGrades = {}; // Key: studentNumber, Value: { name, grades: { subject: grade } }
    
    for (let i = 0; i < subjectSheets.length; i++) {
      const subjectSheet = subjectSheets[i].sheet;
      const subjectName = subjectSheets[i].name;
      
      const lastRow = subjectSheet.getLastRow();
      if (lastRow < 10) continue; // Skip if no data
      
      // Get student data (columns A, B, AA) starting from row 10
      const dataRange = subjectSheet.getRange(10, 1, lastRow - 9, 27); // Up to column AA
      const data = dataRange.getValues();
      
      for (let j = 0; j < data.length; j++) {
        const row = data[j];
        const studentNumber = String(row[0] || '').trim();
        const studentName = String(row[1] || '').trim();
        const finalGrade = row[26]; // Column AA (Final Grading)
        
        if (!studentNumber) continue; // Skip empty rows
        
        if (!studentGrades[studentNumber]) {
          studentGrades[studentNumber] = {
            name: studentName,
            grades: {}
          };
        }
        
        // Store the final grade for this subject
        if (finalGrade !== null && finalGrade !== undefined && finalGrade !== '') {
          studentGrades[studentNumber].grades[subjectName] = finalGrade;
        }
      }
    }

    if (Object.keys(studentGrades).length === 0) {
      return { 
        success: false, 
        message: 'No student grades found in OGS template. Please ensure the template contains student data.' 
      };
    }

    // Get existing data from target sheet to find existing students
    const lastRow = targetSheet.getLastRow();
    const existingData = {};
    
    if (lastRow > 1) {
      const existingRange = targetSheet.getRange(2, 1, lastRow - 1, targetSheet.getLastColumn());
      const existingValues = existingRange.getValues();
      
      for (let i = 0; i < existingValues.length; i++) {
        const studentNum = String(existingValues[i][columnMap['Student Number']] || '').trim();
        if (studentNum) {
          existingData[studentNum] = i + 2; // Row number (1-based, +1 for header row)
        }
      }
    }

    // Prepare data for import/update
    const rowsToUpdate = [];
    const rowsToInsert = [];
    
    for (const studentNumber in studentGrades) {
      const studentData = studentGrades[studentNumber];
      const rowData = new Array(headerRow.length);
      
      // Set required columns
      rowData[columnMap['Student Number']] = studentNumber;
      rowData[columnMap['Full Name']] = studentData.name;
      rowData[columnMap['Grade Level']] = normalizedGradeLevel;
      rowData[columnMap['Section']] = section;
      rowData[columnMap['Teacher']] = advisorName;
      rowData[columnMap['School Year']] = schoolYear;
      
      // Set subject grades
      for (const subjectName in studentData.grades) {
        if (columnMap.hasOwnProperty(subjectName)) {
          rowData[columnMap[subjectName]] = studentData.grades[subjectName];
        }
      }
      
      // Calculate average grade if Average Grade column exists
      if (columnMap.hasOwnProperty('Average Grade')) {
        const grades = [];
        for (const subjectName in studentData.grades) {
          const grade = studentData.grades[subjectName];
          if (grade !== null && grade !== undefined && grade !== '' && !isNaN(grade)) {
            grades.push(parseFloat(grade));
          }
        }
        if (grades.length > 0) {
          const sum = grades.reduce((a, b) => a + b, 0);
          rowData[columnMap['Average Grade']] = sum / grades.length;
        }
      }
      
      if (existingData.hasOwnProperty(studentNumber)) {
        // Update existing row
        rowsToUpdate.push({
          row: existingData[studentNumber],
          data: rowData
        });
      } else {
        // Insert new row
        rowsToInsert.push(rowData);
      }
    }

    // Perform updates
    const numColumns = headerRow.length;
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

