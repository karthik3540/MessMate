// Load environment variables
require("dotenv").config();
const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const cors = require("cors");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const app = express();

app.use(cors({
  origin: "https://messmate-x7pw.onrender.com", 
  credentials: true
}));

app.use(bodyParser.json());

// Use connection pool to avoid handshake errors
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  connectionLimit: 10
});

// --------------------- User Endpoints ---------------------
app.post("/signup", (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const sql = "INSERT INTO users (username, password, role) VALUES (?, ?, ?)";
  pool.query(sql, [username, password, role], (err) => {
    if (err) return res.status(500).json({ message: "Registration failed" });
    res.json({ success: true, message: "User registered successfully!" });
  });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
  pool.query(sql, [username, password], (err, results) => {
    if (err) return res.status(500).json({ error: "Login failed" });
    if (results.length > 0) {
      const user = results[0];
      const redirectPage = user.role === "student" ? "studentdetails.html" : "report.html";
      res.json({ success: true, redirect: redirectPage });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });
});

// --------------------- Entry and Reports ---------------------
app.post("/entries", (req, res) => {
  const { reg_no, name, block, room_no, dining_mess, mess_type, food_suggestion, meal_type, feasibility } = req.body;
  if (!reg_no || !name || !block || !room_no || !dining_mess || !mess_type || !meal_type || !feasibility) {
    return res.status(400).json({ error: "All required fields must be provided" });
  }
  const sql = `INSERT INTO mess_entries 
               (reg_no, name, block, room_no, dining_mess, mess_type, food_suggestion, meal_type, feasibility, entry_date) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
  pool.query(sql, [reg_no, name, block, room_no, dining_mess, mess_type, food_suggestion, meal_type, feasibility], (err) => {
    if (err) return res.status(500).json({ error: "Failed to store details" });
    res.json({ success: true, message: "Stored successfully!" });
  });
});

function generateExcelReport(data, fileName) {
  return new Promise((resolve, reject) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");

    worksheet.columns = [
      { header: "Reg No", key: "reg_no", width: 15 },
      { header: "Name", key: "name", width: 20 },
      { header: "Block", key: "block", width: 10 },
      { header: "Room No", key: "room_no", width: 10 },
      { header: "Dining Mess", key: "dining_mess", width: 15 },
      { header: "Mess Type", key: "mess_type", width: 15 },
      { header: "Food Suggestion", key: "food_suggestion", width: 25 },
      { header: "Meal Type", key: "meal_type", width: 15 },
      { header: "Feasibility", key: "feasibility", width: 15 },
      { header: "Entry Date", key: "entry_date", width: 20 }
    ];

    data.forEach(item => worksheet.addRow(item));
    workbook.xlsx.writeFile(fileName).then(resolve).catch(reject);
  });
}

function generatePDFReport(data, fileName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30 });
    const stream = fs.createWriteStream(fileName);
    doc.pipe(stream);

    doc.fontSize(16).text("Mess Report", { align: "center" }).moveDown();
    data.forEach(item => {
      doc.fontSize(12)
        .text(`Reg No: ${item.reg_no}`)
        .text(`Name: ${item.name}`)
        .text(`Block: ${item.block}`)
        .text(`Room No: ${item.room_no}`)
        .text(`Dining Mess: ${item.dining_mess}`)
        .text(`Mess Type: ${item.mess_type}`)
        .text(`Food Suggestion: ${item.food_suggestion}`)
        .text(`Meal Type: ${item.meal_type}`)
        .text(`Feasibility: ${item.feasibility}`)
        .text(`Entry Date: ${item.entry_date}`)
        .moveDown();
    });

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function handleReportRequest(sqlQuery, fileBaseName, req, res, params = []) {
  const format = (req.query.format || "excel").toLowerCase();
  pool.query(sqlQuery, params, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    const fileName = `${fileBaseName}.${format === "pdf" ? "pdf" : "xlsx"}`;
    const generator = format === "pdf" ? generatePDFReport : generateExcelReport;
    generator(results, fileName)
      .then(() => res.download(fileName, err => { if (err) console.error("Download error:", err); }))
      .catch(error => res.status(500).json({ error: error.toString() }));
  });
}

app.get("/reports/student/:name", (req, res) => {
  handleReportRequest("SELECT * FROM mess_entries WHERE name = ?", `Student_Report_${req.params.name}`, req, res, [req.params.name]);
});

app.get("/reports/weekly", (req, res) => {
  handleReportRequest("SELECT * FROM mess_entries WHERE WEEK(entry_date) = WEEK(CURDATE())", "Weekly_Report", req, res);
});

app.get("/reports/monthly", (req, res) => {
  handleReportRequest("SELECT * FROM mess_entries WHERE MONTH(entry_date) = MONTH(CURDATE())", "Monthly_Report", req, res);
});

app.get("/reports/meal/:meal", (req, res) => {
  handleReportRequest("SELECT * FROM mess_entries WHERE meal_type = ?", `Meal_Report_${req.params.meal}`, req, res, [req.params.meal]);
});

app.get("/", (req, res) => {
  res.send("Backend is alive!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
