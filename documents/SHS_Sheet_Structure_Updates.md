# Senior High School Sheet Structure Updates

## Overview
This document outlines the changes made to support Senior High School (SHS) requirements, specifically adding support for Strands, Categories, and Semesters.

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

## 🆕 New Reference Sheet: STRANDS_REF

### **Purpose:** 
List of available strands for Senior High School. Similar structure to SUBJECTS_REF.

### **Sheet Structure:**

```
Row 1 (Parent Header):
┌─────────────────────────────────────────────────────────┐
│                    STRAND INFORMATION                    │
└─────────────────────────────────────────────────────────┘
                        Col A-C

Row 2 (Column Headers):
# | Strand Name | Active
```

### **Column Details:**

| Column | Field Name    | Description                    | Example         |
|--------|---------------|--------------------------------|-----------------|
| A      | #             | Row numbering (formula)        | 1               |
| B      | Strand Name   | Full strand name               | STEM            |
| C      | Active        | ✓ or blank (hide if inactive)  | ✓               |

### **Sample Data:**

```
Row 1: STRAND INFORMATION (merged across A-C)
Row 2: # | Strand Name | Active
Row 3: 1 | ALL         | ✓
Row 4: 2 | STEM        | ✓
Row 5: 3 | HUMSS       | ✓
Row 6: 4 | ICT         | ✓
Row 7: 5 | ABM         | ✓
Row 8: 6 | GAS         | ✓
```

### **Default Values:**
If STRANDS_REF sheet doesn't exist or is empty, the system uses these default strands:
- ALL
- STEM
- HUMSS
- ICT
- ABM
- GAS

---

## 🔧 Configuration Updates

### **New Constants in Config.js:**

```javascript
// SHS Strands
STRANDS: {
  ALL: 'ALL',
  STEM: 'STEM',
  HUMSS: 'HUMSS',
  ICT: 'ICT',
  ABM: 'ABM',
  GAS: 'GAS'
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
   - All new assignments MUST include Strand, Category, and Semester
   - The UI will prompt for these fields

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
- `getStrands()` - Returns available strands
- `getCategories()` - Returns available categories
- `getSemesters()` - Returns available semesters
- `getAllDropdownData()` - Now includes strands, categories, semesters
- `addAssignment()` - Updated to accept strand, category, semester parameters
- `addSubjectsBatch()` - Updated to handle subject objects with strand/category/semester

### **API.js:**
- `_addAssignment()` - Handles new columns
- `_addSubjectsBatch()` - Handles subject objects with new fields
- `_getSubjects()` - Returns assignments with new fields
- All functions handle backward compatibility (defaults for missing values)

---

## 📋 Setup Instructions

### **Step 1: Create STRANDS_REF Sheet**

1. Create a new sheet named "STRANDS_REF"
2. Set up headers:
   - Row 1: Merge A1:C1, type "STRAND INFORMATION"
   - Row 2: A2 = "#", B2 = "Strand Name", C2 = "Active"
3. Add data starting at Row 3:
   ```
   Row 3: 1 | ALL   | ✓
   Row 4: 2 | STEM  | ✓
   Row 5: 3 | HUMSS | ✓
   Row 6: 4 | ICT   | ✓
   Row 7: 5 | ABM   | ✓
   Row 8: 6 | GAS   | ✓
   ```

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
2. Verify that Strand, Category, and Semester dropdowns appear
3. Create a test assignment with all fields filled
4. Verify it appears correctly in the SUBJECTS sheet

---

## ⚠️ Important Notes

1. **Backward Compatibility:** The system maintains backward compatibility with existing data. Missing values default to ALL/Core/1ST.

2. **Validation:** The system validates that the same subject cannot be assigned to different teachers for the same grade/section/strand/category/semester combination.

3. **Required Fields:** When creating new assignments, Strand, Category, and Semester are required (defaults are provided if not specified).

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

