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

  ui.createMenu("Manual")
    .addItem("Open Working Instruction", "showWorkingInstructions")
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
  console.log(
    "Function importGrades executed by: " + Session.getActiveUser().getEmail()
  );
  return callApi("importGrades", { ogsTemplateUrl, academicYearSheet });
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
