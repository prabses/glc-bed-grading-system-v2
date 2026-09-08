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
 * Reads a Student Number cell value as text, recovering it from a Date
 * object if Sheets already auto-converted it (legacy rows written before
 * the plain-text-format fix, or a manual paste directly into the sheet).
 * Sheets parses the older "NN-NN-NNNN" (4-digit) format as MM-DD-YYYY, so
 * the original text is reconstructed the same way — getMonth()+1,
 * getDate(), getFullYear(), each zero-padded back to the original width.
 * This is exact for any legacy 4-digit-segment value, since MM-DD-YYYY <->
 * Date is lossless in that range. The current 5-digit-segment format
 * ("NN-NN-NNNNN") isn't a date Sheets recognizes, so it's never coerced in
 * the first place — this recovery path only matters for old rows.
 * @param {*} rawValue - Raw cell value from getValues()
 * @return {string} Recovered/plain Student Number text, or '' if blank
 */
function _readStudentNumberCell_(rawValue) {
  if (rawValue instanceof Date) {
    const mm = String(rawValue.getMonth() + 1).padStart(2, '0');
    const dd = String(rawValue.getDate()).padStart(2, '0');
    const yyyy = String(rawValue.getFullYear()).padStart(4, '0');
    return `${mm}-${dd}-${yyyy}`;
  }
  return String(rawValue || '').trim();
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
      case "importStudentDataXlsx":
        return response(200, _importStudentDataXlsx(payload.base64Xlsx, payload.academicYearSheet));
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
      case "getStudentsInSection":
        return response(200, _getStudentsInSection(payload.academicYearSheet, payload.gradeLevel, payload.section));
      case "getParentContacts":
        return response(200, _getParentContacts(payload.studentNumbers));
      case "getStudentsDemographics":
        return response(200, _getStudentsDemographics(payload.studentNumbers, payload.academicYearSheet));
      case "getCombinedStudentData":
        return response(200, _getCombinedStudentData(payload.academicYearSheet));
      case "repairCorruptedIdentifiers":
        return response(200, _repairCorruptedIdentifiers());
      case "convertStudentNumbersToStandardFormat":
        return response(200, _convertStudentNumbersToStandardFormat());
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
 * Validates a Student Number against CONFIG.STUDENT_NUMBER_PATTERN
 * ("NN-NN-NNNNN", e.g. "22-02-00001"). Also rejects a raw Date object, which
 * is what a value like "10-01-0798" (older 4-digit format) becomes if
 * Sheets/Excel auto-detects it as a date on paste/typed-entry before this
 * validation ever sees it as text — a plain regex test on the stringified
 * Date would otherwise pass through garbage silently.
 * @param {*} value - Raw value (expected string, but may be a Date if a
 *   cell/CSV cell got auto-converted upstream)
 * @return {boolean}
 */
function _validateStudentNumber_(value) {
  if (value instanceof Date) return false;
  return CONFIG.STUDENT_NUMBER_PATTERN.test(String(value || '').trim());
}

/**
 * Validates an LRN (12-digit Learner Reference Number) against
 * CONFIG.LRN_PATTERN. Same Date-object guard as _validateStudentNumber_,
 * since a numeric-looking LRN can also be misread by Sheets.
 * @param {*} value - Raw value
 * @return {boolean}
 */
function _validateLrn_(value) {
  if (value instanceof Date) return false;
  return CONFIG.LRN_PATTERN.test(String(value || '').trim());
}

/**
 * Validates Grade Level is a whole number from 1 to 12. Matches the
 * downloadable import template's conditional-format rule #2 (see
 * TemplateFormatting.js) — this is the server-side backstop for the same
 * check, since a red-highlighted cell in the template is only advisory
 * and doesn't stop someone from uploading anyway.
 * @param {*} value - Raw value
 * @return {boolean}
 */
function _validateGradeLevel_(value) {
  const trimmed = String(value || '').trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const num = Number(trimmed);
  return num >= 1 && num <= 12;
}

/**
 * Validates Gender is exactly "Male" or "Female" (case-insensitive).
 * Matches the import template's rule #8.
 * @param {*} value - Raw value
 * @return {boolean}
 */
function _validateGender_(value) {
  const trimmed = String(value || '').trim().toLowerCase();
  return CONFIG.VALID_GENDERS.some((valid) => valid.toLowerCase() === trimmed);
}

/**
 * Validates Email ends with CONFIG.EMAIL_DOMAIN (case-insensitive). Matches
 * the import template's rule #6.
 * @param {*} value - Raw value
 * @return {boolean}
 */
function _validateEmail_(value) {
  const trimmed = String(value || '').trim().toLowerCase();
  return trimmed.endsWith(CONFIG.EMAIL_DOMAIN.toLowerCase());
}

/**
 * Validates Date of Birth matches mm/dd/yyyy against
 * CONFIG.DATE_OF_BIRTH_PATTERN. Applied to the value AFTER
 * _normalizeDateOfBirth_ has already reformatted whatever the CSV cell
 * held — this catches inputs _normalizeDateOfBirth_ couldn't parse as a
 * date at all (it falls back to returning the raw trimmed string
 * unchanged in that case). Matches the import template's rule #7.
 * @param {string} normalizedValue - Output of _normalizeDateOfBirth_
 * @return {boolean}
 */
function _validateDateOfBirth_(normalizedValue) {
  return CONFIG.DATE_OF_BIRTH_PATTERN.test(String(normalizedValue || '').trim());
}

/**
 * Normalizes a raw Date of Birth string from an import CSV to mm/dd/yyyy
 * (e.g. "03/31/2019"), regardless of the format it was typed/exported in
 * (e.g. "March 31, 2019", "2019-03-31", "3/31/2019"). Falls back to the
 * original trimmed string if it can't be parsed as a date, so a malformed
 * value is preserved rather than lost.
 * @param {string} value - Raw DOB cell value from the parsed CSV row
 * @return {string} e.g. "03/31/2019", or '' if blank
 */
function _normalizeDateOfBirth_(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return trimmed;
  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'MM/dd/yyyy');
}

