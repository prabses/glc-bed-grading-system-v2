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
    .addItem("Import OGS Template", "showImportOGSTemplateDialog")
    .addItem("Update Student Grades", "showUpdateGradesDialog")
    .addItem("Update Student Character", "showUpdateCharacterDialog")
    .addToUi();

  ui.createMenu("Export for SRMS")
    .addItem("Export Student Grades", "showExportGradesDialog")
    .addItem("Export Student Characters", "showExportCharactersDialog")
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

function showImportOGSTemplateDialog() {
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const html = HtmlService.createTemplateFromFile("ImportOGSTemplateDialog");
  html.gradesDbSpreadsheetId = spreadsheetId;
  const htmlOutput = html.evaluate()
    .setWidth(500)
    .setHeight(550)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Import OGS Template");
}

function importOGSTemplate(ogsTemplateUrl, academicYearSheet, spreadsheetId) {
  const userEmail = Session.getActiveUser().getEmail();
  const trimmedUrl = ogsTemplateUrl.toString().trim();
  if (!trimmedUrl) {
    return { success: false, message: "OGS template URL cannot be empty." };
  }
  if (!academicYearSheet || academicYearSheet.toString().trim() === "") {
    return { success: false, message: "Academic year must be specified." };
  }

  let sheetNames = [];
  try {
    const ogsSpreadsheetId = extractSpreadsheetId(trimmedUrl);
    const ogsSpreadsheet = SpreadsheetApp.openById(ogsSpreadsheetId);
    sheetNames = ogsSpreadsheet.getSheets().map(function(s) { return s.getName(); });
  } catch (error) {
    const errMsg = error.message || error.toString();
    return { success: false, message: "Could not open OGS template. " + errMsg };
  }

  const hasCharacter = sheetNames.indexOf("Character") >= 0;
  let gradesMsg = '';
  let characterMsg = '';
  let gradesOk = false;
  let characterOk = false;
  let gradesResult = null;

  try {
    gradesResult = callApi("importGrades", { ogsTemplateUrl: trimmedUrl, academicYearSheet: academicYearSheet, userEmail: userEmail });
    if (gradesResult && gradesResult.success !== false) {
      gradesOk = true;
      gradesMsg = gradesResult.message || "Imported successfully.";
    } else {
      gradesMsg = "Failed. " + (gradesResult && gradesResult.message ? gradesResult.message : "Unknown error.");
    }
  } catch (error) {
    gradesMsg = "Failed. " + (error.message || error.toString());
  }

  if (hasCharacter && CONFIG.CHARACTER_DB_SHEET_URL) {
    try {
      const msg = callApi("importCharacters", { ogsTemplateUrl: trimmedUrl, academicYearSheet: academicYearSheet, userEmail: userEmail });
      if (msg && msg.success !== false) {
        characterOk = true;
        characterMsg = msg.message || "Imported successfully.";
      } else {
        characterMsg = "Failed. " + (msg && msg.message ? msg.message : "Unknown error.");
      }
    } catch (error) {
      characterMsg = "Failed. " + (error.message || error.toString());
    }
  } else {
    characterMsg = "Not in template.";
  }

  const allOk = gradesOk && (!hasCharacter || characterOk);
  const gradeLevel = gradesOk && gradesResult ? (gradesResult.gradeLevel || '') : '';
  const section = gradesOk && gradesResult ? (gradesResult.section || '') : '';
  const semester = (gradesOk && gradesResult && gradesResult.semester) ? gradesResult.semester : 'N/A';
  const strand = (gradesOk && gradesResult && gradesResult.strand) ? gradesResult.strand : 'N/A';
  const teacher = gradesOk && gradesResult ? (gradesResult.teacher || '') : '';
  logImport(trimmedUrl, academicYearSheet, userEmail, gradeLevel, section, semester, strand, teacher, spreadsheetId);
  return {
    success: allOk,
    gradesMessage: gradesMsg,
    characterMessage: characterMsg
  };
}

/**
 * Returns semester options from config (for Update Grades dialog)
 * @return {Array<string>}
 */
function getSemesterOptions() {
  return CONFIG.SEMESTERS ? Object.values(CONFIG.SEMESTERS) : [];
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

function showUpdateCharacterDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("UpdateCharacterDialog")
    .setWidth(1100)
    .setHeight(700)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Update Student Character");
}

function _getCharacterSpreadsheet() {
  const url = CONFIG.CHARACTER_DB_SHEET_URL;
  if (!url) return null;
  try {
    return SpreadsheetApp.openById(extractSpreadsheetId(url));
  } catch (e) {
    return null;
  }
}

function getCharacterStudentSheets() {
  const spreadsheet = _getCharacterSpreadsheet();
  if (!spreadsheet) return [];
  const sheets = spreadsheet.getSheets();
  const sheetNames = [];
  const yearPattern = /^\d{4}-\d{4}$/;
  for (let i = 0; i < sheets.length; i++) {
    const sheetName = sheets[i].getName().trim();
    if (yearPattern.test(sheetName)) sheetNames.push(sheetName);
  }
  return sheetNames;
}

