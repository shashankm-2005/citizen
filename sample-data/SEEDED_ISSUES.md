# Seeded issues in the synthetic sample

All names and emails are made up (`@example.com`). Row numbers are 1-based data rows (header excluded).
Running **Data Quality Lab → Run checks** on the sample produces **16 flags**:

| Row | employee_id | Problem seeded | Expected flag | Suggested fix |
|---|---|---|---|---|
| 5, 6 | E1005 | Two different people share one ID | Duplicate employee ID (×2) | Human decides; re-ID in sandbox |
| 14 | E1012 | Exact copy of row 13 | Duplicate full row (row 13 is *not* flagged) | Exclude copy from sandbox |
| 8 | E1007 | Email empty | Missing required value | Human enters it |
| 9 | E1008 | Last name is spaces only | Missing required value | Human enters it |
| 19 | E1017 | department_id empty | Missing required value | Human enters it |
| 22 | (blank) | employee_id empty | Missing required value | Human enters it |
| 10 | E1009 | `jordan.blake@example` | Invalid email format | Human confirms |
| 11 | E1010 | `kai.morgan.example.com` | Invalid email format | Human confirms |
| 12 | E1011 | `" Logan"` leading space | Inconsistent formatting | `Logan` |
| 15 | E1013 | `nOAH` | Inconsistent formatting (casing) | `Noah` |
| 16 | E1014 | `Oakley.Grant@Example.COM` | Inconsistent formatting (email case) | lowercase |
| 17 | E1015 | department `d02` | Inconsistent formatting (code case) | `D02` |
| 20 | E1018 | hire_date `03/15/1997` | Inconsistent formatting (date) | `1997-03-15` |
| 23 | E1020 | email with trailing space | Inconsistent formatting | trimmed |
| 18 | E1016 | department `D99` | Unmatched foreign key | Human enters a real code |

Clean rows (no flags): 1, 2, 3, 4, 7, 13, 21, 24.

`bad_malformed.csv` has a row with 3 columns instead of 5; the import must be blocked with
`Row 3: Expected 5 columns, found 3`.

These expectations are asserted in `src/lib/core.test.ts`.
