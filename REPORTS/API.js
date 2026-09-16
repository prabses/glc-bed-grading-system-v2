/**
 * API.js - REPORTS Web App
 * Report builder, PDF export, and Google Drive folder management.
 */

// ---------------------------------------------------------------------------
// Subject display order
// ---------------------------------------------------------------------------

// Canonical subject order for report cards, same list for every grade band
// (PG Grade 1-6, PG Grade 7-12, NG all levels) per school requirements.
// Subjects found in a student's grades but absent from this list are sorted
// after it, alphabetically, so nothing silently disappears from a report.
const SUBJECT_ORDER = [
  'Filipino',
  'English',
  'Mathematics',
  'Science',
  'Sibika at Kultura',
  'Values Education',
  'Computer',
  'MAPEH'
];

const MAPEH_SUBCOMPONENTS = ['Music', 'Arts', 'Physical Education', 'Health'];

/**
 * Sorts a student's grades[] into SUBJECT_ORDER, case-insensitive/trimmed
 * name match. MAPEH's 4 sub-components and any SHS parent/child group's
 * children (row has `parentSubject` set) are excluded from the sort itself
 * and left in their original relative order — each builder already splices
 * them back in immediately after their parent row (see MAPEH_SUBCOMPONENTS/
 * childrenByParent handling in _buildReportCardHtml, _buildNumericalReportCardHtml,
 * _buildLPRHtml), so re-sorting them here would only be discarded.
 */
function _sortGradesBySubjectOrder_(grades) {
  const orderIndex = {};
  SUBJECT_ORDER.forEach((name, i) => { orderIndex[name.toLowerCase()] = i; });

  const indexOf = (g) => {
    const key = (g.subject || '').trim().toLowerCase();
    return orderIndex.hasOwnProperty(key) ? orderIndex[key] : SUBJECT_ORDER.length;
  };

  const ordered = [];
  const rest = [];
  grades.forEach(g => {
    if (MAPEH_SUBCOMPONENTS.includes(g.subject) || g.parentSubject) {
      rest.push(g);
    } else {
      ordered.push(g);
    }
  });

  ordered.sort((a, b) => {
    const ia = indexOf(a), ib = indexOf(b);
    if (ia !== ib) return ia - ib;
    return (a.subject || '').localeCompare(b.subject || '');
  });

  // Re-attach MAPEH sub-components / parent-child children right after their
  // parent row so each builder's "splice children after parent" logic still
  // finds them adjacent, matching grades[]'s original (import-time) order.
  const result = [];
  ordered.forEach(g => {
    result.push(g);
    if (g.subject === 'MAPEH') {
      rest.filter(r => MAPEH_SUBCOMPONENTS.includes(r.subject)).forEach(r => result.push(r));
    }
    rest.filter(r => r.parentSubject === g.subject).forEach(r => result.push(r));
  });
  // Any leftover rest rows whose parent wasn't found in ordered (shouldn't
  // normally happen) still get included, appended at the end.
  rest.forEach(r => {
    if (!result.includes(r)) result.push(r);
  });

  return result;
}

// ---------------------------------------------------------------------------
// Main orchestrators (called from Code.js bridge functions)
// ---------------------------------------------------------------------------

/**
 * Generates report cards for a selected list of students in a class.
 * @param {string}   academicYearSheet - e.g. "2025-2026"
 * @param {string}   gradeLevel        - e.g. "1"
 * @param {string}   section           - e.g. "A"
 * @param {string}   trimester         - "1", "2", or "3"
 * @param {string[]} studentNumbers    - array of student numbers to generate for
 * @param {string}   reportType        - e.g. "PG", "NG" — selects the HTML builder + filename prefix
 * @return {Object} { success, results: [{ studentNumber, fullName, driveUrl, error }] }
 */
function _generateReports(academicYearSheet, gradeLevel, section, trimester, studentNumbers, userEmail, reportType) {
  // Fetch grades and attendance for the whole class in 2 API calls
  const gradesResult = callGradesDb('getClassGrades', {
    academicYearSheet: academicYearSheet,
    gradeLevel: gradeLevel,
    section: section
  });
  if (!gradesResult.success) {
    return { success: false, message: `Failed to fetch grades: ${gradesResult.message}` };
  }

  const attendanceResult = callAttendanceDb('getClassAttendance', {
    academicYearSheet: academicYearSheet,
    gradeLevel: gradeLevel,
    section: section
  });
  if (!attendanceResult.success) {
    return { success: false, message: `Failed to fetch attendance: ${attendanceResult.message}` };
  }

  const allStudents   = gradesResult.students;
  const allAttendance = attendanceResult.attendance;

  // Filter to only the selected student numbers that actually exist in the data
  const targets = (studentNumbers || []).filter(sn => allStudents[sn]);

  if (targets.length === 0) {
    return { success: false, message: 'No matching student records found for the selected students.' };
  }

  // Values Education/Character trait grades for the PG report's TRAITS table.
  // Soft-fail like contacts/demographics below, not a hard return - a class
  // with no Character DB records yet (or Character DB being unreachable)
  // should still generate reports, just with blank trait cells, not block
  // every other report type on a section that never needed traits before.
  const charactersResult = callGradesDb('getClassCharacters', {
    academicYearSheet: academicYearSheet,
    gradeLevel: gradeLevel,
    section: section
  });
  const allCharacters = charactersResult.success ? charactersResult.characters : {};

  // Student No./DOB (global, Other Information sheet) + Gender (per-year sheet)
  const contactsResult = callStudentsDb('getParentContacts', { studentNumbers: targets });
  const allContacts = contactsResult.success ? contactsResult.contacts : {};

  const demographicsResult = callStudentsDb('getStudentsDemographics', {
    studentNumbers: targets,
    academicYearSheet: academicYearSheet
  });
  const allDemographics = demographicsResult.success ? demographicsResult.demographics : {};

  const results = [];

  for (let i = 0; i < targets.length; i++) {
    const sn = targets[i];
    const studentData = allStudents[sn];
    studentData.grades = _sortGradesBySubjectOrder_(studentData.grades);
    const attendanceData = allAttendance[sn] || { fullName: studentData.studentInfo.fullName, months: {} };
    const characterData = allCharacters[sn] || { fullName: studentData.studentInfo.fullName, traits: {} };
    const extraInfo = Object.assign(
      { dateOfBirth: '', lrn: '', gender: '', lastName: '', firstName: '', middleName: '' },
      allContacts[sn] || {},
      allDemographics[sn] || {}
    );
    extraInfo.studentNumber = sn;

    try {
      let html;
      if (reportType === 'NG') {
        html = _buildNumericalReportCardHtml(studentData, academicYearSheet, trimester, extraInfo);
      } else if (reportType === 'SC') {
        html = _buildSchoolClearanceHtml(studentData, academicYearSheet, extraInfo);
      } else if (reportType === 'SF9') {
        html = _buildLPRHtml(studentData, attendanceData, academicYearSheet, trimester, extraInfo);
      } else {
        html = _buildReportCardHtml(studentData, attendanceData, characterData, academicYearSheet, trimester, extraInfo);
      }
      const pdf  = _htmlToPdf(html);
      const url  = _saveReportToDrive(pdf, studentData.studentInfo, extraInfo, academicYearSheet, trimester, reportType);

      _logReport(
        studentData.studentInfo.fullName,
        studentData.studentInfo.gradeLevel,
        studentData.studentInfo.section,
        studentData.studentInfo.track || '',
        academicYearSheet,
        url,
        userEmail
      );

      results.push({
        studentNumber: sn,
        fullName: studentData.studentInfo.fullName,
        driveUrl: url,
        error: null
      });
    } catch (err) {
      console.error(`Error generating report for ${sn}:`, err);
      results.push({
        studentNumber: sn,
        fullName: studentData.studentInfo.fullName,
        driveUrl: null,
        error: err.message
      });
    }
  }

  const successCount = results.filter(r => !r.error).length;
  return {
    success: successCount > 0,
    message: `Generated ${successCount} of ${results.length} report(s).`,
    results: results
  };
}

// ---------------------------------------------------------------------------
// Report Card HTML Builder
// ---------------------------------------------------------------------------

/**
 * Fetches the school seal from Drive (CONFIG.LOGO_FILE_ID) and returns it as
 * a base64 data URI for inline embedding — Drive's HTML->PDF conversion
 * needs a self-contained <img>, not an external fetch. Placeholder until
 * CONFIG.LOGO_FILE_ID is set: returns '' and the header prints without a
 * logo rather than failing report generation.
 * @return {string} data URI (e.g. "data:image/png;base64,...") or '' if unset/unreachable.
 */
function _getLogoDataUri_() {
  const fileId = CONFIG.LOGO_FILE_ID;
  if (!fileId || fileId === 'YOUR_LOGO_DRIVE_FILE_ID_HERE') return '';
  try {
    const blob = DriveApp.getFileById(fileId).getBlob();
    return `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`;
  } catch (err) {
    console.error('_getLogoDataUri_ error (check CONFIG.LOGO_FILE_ID sharing/ID):', err);
    return '';
  }
}

/**
 * Reads the signature block (Designation/Verification/Name) for a report
 * type from the hand-maintained "Signatories" sheet (see
 * CONFIG.SIGNATORIES_SHEET). Looks for a row matching both `reportCode` and
 * `gradeBand` first; if none exists, falls back to that report's
 * CONFIG.SIGNATORIES_ALL_BAND ("ALL"/blank) row — so a school that hasn't
 * split signatories by grade band yet only needs one row per report.
 * @param {string} reportCode - e.g. "NG", "SC", "SF9" (matches the Report column)
 * @param {string} [gradeBand] - e.g. "Elementary", "JHS", "SHS"; omit for the ALL-band row.
 * @return {{designation: string, verification: string, name: string}} blank
 *   strings in every field if the sheet/row doesn't exist.
 */
function _getSignatory_(reportCode, gradeBand) {
  const empty = { designation: '', verification: '', name: '' };
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SIGNATORIES_SHEET);
    if (!sheet) return empty;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return empty;

    const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    const band = String(gradeBand || '').trim().toLowerCase();
    let fallback = null;

    for (let i = 0; i < rows.length; i++) {
      const [report, rowBand, designation, verification, name] = rows[i];
      if (String(report || '').trim() !== reportCode) continue;
      const normalizedBand = String(rowBand || '').trim().toLowerCase();
      const entry = { designation: String(designation || '').trim(), verification: String(verification || '').trim(), name: String(name || '').trim() };
      if (band && normalizedBand === band) return entry;
      if (!normalizedBand || normalizedBand === CONFIG.SIGNATORIES_ALL_BAND.toLowerCase()) fallback = entry;
    }
    return fallback || empty;
  } catch (err) {
    console.error('_getSignatory_ error for report "' + reportCode + '":', err);
    return empty;
  }
}

/**
 * Computes age in whole years as of today from a "March 31, 2019"-style
 * Date of Birth string (see _formatDateOfBirth_ in STUDENTS DB/API.js,
 * which normalizes the sheet cell to this exact format before it reaches
 * REPORTS). Age is derived here rather than stored, so it's always
 * correct as of generation time rather than going stale.
 * @param {string} dateOfBirthStr - e.g. "March 31, 2019"
 * @return {string} whole years as a string, or '' if unparseable/blank
 */