function getCharacterStudentNumbers(academicYearSheet) {
  if (!academicYearSheet || academicYearSheet.toString().trim() === "") return [];
  const spreadsheet = _getCharacterSpreadsheet();
  if (!spreadsheet) return [];
  const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
  if (!targetSheet || targetSheet.getLastRow() < 2) return [];
  const lastRow = targetSheet.getLastRow();
  const data = targetSheet.getRange(2, 1, lastRow, 1).getValues();
  const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
  const unique = new Set();
  for (let i = 0; i < data.length; i++) {
    if (formulas[i][0] && typeof formulas[i][0] === "string" && formulas[i][0].includes("HYPERLINK")) continue;
    const sn = String(data[i][0] || "").trim();
    if (sn) unique.add(sn);
  }
  return Array.from(unique).sort();
}

function getCharacterSections(academicYearSheet, studentNumber) {
  if (!academicYearSheet || !studentNumber) return [];
  const spreadsheet = _getCharacterSpreadsheet();
  if (!spreadsheet) return [];
  const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
  if (!targetSheet || targetSheet.getLastRow() < 2) return [];
  const lastRow = targetSheet.getLastRow();
  const data = targetSheet.getRange(2, 1, lastRow, 6).getValues();
  const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
  const unique = new Set();
  const sn = studentNumber.toString().trim();
  for (let i = 0; i < data.length; i++) {
    if (formulas[i][0] && typeof formulas[i][0] === "string" && formulas[i][0].includes("HYPERLINK")) continue;
    if (String(data[i][0] || "").trim() === sn) {
      const sec = String(data[i][3] || "").trim();
      if (sec) unique.add(sec);
    }
  }
  return Array.from(unique).sort();
}

function getCharacterTraits(academicYearSheet, studentNumber, section) {
  if (!academicYearSheet || !studentNumber || !section) return [];
  const spreadsheet = _getCharacterSpreadsheet();
  if (!spreadsheet) return [];
  const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
  if (!targetSheet || targetSheet.getLastRow() < 2) return [];
  const lastRow = targetSheet.getLastRow();
  const data = targetSheet.getRange(2, 1, lastRow, 6).getValues();
  const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
  const orderSeen = [];
  const seen = new Set();
  const sn = studentNumber.toString().trim();
  const sec = section.toString().trim();
  for (let i = 0; i < data.length; i++) {
    if (formulas[i][0] && typeof formulas[i][0] === "string" && formulas[i][0].includes("HYPERLINK")) continue;
    if (String(data[i][0] || "").trim() === sn && String(data[i][3] || "").trim() === sec) {
      const trait = String(data[i][5] || "").trim();
      if (trait && !seen.has(trait)) { seen.add(trait); orderSeen.push(trait); }
    }
  }
  return orderSeen;
}

function _callCharacterApi(action, payload) {
  const url = CONFIG.WEB_APP_URL;
  if (!url) throw new Error("WEB_APP_URL not configured.");
  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ apiKey: CONFIG.API_KEY, action: action, payload: payload || {} }),
    muteHttpExceptions: true
  });
  const parsed = JSON.parse(resp.getContentText());
  if (parsed.statusCode !== 200) throw new Error(parsed.message || "Character API error.");
  return parsed.message;
}

function getCharacterInfo(studentNumber, academicYearSheet, section, trait) {
  return _callCharacterApi("getCharacterInfo", { studentNumber: studentNumber, academicYearSheet: academicYearSheet, section: section, trait: trait });
}

function updateCharacter(studentNumber, academicYearSheet, section, trait, firstGrade, secondGrade, thirdGrade, fourthGrade, remarks) {
  const userEmail = Session.getActiveUser().getEmail();
  return _callCharacterApi("updateCharacter", {
    studentNumber: studentNumber,
    academicYearSheet: academicYearSheet,
    section: section,
    trait: trait,
    firstGrade: firstGrade,
    secondGrade: secondGrade,
    thirdGrade: thirdGrade,
    fourthGrade: fourthGrade,
    remarks: remarks,
    userEmail: userEmail
  });
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

function getAllGradeInfo(studentNumber, academicYearSheet, gradeLevel) {
  console.log("Function getAllGradeInfo executed by: " + Session.getActiveUser().getEmail());
  return callApi("getAllGradeInfo", { studentNumber, academicYearSheet, gradeLevel });
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

function showExportCharactersDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile("ExportCharactersDialog")
    .setWidth(500)
    .setHeight(550)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Export Student Characters");
}

function _sortGradeLevels(arr) {
  return arr.slice().sort(function(a, b) {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });
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
    
    return _sortGradeLevels(Array.from(uniqueLevels));
  } catch (error) {
    console.error('Error getting grade levels:', error);
    return [];
  }
}

/**
 * Gets unique grade levels for a specific student in an academic year sheet
 * @param {string} academicYearSheet - The academic year sheet name
 * @param {string} studentNumber - The student number
 * @return {Array} Array of unique grade levels for that student
 */
