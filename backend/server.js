require('dotenv').config();
const express     = require("express");
const mysql       = require("mysql");
const bodyParser  = require("body-parser");
const cors        = require("cors");
const ExcelJS     = require("exceljs");
const PDFDocument = require("pdfkit");
const fs          = require("fs");
const app         = express();

app.use(cors());
app.use(bodyParser.json());

const connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASSWORD,
  database : process.env.DB_NAME,
  port     : process.env.DB_PORT
});

connection.connect(err => {
  if (err) {
    console.error('Error connecting: ' + err.stack);
    return;
  }
  console.log('Connected as id ' + connection.threadId);
});

// --------------------- User Endpoints ---------------------
// Register User (Signup)
app.post("/register", (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: "All fields are required" });
    }
    const sql = "INSERT INTO users (username, password, role) VALUES (?, ?, ?)";
    connection.query(sql, [username, password, role], (err, result) => {
        if (err) {
            console.error("Error inserting user:", err);
            return res.status(500).json({ error: "Registration failed" });
        }
        res.json({ success: true, message: "User registered successfully!" });
    });
});

// Login User
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }
    const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
    connection.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error("Error fetching user:", err);
            return res.status(500).json({ error: "Login failed" });
        }

        if (results.length > 0) {
            const user = results[0];
            const redirectPage = user.role === "student" ? "studentdetails.html" : "report.html";
            res.json({ success: true, redirect: redirectPage });
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    });
});

// Insert mess entries
app.post("/entries", (req, res) => {
    const { reg_no, name, block, room_no, dining_mess, mess_type, food_suggestion, meal_type, feasibility } = req.body;
    if (!reg_no || !name || !block || !room_no || !dining_mess || !mess_type || !meal_type || !feasibility) {
        return res.status(400).json({ error: "All required fields must be provided" });
    }
    const sql = `INSERT INTO mess_entries 
                 (reg_no, name, block, room_no, dining_mess, mess_type, food_suggestion, meal_type, feasibility, entry_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
    connection.query(sql, [reg_no, name, block, room_no, dining_mess, mess_type, food_suggestion, meal_type, feasibility], (err, result) => {
        if (err) {
            console.error("Error inserting entry:", err);
            return res.status(500).json({ error: "Failed to store details" });
        }
        res.json({ success: true, message: "Stored successfully!" });
    });
});

// Generate Excel report
function generateExcelReport(data, fileName) {
    return new Promise((resolve, reject) => {
        let workbook = new ExcelJS.Workbook();
        let worksheet = workbook.addWorksheet("Report");

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

        data.forEach(item => {
            worksheet.addRow(item);
        });

        workbook.xlsx.writeFile(fileName)
            .then(() => resolve())
            .catch(err => reject(err));
    });
}

// Generate PDF report
function generatePDFReport(data, fileName) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30 });
        const stream = fs.createWriteStream(fileName);
        doc.pipe(stream);

        doc.fontSize(16).text("Mess Report", { align: "center" });
        doc.moveDown();

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

// Generic report handler
function handleReportRequest(sqlQuery, fileBaseName, req, res) {
    const format = (req.query.format || "excel").toLowerCase();
    connection.query(sqlQuery, (err, results) => {
        if (err) return res.status(500).json({ error: err });
        let fileName = `${fileBaseName}.${format === "pdf" ? "pdf" : "xlsx"}`;
        const generator = format === "pdf" ? generatePDFReport : generateExcelReport;
        generator(results, fileName)
            .then(() => {
                res.download(fileName, err => {
                    if (err) console.error("Error downloading file:", err);
                    // Optionally delete file after download here
                });
            })
            .catch(error => res.status(500).json({ error: error.toString() }));
    });
}

// Student-wise report
app.get("/reports/student/:name", (req, res) => {
    const studentName = req.params.name;
    const sql = "SELECT * FROM mess_entries WHERE name = ?";
    connection.query(sql, [studentName], (err, results) => {
        if (err) return res.status(500).json({ error: err });
        const format = (req.query.format || "excel").toLowerCase();
        let fileName = `Student_Report_${studentName}.${format === "pdf" ? "pdf" : "xlsx"}`;
        const generator = format === "pdf" ? generatePDFReport : generateExcelReport;
        generator(results, fileName)
            .then(() => {
                res.download(fileName, err => {
                    if (err) console.error("Error downloading file:", err);
                });
            })
            .catch(error => res.status(500).json({ error: error.toString() }));
    });
});

// Weekly report
app.get("/reports/weekly", (req, res) => {
    const sql = "SELECT * FROM mess_entries WHERE WEEK(entry_date) = WEEK(CURDATE())";
    handleReportRequest(sql, "Weekly_Report", req, res);
});

// Monthly report
app.get("/reports/monthly", (req, res) => {
    const sql = "SELECT * FROM mess_entries WHERE MONTH(entry_date) = MONTH(CURDATE())";
    handleReportRequest(sql, "Monthly_Report", req, res);
});

// Meal-wise report
app.get("/reports/meal/:meal", (req, res) => {
    const mealType = req.params.meal;
    const sql = "SELECT * FROM mess_entries WHERE meal_type = ?";
    connection.query(sql, [mealType], (err, results) => {
        if (err) return res.status(500).json({ error: err });
        const format = (req.query.format || "excel").toLowerCase();
        let fileName = `Meal_Report_${mealType}.${format === "pdf" ? "pdf" : "xlsx"}`;
        const generator = format === "pdf" ? generatePDFReport : generateExcelReport;
        generator(results, fileName)
            .then(() => {
                res.download(fileName, err => {
                    if (err) console.error("Error downloading file:", err);
                });
            })
            .catch(error => res.status(500).json({ error: error.toString() }));
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