function _calculateAge_(dateOfBirthStr) {
  if (!dateOfBirthStr) return '';
  const dob = new Date(dateOfBirthStr);
  if (isNaN(dob.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return String(age);
}

/**
 * PG's TRAITS/Values Education tables, hardcoded per grade band rather than
 * read from CHARACTERS_REF — these read as a fixed DepEd-style rubric per
 * band, not an admin-configurable list, and Grade 1-6 vs Grade 7-12 use
 * genuinely different traits (not a subset/superset of each other). Each
 * trait's actual grade still comes from Character DB at render time (see
 * _getClassCharacters/getClassCharacters) via an exact name match against
 * these lists — a trait here with no matching Character DB row for a given
 * student just renders blank, it's not an error.
 * Grade 1-6: traits grouped under 3 category header rows (matches
 * "Periodical Letter Grade - Grade 1-6.pdf"). Grade 7-12: flat list, no
 * category headers (matches "Periodical Letter Grade - Grade 7-11.pdf" — the
 * reference file is named "7-11" but the layout applies to all of JHS/SHS,
 * grade levels 7 through 12).
 */
const PG_TRAITS_GRADE_1_TO_6 = [
  { category: 'EMOTIONAL AND SOCIAL DEVELOPMENT', traits: [
    'Courteous in speech and manners',
    'Displays cheerful disposition',
    'Displays self-confidence',
    'Follows rules and regulations',
    'Respects rights and properties of others',
    'Willingness to admit mistakes and take responsibility for correcting them',
    'Relates well with teachers and classmates',
    'Ability to manage ones emotions and impulses',
    'Resolves conflicts in non-violent ways'
  ]},
  { category: 'WORK HABITS', traits: [
    'Assumes responsibility',
    'Regular and punctual in doing assignments',
    'Works independently',
    'Works cooperatively in a joint project',
    'Gives positive feedbacks and compliments on others’ works',
    'Resourceful',
    'Shows leadership',
    'Works patiently and diligently',
    'Works voluntarily'
  ]},
  { category: 'PRACTICAL LIFE AND HEALTH HABITS', traits: [
    'Shows leadership and performs well in his / her duties',
    'Conserves water and electricity',
    'Maintains cleanliness of the classroom and surroundings',
    'Handles personal and school materials with care',
    'Keeps oneself neat and orderly',
    'Shows interest in gardening and expresses care for animals',
    'Picks up and disposes trashes voluntarily'
  ]}
];

const PG_TRAITS_GRADE_7_TO_12 = [
  { category: null, traits: [
    'Conduct',
    'Work and Study Habits',
    'Relationships'
  ]}
];

/**
 * Builds the report card as an HTML string styled for PDF printing.
 * Layout matches "Periodical Letter Grade - Grade 1-6.pdf" / "Periodical
 * Letter Grade - Grade 7-11.pdf" reference templates — a two-column single
 * page (left: student info/grades/attendance/performance descriptors/
 * footer, right: TRAITS/Values Education table). Page margins: 0.5in top/
 * left/right, 0.25in bottom (@page rule).
 * @param {Object} characterData - { fullName, traits: { [traitName]: {
 *   t1EQ, t2EQ, t3EQ, finalEQ } } } from GRADES DB's getClassCharacters
 *   (which reads Character DB) - see PG_TRAITS_GRADE_1_TO_6/_7_TO_12 above
 *   for where the trait NAMES come from; this only supplies each one's grade.
 * @param {Object} extraInfo - { studentNumber, gender, dateOfBirth } —
 *   fetched from STUDENTS DB (getParentContacts + getStudentsDemographics),
 *   not present on studentData.studentInfo which only carries grade/section/track.
 *   Age is not fetched — it's calculated here from dateOfBirth vs. today.
 */
function _buildReportCardHtml(studentData, attendanceData, characterData, academicYearSheet, trimester, extraInfo) {
  const info     = studentData.studentInfo;
  // MAPEH's Music/Arts/Physical Education/Health arrive as their own rows in
  // grades[] (see the isMAPEH import branch in GRADES DB/API.js _importGrades)
  // so their own numeric grades can feed the NG certificate's sub-rows. PG
  // shows only the single MAPEH line per its reference template — no
  // breakdown — so those 4 rows are excluded here entirely, not just from
  // the average. Same treatment for any SHS parent/child subject group (e.g.
  // "Effective Communication & Mabisang Komunikasyon") - each grade row's
  // `parentSubject` field (set by GRADES DB's _importGrades from the
  // TEMPLATE MASTERFILE GRADE 11-12 masterfile's SUBJECTS_REF) marks it as a
  // child, so it's excluded here the same way, without a hardcoded name list.
  // (MAPEH_SUBCOMPONENTS is the shared top-of-file constant.)
  const grades   = studentData.grades.filter(g => !MAPEH_SUBCOMPONENTS.includes(g.subject) && !g.parentSubject);
  const trimNum  = parseInt(trimester, 10);
  const extra    = extraInfo || {};
  const logoUri  = _getLogoDataUri_();

  // Grade 1-6's left column (grades/attendance/descriptors/footer) grows
  // with subject count while the right column's TRAITS list is a fixed
  // 25-row constant (PG_TRAITS_GRADE_1_TO_6) that never changes size to
  // match. Baseline padding (2.75px) aligns both columns' bottoms at 9
  // subjects (the real max for grades 4-6, vs. 8 for 1-3) — scale it down
  // 0.25px per missing subject row for shorter subject lists (2.5px at 8
  // subjects) so the two columns still end together instead of the right
  // one overshooting.
  const traitsCellPadding = (2.75 - Math.max(0, 9 - grades.length) * 0.25).toFixed(2);

  // Compute General Average per trimester, converted to EQ letter
  const subjectGrades = grades.filter(g => g.subject && g.subject !== 'MAPEH');
  const t1Grades = subjectGrades.map(g => parseFloat(g.t1Transmuted)).filter(v => !isNaN(v));
  const t2Grades = subjectGrades.map(g => parseFloat(g.t2Transmuted)).filter(v => !isNaN(v));
  const t3Grades = subjectGrades.map(g => parseFloat(g.t3Transmuted)).filter(v => !isNaN(v));
  const finalGrades = subjectGrades.map(g => parseFloat(g.finalGrading)).filter(v => !isNaN(v));

  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const genAvgT1 = _numericToEQ(avg(t1Grades));
  const genAvgT2 = _numericToEQ(avg(t2Grades));
  const genAvgT3 = _numericToEQ(avg(t3Grades));
  const genAvgFinal = _numericToEQ(avg(finalGrades));

  // Build subject rows — show EQ (letter) values, not transmuted numbers
  let subjectRows = '';
  for (let i = 0; i < grades.length; i++) {
    const g = grades[i];
    const t1 = trimNum >= 1 ? (g.t1EQ || '') : '';
    const t2 = trimNum >= 2 ? (g.t2EQ || '') : '';
    const t3 = trimNum >= 3 ? (g.t3EQ || '') : '';
    const final = trimNum >= 3 ? (g.finalEQ || '') : '';
    subjectRows += `
      <tr>
        <td class="subject-col">${g.subject}</td>
        <td>${t1}</td>
        <td>${t2}</td>
        <td>${t3}</td>
        <td>${final}</td>
      </tr>`;
  }

  // Build attendance rows. Per both reference PDFs, PG's Attendance table
  // always shows this exact fixed 11-month range (June through April, no
  // May) with 0s for any month the student has no data for yet - it does
  // NOT filter down to only months with recorded data (that was the
  // previous, incorrect behavior; CONFIG.MONTHS' July-June order/12-month
  // set is for other reports, not this one).
  const PG_ATTENDANCE_MONTHS = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April'];
  const mData  = attendanceData.months || {};
  const activeMonths = PG_ATTENDANCE_MONTHS;
  let totalSD = 0, totalDP = 0, totalDA = 0;

  // A month with 0 Days Present AND 0 Days Absent hasn't actually happened yet
  // for this student (e.g. future/unrecorded month), even if Attendance DB
  // still has some other School Days figure stored for it from the calendar -
  // show 0 for School Days too in that case, rather than a days-in-session
  // count that implies attendance was already being tracked.
  const effectiveSchoolDays = {};
  for (let m = 0; m < activeMonths.length; m++) {
    const month = activeMonths[m];
    const rec   = mData[month] || {};
    const daysPresent = rec.daysPresent !== undefined && rec.daysPresent !== '' ? Number(rec.daysPresent) : 0;
    const daysAbsent  = rec.daysAbsent  !== undefined && rec.daysAbsent  !== '' ? Number(rec.daysAbsent)  : 0;
    const schoolDays  = rec.schoolDays  !== undefined && rec.schoolDays  !== '' ? Number(rec.schoolDays)  : 0;
    effectiveSchoolDays[month] = (daysPresent === 0 && daysAbsent === 0) ? 0 : schoolDays;

    totalSD += effectiveSchoolDays[month];
    totalDP += daysPresent;
    totalDA += daysAbsent;
  }

  const schoolYear  = academicYearSheet;
  const studentName = info.fullName || '';
  const age         = _calculateAge_(extra.dateOfBirth);
  // "1st Trimester" -> "1st" for the acknowledgment sentence's fill-in blank
  const trimesterOrdinal = (CONFIG.TRIMESTERS[trimester] || '').replace(/\s*Trimester$/i, '') || trimester;

  // Grade 1-6 gets the long, category-grouped trait list; Grade 7-12 gets the
  // short flat list — see PG_TRAITS_GRADE_1_TO_6/_7_TO_12 above for why these
  // are hardcoded rather than read from CHARACTERS_REF. The two bands also use
  // entirely different page structures below (landscape two-column vs.
  // portrait single-column) — see the isGrade1To6 branch further down.
  const gradeLevelNum = parseInt(info.gradeLevel, 10);
  const isGrade1To6 = gradeLevelNum <= 6;
  const traitGroups = isGrade1To6 ? PG_TRAITS_GRADE_1_TO_6 : PG_TRAITS_GRADE_7_TO_12;
  const charTraits = (characterData && characterData.traits) || {};

  let traitRows = '';
  for (let g = 0; g < traitGroups.length; g++) {
    const group = traitGroups[g];
    if (group.category) {
      traitRows += `
      <tr class="trait-category-row"><td colspan="5">${group.category}</td></tr>`;
    }
    for (let t = 0; t < group.traits.length; t++) {
      const traitName = group.traits[t];
      const rec = charTraits[traitName] || {};
      const t1 = trimNum >= 1 ? (rec.t1EQ || '') : '';
      const t2 = trimNum >= 2 ? (rec.t2EQ || '') : '';
      const t3 = trimNum >= 3 ? (rec.t3EQ || '') : '';
      const final = trimNum >= 3 ? (rec.finalEQ || '') : '';
      traitRows += `
      <tr>
        <td class="trait-col">${traitName}</td>
        <td>${t1}</td>
        <td>${t2}</td>
        <td>${t3}</td>
        <td>${final}</td>
      </tr>`;
    }
  }

  const descriptorsTable = `
      <table class="rc-descriptors">
        <caption>PERFORMANCE DESCRIPTORS</caption>
        <thead>
          <tr>
            <th>Grading Scale</th>
            <th>Description</th>
            <th>Traits Scale</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td class="scale-col">A</td><td>Advancing</td><td class="scale-col">O</td><td>Outstanding</td></tr>
          <tr><td class="scale-col">B</td><td>Benchmarking</td><td class="scale-col">VG</td><td>Very Good</td></tr>
          <tr><td class="scale-col">C</td><td>Connecting</td><td class="scale-col">G</td><td>Good</td></tr>
          <tr><td class="scale-col">D</td><td>Developing</td><td class="scale-col">F</td><td>Fair</td></tr>
          <tr><td class="scale-col">E</td><td>Emerging</td><td class="scale-col">NI</td><td>Needs Improvement</td></tr>
        </tbody>
      </table>`;

  // Forced 2-line split for both grade bands: line 1 ends at the name, line
  // 2 starts at "for the" - otherwise "for the" dangles alone at the end of
  // line 1 (name inline) or the layout needs a 3rd line (name wrapped).
  const acknowledgmentBlock = `
      <p class="rc-footer">
        This is to acknowledge receipt of the periodical progress report of
        <span class="fill name">${studentName}</span><br>
        for the <span class="fill">${trimesterOrdinal}</span> term of school year <span class="fill">${schoolYear}</span>.
      </p>`;

  const disclaimerBlock = `
      <p class="rc-disclaimer">
        Note: This is a computer-generated document, hence does not require a signature. For any grade concern,
        request an appointment for grade consultation with your Teacher/s or the Academic Coordinator.
      </p>`;

  // Kept together for Grade 7-12's single-column layout, where both sit one
  // after another at the bottom of the page (see the isGrade1To6 branch below
  // for why Grade 1-6 needs these split into two separate placements instead).
  const footerBlock = acknowledgmentBlock + '\n' + disclaimerBlock;

  // Grade 1-6 and Grade 7-12 aren't the same layout with a font swap — they're
  // genuinely different page structures, confirmed by measuring both reference
  // PDFs directly (PyMuPDF page.get_text('dict'), same method as the font-size
  // notes below): Grade 1-6 is landscape, two columns side by side (grades/
  // attendance/descriptors/footer on the left, the ~25-row grouped TRAITS
  // table on the right, each column ~342-346pt of the 720pt printable width).
  // Grade 7-12 is portrait, ONE full-width column, everything stacked
  // top-to-bottom (grades table, then the 3-row flat TRAITS table below it,
  // then attendance/descriptors/footer) — there is no side-by-side split.
  if (isGrade1To6) {
    // Grade 1-6 font sizes measured from "Periodical Letter Grade -
    // Grade 1-6.pdf" (PyMuPDF span sizes, pt -> px via *1.333): school name
    // 10.06pt/13.4px, dept 9.39pt/12.5px, report title 8.72pt/11.6px, address
    // 6.71pt/8.9px, and ALL body/table content (info block, grades, TRAITS,
    // attendance, descriptors, footer) a uniform 8.05pt/10.7px — this report
    // fits far more content per page than the old single-column PG template,
    // hence the much smaller scale than Grade 7-12 below.
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* Custom page height (not standard Letter's 8.5in) - trimmed to hug
       content instead of leaving trailing white space below the two
       columns. At 9 subjects (the real max for grades 4-6) the right
       TRAITS column renders ~678px @96dpi tall - taller than 7.5in's
       ~648px printable height, so this deliberately runs a small
       overflow onto a 2nd page for the fullest subject lists in
       exchange for a tighter fit everywhere else. Re-measure and adjust
       this value if the subject/trait lists grow, or if the overflow
       becomes unacceptable. */
    @page { size: 11in 7.5in; margin: 0.5in 0.5in 0.25in 0.5in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 10.7px; background: #fff; }

    .rc-page { display: flex; gap: 18px; align-items: flex-start; }
    .rc-col-left { flex: 1 1 0; min-width: 0; }
    .rc-col-right { flex: 1 1 0; min-width: 0; }

    .rc-header { position: relative; text-align: center; margin-bottom: 10px; }
    .rc-header .school-row { display: inline-flex; align-items: center; justify-content: center; gap: 22px; }
    .rc-header .corner-logo { position: absolute; left: 20px; top: 0; width: 52.65px; height: 52.65px; }
    .rc-header .school-text { text-align: center; }
    .rc-header h1 { font-size: 13.4px; font-weight: bold; margin-bottom: 1px; }
    .rc-header p  { font-size: 8.9px; margin: 0; font-style: italic; }
    .rc-header .dept { font-size: 12.5px; font-weight: bold; font-style: normal; margin-top: 4px; }
    .rc-header .report-title { font-size: 11.6px; font-weight: bold; font-style: normal; text-decoration: underline; margin-top: 12px; }

    .rc-info { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .rc-info td { padding: 1px 3px; }
    .rc-info .label { font-weight: bold; white-space: nowrap; }
    .rc-info .value { border-bottom: 1px solid #333; padding-bottom: 2px; font-style: normal; }

    .rc-grades { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 5px; border: 1.5px solid #333; }
    .rc-grades th, .rc-grades td { border: 1px solid #333; padding: 2px 4px; text-align: center; }
    .rc-grades .subject-col { text-align: left; min-width: 100px; vertical-align: middle; }
    .rc-grades .learning-areas-header { text-align: center; vertical-align: middle; border-bottom: 2px solid #333; }
    .rc-grades thead th { background: #d9d9d9; font-weight: bold; vertical-align: middle; }
    .rc-grades thead tr:last-child th { border-bottom: 2px solid #333; }
    .rc-grades tbody tr.general-average-row { font-weight: bold; background: #f3f3f3; }
    .rc-grades tbody tr.general-average-row td.subject-col { text-align: left; }
    .rc-grades-average { margin-bottom: 8px; }

    .rc-attendance { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.5px solid #333; }
    .rc-attendance th, .rc-attendance td { border: 1px solid #333; padding: 2px 3px; text-align: center; font-style: italic; }
    .rc-attendance thead th { background: #d9d9d9; font-weight: bold; font-style: normal; }
    .rc-attendance .row-label { text-align: left; white-space: nowrap; padding-left: 4px; font-style: normal; }
    .rc-attendance td.total-col { font-weight: bold; font-style: normal; }

    .rc-descriptors { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.5px solid #333; }
    .rc-descriptors caption { font-weight: bold; padding: 2px; border: 1px solid #333; border-bottom: none; background: #d9d9d9; caption-side: top; }
    .rc-descriptors th, .rc-descriptors td { border: 1px solid #333; padding: 2px 4px; text-align: center; }
    .rc-descriptors thead th { background: #d9d9d9; font-weight: bold; }
    .rc-descriptors td.scale-col { font-weight: bold; }

    .rc-footer { font-size: 10.7px; margin-top: 6px; line-height: 1.5; font-style: italic; text-align: center; }
    .rc-footer .fill { display: inline-block; min-width: 80px; border-bottom: 1px solid #333; padding: 0 3px 1px; text-align: center; font-weight: bold; }
    .rc-footer .fill.name { min-width: 120px; }

    /* Same 10.7px as .rc-footer - both measured at 8.05pt in the reference PDF,
       not the smaller address-line size this was previously copied from. */
    .rc-disclaimer { font-size: 10.7px; font-style: italic; line-height: 1.3; margin-top: 12px; text-align: left; }

    /* TRAITS name column ~71% / each numeric column ~7.25%, measured off the
       reference PDF's own table borders — needed so the longest trait label
       ("Willingness to admit mistakes and take responsibility for correcting
       them") fits on one line instead of wrapping and blowing out row height. */
    .rc-traits { width: 100%; table-layout: fixed; border-collapse: collapse; border: 1.5px solid #333; }
    .rc-traits th, .rc-traits td { border: 1px solid #333; padding: ${traitsCellPadding}px 4px; text-align: center; }
    .rc-traits .traits-header { text-align: center; vertical-align: middle; border-bottom: 2px solid #333; }
    .rc-traits thead th { background: #d9d9d9; font-weight: bold; vertical-align: middle; }
    .rc-traits thead tr:last-child th { border-bottom: 2px solid #333; }
    .rc-traits .trait-col { text-align: left; }
    .rc-traits tr.trait-category-row td { text-align: center; font-weight: bold; background: #f3f3f3; }
  </style>
</head>
<body>

  <div class="rc-page">
    <div class="rc-col-left">

      <div class="rc-header">
        ${logoUri ? `<img class="corner-logo" src="${logoUri}" alt="">` : ''}
        <div class="school-row">
          <div class="school-text">
            <h1>${CONFIG.SCHOOL_NAME.toUpperCase()} FOUNDATION, INC.</h1>
            <p>Along Gov. Fortunato Halili Rd. Brgy. San Vicente, Santa Maria, Bulacan</p>
          </div>
        </div>
        <p class="dept">${CONFIG.DEPARTMENT}</p>
        <p class="report-title">PERIODICAL LETTER GRADE</p>
      </div>

      <table class="rc-info">
        <tr>
          <td class="label" style="width:22%;">Student Information:</td>
          <td style="width:28%;"></td>
          <td class="label" style="width:16%;">S.Y.:</td>
          <td class="value">${schoolYear}</td>
        </tr>
        <tr>
          <td class="label">Name:</td>
          <td class="value">${studentName}</td>
          <td class="label">Gender:</td>
          <td class="value">${extra.gender || ''}</td>
        </tr>
        <tr>
          <td class="label">Student No.:</td>
          <td class="value">${extra.studentNumber || ''}</td>
          <td class="label">Grade:</td>
          <td class="value">${info.gradeLevel || ''}</td>
        </tr>
        <tr>
          <td class="label">Date of Birth:</td>
          <td class="value">${extra.dateOfBirth || ''}</td>
          <td class="label">Age:</td>
          <td class="value">${age}</td>
        </tr>
      </table>

      <table class="rc-grades">
        <colgroup>
          <col style="width:40%">
          <col style="width:15%">
          <col style="width:15%">
          <col style="width:15%">
          <col style="width:15%">
        </colgroup>
        <thead>
          <tr>
            <th class="learning-areas-header" rowspan="2">Learning Areas</th>
            <th colspan="3">TERM</th>
            <th class="learning-areas-header" rowspan="2">Final Grade</th>
          </tr>
          <tr>
            <th>1</th>
            <th>2</th>
            <th>3</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRows}
        </tbody>
      </table>

      <table class="rc-grades rc-grades-average">
        <colgroup>
          <col style="width:40%">
          <col style="width:15%">
          <col style="width:15%">
          <col style="width:15%">
          <col style="width:15%">
        </colgroup>
        <tbody>
          <tr class="general-average-row">
            <td class="subject-col">General Average</td>
            <td>${trimNum >= 1 ? genAvgT1 : ''}</td>
            <td>${trimNum >= 2 ? genAvgT2 : ''}</td>
            <td>${trimNum >= 3 ? genAvgT3 : ''}</td>
            <td>${trimNum >= 3 ? genAvgFinal : ''}</td>
          </tr>
        </tbody>
      </table>

      <table class="rc-attendance">
        <thead>
          <tr>
            <th class="row-label">Attendance</th>
            ${activeMonths.map(m => `<th>${m.slice(0,3)}</th>`).join('')}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="row-label">Days of School</td>
            ${activeMonths.map(m => `<td>${effectiveSchoolDays[m] || 0}</td>`).join('')}
            <td class="total-col">${totalSD || 0}</td>
          </tr>
          <tr>
            <td class="row-label">Days Present</td>
            ${activeMonths.map(m => `<td>${(mData[m] || {}).daysPresent || 0}</td>`).join('')}
            <td class="total-col">${totalDP || 0}</td>
          </tr>
          <tr>
            <td class="row-label">Days Absent</td>
            ${activeMonths.map(m => `<td>${(mData[m] || {}).daysAbsent || 0}</td>`).join('')}
            <td class="total-col">${totalDA || 0}</td>
          </tr>
        </tbody>
      </table>

      ${descriptorsTable}
      ${acknowledgmentBlock}

    </div>

    <div class="rc-col-right">
      <table class="rc-traits">
        <colgroup>
          <col style="width:71%">
          <col style="width:7.25%">
          <col style="width:7.25%">
          <col style="width:7.25%">
          <col style="width:7.25%">
        </colgroup>
        <thead>
          <tr>
            <th class="traits-header" colspan="5">VALUES EDUCATION / CHARACTER BUILDING</th>
          </tr>
          <tr>
            <th class="traits-header" rowspan="2">TRAITS</th>
            <th colspan="3">Term Assessment</th>
            <th class="traits-header" rowspan="2">Final</th>
          </tr>
          <tr>
            <th>1</th>
            <th>2</th>
            <th>3</th>
          </tr>
        </thead>
        <tbody>
          ${traitRows}
        </tbody>
      </table>
      ${disclaimerBlock}
    </div>

  </div>

</body>
</html>`;
  }

  // Grade 7-12 font sizes measured from "Periodical Letter Grade -
  // Grade 7-11.pdf" (reference file is named "7-11" but the layout applies to
  // all of JHS/SHS, grade levels 7 through 12): school name 11.16pt/14.9px,
  // dept 10.41pt/13.9px, report title 9.67pt/12.9px, address 7.44pt/9.9px,
  // body/table content 8.93pt/11.9px — larger than Grade 1-6's scale since
  // this layout only needs to fit ~9 rows total (student info + grades + 3
  // traits + attendance + descriptors) in one full-width portrait column,
  // not two narrower columns with a 25-row trait list.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: legal portrait; margin: 0.5in 0.5in 0.25in 0.5in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11.9px; background: #fff; }
    .rc-content { width: 100%; margin: 0 auto; }

    .rc-header { position: relative; text-align: center; margin-bottom: 14px; }
    .rc-header .school-row { display: inline-flex; align-items: center; justify-content: center; gap: 28px; }
    .rc-header .corner-logo { position: absolute; left: 107.77px; top: 0; width: 65.61px; height: 65.61px; }
    .rc-header h1 { font-size: 14.9px; font-weight: bold; margin-bottom: 1px; }
    .rc-header p  { font-size: 9.9px; margin: 0; font-style: italic; }
    .rc-header .dept { font-size: 13.9px; font-weight: bold; font-style: normal; margin-top: 6px; }
    .rc-header .report-title { font-size: 12.9px; font-weight: bold; font-style: normal; text-decoration: underline; margin-top: 18px; }

    .rc-info { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .rc-info td { padding: 2px 4px; }
    .rc-info .label { font-weight: bold; white-space: nowrap; }
    .rc-info .value { border-bottom: 1px solid #333; padding-bottom: 3px; font-style: normal; }

    .rc-grades { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 2px; border: 2px solid #333; }
    .rc-grades th, .rc-grades td { border: 1px solid #333; padding: 2px 6px; text-align: center; }
    .rc-grades .subject-col { text-align: left; min-width: 140px; vertical-align: middle; }
    .rc-grades .learning-areas-header { text-align: center; vertical-align: middle; border-bottom: 2px solid #333; }
    .rc-grades thead th { background: #d9d9d9; font-weight: bold; vertical-align: middle; }
    .rc-grades thead tr:last-child th { border-bottom: 2px solid #333; }
    .rc-grades tbody tr.general-average-row { font-weight: bold; background: #f3f3f3; }
    .rc-grades tbody tr.general-average-row td.subject-col { text-align: left; }
    .rc-grades-average { margin-top: 0; margin-bottom: 8px; }

    /* Same measured ratio as Grade 1-6's TRAITS table, but only 3 flat rows
       here so wrapping was never actually a risk - kept consistent anyway. */
    .rc-traits { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 12px; border: 2px solid #333; }
    .rc-traits th, .rc-traits td { border: 1px solid #333; padding: 1px 6px; text-align: center; }
    .rc-traits .traits-header { text-align: center; vertical-align: middle; border-bottom: 2px solid #333; }
    .rc-traits thead th { background: #d9d9d9; font-weight: bold; vertical-align: middle; }
    .rc-traits thead tr:last-child th { border-bottom: 2px solid #333; }
    .rc-traits .trait-col { text-align: left; }
    .rc-traits tr.trait-category-row td { text-align: center; font-weight: bold; background: #f3f3f3; }

    .rc-attendance { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 2px solid #333; }
    .rc-attendance th, .rc-attendance td { border: 1px solid #333; padding: 1px 4px; text-align: center; font-style: italic; }
    .rc-attendance thead th { background: #d9d9d9; font-weight: bold; font-style: normal; }
    .rc-attendance .row-label { text-align: left; white-space: nowrap; padding-left: 6px; font-style: normal; }
    .rc-attendance td.total-col { font-weight: bold; font-style: normal; }

    .rc-descriptors { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 2px solid #333; }
    .rc-descriptors caption { font-weight: bold; padding: 2px 4px; border: 1px solid #333; border-bottom: none; background: #d9d9d9; caption-side: top; }
    .rc-descriptors th, .rc-descriptors td { border: 1px solid #333; padding: 1px 6px; text-align: center; }
    .rc-descriptors thead th { background: #d9d9d9; font-weight: bold; }
    .rc-descriptors td.scale-col { font-weight: bold; }

    .rc-footer { font-size: 11.9px; padding-top: 20px; margin-top: 4px; line-height: 1.5; font-style: italic; text-align: center; }
    .rc-footer .fill { display: inline-block; min-width: 100px; border-bottom: 1px solid #333; padding: 0 4px 1px; text-align: center; font-weight: bold; }
    .rc-footer .fill.name { min-width: 130px; }

    /* Same 11.9px as .rc-footer - both measured at 8.93pt in the reference PDF. */
    .rc-disclaimer { font-size: 11.9px; font-style: italic; line-height: 1.25; margin-top: 20px; padding-bottom: 20px; }
  </style>
</head>
<body>

  <div class="rc-content">

  <div class="rc-header">
    ${logoUri ? `<img class="corner-logo" src="${logoUri}" alt="">` : ''}
    <div class="school-row">
      <h1>${CONFIG.SCHOOL_NAME.toUpperCase()} FOUNDATION, INC.</h1>
    </div>
    <p>Along Gov. Fortunato Halili Rd. Brgy. San Vicente, Santa Maria, Bulacan</p>
    <p class="dept">${CONFIG.DEPARTMENT}</p>
    <p class="report-title">PERIODICAL LETTER GRADE</p>
  </div>

  <table class="rc-info">
    <tr>
      <td class="label" style="width:22%;">Student Information:</td>
      <td style="width:28%;"></td>
      <td class="label" style="width:16%;">S.Y.:</td>
      <td class="value">${schoolYear}</td>
    </tr>
    <tr>
      <td class="label">Name:</td>
      <td class="value">${studentName}</td>
      <td class="label">Gender:</td>
      <td class="value">${extra.gender || ''}</td>
    </tr>
    <tr>
      <td class="label">Student No.:</td>
      <td class="value">${extra.studentNumber || ''}</td>
      <td class="label">Grade:</td>
      <td class="value">${info.gradeLevel || ''}</td>
    </tr>
    <tr>
      <td class="label">Date of Birth:</td>
      <td class="value">${extra.dateOfBirth || ''}</td>
      <td class="label">Age:</td>
      <td class="value">${age}</td>
    </tr>
  </table>

  <table class="rc-grades">
    <colgroup>
      <col style="width:40%">
      <col style="width:15%">
      <col style="width:15%">
      <col style="width:15%">
      <col style="width:15%">
    </colgroup>
    <thead>
      <tr>
        <th class="learning-areas-header" rowspan="2">Learning Areas</th>
        <th colspan="3">TERM</th>
        <th class="learning-areas-header" rowspan="2">Final Grade</th>
      </tr>
      <tr>
        <th>1</th>
        <th>2</th>
        <th>3</th>
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
    </tbody>
  </table>

  <table class="rc-grades rc-grades-average">
    <colgroup>
      <col style="width:40%">
      <col style="width:15%">
      <col style="width:15%">
      <col style="width:15%">
      <col style="width:15%">
    </colgroup>
    <tbody>
      <tr class="general-average-row">
        <td class="subject-col">General Average</td>
        <td>${trimNum >= 1 ? genAvgT1 : ''}</td>
        <td>${trimNum >= 2 ? genAvgT2 : ''}</td>
        <td>${trimNum >= 3 ? genAvgT3 : ''}</td>
        <td>${trimNum >= 3 ? genAvgFinal : ''}</td>
      </tr>
    </tbody>
  </table>

  <table class="rc-traits">
    <colgroup>
      <col style="width:38%">
      <col style="width:13.2%">
      <col style="width:13.2%">
      <col style="width:13.2%">
      <col style="width:22.4%">
    </colgroup>
    <thead>
      <tr>
        <th class="traits-header" colspan="5">VALUES EDUCATION / CHARACTER BUILDING</th>
      </tr>
      <tr>
        <th class="traits-header" rowspan="2">TRAITS</th>
        <th colspan="3">Term Assessment</th>
        <th class="traits-header" rowspan="2">Final</th>
      </tr>
      <tr>
        <th>1</th>
        <th>2</th>
        <th>3</th>
      </tr>
    </thead>
    <tbody>
      ${traitRows}
    </tbody>
  </table>

  <table class="rc-attendance">
    <thead>
      <tr>
        <th class="row-label">Attendance</th>
        ${activeMonths.map(m => `<th>${m.slice(0,3)}</th>`).join('')}
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="row-label">Days of School</td>
        ${activeMonths.map(m => `<td>${effectiveSchoolDays[m] || 0}</td>`).join('')}
        <td class="total-col">${totalSD || 0}</td>
      </tr>
      <tr>
        <td class="row-label">Days Present</td>
        ${activeMonths.map(m => `<td>${(mData[m] || {}).daysPresent || 0}</td>`).join('')}
        <td class="total-col">${totalDP || 0}</td>
      </tr>
      <tr>
        <td class="row-label">Days Absent</td>
        ${activeMonths.map(m => `<td>${(mData[m] || {}).daysAbsent || 0}</td>`).join('')}
        <td class="total-col">${totalDA || 0}</td>
      </tr>
    </tbody>
  </table>

  ${descriptorsTable}
  ${footerBlock}

  </div>

</body>
</html>`;
}

/**
 * Builds the "Numerical Grade" certificate as an HTML string styled for PDF
 * printing. Layout matches "Numerical Grade (NG) - Google Sheets.pdf"
 * reference template — a distinct document from the PG report card, not a
 * value-swapped variant of it: title reads "CERTIFICATE OF NUMERICAL GRADE",
 * there's no attendance table, MAPEH's Music/Arts/PE/Health sub-components
 * are shown as indented italic rows under the MAPEH row, and the signature
 * block is a single "Administrator" line (no parent acknowledgment) followed
 * by a dry-seal validity disclaimer.
 * @param {Object} studentData - { studentInfo, grades } from getClassGrades.
 *   grades[] includes MAPEH's own row plus 4 sub-component rows (subject:
 *   "Music"/"Arts"/"Physical Education"/"Health") — see the isMAPEH import
 *   branch in GRADES DB/API.js _importGrades.
 * @param {string} academicYearSheet - e.g. "2025-2026"
 * @param {string} trimester - "1", "2", or "3"
 * @param {Object} extraInfo - { studentNumber, gender, dateOfBirth } — see
 *   _buildReportCardHtml for where this comes from.
 */
function _buildNumericalReportCardHtml(studentData, academicYearSheet, trimester, extraInfo) {
  const info      = studentData.studentInfo;
  const grades    = studentData.grades;
  const trimNum   = parseInt(trimester, 10);
  const extra     = extraInfo || {};
  const logoUri   = _getLogoDataUri_();
  const signatory = _getSignatory_('NG');

  const subByName = {};
  grades.forEach(g => { if (g.subject) subByName[g.subject] = g; });

  // SHS parent/child subject groups (e.g. "Effective Communication & Mabisang
  // Komunikasyon") are grouped the same way MAPEH's sub-components are below,
  // but driven by each grade row's `parentSubject` field (set by GRADES DB's
  // _importGrades from SUBJECTS_REF's Parent Subject column) instead of a
  // hardcoded subject list - so any number of parent/child groups, with any
  // number of children each, are handled without new code per group.
  const childrenByParent = {};
  grades.forEach(g => {
    if (g.parentSubject) {
      if (!childrenByParent[g.parentSubject]) childrenByParent[g.parentSubject] = [];
      childrenByParent[g.parentSubject].push(g);
    }
  });
  const isChildSubject = g => !!g.parentSubject;

  // General Average excludes MAPEH's 4 sub-components (already folded into
  // the single MAPEH row) so they aren't double-counted. Same for any SHS
  // parent/child group's children - only the parent's own row counts.
  const avgEligible = grades.filter(g => g.subject && !MAPEH_SUBCOMPONENTS.includes(g.subject) && !isChildSubject(g));
  const t1Grades = avgEligible.map(g => parseFloat(g.t1Transmuted)).filter(v => !isNaN(v));
  const t2Grades = avgEligible.map(g => parseFloat(g.t2Transmuted)).filter(v => !isNaN(v));
  const t3Grades = avgEligible.map(g => parseFloat(g.t3Transmuted)).filter(v => !isNaN(v));
  const finalGrades = avgEligible.map(g => parseFloat(g.finalGrading)).filter(v => !isNaN(v));

  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  // Every grade shown on this certificate is a whole number — subject grades
  // and the General Average alike — even though GRADES DB may store the
  // transmuted/final values with decimal precision.
  const fmt = (v) => (v === null || v === '' || isNaN(v)) ? '' : String(Math.round(Number(v)));
  const genAvgT1 = fmt(avg(t1Grades));
  const genAvgT2 = fmt(avg(t2Grades));
  const genAvgT3 = fmt(avg(t3Grades));
  const genAvgFinal = fmt(avg(finalGrades));

  const gradeRow = (g, extraClass) => {
    const t1 = trimNum >= 1 ? fmt(g.t1Transmuted) : '';
    const t2 = trimNum >= 2 ? fmt(g.t2Transmuted) : '';
    const t3 = trimNum >= 3 ? fmt(g.t3Transmuted) : '';
    const final = trimNum >= 3 ? fmt(g.finalGrading) : '';
    return `
      <tr${extraClass ? ` class="${extraClass}"` : ''}>
        <td class="subject-col">${g.subject}</td>
        <td>${t1}</td>
        <td>${t2}</td>
        <td>${t3}</td>
        <td>${final}</td>
      </tr>`;
  };

  // Subject rows in the order grades[] arrives (OGS template sheet order),
  // skipping MAPEH sub-components and any SHS parent/child group's children —
  // they're rendered right after their parent row, not inline at their own
  // position.
  let subjectRows = '';
  for (let i = 0; i < grades.length; i++) {
    const g = grades[i];
    if (!g.subject || MAPEH_SUBCOMPONENTS.includes(g.subject) || isChildSubject(g)) continue;
    subjectRows += gradeRow(g);
    if (g.subject === 'MAPEH') {
      MAPEH_SUBCOMPONENTS.forEach(name => {
        const sub = subByName[name];
        if (sub) subjectRows += gradeRow(sub, 'mapeh-sub-row');
      });
    }
    if (childrenByParent[g.subject]) {
      childrenByParent[g.subject].forEach(child => {
        subjectRows += gradeRow(child, 'mapeh-sub-row');
      });
    }
  }

  const schoolYear  = academicYearSheet;
  const studentName = info.fullName || '';
  const age         = _calculateAge_(extra.dateOfBirth);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: letter; margin: 0.5in 0.5in 0.25in 0.5in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 14.9px; background: #fff; }

    .rc-header { position: relative; text-align: center; margin-bottom: 14px; }
    .rc-header .school-row { display: inline-flex; align-items: center; justify-content: center; gap: 32px; }
    .rc-header .corner-logo { position: absolute; left: 36px; top: 0; width: 72.88px; height: 72.88px; }
    .rc-header h1 { font-size: 19.8px; font-weight: bold; margin-bottom: 1px; }
    .rc-header p  { font-size: 13.2px; margin: 0; font-style: italic; }
    .rc-header .dept { font-size: 18.4px; font-weight: bold; font-style: normal; margin-top: 6px; }
    .rc-header .report-title { font-size: 16px; font-weight: bold; font-style: normal; text-decoration: underline; margin-top: 20px; }

    .rc-info { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .rc-info td { padding: 2px 4px; }
    .rc-info .label { font-weight: bold; white-space: nowrap; }
    .rc-info .value { border-bottom: 1px solid #333; padding-bottom: 3px; font-style: normal; }

    .rc-grades { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 6px; border: 2px solid #333; }
    .rc-grades th, .rc-grades td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
    .rc-grades td:nth-child(2), .rc-grades td:nth-child(3), .rc-grades td:nth-child(4) { padding: 4px 26px; }
    .rc-grades .subject-col { text-align: left; min-width: 160px; vertical-align: middle; }
    .rc-grades .learning-areas-header { text-align: center; vertical-align: middle; border-bottom: 2px solid #333; }
    .rc-grades thead th { background: #d9d9d9; font-weight: bold; vertical-align: middle; }
    .rc-grades thead tr:last-child th { border-bottom: 2px solid #333; }
    .rc-grades tbody tr.mapeh-sub-row td { font-style: italic; }
    .rc-grades tbody tr.mapeh-sub-row td.subject-col { padding-left: 22px; }
    .rc-grades tbody tr.mapeh-sub-row td:not(.subject-col) { text-align: left; padding-left: 6px; }
    .rc-grades tbody tr.general-average-row { font-weight: bold; background: #f3f3f3; }
    .rc-grades tbody tr.general-average-row td.subject-col { text-align: left; }
    .rc-grades-average { margin-bottom: 24px; }

    .rc-footer-group { margin-top: 60px; }
    .rc-certified { margin-top: 0; }

    .rc-signatures { margin-top: 70px; }
    .rc-sig-line { text-align: center; width: 260px; }
    .rc-sig-line span { font-size: 14px; font-style: italic; }
    .rc-sig-line .name { font-weight: bold; font-style: normal; font-size: 14px; }
    .rc-sig-line .line { border-top: 1px solid #333; margin-top: 4px; }

    .rc-disclaimer { font-size: 12px; font-style: italic; line-height: 1.4; margin-top: 60px; }
  </style>
</head>
<body>

  <div class="rc-header">
    ${logoUri ? `<img class="corner-logo" src="${logoUri}" alt="">` : ''}
    <div class="school-row">
      <h1>${CONFIG.SCHOOL_NAME.toUpperCase()} FOUNDATION, INC.</h1>
    </div>
    <p>Along Gov. Fortunato Halili Rd. Brgy. San Vicente, Santa Maria, Bulacan</p>
    <p class="dept">${CONFIG.DEPARTMENT}</p>
    <p class="report-title">CERTIFICATE OF NUMERICAL GRADE</p>
  </div>

  <table class="rc-info">
    <tr>
      <td class="label" style="width:14%;">Student Information:</td>
      <td style="width:36%;"></td>
      <td class="label" style="width:10%;">S.Y.:</td>
      <td class="value">${schoolYear}</td>
    </tr>
    <tr>
      <td class="label">Name:</td>
      <td class="value">${studentName}</td>
      <td class="label">Gender:</td>
      <td class="value">${extra.gender || ''}</td>
    </tr>
    <tr>
      <td class="label">Student No.:</td>
      <td class="value">${extra.studentNumber || ''}</td>
      <td class="label">Grade:</td>
      <td class="value">${info.gradeLevel || ''}</td>
    </tr>
    <tr>
      <td class="label">Date of Birth:</td>
      <td class="value">${extra.dateOfBirth || ''}</td>
      <td class="label">Age:</td>
      <td class="value">${age}</td>
    </tr>
  </table>

  <table class="rc-grades">
    <colgroup>
      <col style="width:40%">
      <col style="width:15%">
      <col style="width:15%">
      <col style="width:15%">
      <col style="width:15%">
    </colgroup>
    <thead>
      <tr>
        <th class="learning-areas-header" rowspan="2">Learning Areas</th>
        <th colspan="3">TERM</th>
        <th class="learning-areas-header" rowspan="2">Final Grade</th>
      </tr>
      <tr>
        <th>1</th>
        <th>2</th>
        <th>3</th>
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
    </tbody>
  </table>

  <table class="rc-grades rc-grades-average">
    <colgroup>
      <col style="width:40%">
      <col style="width:15%">
      <col style="width:15%">
      <col style="width:15%">
      <col style="width:15%">
    </colgroup>
    <tbody>
      <tr class="general-average-row">
        <td class="subject-col">General Average</td>
        <td>${trimNum >= 1 ? genAvgT1 : ''}</td>
        <td>${trimNum >= 2 ? genAvgT2 : ''}</td>
        <td>${trimNum >= 3 ? genAvgT3 : ''}</td>
        <td>${trimNum >= 3 ? genAvgFinal : ''}</td>
      </tr>
    </tbody>
  </table>

  <div class="rc-footer-group">
    <p class="rc-certified">${signatory.verification}</p>

    <div class="rc-signatures">
      <div class="rc-sig-line">
        <div class="name">${signatory.name}</div>
        <div class="line"></div>
        <span>${signatory.designation}</span>
      </div>
    </div>

    <p class="rc-disclaimer">
      This certificate is NOT VALID without<br>
      school dry seal or with any alteration.
    </p>
  </div>

</body>
</html>`;
}

// Ordinal-word grade level, e.g. "1" -> "Grade One (1)", "11" -> "Grade Eleven (11)".
// Only 1-12 are valid grade levels in this system (see normalizeGradeLevel in
// GRADES DB/API.js), so a fixed lookup table covers every case.
const GRADE_LEVEL_WORDS = {
  '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six',
  '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten', '11': 'Eleven', '12': 'Twelve'
};

/**
 * "Grade Level (in word and number)" per the SC reference template, e.g.
 * "Grade One (1)". Falls back to "Grade {n}" if the level isn't 1-12.
 * @param {string} gradeLevel
 * @return {string}
 */
function _formatGradeLevelWords_(gradeLevel) {
  const gl = String(gradeLevel || '').trim();
  const word = GRADE_LEVEL_WORDS[gl];
  return word ? `Grade ${word} (${gl})` : `Grade ${gl}`;
}

/**
 * Third-person singular pronoun for the SC certificate body ("he"/"she"/
 * "they") from the student's gender field (see extraInfo.gender, sourced the
 * same way as PG/NG — see _buildReportCardHtml). Defaults to "they" when
 * gender is blank/unrecognized rather than guessing.
 * @param {string} gender
 * @return {string}
 */
function _pronounFor_(gender) {
  const g = String(gender || '').trim().toLowerCase();
  if (g === 'male') return 'he';
  if (g === 'female') return 'she';
  return 'they';
}

/**
 * Builds the "School Clearance" certificate as an HTML string styled for PDF
 * printing. Layout matches "School Clearance (SC) - Google Sheets.pdf"
 * reference template — a short certificate paragraph, not a grades table.
 * Unlike PG/NG this isn't period-scoped (no trimester shown); the
 * `trimester` param it still receives from the shared _generateReports flow
 * is unused here. Page margins: 1.00in on every side, per the reference.
 * @param {Object} studentData - { studentInfo } from getClassGrades (grades[]
 *   is not used by this report).
 * @param {string} academicYearSheet - e.g. "2025-2026"
 * @param {Object} extraInfo - { studentNumber, gender, lrn } — lrn comes from
 *   STUDENTS DB getParentContacts (see _generateReports), unused by PG/NG but
 *   needed here.
 */
function _buildSchoolClearanceHtml(studentData, academicYearSheet, extraInfo) {
  const info    = studentData.studentInfo;
  const extra   = extraInfo || {};
  const logoUri = _getLogoDataUri_();

  const studentName  = info.fullName || '';
  const gradeWords   = _formatGradeLevelWords_(info.gradeLevel);
  const pronoun      = _pronounFor_(extra.gender);
  const dateNow      = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy');
  const signatory    = _getSignatory_('SC');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /*
     * Font sizes below are measured directly from the reference PDF's
     * embedded fonts (PyMuPDF page.get_text('dict'), same method used for
     * the PG template), not copied from PG/NG — SC is its own Sheets
     * document with its own point sizes. pt->px via the standard 1pt =
     * 1.333px (96/72 dpi) conversion:
     *   School name        14.82pt -> 19.8px
     *   Address             9.88pt -> 13.2px
     *   Department         13.83pt -> 18.4px
     *   "SCHOOL CLEARANCE" 12.84pt -> 17.1px
     *   Body paragraphs    11.86pt -> 15.8px
     *   Disclaimer         10.86pt -> 14.5px
     */
    /* 11in page - 1in top margin - 1in bottom margin = 9in printable height.
       body is stretched to exactly that and laid out as a column so
       .rc-footer-group (Certified Correct + signatures + disclaimer) can be
       pushed to the very bottom via margin-top: auto, regardless of body
       paragraph length — see the .lpr-page flex layout in _buildLPRHtml for
       confirmation this converter (DriveApp HTML->PDF) honors flexbox. */
    @page { size: letter; margin: 1in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 9in; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 15.8px; display: flex; flex-direction: column; }

    .rc-header { text-align: center; margin-bottom: 14px; position: relative; }
    .rc-header img.seal { position: absolute; left: 0; top: 0; width: 62px; height: 62px; }
    .rc-header h1 { font-size: 19.8px; font-weight: bold; margin-bottom: 1px; }
    .rc-header p  { font-size: 13.2px; margin: 0; font-style: italic; }
    .rc-header .dept { font-size: 18.4px; font-weight: bold; font-style: normal; margin-top: 6px; }
    .rc-header .report-title { font-size: 17.1px; font-weight: bold; font-style: normal; text-decoration: underline; margin-top: 40px; }

    .rc-body { margin-top: 50px; line-height: 2; text-align: justify; }
    .rc-body p { margin-bottom: 22px; }

    .rc-footer-group { margin-top: auto; }
    .rc-certified { margin-top: 40px; }

    .rc-signatures { margin-top: 70px; }
    .rc-sig-line { text-align: center; width: 260px; }
    .rc-sig-line span { font-size: 14.5px; font-style: italic; }
    .rc-sig-line .name { font-weight: bold; font-style: normal; font-size: 14.5px; }
    .rc-sig-line .line { border-top: 1px solid #333; margin-top: 4px; }

    .rc-disclaimer { font-size: 14.5px; font-style: italic; line-height: 1.4; margin-top: 40px; }
  </style>
</head>
<body>

  <div class="rc-header" style="margin-top: 40px;">
    ${logoUri ? `<img class="seal" src="${logoUri}" alt="">` : ''}
    <h1>${CONFIG.SCHOOL_NAME.toUpperCase()} FOUNDATION, INC.</h1>
    <p>Along Gov. Fortunato Halili Rd. Brgy. San Vicente, Santa Maria, Bulacan</p>
    <p class="dept">${CONFIG.DEPARTMENT}</p>
    <p class="report-title">SCHOOL CLEARANCE</p>
  </div>

  <div class="rc-body">
    <p>
      This is to certify that <strong>${studentName}</strong>, LRN: <strong>${extra.lrn || ''}</strong>,
      was a <strong>${gradeWords}</strong> student of ${CONFIG.SCHOOL_NAME}
      Foundation, Inc., Main Campus for Academic Year <strong>${academicYearSheet}</strong>.
    </p>
    <p>
      This further certifies that ${pronoun} has not violated any rules or regulations during
      ${pronoun === 'he' ? 'his' : pronoun === 'she' ? 'her' : 'their'} studies and has no outstanding
      obligations to the school as of <strong>${dateNow}</strong>.
    </p>
  </div>

  <div class="rc-footer-group">
    <p class="rc-certified">${signatory.verification}</p>

    <div class="rc-signatures">
      <div class="rc-sig-line">
        <div class="name">${signatory.name}</div>
        <div class="line"></div>
        <span>${signatory.designation}</span>
      </div>
    </div>

    <p class="rc-disclaimer">
      This certificate is NOT VALID without<br>
      school dry seal or with any alteration.
    </p>
  </div>

</body>
</html>`;
}

/**
 * Builds the "Learner's Performance Report" (LPR / SF-9) as an HTML string
 * styled for landscape PDF printing. Layout matches "LEARNERS PERFORMANCE
 * REPORT (LPR) - Google Sheets.pdf" reference template — the most complex
 * of the report types: DepEd letterhead (not just GLC's own), a two-column
 * layout (grades+attendance on the left, admin/certificate blocks on the
 * right), and several fields left intentionally blank for manual/
 * administrative completion (teacher comments, promotion decision,
 * transfer certificate) since no data source for those exists yet — see
 * the field-by-field scoping decision recorded when this was built
 * (2026-07-10). Subject grades show the raw numeric score only (like NG),
 * not the EQ letter the reference PDF shows alongside it — a deliberate
 * choice made after the PDF, not a layout gap.
 * @param {Object} studentData - { studentInfo, grades } from getClassGrades.
 *   grades[] includes MAPEH's own row plus 4 sub-component rows (Music/
 *   Arts/Physical Education/Health) — see the isMAPEH import branch in
 *   GRADES DB/API.js _importGrades. Unlike NG (which lists all 4 sub-rows)
 *   or PG (which drops them entirely), LPR pairs them into 2 combined
 *   rows — "Music and Arts" and "Physical Education and Health" — each
 *   averaging its 2 components per term, per the reference template.
 * @param {Object} attendanceData - from getClassAttendance, same shape PG uses.
 * @param {string} academicYearSheet - e.g. "2025-2026"
 * @param {string} trimester - "1", "2", or "3" — which TERM column(s) to fill.
 * @param {Object} extraInfo - { studentNumber, gender, dateOfBirth, lrn } —
 *   see _buildReportCardHtml for where this comes from.
 */
function _buildLPRHtml(studentData, attendanceData, academicYearSheet, trimester, extraInfo) {
  const info    = studentData.studentInfo;
  const trimNum = parseInt(trimester, 10);
  const extra   = extraInfo || {};
  const logoUri = _getLogoDataUri_();

  const subByName = {};
  studentData.grades.forEach(g => { if (g.subject) subByName[g.subject] = g; });

  // SHS parent/child subject groups (e.g. "Effective Communication & Mabisang
  // Komunikasyon") - unlike MAPEH, the parent's own row already carries a
  // real, correct grade (computed in the TEMPLATE MASTERFILE GRADE 11-12
  // masterfile by averaging its children's Initial grades, flowing through
  // GRADES DB like any normal subject) - so no re-averaging is needed here,
  // just splicing the children in as indented rows right after their parent.
  const childrenByParent = {};
  studentData.grades.forEach(g => {
    if (g.parentSubject) {
      if (!childrenByParent[g.parentSubject]) childrenByParent[g.parentSubject] = [];
      childrenByParent[g.parentSubject].push(g);
    }
  });
  const isChildSubject = g => !!g.parentSubject;

  // Main subject list excludes MAPEH's 4 sub-components — those are folded
  // into the 2 paired rows built separately below, not listed individually
  // (unlike NG) or dropped (unlike PG). Also excludes any SHS parent/child
  // group's children, spliced back in below (same treatment as NG).
  const grades = studentData.grades.filter(g => g.subject && !MAPEH_SUBCOMPONENTS.includes(g.subject) && !isChildSubject(g));

  // Combine 2 MAPEH sub-components into one row by averaging their
  // transmuted/final numeric grades per term, per the reference template
  // ("Music and Arts", "Physical Education and Health" — 2 rows, not 4).
  function pairedMapehRow(label, nameA, nameB) {
    const a = subByName[nameA], b = subByName[nameB];
    if (!a && !b) return null;
    const avgOf = (field) => {
      const vals = [a, b].filter(Boolean).map(g => parseFloat(g[field])).filter(v => !isNaN(v));
      return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
    };
    return {
      subject: label,
      t1Transmuted: avgOf('t1Transmuted'), t2Transmuted: avgOf('t2Transmuted'), t3Transmuted: avgOf('t3Transmuted'),
      finalGrading: avgOf('finalGrading')
    };
  }
  const musicArts  = pairedMapehRow('Music and Arts', 'Music', 'Arts');
  const peHealth   = pairedMapehRow('Physical Education and Health', 'Physical Education', 'Health');

  // Insert the 2 paired rows immediately after the MAPEH row, matching the
  // reference template's row order (MAPEH, then its 2 sub-pairs indented).
  const mapehIdx = grades.findIndex(g => g.subject === 'MAPEH');
  const allSubjectRows = grades.slice();
  const pairedRows = [musicArts, peHealth].filter(Boolean);
  if (mapehIdx >= 0) {
    allSubjectRows.splice(mapehIdx + 1, 0, ...pairedRows.map(r => Object.assign({ isPaired: true }, r)));
  } else {
    allSubjectRows.push(...pairedRows.map(r => Object.assign({ isPaired: true }, r)));
  }

  // Splice each SHS parent/child group's children in right after their
  // parent row, same position convention as the MAPEH pairs above. Iterate
  // over allSubjectRows' current snapshot so newly-spliced rows don't get
  // re-processed, and insert back-to-front per parent so earlier splices
  // don't shift the index of a not-yet-processed parent.
  Object.keys(childrenByParent).forEach(parentName => {
    const parentIdx = allSubjectRows.findIndex(g => g.subject === parentName);
    const childRows = childrenByParent[parentName].map(c => Object.assign({ isPaired: true }, c));
    if (parentIdx >= 0) {
      allSubjectRows.splice(parentIdx + 1, 0, ...childRows);
    } else {
      allSubjectRows.push(...childRows);
    }
  });

  // General Average — same averaging pattern as PG/NG, excluding MAPEH's 4
  // raw sub-components (only the single MAPEH row counts, same reasoning
  // as PG/NG's General Average) and any SHS parent/child group's children
  // (only the parent's own row counts).
  const avgEligible = grades.filter(g => g.subject !== 'MAPEH' && !isChildSubject(g));
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const numAvg = (field) => avg(avgEligible.map(g => parseFloat(g[field])).filter(v => !isNaN(v)));
  const genAvgT1 = numAvg('t1Transmuted'), genAvgT2 = numAvg('t2Transmuted'), genAvgT3 = numAvg('t3Transmuted'), genAvgFinal = numAvg('finalGrading');

  // Per-subject Remarks (Passed/Failed) — DepEd's standard 75-point passing
  // threshold, per this report's own Performance Descriptors table (75-79
  // "Connecting" is the lowest passing band, 65-74 "Developing" the highest
  // failing one). Independent of PG's EQ-letter thresholds, which are for
  // display only here, not pass/fail determination.
  const remarkFor = (score) => (score === null || isNaN(score)) ? '' : (score >= 75 ? 'Passed' : 'Failed');

  function gradeRow(g) {
    const t1v = trimNum >= 1 ? parseFloat(g.t1Transmuted) : NaN;
    const t2v = trimNum >= 2 ? parseFloat(g.t2Transmuted) : NaN;
    const t3v = trimNum >= 3 ? parseFloat(g.t3Transmuted) : NaN;
    const finalv = trimNum >= 3 ? parseFloat(g.finalGrading) : NaN;
    // Most recently completed term's score drives this row's Remarks —
    // Final Grade once T3 is in, else whichever term is furthest along.
    const remarkScore = !isNaN(finalv) ? finalv : !isNaN(t3v) ? t3v : !isNaN(t2v) ? t2v : t1v;
    const fmtCell = (v) => isNaN(v) ? '' : String(Math.round(v));
    return `
      <tr${g.isPaired ? ' class="mapeh-sub-row"' : ''}>
        <td class="subject-col">${g.subject}</td>
        <td>${fmtCell(t1v)}</td>
        <td>${fmtCell(t2v)}</td>
        <td>${fmtCell(t3v)}</td>
        <td>${fmtCell(finalv)}</td>
        <td>${remarkFor(remarkScore)}</td>
      </tr>`;
  }
  const subjectRows = allSubjectRows.map(gradeRow).join('');

  const genAvgRemarkScore = trimNum >= 3 ? genAvgFinal : trimNum >= 2 ? genAvgT2 : genAvgT1;
  const fmtAvg = (v) => v === null ? '' : String(Math.round(v));

  // Attendance — same shape/logic as PG (see _buildReportCardHtml), but
  // this template's table starts at June, not July, and has no April/May
  // columns (matches the reference's fixed Jun-Mar 10-month layout).
  const LPR_MONTHS = ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
  const mData = (attendanceData && attendanceData.months) || {};
  const activeMonths = LPR_MONTHS.filter(m => mData[m] !== undefined);
  let totalSD = 0, totalDP = 0, totalDA = 0;
  for (let m = 0; m < activeMonths.length; m++) {
    const rec = mData[activeMonths[m]] || {};
    totalSD += rec.schoolDays !== undefined && rec.schoolDays !== '' ? Number(rec.schoolDays) : 0;
    totalDP += rec.daysPresent !== undefined && rec.daysPresent !== '' ? Number(rec.daysPresent) : 0;
    totalDA += rec.daysAbsent !== undefined && rec.daysAbsent !== '' ? Number(rec.daysAbsent) : 0;
  }

  const schoolYear  = academicYearSheet;
  const studentName = info.fullName || '';
  const age         = _calculateAge_(extra.dateOfBirth);
  const isSHS       = parseInt(info.gradeLevel, 10) >= 11;
  const track       = isSHS ? (info.track || '') : 'N/A';
  const adviserName = _getAdvisorNameForSection_(info.gradeLevel, info.section);
  const signatory   = _getSignatory_('SF9');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: 13in 8.5in; margin: 0.4in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11px; }

    .lpr-page { display: flex; gap: 18px; }
    .lpr-col { flex: 1; min-width: 0; }

    .lpr-header { text-align: center; margin-bottom: 10px; position: relative; }
    .lpr-header img.seal { position: absolute; left: 0; top: 0; width: 50px; height: 50px; }
    .lpr-header p { font-size: 10.5px; margin: 0; }
    .lpr-header .school-name { font-size: 12px; font-weight: bold; margin-top: 4px; }
    .lpr-header .report-title { font-size: 14px; font-weight: bold; text-decoration: underline; margin-top: 6px; }
    .lpr-header .sy-line { font-size: 11px; margin-top: 3px; }

    .lpr-info { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
    .lpr-info td { padding: 2px 4px; }
    .lpr-info .label { font-weight: bold; white-space: nowrap; width: 60px; }
    .lpr-info .value { border-bottom: 1px solid #333; }

    .lpr-note { font-size: 10.5px; line-height: 1.5; margin-bottom: 10px; }

    .lpr-grades { width: 100%; border-collapse: collapse; margin-bottom: 4px; border: 1.5px solid #333; }
    .lpr-grades th, .lpr-grades td { border: 1px solid #333; padding: 2px 4px; text-align: center; font-size: 10.5px; }
    .lpr-grades .subject-col { text-align: left; }
    .lpr-grades thead th { background: #d9d9d9; font-weight: bold; }
    .lpr-grades tbody tr.mapeh-sub-row td.subject-col { font-style: italic; padding-left: 14px; }
    .lpr-grades tbody tr.general-average-row { font-weight: bold; background: #f3f3f3; }

    .lpr-descriptors { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
    .lpr-descriptors th, .lpr-descriptors td { border: 1px solid #333; padding: 2px 4px; text-align: center; }
    .lpr-descriptors thead th { background: #d9d9d9; font-weight: bold; }
    .lpr-descriptors caption { font-weight: bold; font-size: 10.5px; text-align: left; margin-bottom: 2px; caption-side: top; }

    .lpr-attendance { width: 100%; border-collapse: collapse; font-size: 10px; }
    .lpr-attendance th, .lpr-attendance td { border: 1px solid #333; padding: 2px 3px; text-align: center; }
    .lpr-attendance thead th { background: #d9d9d9; font-weight: bold; }
    .lpr-attendance .row-label { text-align: left; }
    .lpr-attendance caption { font-weight: bold; font-size: 10.5px; text-align: center; margin-bottom: 2px; caption-side: top; }

    .lpr-comments { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
    .lpr-comments th, .lpr-comments td { border: 1px solid #333; padding: 4px; vertical-align: top; }
    .lpr-comments .term-col { font-weight: bold; width: 55px; text-align: center; }
    .lpr-comments .comment-cell { height: 30px; }
    .lpr-comments caption { font-weight: bold; font-size: 10.5px; text-align: center; margin-bottom: 2px; caption-side: top; }

    .lpr-sig-block { margin-top: 12px; }
    .lpr-sig-title { font-weight: bold; font-size: 10.5px; text-align: center; margin-bottom: 4px; }
    .lpr-sig-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 10.5px; }
    .lpr-sig-row .term-label { font-weight: bold; width: 45px; flex-shrink: 0; }
    .lpr-sig-row .line { flex: 1; border-bottom: 1px solid #333; height: 12px; }

    .lpr-cert { margin-top: 14px; font-size: 10.5px; }
    .lpr-cert-title { font-weight: bold; text-align: center; text-decoration: underline; margin-bottom: 4px; }
    .lpr-cert p { line-height: 1.5; margin-bottom: 6px; }
    .lpr-cert-field { display: flex; gap: 6px; margin-bottom: 8px; }
    .lpr-cert-field .cert-label { white-space: nowrap; }
    .lpr-cert-field .line { flex: 1; border-bottom: 1px solid #333; }

    .lpr-approve { margin-top: 14px; display: flex; justify-content: space-between; }
    .lpr-approve-sig { text-align: center; width: 45%; }
    .lpr-approve-sig .name { font-weight: bold; }
    .lpr-approve-sig .line { border-top: 1px solid #333; margin-top: 2px; padding-top: 2px; }
    .lpr-approve-sig .role { font-size: 10px; font-style: italic; margin-top: 2px; }

    .lpr-transfer { margin-top: 14px; font-size: 10.5px; }
    .lpr-transfer-title { font-weight: bold; text-align: center; text-decoration: underline; margin-bottom: 4px; }
    .lpr-transfer-field { display: flex; gap: 6px; margin-bottom: 8px; }
    .lpr-transfer-field .line { flex: 1; border-bottom: 1px solid #333; }
  </style>
</head>
<body>

  <div class="lpr-page">

    <!-- LEFT COLUMN: identity, grades, descriptors, attendance -->
    <div class="lpr-col">
      <div class="lpr-header">
        ${logoUri ? `<img class="seal" src="${logoUri}" alt="">` : ''}
        <p>Republic of the Philippines</p>
        <p>Department of Education</p>
        <p>${CONFIG.DEPED_REGION}</p>
        <p>${CONFIG.DEPED_DIVISION}</p>
        <p>${CONFIG.DEPED_DISTRICT}</p>
        <p>${CONFIG.DEPED_CITY}</p>
        <p class="school-name">${CONFIG.SCHOOL_NAME.toUpperCase()} FOUNDATION, INC.</p>
        <p class="report-title">LEARNERS PERFORMANCE REPORT</p>
        <p class="sy-line">School Year <strong>${schoolYear}</strong></p>
      </div>

      <table class="lpr-info">
        <tr><td class="label">Name:</td><td class="value" colspan="3">${studentName}</td></tr>
        <tr>
          <td class="label">LRN:</td><td class="value">${extra.lrn || ''}</td>
          <td class="label">Age:</td><td class="value">${age}</td>
        </tr>
        <tr>
          <td class="label">Grade:</td><td class="value">${info.gradeLevel || ''}</td>
          <td class="label">Gender:</td><td class="value">${extra.gender || ''}</td>
        </tr>
        <tr>
          <td class="label">Section:</td><td class="value">${info.section || ''}</td>
          <td class="label">Track:</td><td class="value">${track}</td>
        </tr>
      </table>

      <p class="lpr-note">
        Dear Parents,<br>
        This Performance Report shows the ability and progress your child has made in the different
        learning areas as well as his/her core values. The school welcomes you should you
        desire to know more about your child's progress.
      </p>

      <table class="lpr-grades">
        <caption>LEARNING PROGRESS AND ACHIEVEMENT</caption>
        <thead>
          <tr>
            <th class="subject-col" rowspan="2">Learning Areas</th>
            <th colspan="3">TERM</th>
            <th rowspan="2">Final Grade</th>
            <th rowspan="2">Remarks</th>
          </tr>
          <tr><th>1</th><th>2</th><th>3</th></tr>
        </thead>
        <tbody>
          ${subjectRows}
          <tr class="general-average-row">
            <td class="subject-col">General Average</td>
            <td>${trimNum >= 1 ? fmtAvg(genAvgT1) : ''}</td>
            <td>${trimNum >= 2 ? fmtAvg(genAvgT2) : ''}</td>
            <td>${trimNum >= 3 ? fmtAvg(genAvgT3) : ''}</td>
            <td>${trimNum >= 3 ? fmtAvg(genAvgFinal) : ''}</td>
            <td>${remarkFor(genAvgRemarkScore)}</td>
          </tr>
        </tbody>
      </table>

      <table class="lpr-descriptors">
        <caption>PERFORMANCE DESCRIPTORS</caption>
        <thead><tr><th>Grading Scale</th><th>Description</th><th>Remarks</th></tr></thead>
        <tbody>
          <tr><td>90 - 100</td><td>Advancing</td><td>Passed</td></tr>
          <tr><td>80 - 89</td><td>Benchmarking</td><td>Passed</td></tr>
          <tr><td>75 - 79</td><td>Connecting</td><td>Passed</td></tr>
          <tr><td>65 - 74</td><td>Developing</td><td>Failed</td></tr>
          <tr><td>0 - 64</td><td>Emerging</td><td>Failed</td></tr>
        </tbody>
      </table>
    </div>

    <!-- RIGHT COLUMN: attendance, comments, parent signatures, certificate, approval -->
    <div class="lpr-col">
      <table class="lpr-attendance">
        <caption>ATTENDANCE RECORD</caption>
        <thead>
          <tr><th>Month</th>${activeMonths.map(m => `<th>${m.slice(0, 3)}</th>`).join('')}<th>Total</th></tr>
        </thead>
        <tbody>
          <tr><td class="row-label">Class Days</td>${activeMonths.map(m => `<td>${(mData[m] || {}).schoolDays || 0}</td>`).join('')}<td>${totalSD}</td></tr>
          <tr><td class="row-label">Present</td>${activeMonths.map(m => `<td>${(mData[m] || {}).daysPresent || 0}</td>`).join('')}<td>${totalDP}</td></tr>
          <tr><td class="row-label">Absent</td>${activeMonths.map(m => `<td>${(mData[m] || {}).daysAbsent || 0}</td>`).join('')}<td>${totalDA}</td></tr>
        </tbody>
      </table>

      <table class="lpr-comments">
        <caption>TEACHER'S COMMENTS/REMARKS</caption>
        <tbody>
          <tr><td class="term-col">Term 1</td><td class="comment-cell"></td></tr>
          <tr><td class="term-col">Term 2</td><td class="comment-cell"></td></tr>
          <tr><td class="term-col">Term 3</td><td class="comment-cell"></td></tr>
        </tbody>
      </table>

      <div class="lpr-sig-block">
        <p class="lpr-sig-title">PARENTS/GUARDIAN'S SIGNATURE</p>
        <div class="lpr-sig-row"><span class="term-label">Term 1</span><span class="line"></span></div>
        <div class="lpr-sig-row"><span class="term-label">Term 2</span><span class="line"></span></div>
        <div class="lpr-sig-row"><span class="term-label">Term 3</span><span class="line"></span></div>
      </div>

      <div class="lpr-cert">
        <p class="lpr-cert-title">CERTIFICATE OF TRANSFER</p>
        <p>This is to certify that the above-named learner has satisfactorily completed the requirements for the grade level indicated.</p>
        <div class="lpr-cert-field"><span class="cert-label">Admitted to Grade:</span><span class="line"></span></div>
        <div class="lpr-cert-field"><span class="cert-label">Eligible for Admission to Grade:</span><span class="line"></span></div>
        <p>Approved:</p>
      </div>

      <div class="lpr-approve">
        <div class="lpr-approve-sig">
          <div class="name">${signatory.name}</div>
          <div class="line"></div>
          <div class="role">${signatory.designation}</div>
        </div>
        <div class="lpr-approve-sig">
          <div class="name">${adviserName}</div>
          <div class="line"></div>
          <div class="role">Teacher-in-Charge</div>
        </div>
      </div>

      <div class="lpr-transfer">
        <p class="lpr-transfer-title">CANCELLATION OF ELIGIBILITY TO TRANSFER</p>
        <div class="lpr-transfer-field"><span class="cert-label">Admitted in:</span><span class="line"></span><span class="cert-label" style="margin-left:12px;">Date:</span><span class="line"></span></div>
        <div class="lpr-approve-sig" style="width:60%; margin-top:20px;">
          <div class="line"></div>
          <div class="role">${signatory.designation}</div>
        </div>
      </div>
    </div>

  </div>

</body>
</html>`;
}

/**
 * Builds the "Lastname, Firstname M." display name used in report filenames.
 * Prefers the split lastName/firstName/middleName fields (from STUDENTS DB,
 * see _getStudentsDemographics) since they're reliably correct; falls back
 * to re-splitting the combined fullName ("Last, First Middle", the join
 * convention used by _getStudentsInSection) only when the split fields are
 * unavailable, e.g. transitional data or a student missing from STUDENTS DB.
 * @param {{lastName: string, firstName: string, middleName: string}} nameInfo
 * @param {string} fullName - combined "Last, First Middle" fallback source
 * @return {string} e.g. "Ramos, Jhannuel M."
 */
function _buildNameForFileName_(nameInfo, fullName) {
  let lastName   = (nameInfo && nameInfo.lastName)   || '';
  let firstName  = (nameInfo && nameInfo.firstName)  || '';
  let middleName = (nameInfo && nameInfo.middleName) || '';

  if (!lastName && !firstName) {
    // Fallback: re-split "Last, First Middle" — best effort only.
    const parts = String(fullName || '').split(',');
    lastName = (parts[0] || '').trim();
    const rest = (parts[1] || '').trim().split(/\s+/).filter(Boolean);
    firstName = rest.shift() || '';
    middleName = rest.join(' ');
  }

  const middleInitial = middleName ? middleName.trim().charAt(0).toUpperCase() + '.' : '';
  return middleInitial
    ? `${lastName}, ${firstName} ${middleInitial}`
    : `${lastName}, ${firstName}`;
}

/**
 * Builds the report's PDF filename so it's distinguishable on its own when
 * found via Drive search, not just by folder path — includes report type,
 * academic year, grade level, section, term, and the student's name. e.g.
 * "PG-2025-2026-1-A-T1-Ramos, Jhannuel M..pdf".
 * No separate track segment: for Grade 11-12, Section already carries the
 * track code (e.g. "ICT201"); Track itself is stored as a long full name
 * ("Science, Technology, Engineering and Mathematics") that isn't
 * filename-friendly and would just duplicate what Section already conveys.
 * Used by _saveReportToDrive (must write this exact name) and
 * _findReportInDrive (must look up this exact name) — keep in sync.
 * @param {{gradeLevel: string, section: string, fullName: string}} studentInfo
 * @param {{lastName: string, firstName: string, middleName: string}} nameInfo
 * @param {string} trimester
 * @param {string} [reportType] - filename prefix, defaults to "PG" for callers
 *   that predate multi-report-type support. "SC" (School Clearance) omits the
 *   term segment — it isn't period-scoped, see _buildSchoolClearanceHtml.
 * @param {string} schoolYear - e.g. "2025-2026" (same value used for the
 *   Drive folder path — see _saveReportToDrive/_findReportInDrive).
 * @return {string}
 */
function _buildReportFileName_(studentInfo, nameInfo, trimester, reportType, schoolYear) {
  const prefix = reportType || 'PG';
  const termPart = prefix === 'SC' ? '' : `-T${trimester}`;
  const namePart = _buildNameForFileName_(nameInfo, studentInfo.fullName);
  return `${prefix}-${schoolYear}-${studentInfo.gradeLevel}-${studentInfo.section}${termPart}-${_sanitizeFileName(namePart)}.pdf`;
}

// ---------------------------------------------------------------------------
// PDF Export
// ---------------------------------------------------------------------------

let _pdfCounter = 0;
function _htmlToPdf(html) {
  const tempFile = DriveApp.createFile(
    `temp_report_${Date.now()}_${++_pdfCounter}.html`,
    html,
    MimeType.HTML
  );

  try {
    return tempFile.getAs(MimeType.PDF);
  } finally {
    tempFile.setTrashed(true);
  }
}

// ---------------------------------------------------------------------------
// Google Drive Folder Management
// ---------------------------------------------------------------------------

/**
 * Saves a PDF blob to the correct Drive folder, overwriting if already exists.
 * Folder path: GLC Reports / {schoolYear} / Grade {level} / {section} / {fullName}
 * @return {string} The URL of the saved file
 */
function _saveReportToDrive(pdfBlob, studentInfo, nameInfo, schoolYear, trimester, reportType) {
  const rootFolder  = _getOrCreateFolder(null, CONFIG.REPORTS_FOLDER_NAME, CONFIG.REPORTS_FOLDER_ID);
  const syFolder    = _getOrCreateFolder(rootFolder, schoolYear);
  const gradeFolder = _getOrCreateFolder(syFolder, `Grade ${studentInfo.gradeLevel}`);
  const secFolder   = _getOrCreateFolder(gradeFolder, studentInfo.section);
  const stuFolder   = _getOrCreateFolder(secFolder, _sanitizeFolderName(studentInfo.fullName));

  const fileName = _buildReportFileName_(studentInfo, nameInfo, trimester, reportType, schoolYear);

  // Remove existing file with same name to avoid duplicates
  const existing = stuFolder.getFilesByName(fileName);
  while (existing.hasNext()) {
    existing.next().setTrashed(true);
  }

  pdfBlob.setName(fileName);
  const savedFile = stuFolder.createFile(pdfBlob);
  return savedFile.getUrl();
}

/**
 * Gets a subfolder by name inside a parent, or creates it if missing.
 * If rootFolderId is provided and parent is null, opens the root folder by ID.
 */
function _getOrCreateFolder(parent, folderName, rootFolderId) {
  if (!parent && rootFolderId && rootFolderId !== 'YOUR_DRIVE_FOLDER_ID_HERE') {
    parent = DriveApp.getFolderById(rootFolderId);
  } else if (!parent) {
    // Fall back: find or create in root of My Drive
    const roots = DriveApp.getFoldersByName(folderName);
    if (roots.hasNext()) return roots.next();
    return DriveApp.createFolder(folderName);
  }

  const existing = parent.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(folderName);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function _numericToEQ(value) {
  if (value === null || isNaN(value)) return '';
  if (value >= 94.45) return 'A';
  if (value >= 88.45) return 'B';
  if (value >= 81.45) return 'C';
  if (value >= 74.45) return 'D';
  return 'E';
}

function _sanitizeFileName(name) {
  // Allows letters, numbers, spaces, commas, and periods — needed for the
  // "Lastname, Firstname M." name segment in report filenames (see
  // _buildNameForFileName_). Both Drive and Windows permit these characters
  // in filenames; only characters actually invalid on those filesystems are
  // stripped here.
  return String(name || '').replace(/[^a-zA-Z0-9_\-,. ]/g, '').trim();
}

function _sanitizeFolderName(name) {
  // Drive folder names allow letters, numbers, spaces, commas, periods, hyphens
  // Strip anything outside that set and trim whitespace
  return String(name || '').replace(/[\/\\:*?"<>|]/g, '').trim();
}

// ---------------------------------------------------------------------------
// Mail Merge
// ---------------------------------------------------------------------------

/**
 * Emails already-generated PDFs from Drive to each student's parent.
 * Does NOT regenerate PDFs — teacher must run Generate Reports first.
 * Statuses: sent | skipped (no email) | not_generated (no PDF in Drive) | failed (send error)
 *
 * @param {string}   academicYearSheet - e.g. "2025-2026"
 * @param {string}   gradeLevel        - e.g. "1"
 * @param {string}   section           - e.g. "A"
 * @param {string}   trimester         - "1", "2", or "3"
 * @param {string[]} studentNumbers    - array of student numbers to send for
 * @param {string}   reportType        - e.g. "PG", "NG" — selects which PDF to look up in Drive
 * @return {Object} { success, message, results: [{ studentNumber, fullName, parentEmail, status, error }] }
 */
function _sendMailMerge(academicYearSheet, gradeLevel, section, trimester, studentNumbers, reportType) {
  // 1. Fetch student list (names + numbers only — no grades/attendance needed)
  const gradesResult = callGradesDb('getClassGrades', {
    academicYearSheet: academicYearSheet,
    gradeLevel: gradeLevel,
    section: section
  });
  if (!gradesResult.success) {
    return { success: false, message: `Failed to fetch student list: ${gradesResult.message}` };
  }

  const allStudents = gradesResult.students;
  // Filter to only the selected student numbers that actually exist in the data
  const targets = (studentNumbers || []).filter(sn => allStudents[sn]);

  if (targets.length === 0) {
    return { success: false, message: 'No matching student records found for the selected students.' };
  }

  // 2. Fetch parent contacts from STUDENTS DB
  const contactsResult = callStudentsDb('getParentContacts', { studentNumbers: targets });
  if (!contactsResult.success) {
    return { success: false, message: `Failed to fetch contacts: ${contactsResult.message}` };
  }
  const contacts = contactsResult.contacts || {};

  // 2b. Fetch split name parts (lastName/firstName/middleName) — needed to
  // rebuild the exact same filename _generateReports used when saving the
  // PDF (see _buildReportFileName_ / _buildNameForFileName_).
  const demographicsResult = callStudentsDb('getStudentsDemographics', {
    studentNumbers: targets,
    academicYearSheet: academicYearSheet
  });
  const demographics = demographicsResult.success ? demographicsResult.demographics : {};

  const reportLabel = reportType === 'NG' ? 'Numerical Grade Report' : 'Periodical Letter Grade';
  const subject = `${academicYearSheet}-Term ${trimester}-${reportLabel}`;
  const signatureHtml = _getGmailSignature_();

  const results = [];

  for (let i = 0; i < targets.length; i++) {
    const sn          = targets[i];
    const studentInfo = allStudents[sn].studentInfo;
    const nameInfo    = demographics[sn] || {};
    const fullName    = studentInfo.fullName;
    const contact     = contacts[sn] || {};
    const parentEmail = contact.parentEmail || '';

    // Skip students with no parent email on file
    if (!parentEmail) {
      results.push({ studentNumber: sn, fullName: fullName, parentEmail: '', status: 'skipped', error: null });
      _logMailSent(fullName, gradeLevel, section, academicYearSheet, trimester, '', 'skipped', 'No parent email on file');
      continue;
    }

    // Look up the existing PDF in Drive
    const pdfFile = _findReportInDrive(studentInfo, nameInfo, academicYearSheet, trimester, reportType);
    if (!pdfFile) {
      results.push({ studentNumber: sn, fullName: fullName, parentEmail: parentEmail, status: 'not_generated', error: null });
      _logMailSent(fullName, gradeLevel, section, academicYearSheet, trimester, parentEmail, 'not_generated', 'No PDF found in Drive');
      continue;
    }

    try {
      const bodyHtml =
        `<p>Dear ${_escapeHtml_(fullName)},</p>` +
        `<p>We would like to share with you your ${_escapeHtml_(reportLabel)}s as part of our regular academic updates, ` +
        `these grades reflect your performance during this grading period and are intended to guide you in tracking your progress.</p>` +
        `<p>Please note that this is a computer-generated document, hence does not require a signature. ` +
        `For any grade concern, request an appointment for grade consultation with your Teacher/s or the Academic Coordinator.</p>` +
        `<p>Thank you and keep up the good work.</p>` +
        (signatureHtml ? `<br>--<br>${signatureHtml}` : '');

      GmailApp.sendEmail(parentEmail, subject, '', {
        htmlBody: bodyHtml,
        attachments: [pdfFile.getAs(MimeType.PDF)],
        name: `${CONFIG.SCHOOL_NAME} — ${CONFIG.DEPARTMENT}`
      });

      results.push({ studentNumber: sn, fullName: fullName, parentEmail: parentEmail, status: 'sent', error: null });
      _logMailSent(fullName, gradeLevel, section, academicYearSheet, trimester, parentEmail, 'sent', '');

    } catch (err) {
      console.error(`Mail merge error for ${sn}:`, err);
      results.push({ studentNumber: sn, fullName: fullName, parentEmail: parentEmail, status: 'failed', error: err.message });
      _logMailSent(fullName, gradeLevel, section, academicYearSheet, trimester, parentEmail, 'failed', err.message);
    }
  }

  const sentCount         = results.filter(r => r.status === 'sent').length;
  const skippedCount      = results.filter(r => r.status === 'skipped').length;
  const notGeneratedCount = results.filter(r => r.status === 'not_generated').length;
  const failedCount       = results.filter(r => r.status === 'failed').length;

  return {
    success: sentCount > 0 || skippedCount > 0,
    message: `Sent: ${sentCount} | Skipped: ${skippedCount} | Not generated: ${notGeneratedCount} | Failed: ${failedCount}`,
    results: results
  };
}

/**
 * Fetches the HTML signature currently active for the account executing
 * this script (executeAs: USER_DEPLOYING — see appsscript.json).
 *
 * The Gmail API has no concept of Gmail's "multiple named signatures" UI
 * feature — a sendAs alias only ever exposes ONE `signature` field, whatever
 * is currently selected as active in Gmail Settings > General > Signature
 * for that alias. There is no way to fetch a signature by its UI label
 * (e.g. "EMAIL FOOTER") — this relies on that being the one active on the
 * sending account. Calls the Gmail REST API directly via UrlFetchApp
 * (not the Gmail advanced service — Gmail.Users.Settings.SendAs.list
 * returned an empty sendAsSettings array for this Workspace account even
 * though the identical REST endpoint returns data, so the advanced-service
 * binding is unreliable here). Requires the gmail.settings.basic scope
 * (see appsscript.json); the Gmail advanced service dependency is no
 * longer needed for this function.
 *
 * @return {string} signature HTML, or '' if not found / not accessible
 */
function _getGmailSignature_() {
  try {
    const resp = UrlFetchApp.fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
      {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      }
    );
    if (resp.getResponseCode() !== 200) {
      console.error('Failed to fetch Gmail signature: HTTP', resp.getResponseCode(), resp.getContentText());
      return '';
    }
    const sendAsList = JSON.parse(resp.getContentText()).sendAs || [];
    const match = sendAsList.find(sa => sa.isDefault) || sendAsList[0];
    return (match && match.signature) || '';
  } catch (err) {
    console.error('Failed to fetch Gmail signature:', err);
    return '';
  }
}

/**
 * Minimal HTML-escaper for interpolating plain-text values (student names)
 * into an htmlBody email.
 */
function _escapeHtml_(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Looks up an already-generated PDF in Drive using the same folder path
 * that _saveReportToDrive creates.
 * Path: GLC Reports / {schoolYear} / Grade {level} / {section} / {fullName} / {filename}
 * Filename built by _buildReportFileName_ — keep in sync with _saveReportToDrive.
 *
 * @return {File|null} The Drive File object, or null if not found.
 */
function _findReportInDrive(studentInfo, nameInfo, schoolYear, trimester, reportType) {
  try {
    const rootFolder = _getOrCreateFolder(null, CONFIG.REPORTS_FOLDER_NAME, CONFIG.REPORTS_FOLDER_ID);

    const syFolders = rootFolder.getFoldersByName(schoolYear);
    if (!syFolders.hasNext()) return null;
    const syFolder = syFolders.next();

    const gradeFolders = syFolder.getFoldersByName(`Grade ${studentInfo.gradeLevel}`);
    if (!gradeFolders.hasNext()) return null;
    const gradeFolder = gradeFolders.next();

    const secFolders = gradeFolder.getFoldersByName(studentInfo.section);
    if (!secFolders.hasNext()) return null;
    const secFolder = secFolders.next();

    const stuFolders = secFolder.getFoldersByName(_sanitizeFolderName(studentInfo.fullName));
    if (!stuFolders.hasNext()) return null;
    const stuFolder = stuFolders.next();

    const fileName = _buildReportFileName_(studentInfo, nameInfo, trimester, reportType, schoolYear);
    const files = stuFolder.getFilesByName(fileName);
    return files.hasNext() ? files.next() : null;

  } catch (err) {
    console.error(`_findReportInDrive error for ${studentInfo.fullName}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mail Log
// ---------------------------------------------------------------------------

const MAIL_LOG_SHEET_NAME = 'MAIL LOG';
const MAIL_LOG_HEADERS = ['ID', 'Timestamp', 'Student Name', 'Grade Level', 'Section', 'Academic Year', 'Trimester', 'Parent Email', 'Status', 'Notes'];

function _logMailSent(studentName, gradeLevel, section, academicYear, trimester, parentEmail, status, notes) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(MAIL_LOG_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(MAIL_LOG_SHEET_NAME);
      const headerRange = sheet.getRange(1, 1, 1, MAIL_LOG_HEADERS.length);
      headerRange.setValues([MAIL_LOG_HEADERS]);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#34a853');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 50);
      sheet.setColumnWidth(2, 160);
      sheet.setColumnWidth(3, 200);
      sheet.setColumnWidth(4, 90);
      sheet.setColumnWidth(5, 90);
      sheet.setColumnWidth(6, 100);
      sheet.setColumnWidth(7, 110);
      sheet.setColumnWidth(8, 220);
      sheet.setColumnWidth(9, 80);
      sheet.setColumnWidth(10, 260);
    }

    const lastRow = sheet.getLastRow();
    const nextRow = lastRow + 1;
    const newId   = lastRow;

    sheet.getRange(nextRow, 1, 1, MAIL_LOG_HEADERS.length).setValues([[
      newId,
      new Date(),
      studentName,
      gradeLevel ? `Grade ${gradeLevel}` : '',
      section,
      academicYear,
      CONFIG.TRIMESTERS[trimester] || trimester,
      parentEmail,
      status,
      notes || ''
    ]]);

    sheet.getRange(nextRow, 2).setNumberFormat('yyyy-MM-dd HH:mm:ss');

    // Color-code status cell
    const statusCell = sheet.getRange(nextRow, 9);
    if (status === 'sent')    statusCell.setBackground('#d4edda');
    if (status === 'skipped') statusCell.setBackground('#fff3cd');
    if (status === 'failed')  statusCell.setBackground('#f8d7da');

  } catch (error) {
    console.error('Error writing to mail log:', error);
  }
}

// ---------------------------------------------------------------------------
// Report Generation Log
// ---------------------------------------------------------------------------

const LOG_SHEET_NAME = 'GENERATION LOG';
const LOG_HEADERS = ['ID', 'Timestamp', 'Student Name', 'Grade Level', 'Section', 'Track', 'Academic Year', 'User Email', 'File URL'];

function _logReport(studentName, gradeLevel, section, track, academicYear, fileUrl, userEmail) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(LOG_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(LOG_SHEET_NAME);
      const headerRange = sheet.getRange(1, 1, 1, LOG_HEADERS.length);
      headerRange.setValues([LOG_HEADERS]);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#667eea');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 60);   // ID
      sheet.setColumnWidth(2, 160);  // Timestamp
      sheet.setColumnWidth(3, 200);  // Student Name
      sheet.setColumnWidth(4, 90);   // Grade Level
      sheet.setColumnWidth(5, 90);   // Section
      sheet.setColumnWidth(6, 90);   // Track
      sheet.setColumnWidth(7, 100);  // Academic Year
      sheet.setColumnWidth(8, 210);  // User Email
      sheet.setColumnWidth(9, 300);  // File URL
    }

    const lastRow = sheet.getLastRow();
    const nextRow = lastRow + 1;
    const newId   = lastRow; // row 1 is header, so lastRow = count of data rows = auto-increment ID

    sheet.getRange(nextRow, 1, 1, LOG_HEADERS.length).setValues([[
      newId,
      new Date(),
      studentName,
      gradeLevel ? `Grade ${gradeLevel}` : '',
      section,
      track,
      academicYear,
      userEmail || 'unknown',
      fileUrl
    ]]);

    sheet.getRange(nextRow, 2).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  } catch (error) {
    console.error('Error writing to generation log:', error);
  }
}