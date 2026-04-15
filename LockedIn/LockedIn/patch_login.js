import fs from 'fs';
let content = fs.readFileSync('frontend/src/pages/Login.jsx', 'utf8');
content = content.replace(
  "localStorage.setItem('attendance_data', JSON.stringify(data.student_data.attendance));",
  "localStorage.setItem('attendance_data', JSON.stringify(data.student_data.attendance));\n          if (data.student_data.marks) {\n            localStorage.setItem('marks_data', JSON.stringify(data.student_data.marks));\n          }"
);
fs.writeFileSync('frontend/src/pages/Login.jsx', content);
