/**
 * Setup.js — One-time authorized-users setup for the REPORTS web app.
 *
 * Run runSetup() once from the Apps Script editor (or the Sheet menu) to
 * create the AUTHORIZED_USERS sheet. Auth itself uses native Workspace
 * identity (Session.getEffectiveUser() in Code.js) — no OAuth Client
 * credentials needed. See AuthService.unused.js for the previous OAuth-based
 * approach, kept for reference/rollback.
 */

function runSetup() {
  _ensureAuthorizedUsersSheet();
  Logger.log('Setup complete.');
  try {
    SpreadsheetApp.getActive().toast('Setup complete!', '✅ Setup', 5);
  } catch (_) {}
}

/**
 * Creates the AUTHORIZED_USERS sheet with headers if it doesn't already exist.
 * Columns: Email | Role | Name | Assigned Grade Level
 * Admin/Principal/Registrar get full access to all sections.
 * Teacher is scoped to their advised section(s), resolved via the ADVISORS
 * sheet (see AdvisorSync.js) — run "Sync Advisors Now" from the menu, or
 * install the daily trigger, before granting Teacher accounts access.
 * Coordinator is scoped to an Assigned Grade Level (col D, e.g. "7-10")
 * matching one of the 4 Template Masterfile blocks — set by hand per
 * Coordinator row.
 */
function _ensureAuthorizedUsersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.AUTHORIZED_USERS_SHEET);
  if (sheet) return;

  sheet = ss.insertSheet(CONFIG.AUTHORIZED_USERS_SHEET);
  const headers = CONFIG.AUTHORIZED_USERS_HEADERS;
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, headers.length, 220);

  // Seed one example Admin row so the sheet's shape is obvious.
  sheet.appendRow(['admin@example.com', CONFIG.ROLES.ADMIN, 'Admin Name', '']);

  _applyAssignedGradeLevelConditionalFormat(sheet);

  Logger.log('AUTHORIZED_USERS sheet created. Add Admin/Teacher/Coordinator rows before granting access.');
}

/**
 * Highlights AUTHORIZED_USERS col D (Assigned Grade Level) red wherever Role
 * = Coordinator and Assigned Grade Level is blank — that combination
 * silently locks the Coordinator out of every grade level (see
 * _canAccessSection_ in Code.js), so it's worth flagging visually right on
 * the sheet instead of only surfacing as a runtime access-denied message.
 * Safe to re-run: replaces any prior rule on the Assigned Grade Level column
 * rather than stacking duplicates.
 */
function _applyAssignedGradeLevelConditionalFormat(sheet) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.AUTHORIZED_USERS_SHEET);
  if (!sheet) return;

  const assignedGradeLevelCol = CONFIG.AUTHORIZED_USERS_HEADERS.indexOf('Assigned Grade Level') + 1; // 1-based
  const maxRows = Math.max(sheet.getMaxRows(), 1000);
  const range = sheet.getRange(2, assignedGradeLevelCol, maxRows - 1, 1);

  const rules = sheet.getConditionalFormatRules()
    .filter(r => !r.getRanges().some(rg => rg.getColumn() === assignedGradeLevelCol && rg.getRow() === 2));

  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(
      '=AND($B2="' + CONFIG.ROLES.COORDINATOR + '", $D2="")'
    )
    .setBackground('#f4c7c3')
    .setRanges([range])
    .build();

  rules.push(rule);
  sheet.setConditionalFormatRules(rules);
}

/**
 * Menu-callable entry point to (re)apply the Assigned Grade Level
 * conditional format to an AUTHORIZED_USERS sheet that already existed
 * before this rule was introduced. New sheets get it automatically via
 * _ensureAuthorizedUsersSheet.
 */
function applyAssignedGradeLevelFormatting() {
  _applyAssignedGradeLevelConditionalFormat();
  try {
    SpreadsheetApp.getActive().toast('Assigned Grade Level conditional formatting applied!', '✅ Done', 5);
  } catch (_) {}
}

/**
 * Creates the Signatories sheet with headers if it doesn't already exist,
 * seeded with the school's current signatories (Designation/Verification/
 * Name per report type) so the sheet's shape and expected content are both
 * obvious on first run. See CONFIG.SIGNATORIES_SHEET and _getSignatory_ in
 * API.js. PG and SF-10 are omitted — neither renders a signature block.
 */
function _ensureSignatoriesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SIGNATORIES_SHEET);
  if (sheet) return;

  sheet = ss.insertSheet(CONFIG.SIGNATORIES_SHEET);
  const headers = CONFIG.SIGNATORIES_HEADERS;
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, headers.length, 180);

  const ALL = CONFIG.SIGNATORIES_ALL_BAND;
  sheet.getRange(2, 1, 3, headers.length).setValues([
    ['NG',  ALL, 'Assistant Principal', 'Certified Correct:', 'Mary Grace A. Busalanan'],
    ['SF9', ALL, 'Administrator',       'Administrator',      'Rekha L. Nahar'],
    ['SC',  ALL, 'Administrator',       'Certified Correct:', 'Rekha L. Nahar']
  ]);

  Logger.log('Signatories sheet created and seeded. Add/edit rows as signatories change.');
}

/**
 * Menu-callable entry point to create the Signatories sheet on a spreadsheet
 * that predates this feature. New spreadsheets don't need this — Signatories
 * is only auto-created here, not on every onOpen, to avoid recreating a sheet
 * a user intentionally deleted.
 */
function ensureSignatoriesSheet() {
  _ensureSignatoriesSheet_();
  try {
    SpreadsheetApp.getActive().toast('Signatories sheet ready!', '✅ Done', 5);
  } catch (_) {}
}

/**
 * Menu-callable entry point that opens the deployed web app in a new browser
 * tab. Apps Script has no server-side "open URL" call, so this shows a tiny
 * modeless dialog whose only job is to window.open() the URL and close
 * itself — the click-through popup-blocker prompt some browsers show is
 * unavoidable from a script-triggered window.open, but only appears once.
 * Uses CONFIG.WEB_APP_URL (hardcoded) rather than ScriptApp.getService()
 * .getUrl() — see the comment on WEB_APP_URL in Config.js for why.
 */
function openWebApp() {
  const url = CONFIG.WEB_APP_URL;
  const html = HtmlService
    .createHtmlOutput(`<script>window.open(${JSON.stringify(url)}, '_blank'); google.script.host.close();</script>`)
    .setWidth(1)
    .setHeight(1);
  SpreadsheetApp.getUi().showModalDialog(html, 'Opening GLC Reports…');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GLC Reports')
    .addItem('🌐 Open Web Application', 'openWebApp')
    // .addSeparator()
    // .addItem('⚙️ Run Setup', 'runSetup')
    // .addSeparator()
    // .addItem('🔄 Sync Advisors Now', 'syncAdvisors')
    // .addItem('⏰ Install Daily Advisor Sync Trigger', 'installAdvisorSyncTrigger')
    // .addSeparator()
    // .addItem('✍️ Create Signatories Sheet', 'ensureSignatoriesSheet')
    // .addSeparator()
    // .addItem('🎨 Apply Assigned Grade Level Formatting', 'applyAssignedGradeLevelFormatting')

    .createMenu("Menu")
    .addItem("Open Working Instruction", "showWorkingInstructions")
    // .addItem("Repair Student Numbers / LRN", "repairCorruptedIdentifiers")
    // .addItem("Convert Student Numbers to Standard Format", "convertStudentNumbersToStandardFormat")
    .addToUi();
    
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
