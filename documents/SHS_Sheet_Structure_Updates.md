# Senior High School Sheet Structure Updates

## Overview
This document outlines the changes made to support Senior High School (SHS) requirements, specifically adding support for Strands, Categories, and Semesters. **Important:** Category, Strand, and Semester are properties of each subject (stored in SUBJECTS_REF), not user input when creating assignments.

---

## 📊 Updated SUBJECTS Sheet Structure

### **New Column Structure (11 columns total)**

| Column | Field Name    | Description                                    | Example                  |
|--------|---------------|------------------------------------------------|--------------------------|
| A      | Grade Level   | Grade level (stored as number: 11, 12)        | 11                       |
| B      | Section       | Section letter (A, B, C, etc.)                 | A                        |
| C      | Teacher       | Full name of assigned teacher                  | Rojo, R.                 |
| D      | Subject       | Subject name                                   | General Chemistry 1       |
| E      | **Strand**    | **NEW:** Strand (ALL, STEM, HUMSS, ICT, ABM, GAS) | STEM                    |
| F      | **Category**  | **NEW:** Category (Core, Specialized)          | Specialized              |
| G      | **Semester**  | **NEW:** Semester (1ST, 2ND)                   | 1ST                      |
| H      | Status        | Active or Inactive                             | Active                   |
| I      | Created       | Auto-timestamp when created                    | 2025-05-03 10:30         |
| J      | Modified      | Auto-timestamp when modified                   | 2025-05-03 14:15         |
| K      | Created By    | Email of user who created the assignment       | admin@school.edu         |

### **Sample Data:**

```
Row 1 (Headers):
Grade Level | Section | Teacher | Subject | Strand | Category | Semester | Status | Created | Modified | Created By

Row 2 (Example):
11 | A | Rojo, R. | General Chemistry 1 | STEM | Specialized | 1ST | Active | 2025-05-03 10:30 | 2025-05-03 10:30 | admin@school.edu

Row 3 (Example):
11 | A | Santos, J. | Oral Communication | ALL | Core | 1ST | Active | 2025-05-03 11:00 | 2025-05-03 11:00 | admin@school.edu
```

---

## 📋 Updated SUBJECTS_REF Sheet Structure

### **New Column Structure (6 columns total for SHS)**

The SUBJECTS_REF sheet now includes Category, Strand, Semester, and Level columns for SHS subjects. These values are automatically retrieved when assigning subjects to teachers.

| Column | Field Name    | Description                                    | Example                  |
|--------|---------------|------------------------------------------------|--------------------------|
| A      | #             | Row numbering (formula)                       | 1                        |
| B      | Subject Name   | Full subject name                              | General Chemistry 1       |
| C      | **Category**   | **NEW:** Category (Core, Specialized, Applied) | Specialized              |
| D      | **Strand**     | **NEW:** Strand (ALL, STEM, HUMSS, ICT, ABM, GAS) | STEM                    |
| E      | **Semester**   | **NEW:** Semester (1ST, 2ND)                   | 1ST                      |
| F      | **Level**      | **NEW:** Level (11, 12)                        | 11                       |
| G      | Active         | ✓ or blank (hide if inactive)                  | ✓                        |

### **Sample Data:**

```
Row 1: SUBJECT INFORMATION (merged across A-G)
Row 2: # | Subject Name | Category | Strand | Semester | Level | Active
Row 3: 1 | Oral Communication | Core | ALL | 1ST | 11 | ✓
Row 4: 2 | General Chemistry 1 | Specialized | STEM | 1ST | 11 | ✓
Row 5: 3 | Computer Programming 1 | Specialized | ICT | 1ST | 11 | ✓
Row 6: 4 | Basic Calculus | Specialized | STEM | 2ND | 11 | ✓
```

### **Key Points:**

- ✅ **Category, Strand, Semester, and Level are properties of the subject**, not the assignment
- ✅ When a user selects a subject in the "Manage Subjects" dialog, the system automatically retrieves its Category, Strand, Semester, and Level from SUBJECTS_REF
- ✅ No user input required for these fields - they come from SUBJECTS_REF
- ✅ For non-SHS grade levels, these columns can be left blank or use defaults (ALL, Core, 1ST)