function getGradeLevelsForStudent(academicYearSheet, studentNumber) {
  try {
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return [];
    }
    if (!studentNumber || studentNumber.toString().trim() === '') {
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
    const dataRange = targetSheet.getRange(2, 1, lastRow - 1, 3);
    const data = dataRange.getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow - 1, 1).getFormulas();
    const studentNumTrim = studentNumber.toString().trim();
    const uniqueLevels = new Set();
    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) {
        continue;
      }
      const rowStudentNum = String(data[i][0] || '').trim();
      if (rowStudentNum !== studentNumTrim) {
        continue;
      }
      const level = String(data[i][2] || '').trim();
      if (level) {
        uniqueLevels.add(level);
      }
    }
    return _sortGradeLevels(Array.from(uniqueLevels));
  } catch (error) {
    console.error('Error getting grade levels for student:', error);
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

function getCharacterGradeLevels(academicYearSheet) {
  if (!academicYearSheet || academicYearSheet.toString().trim() === '') return [];
  const spreadsheet = _getCharacterSpreadsheet();
  if (!spreadsheet) return [];
  const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
  if (!targetSheet || targetSheet.getLastRow() < 2) return [];
  const lastRow = targetSheet.getLastRow();
  const data = targetSheet.getRange(2, 1, lastRow, 4).getValues();
  const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
  const unique = new Set();
  for (let i = 0; i < data.length; i++) {
    if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
    const level = String(data[i][2] || '').trim();
    if (level) unique.add(level);
  }
  return _sortGradeLevels(Array.from(unique));
}

function getCharacterSectionsForExport(academicYearSheet, gradeLevel) {
  if (!academicYearSheet || !gradeLevel) return [];
  const spreadsheet = _getCharacterSpreadsheet();
  if (!spreadsheet) return [];
  const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
  if (!targetSheet || targetSheet.getLastRow() < 2) return [];
  const lastRow = targetSheet.getLastRow();
  const data = targetSheet.getRange(2, 1, lastRow, 4).getValues();
  const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
  const unique = new Set();
  const gl = gradeLevel.toString().trim();
  for (let i = 0; i < data.length; i++) {
    if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
    if (String(data[i][2] || '').trim() !== gl) continue;
    const sec = String(data[i][3] || '').trim();
    if (sec) unique.add(sec);
  }
  return Array.from(unique).sort();
}

/**
 * Exports character DB sheet to CSV for the given academic year, grade level, and section.
 */
function exportCharacters(academicYearSheet, gradeLevel, section) {
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
    const spreadsheet = _getCharacterSpreadsheet();
    if (!spreadsheet) {
      return { success: false, message: 'Character DB not configured or unavailable' };
    }
    const targetSheet = spreadsheet.getSheetByName(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: 'Academic year sheet not found in Character DB' };
    }
    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No character data found in the sheet' };
    }
    const numCols = Math.max(16, targetSheet.getLastColumn());
    const headerRow = targetSheet.getRange(1, 1, 1, numCols).getValues()[0];
    const data = targetSheet.getRange(2, 1, lastRow, numCols).getValues();
    const formulas = targetSheet.getRange(2, 1, lastRow, 1).getFormulas();
    const gl = gradeLevel.toString().trim();
    const sec = section.toString().trim();
    const filteredRows = [];
    for (let i = 0; i < data.length; i++) {
      if (formulas[i][0] && typeof formulas[i][0] === 'string' && formulas[i][0].includes('HYPERLINK')) continue;
      if (String(data[i][2] || '').trim() !== gl || String(data[i][3] || '').trim() !== sec) continue;
      filteredRows.push(data[i]);
    }
    if (filteredRows.length === 0) {
      return { success: false, message: 'No matching records found for the selected criteria' };
    }
    const rawHeaders = headerRow.map(function(h) { return h !== null && h !== undefined ? String(h) : ''; });
    const keepIndex = function(i) { return rawHeaders[i].indexOf(' EQ') === -1; };
    const headers = rawHeaders.filter(function(_, i) { return keepIndex(i); });
    const csvRows = [headers];
    for (let i = 0; i < filteredRows.length; i++) {
      const row = filteredRows[i];
      const kept = row.filter(function(_, colIdx) { return keepIndex(colIdx); });
      const csvRow = kept.map(function(cell) {
        const value = cell !== null && cell !== undefined ? String(cell) : '';
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      });
      csvRows.push(csvRow);
    }
    const csvContent = csvRows.map(function(row) { return row.join(','); }).join('\n');
    const safeName = `${academicYearSheet}_${gradeLevel}_${section}_characters`.replace(/[^a-zA-Z0-9._-]/g, '_');
    return {
      success: true,
      csvContent: csvContent,
      filename: safeName + '.csv',
      recordCount: filteredRows.length
    };
  } catch (error) {
    console.error('Error exporting characters:', error);
    return { success: false, message: 'Error exporting characters: ' + error.toString() };
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
