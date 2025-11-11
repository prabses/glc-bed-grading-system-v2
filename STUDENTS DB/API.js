/**
 * API.js - API Architecture Layer for Student Database
 * This file contains all API-related functions for secure data operations
 * 
 * Functions in this file:
 * - doPost() - API endpoint handler
 * - callApi() - API client function
 * - Helper functions (getSpreadsheet, getSheet)
 * - Internal functions (_importStudentData, _getStudentInfo, _updateStudentInfo)
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
      case "importStudentData":
        return response(200, _importStudentData(payload.csvContent, payload.academicYearSheet));
      case "updateStudentInfo":
        return response(200, _updateStudentInfo(
          payload.studentNumber,
          payload.academicYearSheet,
          payload.fieldToUpdate,
          payload.newValue,
          payload.remarks,
          payload.userEmail
        ));
      case "getStudentInfo":
        return response(200, _getStudentInfo(payload.studentNumber, payload.academicYearSheet));
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
 * Internal function to import student data to the specified academic year sheet.
 * Maintains the exact format: Student Number, Last Name, First Name, Middle Name, Grade Level, Section, Strand, Gender
 * @param {string} csvContent - The CSV content as a string
 * @param {string} academicYearSheet - The name of the target sheet
 * @return {Object} Result object with success status and message
 */
function _importStudentData(csvContent, academicYearSheet) {
  try {
    // Validate inputs are not empty
    if (!csvContent || csvContent.toString().trim() === '') {
      return { success: false, message: 'CSV content cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    const spreadsheet = getSpreadsheet();
    let targetSheet = getSheet(academicYearSheet);
    
    // If sheet doesn't exist, create it
    if (!targetSheet) {
      targetSheet = spreadsheet.insertSheet(academicYearSheet);
    }
    
    // Parse CSV content
    const csvLines = csvContent.split('\n').filter(line => line.trim() !== '');
    if (csvLines.length === 0) {
      return { success: false, message: 'No data found in CSV file' };
    }
    
    // Parse CSV data with proper handling for student information format
    const csvData = [];
    for (let i = 0; i < csvLines.length; i++) {
      const line = csvLines[i];
      const row = parseCSVLine(line);
      csvData.push(row);
    }
    
    if (csvData.length === 0) {
      return { success: false, message: 'No valid data found in CSV file' };
    }
    
    // Validate expected headers for student information
    const expectedHeaders = CONFIG.EXPECTED_HEADERS;
    if (csvData.length > 0) {
      const headers = csvData[0];
      const headerMatch = expectedHeaders.every((expected, index) => 
        headers[index] && headers[index].trim().toLowerCase() === expected.toLowerCase()
      );
      
      if (!headerMatch) {
        return { 
          success: false, 
          message: `CSV format mismatch. Expected headers: ${expectedHeaders.join(', ')}` 
        };
      }
    }
    
    // Skip the header row from CSV and import only data rows
    const dataRows = csvData.slice(1); // Remove first row (headers)
    
    if (dataRows.length > 0) {
      // Get existing student numbers from column A (starting from row 3)
      const existingStudentNumbers = getExistingStudentNumbers(targetSheet);
      
      // Check for duplicate student numbers
      const duplicateNumbers = [];
      
      for (let i = 0; i < dataRows.length; i++) {
        const studentNumber = dataRows[i][0]; // First column (Student Number)
        
        if (existingStudentNumbers.includes(studentNumber)) {
          duplicateNumbers.push(studentNumber);
        }
      }
      
      // If ANY duplicates found, abort the entire import
      if (duplicateNumbers.length > 0) {
        return { 
          success: false, 
          message: `Import cancelled! Found ${duplicateNumbers.length} duplicate student number(s): ${duplicateNumbers.join(', ')}\n\nPlease remove duplicates from CSV file and try again.` 
        };
      }
      
      // If no duplicates, proceed with import
      // Find the next empty row to append data
      const lastRow = targetSheet.getLastRow();
      const startRow = lastRow + 1; // Start from the next empty row
      
      // Write the data rows to the sheet
      const range = targetSheet.getRange(startRow, 1, dataRows.length, dataRows[0].length);
      range.setValues(dataRows);
      
      // Set all imported data to left alignment to prevent auto-formatting
      range.setHorizontalAlignment('left');
      
      return { 
        success: true, 
        message: `Successfully imported ${dataRows.length} student records to ${academicYearSheet}` 
      };
    }
    
    return { 
      success: true, 
      message: `Successfully imported ${csvData.length - 1} student records to ${academicYearSheet}.\n\nHeaders: ${csvData[0].join(', ')}` 
    };
    
  } catch (error) {
    console.error('Error importing student data:', error);
    return { 
      success: false, 
      message: `Error importing data: ${error.toString()}` 
    };
  }
}

/**
 * Internal function to get student information by student number and academic year.
 * @param {string} studentNumber - The student number to search for
 * @param {string} academicYearSheet - The academic year sheet name
 * @return {Object} Result object with student data or error
 */
function _getStudentInfo(studentNumber, academicYearSheet) {
  try {
    // Validate student number is not empty
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    const spreadsheet = getSpreadsheet();
    const targetSheet = getSheet(academicYearSheet);
    
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found' };
    }
    
    const lastRow = targetSheet.getLastRow();
    if (lastRow < CONFIG.DATA_START_ROW) {
      return { success: false, message: 'No student data found in the sheet' };
    }
    
    // Get all data starting from row 3 (assuming headers are in rows 1-2)
    const dataRange = targetSheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.HEADER_ROWS, 8); // 8 columns for student data
    const data = dataRange.getValues();
    
    // Find the student by student number
    for (let i = 0; i < data.length; i++) {
      if (data[i][CONFIG.COLUMNS.STUDENT_NUMBER].toString().trim() === studentNumber.toString().trim()) {
        return {
          success: true,
          studentData: {
            'Student Number': data[i][CONFIG.COLUMNS.STUDENT_NUMBER],
            'Last Name': data[i][CONFIG.COLUMNS.LAST_NAME],
            'First Name': data[i][CONFIG.COLUMNS.FIRST_NAME],
            'Middle Name': data[i][CONFIG.COLUMNS.MIDDLE_NAME],
            'Grade Level': data[i][CONFIG.COLUMNS.GRADE_LEVEL],
            'Section': data[i][CONFIG.COLUMNS.SECTION],
            'Strand': data[i][CONFIG.COLUMNS.STRAND],
            'Gender': data[i][CONFIG.COLUMNS.GENDER]
          },
          rowIndex: i + CONFIG.DATA_START_ROW // Actual row number in sheet
        };
      }
    }
    
    return { success: false, message: 'Student number not found in the selected academic year' };
    
  } catch (error) {
    console.error('Error getting student info:', error);
    return { 
      success: false, 
      message: `Error retrieving student data: ${error.toString()}` 
    };
  }
}

