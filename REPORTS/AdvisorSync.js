/**
 * AdvisorSync.js — pulls current Advisory Teacher assignments from each
 * Template Masterfile's ADVISORY + TEACHERS_REF tabs into a local ADVISORS
 * sheet in this REPORTS spreadsheet, so Teacher-role report access can be
 * scoped to the section(s) they actually advise.
 *
 * Source of truth per Template Masterfile (see CONFIG.TEMPLATE_MASTERFILES):
 *   ADVISORY tab      — Teacher | Grade Level | Section | Status | ...
 *                        (1 header row; only one Active row per grade+section
 *                        is enforced at the source, per _addAdvisory())
 *   TEACHERS_REF tab  — No. | Full Name | Email Address | Active
 *                        (2 header rows; join key is exact Full Name match,
 *                        mirrors _getTeacherEmail() in each masterfile)
 *
 * Run manually via the "GLC Reports" menu, or automatically via the daily
 * trigger installed by installAdvisorSyncTrigger().
 */

/**
 * Entry point for both the menu item and the time-based trigger.
 * Iterates every configured Template Masterfile, resolves Active advisors to
 * emails via TEACHERS_REF, and rewrites the local ADVISORS + issues sheets.
 * @return {{success: boolean, synced: number, issues: number, message: string}}
 */
function syncAdvisors() {
  const resolvedRows = [];
  const issueRows = [];
  const syncedAt = new Date();

  CONFIG.TEMPLATE_MASTERFILES.forEach(function (masterfile) {
    try {
      const ss = SpreadsheetApp.openById(masterfile.spreadsheetId);
      const emailByName = _readTeachersRefEmailMap(ss);
      const advisoryRows = _readActiveAdvisoryRows(ss);

      advisoryRows.forEach(function (row) {
        const email = emailByName[_normalizeTeacherName_(row.teacher)];
        if (email) {
          resolvedRows.push([row.gradeLevel, row.section, row.teacher, email, masterfile.assignedGradeLevel, syncedAt]);
        } else {
          const issue = emailByName.hasOwnProperty(_normalizeTeacherName_(row.teacher))
            ? 'Advisor found in TEACHERS_REF but Email Address is blank'
            : 'Advisor name not found in TEACHERS_REF';
          issueRows.push([row.gradeLevel, row.section, row.teacher, masterfile.assignedGradeLevel, issue, syncedAt]);
        }
      });
    } catch (error) {
      issueRows.push(['', '', '', masterfile.assignedGradeLevel, 'Could not open masterfile: ' + error.message, syncedAt]);
    }
  });

  _writeAdvisorsSheet_(resolvedRows);
  _writeSyncIssuesSheet_(issueRows);

  const message = 'Synced ' + resolvedRows.length + ' advisor(s), ' + issueRows.length + ' issue(s).';
  Logger.log('syncAdvisors: ' + message);
  return { success: true, synced: resolvedRows.length, issues: issueRows.length, message: message };
}

/**
 * Reads TEACHERS_REF and builds a normalized-name -> email map.
 * Rows with a blank email still get an entry (empty string value) so
 * syncAdvisors() can distinguish "name not found" from "found, no email".
 */
function _readTeachersRefEmailMap(ss) {
  const sheet = ss.getSheetByName(CONFIG.MASTERFILE_SHEETS.TEACHERS_REF);
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const startIdx = CONFIG.TEACHERS_REF_DATA_START_ROW - 1;
  const map = {};

  for (let i = startIdx; i < data.length; i++) {
    const row = data[i];
    const name = String(row[CONFIG.TEACHERS_REF_NAME_COL] || '').trim();
    if (!name) continue;
    const email = String(row[CONFIG.TEACHERS_REF_EMAIL_COL] || '').trim();
    map[_normalizeTeacherName_(name)] = email;
  }
  return map;
}

/**
 * Reads ADVISORY and returns only rows with Status = Active.
 * @return {{teacher: string, gradeLevel: string, section: string}[]}
 */
