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

  ui.createMenu("Export")
    .addItem("Export Student Grades", "showExportGradesDialog")
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

/**
 * Shows the export grades dialog with HTML interface
 */
function showExportGradesDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("ExportGradesDialog")
    .setWidth(500)
    .setHeight(600)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Export Student Grades");
}

/**
 * Gets unique grade levels from an academic year sheet
 * @param {string} academicYearSheet - The academic year sheet name
 * @return {Array} Array of unique grade levels
 */
function getGradeLevels(academicYearSheet) {
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
    
    const dataRange = targetSheet.getRange(2, 3, lastRow - 1, 1);
    const gradeLevels = dataRange.getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();
    
    const uniqueLevels = new Set();
    for (let i = 0; i < gradeLevels.length; i++) {
      const formula = formulas[i][0];
      if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
        continue;
      }
      
      const level = String(gradeLevels[i][0] || '').trim();
      if (level) {
        uniqueLevels.add(level);
      }
    }
    
    return Array.from(uniqueLevels).sort();
  } catch (error) {
    console.error('Error getting grade levels:', error);
    return [];
  }
}

/**
 * Gets unique sections from an academic year sheet filtered by grade level
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} gradeLevel - The grade level to filter by
 * @return {Array} Array of unique sections
 */
function getSections(academicYearSheet, gradeLevel) {
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
    
    const dataRange = targetSheet.getRange(2, 1, lastRow - 1, 4);
    const data = dataRange.getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();
    
    const uniqueSections = new Set();
    for (let i = 0; i < data.length; i++) {
      const formula = formulas[i][0];
      if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
        continue;
      }
      
      const rowGradeLevel = String(data[i][2] || '').trim();
      const section = String(data[i][3] || '').trim();
      
      if (rowGradeLevel === gradeLevel && section) {
        uniqueSections.add(section);
      }
    }
    
    return Array.from(uniqueSections).sort();
  } catch (error) {
    console.error('Error getting sections:', error);
    return [];
  }
}

/**
 * Gets unique subjects from an academic year sheet filtered by grade level and section
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} gradeLevel - The grade level to filter by
 * @param {string} section - The section to filter by
 * @return {Array} Array of unique subjects
 */
function getSubjectsForExport(academicYearSheet, gradeLevel, section) {
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
    
    const dataRange = targetSheet.getRange(2, 1, lastRow - 1, 5);
    const data = dataRange.getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();
    
    const uniqueSubjects = new Set();
    for (let i = 0; i < data.length; i++) {
      const formula = formulas[i][0];
      if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
        continue;
      }
      
      const rowGradeLevel = String(data[i][2] || '').trim();
      const rowSection = String(data[i][3] || '').trim();
      const subject = String(data[i][4] || '').trim();
      
      if (rowGradeLevel === gradeLevel && rowSection === section && subject) {
        uniqueSubjects.add(subject);
      }
    }
    
    return Array.from(uniqueSubjects).sort();
  } catch (error) {
    console.error('Error getting subjects:', error);
    return [];
  }
}

/**
 * Exports grades to CSV format
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} gradeLevel - The grade level to filter by
 * @param {string} section - The section to filter by
 * @param {string} subject - The subject to filter by
 * @return {Object} Result object with CSV data or error
 */
function exportGrades(academicYearSheet, gradeLevel, section, subject) {
  try {
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }
    
    if (!gradeLevel || gradeLevel.toString().trim() === '') {
      return { success: false, message: 'Grade level must be specified' };
    }
    
    if (!section || section.toString().trim() === '') {
      return { success: false, message: 'Section must be specified' };
    }
    
    if (!subject || subject.toString().trim() === '') {
      return { success: false, message: 'Subject must be specified' };
    }
    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
    
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
    
    const filteredRows = [];
    
    for (let i = 0; i < data.length; i++) {
      const formula = formulas[i][0];
      if (formula && typeof formula === 'string' && formula.includes('HYPERLINK')) {
        continue;
      }
      
      const rowGradeLevel = String(data[i][2] || '').trim();
      const rowSection = String(data[i][3] || '').trim();
      const rowSubject = String(data[i][4] || '').trim();
      
      if (rowGradeLevel === gradeLevel && 
          rowSection === section && 
          rowSubject === subject) {
        filteredRows.push([
          data[i][0] || '', // Student Number
          data[i][2] || '', // Grade Level
          data[i][3] || '', // Section
          data[i][4] || '', // Subject
          data[i][5] || '', // Semester
          data[i][6] || '', // Strand
          data[i][7] || '', // Teacher
          data[i][9] || '', // 1st Transmuted
          data[i][12] || '', // 2nd Transmuted
          data[i][15] || '', // 3rd Transmuted
          data[i][18] || ''  // 4th Transmuted
        ]);
      }
    }
    
    if (filteredRows.length === 0) {
      return { success: false, message: 'No matching records found for the selected criteria' };
    }
    
    const headers = [
      'Student Number',
      'Grade Level',
      'Section',
      'Subject',
      'Semester',
      'Strand', 
      'Teacher',
      '1st Transmuted',
      '2nd Transmuted',
      '3rd Transmuted',
      '4th Transmuted'
    ];
    
    const csvRows = [headers];
    
    for (let i = 0; i < filteredRows.length; i++) {
      const row = filteredRows[i];
      const csvRow = row.map(function(cell) {
        const value = cell !== null && cell !== undefined ? String(cell) : '';
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      });
      csvRows.push(csvRow);
    }
    
    const csvContent = csvRows.map(function(row) {
      return row.join(',');
    }).join('\n');
    
    return {
      success: true,
      csvContent: csvContent,
      filename: `${academicYearSheet}_${gradeLevel}_${section}_${subject}.csv`.replace(/[^a-zA-Z0-9._-]/g, '_'),
      recordCount: filteredRows.length
    };
    
  } catch (error) {
    console.error('Error exporting grades:', error);
    return {
      success: false,
      message: `Error exporting grades: ${error.toString()}`
    };
  }
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