### **Backward Compatibility:**

- If SUBJECTS_REF doesn't have the new columns, the system uses defaults:
  - Category: Core
  - Strand: ALL
  - Semester: 1ST
  - Level: null

---

## 📝 Note on STRANDS_REF

**STRANDS_REF sheet is NOT needed.** Strands are now stored directly in SUBJECTS_REF (Column D) for each subject. This eliminates the need for a separate reference sheet and ensures each subject has its own strand assignment.

---

## 🔧 Configuration Updates

### **New Constants in Config.js:**

```javascript
// SHS Default Values (used when values are not provided)
SHS_DEFAULTS: {
  STRAND: 'ALL',        // Default strand value
  CATEGORY: 'Core',     // Default category value
  SEMESTER: '1ST'       // Default semester value
},

// Subject Categories
CATEGORIES: {
  CORE: 'Core',
  SPECIALIZED: 'Specialized'
},

// Semesters
SEMESTERS: {
  FIRST: '1ST',
  SECOND: '2ND'
}
```

### **New Column Mapping for SUBJECTS_REF:**

```javascript
SUBJECTS_REF_COLUMNS: {
  SUBJECT_NAME: 0,  // Column A - Subject Name
  CATEGORY: 1,      // Column B - Category (Core, Specialized, Applied)
  STRAND: 2,        // Column C - Strand (ALL, STEM, HUMSS, ICT, ABM, GAS)
  SEMESTER: 3,      // Column D - Semester (1ST, 2ND)
  LEVEL: 4,         // Column E - Level (11, 12)
  ACTIVE: 5         // Column F - Active (✓ or blank)
}
```

### **Updated Column Mappings:**

```javascript
SUBJECTS_COLUMNS: {
  GRADE_LEVEL: 0,       // Column A
  SECTION: 1,          // Column B
  TEACHER: 2,          // Column C
  SUBJECT: 3,          // Column D
  STRAND: 4,           // Column E - NEW
  CATEGORY: 5,         // Column F - NEW
  SEMESTER: 6,         // Column G - NEW
  STATUS: 7,           // Column H
  CREATED: 8,          // Column I
  MODIFIED: 9,         // Column J
  CREATED_BY: 10        // Column K
}
```

---

## 📝 Migration Guide

### **For Existing Data:**

1. **Backward Compatibility:**
   - Existing assignments without Strand/Category/Semester will default to:
     - Strand: ALL
     - Category: Core
     - Semester: 1ST
   - The system automatically handles missing values

2. **Manual Migration (Optional):**
   - If you want to update existing data, you can:
     - Add columns E, F, G to SUBJECTS sheet
     - Fill in appropriate values based on your subject data
     - The system will use these values going forward

3. **New Assignments:**
   - When creating assignments, users select subjects from SUBJECTS_REF
   - The system automatically retrieves Category, Strand, Semester, and Level from SUBJECTS_REF for each selected subject
   - No manual input required - all metadata comes from SUBJECTS_REF

---

## 🎯 Key Features

### **1. Strand-Based Filtering**
- Subjects can be filtered by strand (STEM, HUMSS, ICT, ABM, GAS)
- Core subjects use "ALL" strand (applies to all strands)
- Specialized subjects are strand-specific

### **2. Category Differentiation**
- **Core:** Subjects that all students take (e.g., Oral Communication, General Mathematics)
- **Specialized:** Strand-specific subjects (e.g., General Chemistry 1 for STEM)

### **3. Semester Tracking**
- Tracks which semester the subject is taught (1ST or 2ND)
- Useful for organizing templates and schedules

### **4. Validation**
- Prevents duplicate assignments: Same grade + section + subject + strand + category + semester cannot be assigned to different teachers
- Validates that required fields are provided

---

## 🔄 Updated Functions