function _readActiveAdvisoryRows(ss) {
  const sheet = ss.getSheetByName(CONFIG.MASTERFILE_SHEETS.ADVISORY);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const C = CONFIG.ADVISORY_COLUMNS;
  const out = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const teacher = String(row[C.TEACHER] || '').trim();
    const status = String(row[C.STATUS] || '').trim();
    if (!teacher || status !== CONFIG.ADVISORY_STATUS_ACTIVE) continue;
    out.push({
      teacher: teacher,
      gradeLevel: String(row[C.GRADE_LEVEL] || '').trim(),
      section: String(row[C.SECTION] || '').trim()
    });
  }
  return out;
}

function _normalizeTeacherName_(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function _writeAdvisorsSheet_(rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.ADVISORS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.ADVISORS_SHEET);
  } else {
    sheet.clearContents();
  }

  const headers = CONFIG.ADVISORS_HEADERS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function _writeSyncIssuesSheet_(rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.ADVISOR_SYNC_ISSUES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.ADVISOR_SYNC_ISSUES_SHEET);
  } else {
    sheet.clearContents();
  }

  const headers = CONFIG.ADVISOR_SYNC_ISSUES_HEADERS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#dc3545')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

// ---------------------------------------------------------------------------
// Lookup used by REPORTS/Code.js to check Teacher section access
// ---------------------------------------------------------------------------

/**
 * Returns the set of {gradeLevel, section} pairs a given email currently
 * advises, per the last sync. Reads the ADVISORS sheet directly (no live
 * masterfile calls) so this is fast enough to call on every report request.
 * @param {string} email
 * @return {{gradeLevel: string, section: string}[]}
 */
function _getAdvisedSectionsForEmail_(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ADVISORS_SHEET);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues(); // Grade Level, Section, Advisor Name, Advisor Email

  const out = [];
  for (let i = 0; i < data.length; i++) {
    const rowEmail = String(data[i][3] || '').trim().toLowerCase();
    if (rowEmail === normalizedEmail) {
      out.push({ gradeLevel: String(data[i][0] || '').trim(), section: String(data[i][1] || '').trim() });
    }
  }
  return out;
}

/**
 * Reverse lookup of _getAdvisedSectionsForEmail_ — given a Grade Level +
 * Section, returns that section's Advisor Name per the last sync. Used by
 * the LPR (SF-9) report to print the adviser's name in the signature block
 * (report generation doesn't otherwise know or care who's advising a
 * section, unlike the Teacher-role access-scoping use of ADVISORS).
 * @param {string} gradeLevel
 * @param {string} section
 * @return {string} advisor name, or '' if no ADVISORS row matches.
 */
function _getAdvisorNameForSection_(gradeLevel, section) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ADVISORS_SHEET);
  if (!sheet) return '';

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';

  const gl = String(gradeLevel || '').trim();
  const sec = String(section || '').trim();
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues(); // Grade Level, Section, Advisor Name, Advisor Email

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === gl && String(data[i][1] || '').trim() === sec) {
      return String(data[i][2] || '').trim();
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Trigger setup
// ---------------------------------------------------------------------------

/**
 * Installs a daily time-based trigger that runs syncAdvisors() automatically.
 * Run this once from the Apps Script editor (or wire it into the "GLC Reports"
 * menu). Safe to re-run — removes any existing syncAdvisors trigger first so
 * duplicates aren't created.
 */
function installAdvisorSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncAdvisors') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('syncAdvisors')
    .timeBased()
    .everyDays(1)
    .atHour(3) // 3 AM, before staff typically start using REPORTS
    .create();

  Logger.log('Daily advisor sync trigger installed (runs ~3 AM).');
  try {
    SpreadsheetApp.getActive().toast('Daily advisor sync trigger installed.', '✅ Setup', 5);
  } catch (_) {}
}