/**
 * Forces a range to plain-text ("@") number format before values are
 * written into it, so Sheets stores identifiers like Student Number/LRN as
 * literal text and never re-interprets them as a Date or Number on a
 * later manual edit. Must be called BEFORE setValues/setValue — formatting
 * an already-coerced Date cell does not recover the original text.
 * @param {GoogleAppsScript.Spreadsheet.Range} range
 */
function _forcePlainTextFormat_(range) {
  range.setNumberFormat('@');
}

/**
 * Internal function to import student data (as CSV text) to the specified
 * academic year sheet. Parses the CSV into rows, then delegates everything
 * else — header validation, per-field checks, and the actual sheet write —
 * to _importStudentRows_, which is format-agnostic and shared with the
 * .xlsx upload path (see _importStudentDataXlsx).
 * @param {string} csvContent - The CSV content as a string
 * @param {string} academicYearSheet - The name of the target sheet
 * @return {Object} Result object with success status and message
 */
function _importStudentData(csvContent, academicYearSheet) {
  if (!csvContent || csvContent.toString().trim() === '') {
    return { success: false, message: 'CSV content cannot be empty' };
  }

  const csvLines = csvContent.split('\n').filter(line => line.trim() !== '');
  if (csvLines.length === 0) {
    return { success: false, message: 'No data found in CSV file' };
  }

  const csvData = csvLines.map(parseCSVLine);
  if (csvData.length === 0) {
    return { success: false, message: 'No valid data found in CSV file' };
  }

  return _importStudentRows_(csvData, academicYearSheet);
}

/**
 * Internal function to import student data from an uploaded .xlsx file
 * (base64-encoded bytes). Converts the file into a 2D array via
 * _convertXlsxToRows_ (Code.js — requires the Drive API Advanced Service),
 * then delegates to the same _importStudentRows_ the CSV path uses, so
 * validation/writing behavior is identical regardless of upload format.
 * @param {string} base64Xlsx - The uploaded file's bytes, base64-encoded
 * @param {string} academicYearSheet - The name of the target sheet
 * @return {Object} Result object with success status and message
 */
function _importStudentDataXlsx(base64Xlsx, academicYearSheet) {
  if (!base64Xlsx || base64Xlsx.toString().trim() === '') {
    return { success: false, message: 'Uploaded file is empty' };
  }

  let rows;
  try {
    rows = _convertXlsxToRows_(base64Xlsx);
  } catch (error) {
    console.error('Error converting xlsx to rows:', error);
    return {
      success: false,
      message: `Could not read the uploaded Excel file: ${error.message}. Make sure it's a valid .xlsx file exported from the import template.`
    };
  }

  if (rows.length === 0) {
    return { success: false, message: 'No data found in the uploaded file' };
  }

  return _importStudentRows_(rows, academicYearSheet);
}

/**
 * Internal function to import student data (as an already-parsed 2D array
 * of row values) to the specified academic year sheet. Maintains the exact
 * format: Student Number, Last Name, First Name, Middle Name, Grade Level,
 * Section, Track, Gender.
 *
 * The data may optionally append CONFIG.OPTIONAL_IMPORT_HEADERS (LRN, Email,
 * Parent/Guardian Name, Date of Birth) after the 8 required columns. Those 4
 * are never written to the per-year sheet — it stays the original 8-column
 * schema — they're upserted into "Other Information" by Student Number
 * instead (see _upsertOtherInformation), since that sheet is keyed globally
 * rather than per academic year. Data with only the original 8 columns
 * still imports normally; per-row blanks in the optional columns are simply
 * skipped rather than failing the row or the import.
 * @param {Array<Array<*>>} rows - Row 0 is headers, remaining rows are data
 * @param {string} academicYearSheet - The name of the target sheet
 * @return {Object} Result object with success status and message
 */