### **Code.js:**
- `getSubjectMetadata(subjectName)` - Gets Category, Strand, Semester, Level for a single subject from SUBJECTS_REF
- `getSubjectsMetadata(subjectNames)` - Gets metadata for multiple subjects at once (batch operation)
- `getAllDropdownData()` - Returns gradeLevels, subjects, teachers, and isSHS flag
- `addSubjectsBatch()` - Accepts subject objects with metadata (retrieved from SUBJECTS_REF)

### **API.js:**
- `_getSubjectMetadata(subjectName)` - Internal function to read metadata from SUBJECTS_REF
- `_getSubjectsMetadata(subjectNames)` - Batch lookup of subject metadata
- `_addSubjectsBatch()` - Handles subject objects with metadata from SUBJECTS_REF
- `_getSubjects()` - Returns assignments with Category, Strand, Semester from SUBJECTS sheet
- All functions handle backward compatibility (defaults for missing values)

---

## 📋 Setup Instructions

### **Step 1: Update SUBJECTS_REF Sheet**

1. Add new columns to your existing SUBJECTS_REF sheet:
   - Column C: Category (Core, Specialized, Applied)
   - Column D: Strand (ALL, STEM, HUMSS, ICT, ABM, GAS)
   - Column E: Semester (1ST, 2ND)
   - Column F: Level (11, 12)
   - Column G: Active (keep existing Active column, move to G)

2. Update headers:
   - Row 1: Merge A1:G1, type "SUBJECT INFORMATION"
   - Row 2: A2 = "#", B2 = "Subject Name", C2 = "Category", D2 = "Strand", E2 = "Semester", F2 = "Level", G2 = "Active"

3. Fill in data for each subject:
   ```
   Row 3: 1 | Oral Communication | Core | ALL | 1ST | 11 | ✓
   Row 4: 2 | General Chemistry 1 | Specialized | STEM | 1ST | 11 | ✓
   Row 5: 3 | Computer Programming 1 | Specialized | ICT | 1ST | 11 | ✓
   ```

**Note:** For non-SHS subjects (Elementary/JHS), you can leave Category, Strand, Semester, and Level blank. The system will use defaults (ALL, Core, 1ST).

### **Step 2: Update SUBJECTS Sheet (if it exists)**

If you have an existing SUBJECTS sheet:

1. **Option A: Let the system handle it (Recommended)**
   - The system will automatically add the new columns when creating new assignments
   - Existing data will use defaults (ALL, Core, 1ST)

2. **Option B: Manual update**
   - Insert 3 new columns after Column D (Subject)
   - Column E: Strand
   - Column F: Category
   - Column G: Semester
   - Update headers in Row 1
   - Fill in values for existing rows (optional)

### **Step 3: Test the System**

1. Open "Manage Subjects" dialog
2. Verify that Strand, Category, and Semester fields are **NOT** shown (they come from SUBJECTS_REF automatically)
3. Select Grade Level, Section, Teacher
4. Select one or more subjects from the list
5. Click "Add Subject" - the system will automatically retrieve Category, Strand, Semester, and Level from SUBJECTS_REF
6. Verify the assignment appears correctly in the SUBJECTS sheet with the correct metadata

---

## ⚠️ Important Notes

1. **Backward Compatibility:** The system maintains backward compatibility with existing data. Missing values default to ALL/Core/1ST.

2. **Validation:** The system validates that the same subject cannot be assigned to different teachers for the same grade/section/strand/category/semester combination.

3. **Automatic Metadata Retrieval:** When creating assignments, Category, Strand, Semester, and Level are automatically retrieved from SUBJECTS_REF for each selected subject. No user input required.

4. **Display:** The UI will show all fields when viewing assignments, making it easy to identify strand-specific subjects.

---

## 📚 Related Files

- `Config.js` - Configuration constants
- `Code.js` - Client-callable functions
- `API.js` - Internal API functions
- `AssignmentDialog.html` - UI for managing subjects
- `OGSTemplateDialog.html` - UI for generating templates

---

**Last Updated:** January 2025  
**Version:** 2.0 (SHS Support)

