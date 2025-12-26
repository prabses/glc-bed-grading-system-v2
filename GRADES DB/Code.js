/**
 * Google Apps Script for Grades Database
 * This script provides functionality for filtering student data by various criteria
 */

/**
 * Creates the custom menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu("Upload")
    .addItem("Import Student Grades", "showImportGradesDialog")
    .addItem("Update Student Grades", "showUpdateGradesDialog")
    .addToUi();

  ui.createMenu("Manual")
    .addItem("Open Working Instruction", "showWorkingInstructions")
    .addToUi();
}

/**
 * Gets the list of sheets that follow the YYYY-YYYY format (e.g., "2024-2025")
 * @return {Array} Array of sheet names matching the academic year format
 */
function getStudentSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();
  const sheetNames = [];
  
  // Regular expression to match YYYY-YYYY format (4 digits, hyphen, 4 digits)
  const yearPattern = /^\d{4}-\d{4}$/;
  
  for (let i = 0; i < sheets.length; i++) {
    const sheetName = sheets[i].getName().trim();
    // Only include sheets that match the YYYY-YYYY format
    if (yearPattern.test(sheetName)) {
      sheetNames.push(sheetName);
    }
  }
  
  return sheetNames;
}

/**
 * Shows the import grades dialog with HTML interface
 * Can be used on any sheet
 */
function showImportGradesDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("ImportGradesDialog")
    .setWidth(500)
    .setHeight(550)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Import Student Grades");
}

/**
 * Client-callable function to import grades via API.
 * This function is called from the client-side HTML form.
 * @param {string} ogsTemplateUrl - The URL of the OGS template Google Sheet
 * @param {string} academicYearSheet - The name of the target academic year sheet
 * @return {Object} Result object with success status and message
 */
function importGrades(ogsTemplateUrl, academicYearSheet) {
  const userEmail = Session.getActiveUser().getEmail();
  console.log(
    "Function importGrades executed by: " + userEmail
  );
  return callApi("importGrades", { ogsTemplateUrl, academicYearSheet, userEmail });
}

/**
 * Shows the update grades dialog with HTML interface
 */
function showUpdateGradesDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("UpdateGradesDialog")
    .setWidth(1100)
    .setHeight(700)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Update Student Grades");
}

/**
 * Gets unique student numbers from an academic year sheet
 * @param {string} academicYearSheet - The academic year sheet name
 * @return {Array} Array of unique student numbers
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
    
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }
    
    // Get all student numbers from column A (starting from row 2)
    const studentNumberRange = targetSheet.getRange(2, 1, lastRow - 1, 1);
    const studentNumbers = studentNumberRange.getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();
    
    // Get unique student numbers, excluding divider rows (rows with HYPERLINK formulas)
    const uniqueNumbers = new Set();
    for (let i = 0; i < studentNumbers.length; i++) {
      const formula = formulas[i][0];
      // Skip divider rows (rows with HYPERLINK formulas)
      if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
        continue;
      }
      
      const studentNum = String(studentNumbers[i][0] || '').trim();
      if (studentNum) {
        uniqueNumbers.add(studentNum);
      }
    }
    
    return Array.from(uniqueNumbers).sort();
  } catch (error) {
    console.error('Error getting student numbers:', error);
    return [];
  }
}

/**
 * Gets unique subjects for a student in an academic year sheet
 * @param {string} studentNumber - The student number
 * @param {string} academicYearSheet - The academic year sheet name
 * @return {Array} Array of unique subject names
 */
function getSubjects(studentNumber, academicYearSheet) {
  try {
    if (!studentNumber || studentNumber.toString().trim() === '') {
      return [];
    }
    
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return [];
    }
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
    
    if (!targetSheet) {
      return [];
    }
    
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }
    
    // Get all data (Student Number is column A, Subject is column E)
    const dataRange = targetSheet.getRange(2, 1, lastRow - 1, 5);
    const data = dataRange.getValues();
    
    // Get unique subjects for this student
    const uniqueSubjects = [];
    const seenSubjects = new Set();
    for (let i = 0; i < data.length; i++) {
      const studentNum = String(data[i][0] || '').trim();
      const subject = String(data[i][4] || '').trim();
      if (studentNum === studentNumber && subject && !seenSubjects.has(subject)) {
        uniqueSubjects.push(subject);
        seenSubjects.add(subject);
      }
    }
    
    return uniqueSubjects;
  } catch (error) {
    console.error('Error getting subjects:', error);
    return [];
  }
}

/**
 * Client-callable function to get grade information via API.
 * @param {string} studentNumber - The student number
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} subject - The subject name
 * @return {Object} Result object with grade data or error
 */
function getGradeInfo(studentNumber, academicYearSheet, subject) {
  console.log(
    "Function getGradeInfo executed by: " + Session.getActiveUser().getEmail()
  );
  return callApi("getGradeInfo", { studentNumber, academicYearSheet, subject });
}

/**
 * Client-callable function to update grades via API.
 * @param {string} studentNumber - The student number
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} subject - The subject name
 * @param {Object} gradeUpdates - Object with period keys (1st Initial, 2nd Initial, etc.) and new values
 * @param {string} remarks - Optional remarks about the update
 * @return {Object} Result object with success status and message
 */
function updateGrades(studentNumber, academicYearSheet, subject, gradeUpdates, remarks) {
  const userEmail = Session.getActiveUser().getEmail();
  console.log("Function updateGrades executed by: " + userEmail);
  
  return callApi("updateGrades", {
    studentNumber,
    academicYearSheet,
    subject,
    gradeUpdates,
    remarks,
    userEmail
  });
}

function getAllGradeInfo(studentNumber, academicYearSheet) {
  console.log("Function getAllGradeInfo executed by: " + Session.getActiveUser().getEmail());
  return callApi("getAllGradeInfo", { studentNumber, academicYearSheet });
}

function updateMultipleGrades(studentNumber, academicYearSheet, updates) {
  const userEmail = Session.getActiveUser().getEmail();
  console.log("Function updateMultipleGrades executed by: " + userEmail);
  return callApi("updateMultipleGrades", {
    studentNumber,
    academicYearSheet,
    updates,
    userEmail
  });
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
