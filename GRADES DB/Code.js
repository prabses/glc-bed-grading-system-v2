/**
 * Google Apps Script for Grades Database
 * This script provides functionality for filtering student data by various criteria
 */

/**
 * Creates the custom menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu("Actions")
    .addItem("Filter Student Data", "showStudentFilterDialog")
    .addItem("Import Student Grades", "showImportGradesDialog")
    .addToUi();
}

/**
 * Shows the student filter dialog with HTML interface
 * Only works on sheets containing "MAIN"
 */
function showStudentFilterDialog() {
  const activeSheet = SpreadsheetApp.getActiveSheet();
  const sheetName = activeSheet.getName();
  
  // Check if current sheet contains "MAIN"
  if (!sheetName.includes('MAIN')) {
    SpreadsheetApp.getUi().alert(
      'Access Denied',
      'This function can only be used on sheets containing "MAIN" in the name.\n\nCurrent sheet: ' + sheetName,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  
  const htmlOutput = HtmlService.createHtmlOutputFromFile("StudentFilterDialog")
    .setWidth(500)
    .setHeight(450)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Filter Student Data");
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
    const sheetName = sheets[i].getName();
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
    .setHeight(450)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Import Student Grades");
}