function _importStudentRows_(rows, academicYearSheet) {
  try {
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }

    const spreadsheet = getSpreadsheet();
    let targetSheet = getSheet(academicYearSheet);

    // If sheet doesn't exist, create it
    if (!targetSheet) {
      targetSheet = spreadsheet.insertSheet(academicYearSheet);
    }

    const csvData = rows;
    if (csvData.length === 0) {
      return { success: false, message: 'No valid data found' };
    }

    // Validate the 8 required headers; the 4 optional headers (if present)
    // are validated separately below so an old 8-column CSV still passes.
    const expectedHeaders = CONFIG.EXPECTED_HEADERS;
    const requiredCount = expectedHeaders.length;
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

    // Optional trailing columns (LRN/Email/Parent Name/DOB) — only validated
    // if the CSV actually has more than the 8 required columns.
    const optionalHeaders = CONFIG.OPTIONAL_IMPORT_HEADERS;
    const hasOptionalColumns = headers.length > requiredCount;
    if (hasOptionalColumns) {
      const optionalMatch = optionalHeaders.every((expected, i) =>
        headers[requiredCount + i] && headers[requiredCount + i].trim().toLowerCase() === expected.toLowerCase()
      );
      if (!optionalMatch) {
        return {
          success: false,
          message: `CSV format mismatch. If including the optional columns, they must appear in this exact order after Gender: ${optionalHeaders.join(', ')}`
        };
      }
    }

    // Skip the header row from CSV and import only data rows
    const dataRows = csvData.slice(1); // Remove first row (headers)

    if (dataRows.length > 0) {
      // Every check below ACCUMULATES its problems into rowErrors — one
      // entry per (row, column) — instead of returning immediately, so a
      // file with several unrelated mistakes (e.g. a bad email AND a bad
      // date of birth) is reported in one pass rather than forcing the user
      // to fix and re-upload once per category. Only after every check has
      // run do we abort — if anything was collected. fileRow is 1-indexed
      // against the uploaded file's own rows, matching what the user sees
      // if they open it in Excel (row 1 = header, row 2 = first data row).
      const rowErrors = []; // { fileRow, studentNumber, column, message }[]
      const addRowError = (i, column, message) => {
        rowErrors.push({ fileRow: i + 2, studentNumber: String(dataRows[i][0] || '').trim(), column, message });
      };

      // A student number repeated WITHIN the same CSV is almost certainly a
      // mistake (e.g. copy-paste error) rather than an intentional re-import
      // — still abort the entire import for this case, same as before.
      const seenInFile = {};
      const seenAtRow = {};
      for (let i = 0; i < dataRows.length; i++) {
        const sn = String(dataRows[i][0] || '').trim();
        if (!sn) continue;
        if (seenInFile[sn]) {
          addRowError(i, 'Student Number', `Duplicate Student Number - also appears at row ${seenAtRow[sn]}`);
        } else {
          seenAtRow[sn] = i + 2;
        }
        seenInFile[sn] = true;
      }

      // Strict format check — catches both genuine typos and the case where
      // a value like "10-01-0798" got auto-converted to a date by
      // Excel/Sheets before it ever reached this CSV (e.g. the source file
      // was opened and re-saved in a spreadsheet app).
      for (let i = 0; i < dataRows.length; i++) {
        const sn = dataRows[i][0];
        if (!_validateStudentNumber_(sn)) {
          addRowError(i, 'Student Number', `Invalid format (expected NN-NN-NNNNN, e.g. "22-02-00001"), got "${sn}". This often happens when the file was opened/saved in Excel or Sheets and the value got auto-converted into a date.`);
        }
      }

      // The remaining core columns must be non-blank — EXCEPT Middle Name
      // (always optional) and Track, whose blank/non-blank requirement
      // depends on Grade Level (blank is correct for Grade 1-10, required
      // for Grade 11-12 — see the Track check further down).
      const requiredNonBlankHeaders = expectedHeaders.filter((header) => header !== 'Middle Name' && header !== 'Track');
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        requiredNonBlankHeaders.forEach((header) => {
          const colIndex = expectedHeaders.indexOf(header);
          if (String(row[colIndex] || '').trim() === '') {
            addRowError(i, header, 'Missing required field');
          }
        });
      }

      // Grade Level must be a whole number 1-12 — server-side backstop for
      // the import template's rule #2 (see TemplateFormatting.js), since a
      // red-highlighted cell there is only advisory.
      for (let i = 0; i < dataRows.length; i++) {
        const gradeLevel = dataRows[i][CONFIG.COLUMNS.GRADE_LEVEL];
        if (!_validateGradeLevel_(gradeLevel)) {
          addRowError(i, 'Grade Level', `Invalid Grade Level (expected a whole number 1-12), got "${gradeLevel}"`);
        }
      }

      // Track must be blank or "-" for Grade 1-10 and non-blank for Grade
      // 11-12 — server-side backstop for the import template's rule #4.
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const gradeLevel = Number(String(row[CONFIG.COLUMNS.GRADE_LEVEL] || '').trim());
        const track = String(row[CONFIG.COLUMNS.TRACK] || '').trim();
        const isSeniorHigh = gradeLevel === 11 || gradeLevel === 12;
        if (isSeniorHigh && !track) {
          addRowError(i, 'Track', 'Track is required for Grade 11-12');
        } else if (!isSeniorHigh && track && track !== CONFIG.NO_TRACK_PLACEHOLDER) {
          addRowError(i, 'Track', `Track must be blank or "${CONFIG.NO_TRACK_PLACEHOLDER}" for Grade 1-10, got "${track}"`);
        }
      }

      // Gender must be exactly "Male" or "Female" — server-side backstop
      // for the import template's rule #8.
      for (let i = 0; i < dataRows.length; i++) {
        const gender = dataRows[i][CONFIG.COLUMNS.GENDER];
        if (!_validateGender_(gender)) {
          addRowError(i, 'Gender', `Invalid Gender (expected "Male" or "Female"), got "${gender}"`);
        }
      }

      if (hasOptionalColumns) {
        for (let i = 0; i < dataRows.length; i++) {
          const lrn = dataRows[i][requiredCount];
          const lrnTrimmed = String(lrn || '').trim();
          if (lrnTrimmed && !_validateLrn_(lrn)) {
            addRowError(i, 'LRN', `Invalid LRN format (expected 12 digits), got "${lrnTrimmed}"`);
          }
        }

        // Email must end with CONFIG.EMAIL_DOMAIN — server-side backstop
        // for the import template's rule #6. Blank is allowed (optional
        // column), same leniency as LRN above.
        for (let i = 0; i < dataRows.length; i++) {
          const email = dataRows[i][requiredCount + 1];
          const emailTrimmed = String(email || '').trim();
          if (emailTrimmed && !_validateEmail_(email)) {
            addRowError(i, 'Email', `Invalid Email (expected to end with "${CONFIG.EMAIL_DOMAIN}"), got "${emailTrimmed}"`);
          }
        }

        // Date of Birth must match mm/dd/yyyy AFTER normalization — server-
        // side backstop for the import template's rule #7. Checked on the
        // normalized value, not the raw cell, since _normalizeDateOfBirth_
        // already accepts a range of input formats and reformats them; this
        // only catches inputs that couldn't be parsed as a date at all.
        for (let i = 0; i < dataRows.length; i++) {
          const dob = dataRows[i][requiredCount + 3];
          const dobTrimmed = String(dob || '').trim();
          if (dobTrimmed && !_validateDateOfBirth_(_normalizeDateOfBirth_(dob))) {
            addRowError(i, 'Date of Birth', `Invalid Date of Birth (expected mm/dd/yyyy), got "${dobTrimmed}"`);
          }
        }
      }

      if (rowErrors.length > 0) {
        const affectedRows = new Set(rowErrors.map((e) => e.fileRow)).size;
        return {
          success: false,
          message: `Import cancelled! ${rowErrors.length} issue(s) found across ${affectedRows} row(s). Download the detailed error report to see exactly what to fix, then re-upload.`,
          errorReportCsv: _buildImportErrorReportCsv_(rowErrors)
        };
      }

      // Rows whose Student Number is already on this academic year's roster
      // are skipped from the roster write (no duplicate roster rows), but —
      // unlike before — they're NOT excluded from the "Other Information"
      // upsert below. Re-importing a CSV to update an existing student's
      // LRN/Email/Parent Name/DOB is a legitimate, expected workflow now
      // that that upsert exists; it shouldn't be blocked by the same guard
      // that protects the roster from duplicate rows.
      const existingStudentNumbers = getExistingStudentNumbers(targetSheet);
      const newRows = dataRows.filter(row => !existingStudentNumbers.includes(String(row[0] || '').trim()));
      const skippedCount = dataRows.length - newRows.length;

      if (newRows.length > 0) {
        // Find the next empty row to append data
        const lastRow = targetSheet.getLastRow();
        const startRow = lastRow + 1; // Start from the next empty row

        // Write only the required 8 columns to the per-year sheet — slice
        // off any optional trailing columns so its schema never changes
        // even when the CSV carries them. Blank Track (Grade 1-10, which
        // has no Track) is normalized to the "-" placeholder so the sheet
        // cell is never left empty — matches what the import template's
        // dropdown now offers (see TemplateFormatting.js).
        const coreRows = newRows.map(row => {
          const core = row.slice(0, requiredCount);
          if (String(core[CONFIG.COLUMNS.TRACK] || '').trim() === '') {
            core[CONFIG.COLUMNS.TRACK] = CONFIG.NO_TRACK_PLACEHOLDER;
          }
          return core;
        });
        const range = targetSheet.getRange(startRow, 1, coreRows.length, requiredCount);

        // Force the Student Number column to plain text BEFORE writing, so
        // Sheets can't re-interpret "10-01-0798" etc. as a date once it
        // lands in the cell. Must happen before setValues — formatting a
        // cell that already holds a coerced Date does not undo the coercion.
        _forcePlainTextFormat_(targetSheet.getRange(startRow, CONFIG.COLUMNS.STUDENT_NUMBER + 1, coreRows.length, 1));

        range.setValues(coreRows);

        // Set all imported data to left alignment to prevent auto-formatting
        range.setHorizontalAlignment('left');
      }

      let otherInfoUpserted = 0;
      if (hasOptionalColumns) {
        // Every row, including ones skipped from the roster as already-existing,
        // is eligible for the Other Information upsert.
        otherInfoUpserted = _upsertOtherInformation(dataRows, requiredCount);
      }

      const otherInfoNote = hasOptionalColumns
        ? `\n${otherInfoUpserted} record(s) updated in "Other Information".`
        : '';
      const skippedNote = skippedCount > 0
        ? `\n${skippedCount} student number(s) already existed in ${academicYearSheet} and were not re-added to the roster.`
        : '';

      return {
        success: true,
        message: `Successfully imported ${newRows.length} new student record(s) to ${academicYearSheet}.${skippedNote}${otherInfoNote}`
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
 * Builds a downloadable CSV report from structured row-level import errors,
 * one line per (row, column) problem so the user can filter/sort by column
 * in Excel and jump straight to the offending file row. Values are quoted
 * and internal quotes escaped per standard CSV rules since error messages
 * can contain commas (e.g. "expected 12 digits").
 * @param {{fileRow: number, studentNumber: string, column: string, message: string}[]} rowErrors
 * @return {string} CSV text, ready to hand to the client for download.
 */
function _buildImportErrorReportCsv_(rowErrors) {
  const escapeCsv = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
  const header = ['Row', 'Student Number', 'Column', 'Problem'].map(escapeCsv).join(',');
  const lines = rowErrors
    .slice()
    .sort((a, b) => a.fileRow - b.fileRow)
    .map((e) => [e.fileRow, e.studentNumber, e.column, e.message].map(escapeCsv).join(','));
  return [header].concat(lines).join('\r\n');
}

/**
 * Upserts LRN/Email/Parent-Guardian Name/Date of Birth into "Other
 * Information" for each CSV row that has at least one non-blank value in
 * those trailing columns — keyed by Student Number (column 0 of each row).
 * Creates the sheet with headers if it doesn't exist yet. Existing rows are
 * updated in place; only the non-blank incoming fields overwrite existing
 * values, so a partially-filled CSV row doesn't blank out data already on
 * file for that student.
 * @param {Array[]} dataRows - Full CSV data rows (8 required + 4 optional columns).
 * @param {number} requiredCount - Index where the optional columns start (CONFIG.EXPECTED_HEADERS.length).
 * @return {number} Count of rows actually upserted (rows with all 4 optional fields blank are skipped).
 */
function _upsertOtherInformation(dataRows, requiredCount) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.OTHER_INFORMATION);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.OTHER_INFORMATION);
    sheet.getRange(1, 1, 1, CONFIG.OTHER_INFO_HEADERS.length).setValues([CONFIG.OTHER_INFO_HEADERS]);
  }

  const cols = CONFIG.OTHER_INFO_COLUMNS;
  const lastRow = sheet.getLastRow();
  const existingData = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, CONFIG.OTHER_INFO_HEADERS.length).getValues()
    : [];

  // Student Number -> sheet row number (1-based), for O(1) upsert lookups.
  const rowIndexBySn = {};
  for (let i = 0; i < existingData.length; i++) {
    const sn = _readStudentNumberCell_(existingData[i][cols.STUDENT_NUMBER]);
    if (sn) rowIndexBySn[sn] = i + 2;
  }

  let upsertedCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const studentNumber = String(row[0] || '').trim();
    if (!studentNumber) continue;

    const lrn         = String(row[requiredCount]     || '').trim();
    const email        = String(row[requiredCount + 1] || '').trim();
    const parentName   = String(row[requiredCount + 2] || '').trim();
    const dateOfBirth  = _normalizeDateOfBirth_(row[requiredCount + 3]);

    if (!lrn && !email && !parentName && !dateOfBirth) continue; // nothing to upsert for this student

    const existingRowNum = rowIndexBySn[studentNumber];
    if (existingRowNum) {
      // Update only the fields provided — don't blank out existing data.
      // LRN column forced to plain text first so a 12-digit value can't be
      // re-interpreted as a Number (dropping leading zeros) or Date.
      if (lrn) {
        const lrnRange = sheet.getRange(existingRowNum, cols.LRN + 1);
        _forcePlainTextFormat_(lrnRange);
        lrnRange.setValue(lrn);
      }
      if (email)        sheet.getRange(existingRowNum, cols.PARENT_EMAIL + 1).setValue(email);
      if (parentName)   sheet.getRange(existingRowNum, cols.PARENT_NAME + 1).setValue(parentName);
      if (dateOfBirth) {
        const dobRange = sheet.getRange(existingRowNum, cols.DATE_OF_BIRTH + 1);
        _forcePlainTextFormat_(dobRange);
        dobRange.setValue(dateOfBirth);
      }
    } else {
      const newRow = new Array(CONFIG.OTHER_INFO_HEADERS.length).fill('');
      newRow[cols.STUDENT_NUMBER] = studentNumber;
      newRow[cols.LRN]            = lrn;
      newRow[cols.PARENT_EMAIL]   = email;
      newRow[cols.PARENT_NAME]    = parentName;
      newRow[cols.DATE_OF_BIRTH]  = dateOfBirth;
      const newRowNum = sheet.getLastRow() + 1;
      // Force Student Number, LRN, and Date of Birth to plain text BEFORE
      // writing so Sheets never re-interprets any of them as a Date/Number.
      _forcePlainTextFormat_(sheet.getRange(newRowNum, cols.STUDENT_NUMBER + 1));
      _forcePlainTextFormat_(sheet.getRange(newRowNum, cols.LRN + 1));
      _forcePlainTextFormat_(sheet.getRange(newRowNum, cols.DATE_OF_BIRTH + 1));
      sheet.getRange(newRowNum, 1, 1, newRow.length).setValues([newRow]);
      rowIndexBySn[studentNumber] = newRowNum; // keep lookup in sync in case of duplicate student numbers within the same CSV
    }

    upsertedCount++;
  }

  return upsertedCount;
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
      if (_readStudentNumberCell_(data[i][CONFIG.COLUMNS.STUDENT_NUMBER]) === studentNumber.toString().trim()) {
        return {
          success: true,
          studentData: {
            'Student Number': _readStudentNumberCell_(data[i][CONFIG.COLUMNS.STUDENT_NUMBER]),
            'Last Name': data[i][CONFIG.COLUMNS.LAST_NAME],
            'First Name': data[i][CONFIG.COLUMNS.FIRST_NAME],
            'Middle Name': data[i][CONFIG.COLUMNS.MIDDLE_NAME],
            'Grade Level': data[i][CONFIG.COLUMNS.GRADE_LEVEL],
            'Section': data[i][CONFIG.COLUMNS.SECTION],
            'Track': data[i][CONFIG.COLUMNS.TRACK],
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
 * Internal function to get all students enrolled in a specific grade level and section.
 * @param {string} academicYearSheet - The academic year sheet name (e.g. "2025-2026")
 * @param {string} gradeLevel - Grade level (e.g. "5", "Grade 5")
 * @param {string} section - Section name (e.g. "B")
 * @return {Object} { success, students: [{ studentNumber, fullName }] }
 */
function _getStudentsInSection(academicYearSheet, gradeLevel, section) {
  try {
    if (!academicYearSheet || !gradeLevel || !section) {
      return { success: false, message: 'academicYearSheet, gradeLevel, and section are required.' };
    }

    const targetSheet = getSheet(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: `Sheet "${academicYearSheet}" not found in Students DB.` };
    }

    const lastRow = targetSheet.getLastRow();
    if (lastRow < CONFIG.DATA_START_ROW) {
      return { success: true, students: [] };
    }

    const data = targetSheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.HEADER_ROWS, 8).getValues();

    // Normalize grade level — strip "Grade " prefix for comparison
    const normalizedInput = String(gradeLevel).replace(/^grade\s*/i, '').trim();
    const sectionTrim = String(section).trim().toUpperCase();

    const students = [];
    for (let i = 0; i < data.length; i++) {
      const sn        = _readStudentNumberCell_(data[i][CONFIG.COLUMNS.STUDENT_NUMBER]);
      const lastName  = String(data[i][CONFIG.COLUMNS.LAST_NAME]      || '').trim();
      const firstName = String(data[i][CONFIG.COLUMNS.FIRST_NAME]     || '').trim();
      const middleName= String(data[i][CONFIG.COLUMNS.MIDDLE_NAME]    || '').trim();
      const rowGrade  = String(data[i][CONFIG.COLUMNS.GRADE_LEVEL]    || '').replace(/^grade\s*/i, '').trim();
      const rowSection= String(data[i][CONFIG.COLUMNS.SECTION]        || '').trim().toUpperCase();

      if (!sn) continue;
      if (rowGrade !== normalizedInput) continue;
      if (rowSection !== sectionTrim) continue;

      students.push({ studentNumber: sn, fullName: lastName + ', ' + firstName + (middleName ? ' ' + middleName : '') });
    }

    students.sort(function (a, b) { return a.fullName.localeCompare(b.fullName); });
    return { success: true, students: students };

  } catch (error) {
    console.error('Error in _getStudentsInSection:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Normalizes a Date of Birth cell to "March 31, 2019" regardless of whether
 * the sheet cell holds a real Date object (default when a date is typed/
 * pasted into a Sheets cell) or plain text — String(dateObj) would otherwise
 * produce "Sat Jul 01 2000 00:00:00 GMT+0800 (Philippine Standard Time)".
 * @param {Date|string} value - Raw cell value from getValues()
 * @return {string} e.g. "March 31, 2019", or '' if blank/unparseable
 */
function _formatDateOfBirth_(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'MMMM d, yyyy');
  }
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'MMMM d, yyyy');
  }
  return String(value).trim();
}