/**
 * Internal function to update student information and log the change.
 * @param {string} studentNumber - The student number
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} fieldToUpdate - The field name to update
 * @param {string} newValue - The new value
 * @param {string} remarks - Optional remarks about the update
 * @param {string} userEmail - The email of the user making the update
 * @return {Object} Result object with success status and message
 */
function _updateStudentInfo(studentNumber, academicYearSheet, fieldToUpdate, newValue, remarks, userEmail) {
  try {
    // Validate inputs are not empty
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return { success: false, message: 'Student number cannot be empty' };
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    if (!fieldToUpdate || fieldToUpdate.toString().trim() === '') {
      return { success: false, message: 'Field to update must be specified' };
    }
    
    if (!newValue || newValue.toString().trim() === '') {
      return { success: false, message: 'New value cannot be empty' };
    }
    
    const spreadsheet = getSpreadsheet();
    const targetSheet = getSheet(academicYearSheet);
    
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found' };
    }
    
    // Get current student information
    const studentInfo = _getStudentInfo(studentNumber, academicYearSheet);
    
    if (!studentInfo.success) {
      return studentInfo;
    }
    
    // Get the column index for the field to update
    const columnIndex = CONFIG.FIELD_MAP[fieldToUpdate];
    
    if (!columnIndex) {
      return { success: false, message: 'Invalid field name' };
    }
    
    // Get the old value
    const oldValue = studentInfo.studentData[fieldToUpdate];
    
    // Trim the new value for consistency with import data handling
    const trimmedNewValue = newValue.toString().trim();
    
    // Check if the value is actually changing
    if (oldValue.toString().trim() === trimmedNewValue) {
      return { success: false, message: 'New value is the same as the current value' };
    }
    
    // Update the cell
    targetSheet.getRange(studentInfo.rowIndex, columnIndex).setValue(trimmedNewValue);
    targetSheet.getRange(studentInfo.rowIndex, columnIndex).setHorizontalAlignment('left');
    
    logUpdate(studentNumber, academicYearSheet, fieldToUpdate, oldValue, trimmedNewValue, remarks, userEmail);
    
    return { 
      success: true, 
      message: `Successfully updated ${fieldToUpdate} for student ${studentNumber}\nOld Value: ${oldValue}\nNew Value: ${trimmedNewValue}` 
    };
    
  } catch (error) {
    console.error('Error updating student info:', error);
    return { 
      success: false, 
      message: `Error updating student data: ${error.toString()}` 
    };
  }
}