/**
 * Internal function to get parent/guardian contact emails for a list of student numbers.
 * Reads from the Other Information sheet (columns: Student Number, LRN, Email,
 * Parent/Guardian Name, Date of Birth) — keyed by Student Number, not scoped
 * by year. See CONFIG.OTHER_INFO_COLUMNS for the exact index mapping if the
 * sheet's column order changes again.
 * @param {string[]} studentNumbers - Array of student numbers to look up
 * @return {Object} { success, contacts: { [studentNumber]: { parentName, parentEmail, dateOfBirth, lrn } } }
 */
function _getParentContacts(studentNumbers) {
  try {
    const sheet = getSheet(CONFIG.SHEET_NAMES.OTHER_INFORMATION);
    if (!sheet) {
      return { success: false, message: '"Other Information" sheet not found. Please create it in the STUDENTS DB spreadsheet.' };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, contacts: {} };
    }

    const cols = CONFIG.OTHER_INFO_COLUMNS;
    const data = sheet.getRange(2, 1, lastRow - 1, CONFIG.OTHER_INFO_HEADERS.length).getValues();
    const lookup = {};
    for (let i = 0; i < data.length; i++) {
      const sn = _readStudentNumberCell_(data[i][cols.STUDENT_NUMBER]);
      if (sn) {
        lookup[sn] = {
          parentName:  String(data[i][cols.PARENT_NAME]   || '').trim(),
          parentEmail: String(data[i][cols.PARENT_EMAIL]  || '').trim(),
          dateOfBirth: _formatDateOfBirth_(data[i][cols.DATE_OF_BIRTH]),
          lrn:         String(data[i][cols.LRN]           || '').trim()
        };
      }
    }

    const contacts = {};
    const nums = studentNumbers || [];
    for (let j = 0; j < nums.length; j++) {
      const sn = String(nums[j]).trim();
      contacts[sn] = lookup[sn] || { parentName: '', parentEmail: '', dateOfBirth: '', lrn: '' };
    }

    return { success: true, contacts: contacts };
  } catch (error) {
    console.error('Error in _getParentContacts:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Internal function to get Gender and split name parts for a list of student
 * numbers within a given academic year. Unlike Other Information (global,
 * keyed by Student Number), these live in the per-year student sheet
 * alongside Grade/Section/Track, so this requires academicYearSheet — see
 * _getStudentInfo for the same pattern.
 * lastName/firstName/middleName are returned unjoined (unlike fullName in
 * _getStudentsInSection, which joins them into "Last, First Middle") so
 * callers that need the pieces separately — e.g. REPORTS' report filenames —
 * don't have to re-parse a combined string.
 * @param {string[]} studentNumbers - Array of student numbers to look up
 * @param {string} academicYearSheet - e.g. "2025-2026"
 * @return {Object} { success, demographics: { [studentNumber]: { gender, lastName, firstName, middleName } } }
 */
function _getStudentsDemographics(studentNumbers, academicYearSheet) {
  try {
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }

    const targetSheet = getSheet(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: `Sheet "${academicYearSheet}" not found in Students DB.` };
    }

    const demographics = {};
    const nums = (studentNumbers || []).map(sn => String(sn).trim());
    nums.forEach(sn => { demographics[sn] = { gender: '', lastName: '', firstName: '', middleName: '' }; });

    const lastRow = targetSheet.getLastRow();
    if (lastRow < CONFIG.DATA_START_ROW) {
      return { success: true, demographics: demographics };
    }

    const data = targetSheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.HEADER_ROWS, 8).getValues();
    for (let i = 0; i < data.length; i++) {
      const sn = _readStudentNumberCell_(data[i][CONFIG.COLUMNS.STUDENT_NUMBER]);
      if (sn && demographics.hasOwnProperty(sn)) {
        demographics[sn] = {
          gender:     String(data[i][CONFIG.COLUMNS.GENDER]      || '').trim(),
          lastName:   String(data[i][CONFIG.COLUMNS.LAST_NAME]   || '').trim(),
          firstName:  String(data[i][CONFIG.COLUMNS.FIRST_NAME]  || '').trim(),
          middleName: String(data[i][CONFIG.COLUMNS.MIDDLE_NAME] || '').trim()
        };
      }
    }

    return { success: true, demographics: demographics };
  } catch (error) {
    console.error('Error in _getStudentsDemographics:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Internal function to get the full per-year roster for an academic year
 * joined with "Other Information" (LRN/Email/Parent-Guardian Name/Date of
 * Birth) by Student Number. Read-only — runs under doPost's script-owner
 * execution, so it succeeds even when the caller only has protected/
 * view-only access to the underlying sheets.
 * @param {string} academicYearSheet - e.g. "2025-2026"
 * @return {Object} { success, rows: [{ studentNumber, lastName, firstName, middleName, gradeLevel, section, track, gender, lrn, email, parentName, dateOfBirth }] }
 */
function _getCombinedStudentData(academicYearSheet) {
  try {
    if (!academicYearSheet || academicYearSheet.toString().trim() === '') {
      return { success: false, message: 'Academic year must be specified' };
    }

    const targetSheet = getSheet(academicYearSheet);
    if (!targetSheet) {
      return { success: false, message: `Sheet "${academicYearSheet}" not found in Students DB.` };
    }

    // Build Student Number -> Other Information lookup once.
    const otherInfoLookup = {};
    const otherSheet = getSheet(CONFIG.SHEET_NAMES.OTHER_INFORMATION);
    if (otherSheet) {
      const oCols = CONFIG.OTHER_INFO_COLUMNS;
      const oLastRow = otherSheet.getLastRow();
      if (oLastRow >= 2) {
        const oData = otherSheet.getRange(2, 1, oLastRow - 1, CONFIG.OTHER_INFO_HEADERS.length).getValues();
        for (let i = 0; i < oData.length; i++) {
          const sn = _readStudentNumberCell_(oData[i][oCols.STUDENT_NUMBER]);
          if (!sn) continue;
          otherInfoLookup[sn] = {
            lrn:         String(oData[i][oCols.LRN]          || '').trim(),
            email:       String(oData[i][oCols.PARENT_EMAIL] || '').trim(),
            parentName:  String(oData[i][oCols.PARENT_NAME]  || '').trim(),
            dateOfBirth: _formatDateOfBirth_(oData[i][oCols.DATE_OF_BIRTH])
          };
        }
      }
    }

    const rows = [];
    const lastRow = targetSheet.getLastRow();
    if (lastRow >= CONFIG.DATA_START_ROW) {
      const cols = CONFIG.COLUMNS;
      const data = targetSheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.HEADER_ROWS, 8).getValues();
      const emptyOtherInfo = { lrn: '', email: '', parentName: '', dateOfBirth: '' };

      for (let i = 0; i < data.length; i++) {
        const sn = _readStudentNumberCell_(data[i][cols.STUDENT_NUMBER]);
        if (!sn) continue;

        const otherInfo = otherInfoLookup[sn] || emptyOtherInfo;
        rows.push({
          studentNumber: sn,
          lastName:      String(data[i][cols.LAST_NAME]   || '').trim(),
          firstName:     String(data[i][cols.FIRST_NAME]  || '').trim(),
          middleName:    String(data[i][cols.MIDDLE_NAME] || '').trim(),
          gradeLevel:    String(data[i][cols.GRADE_LEVEL] || '').trim(),
          section:       String(data[i][cols.SECTION]     || '').trim(),
          track:        String(data[i][cols.TRACK]      || '').trim(),
          gender:        String(data[i][cols.GENDER]      || '').trim(),
          lrn:           otherInfo.lrn,
          email:         otherInfo.email,
          parentName:    otherInfo.parentName,
          dateOfBirth:   otherInfo.dateOfBirth
        });
      }
    }

    return { success: true, rows: rows };
  } catch (error) {
    console.error('Error in _getCombinedStudentData:', error);
    return { success: false, message: error.message };
  }
}

/**
 * One-time repair for Student Number/LRN cells already corrupted into a
 * Date object by Sheets/Excel auto-detection (legacy rows, or a manual
 * paste directly into the sheet — this can't happen through the app's own
 * import/upsert paths any more since those force plain-text format before
 * writing). Scans every academic-year sheet's Student Number column and
 * "Other Information"'s Student Number + LRN columns; any cell holding a
 * Date is recovered to text via _readStudentNumberCell_, the cell is
 * forced to plain-text format, and the recovered text is written back.
 * LRN cells corrupted to a plain Number (not a Date) can't be reliably
 * recovered — a lost leading zero isn't reconstructible — so those are
 * left untouched and reported separately for manual review.
 * @return {Object} { success, message }
 */
function _repairCorruptedIdentifiers() {
  try {
    const ss = getSpreadsheet();
    const sheets = ss.getSheets();
    const yearPattern = /^\d{4}-\d{4}$/;
    let studentNumbersFixed = 0;
    const unrecoverableLrns = [];

    sheets.forEach(function (sheet) {
      const sheetName = sheet.getName();

      if (yearPattern.test(sheetName)) {
        const lastRow = sheet.getLastRow();
        if (lastRow < CONFIG.DATA_START_ROW) return;
        const col = CONFIG.COLUMNS.STUDENT_NUMBER + 1;
        const range = sheet.getRange(CONFIG.DATA_START_ROW, col, lastRow - CONFIG.HEADER_ROWS, 1);
        const values = range.getValues();
        values.forEach(function (row, i) {
          if (row[0] instanceof Date) {
            const recovered = _readStudentNumberCell_(row[0]);
            const cell = sheet.getRange(CONFIG.DATA_START_ROW + i, col);
            _forcePlainTextFormat_(cell);
            cell.setValue(recovered);
            studentNumbersFixed++;
          }
        });
      } else if (sheetName === CONFIG.SHEET_NAMES.OTHER_INFORMATION) {
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return;
        const cols = CONFIG.OTHER_INFO_COLUMNS;

        const snCol = cols.STUDENT_NUMBER + 1;
        const snRange = sheet.getRange(2, snCol, lastRow - 1, 1);
        const snValues = snRange.getValues();
        snValues.forEach(function (row, i) {
          if (row[0] instanceof Date) {
            const recovered = _readStudentNumberCell_(row[0]);
            const cell = sheet.getRange(2 + i, snCol);
            _forcePlainTextFormat_(cell);
            cell.setValue(recovered);
            studentNumbersFixed++;
          }
        });

        const lrnCol = cols.LRN + 1;
        const lrnRange = sheet.getRange(2, lrnCol, lastRow - 1, 1);
        const lrnValues = lrnRange.getValues();
        lrnValues.forEach(function (row, i) {
          if (row[0] instanceof Date) {
            unrecoverableLrns.push(`${sheetName} row ${2 + i}`);
          } else {
            const asText = String(row[0] || '').trim();
            if (asText && !CONFIG.LRN_PATTERN.test(asText)) {
              unrecoverableLrns.push(`${sheetName} row ${2 + i} ("${asText}")`);
            }
          }
        });
      }
    });

    const lrnNote = unrecoverableLrns.length > 0
      ? `\n\n${unrecoverableLrns.length} LRN value(s) are not a valid 12-digit LRN and could not be auto-repaired (a lost leading zero can't be reconstructed) — please review manually:\n${unrecoverableLrns.join(', ')}`
      : '';

    return {
      success: true,
      message: `Repaired ${studentNumbersFixed} Student Number cell(s) that had been auto-converted to a date.${lrnNote}`
    };
  } catch (error) {
    console.error('Error in _repairCorruptedIdentifiers:', error);
    return { success: false, message: error.message };
  }
}

/**
 * One-time migration to bring legacy 4-digit-segment Student Numbers
 * ("NN-NN-NNNN", e.g. "22-02-0036") up to the current 5-digit-segment
 * standard ("NN-NN-NNNNN", e.g. "22-02-00036") by left-padding the last
 * segment with a zero. Scans every academic-year sheet's Student Number
 * column and "Other Information"'s Student Number column; a cell already
 * in the 5-digit format, or not matching either format, is left untouched
 * and reported separately for manual review. Safe to re-run — already
 * 5-digit values are skipped.
 * @return {Object} { success, message }
 */
function _convertStudentNumbersToStandardFormat() {
  try {
    const ss = getSpreadsheet();
    const sheets = ss.getSheets();
    const yearPattern = /^\d{4}-\d{4}$/;
    const legacyPattern = CONFIG.LEGACY_STUDENT_NUMBER_PATTERN;
    let studentNumbersConverted = 0;
    const unrecognizedValues = [];

    const convertCell = function (cell, rawValue, location) {
      const text = _readStudentNumberCell_(rawValue);
      if (!text) return;
      if (CONFIG.STUDENT_NUMBER_PATTERN.test(text)) return; // already standard
      const match = legacyPattern.exec(text);
      if (!match) {
        unrecognizedValues.push(`${location} ("${text}")`);
        return;
      }
      const converted = `${match[1]}0${match[2]}`;
      _forcePlainTextFormat_(cell);
      cell.setValue(converted);
      studentNumbersConverted++;
    };

    sheets.forEach(function (sheet) {
      const sheetName = sheet.getName();

      if (yearPattern.test(sheetName)) {
        const lastRow = sheet.getLastRow();
        if (lastRow < CONFIG.DATA_START_ROW) return;
        const col = CONFIG.COLUMNS.STUDENT_NUMBER + 1;
        const range = sheet.getRange(CONFIG.DATA_START_ROW, col, lastRow - CONFIG.HEADER_ROWS, 1);
        const values = range.getValues();
        values.forEach(function (row, i) {
          const cell = sheet.getRange(CONFIG.DATA_START_ROW + i, col);
          convertCell(cell, row[0], `${sheetName} row ${CONFIG.DATA_START_ROW + i}`);
        });
      } else if (sheetName === CONFIG.SHEET_NAMES.OTHER_INFORMATION) {
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return;
        const cols = CONFIG.OTHER_INFO_COLUMNS;
        const snCol = cols.STUDENT_NUMBER + 1;
        const snRange = sheet.getRange(2, snCol, lastRow - 1, 1);
        const snValues = snRange.getValues();
        snValues.forEach(function (row, i) {
          const cell = sheet.getRange(2 + i, snCol);
          convertCell(cell, row[0], `${sheetName} row ${2 + i}`);
        });
      }
    });

    const unrecognizedNote = unrecognizedValues.length > 0
      ? `\n\n${unrecognizedValues.length} value(s) didn't match the legacy 4-digit or standard 5-digit format and were left untouched — please review manually:\n${unrecognizedValues.join(', ')}`
      : '';

    return {
      success: true,
      message: `Converted ${studentNumbersConverted} Student Number cell(s) to the standard 5-digit format.${unrecognizedNote}`
    };
  } catch (error) {
    console.error('Error in _convertStudentNumbersToStandardFormat:', error);
    return { success: false, message: error.message };
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

