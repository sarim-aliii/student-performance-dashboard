import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import nodemailer from "nodemailer";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import firebaseConfig from './firebaseConfig';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function sendReport(config: any) {
  console.log(`Generating report for ${config.email}...`);
  
  try {
    const q = query(collection(db, 'students'), where('uploadedBy', '==', config.userId));
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(doc => doc.data());

    if (records.length === 0) {
      console.log(`No records found for user ${config.userId}. Skipping report.`);
      return;
    }

    const avgMarks = Math.round(records.reduce((acc, r: any) => acc + r.marks, 0) / records.length);
    const avgAttendance = Math.round(records.reduce((acc, r: any) => acc + r.attendance, 0) / records.length);
    
    const reportContent = `
      <h1>Student Performance Summary</h1>
      <p>Hello, here is your ${config.frequency} student performance report.</p>
      <ul>
        <li><strong>Total Records:</strong> ${records.length}</li>
        <li><strong>Average Marks:</strong> ${avgMarks}%</li>
        <li><strong>Average Attendance:</strong> ${avgAttendance}%</li>
      </ul>
      <p>Log in to your dashboard for detailed analytics and AI-powered insights.</p>
    `;

    let transporter;
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`Using Ethereal test account: ${testAccount.user}`);
    }

    const info = await transporter.sendMail({
      from: '"EduAnalytics Reports" <reports@eduanalytics.com>',
      to: config.email,
      subject: `Your ${config.frequency.charAt(0).toUpperCase() + config.frequency.slice(1)} Performance Report`,
      html: reportContent,
    });

    console.log("Message sent: %s", info.messageId);
    if (!process.env.SMTP_HOST) {
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }

    await updateDoc(doc(db, 'reportConfigs', config.id), {
      lastSent: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error sending report:", error);
  }
}

cron.schedule('0 * * * *', async () => {
  console.log("Checking for reports to send...");
  try {
    const q = query(collection(db, 'reportConfigs'), where('active', '==', true));
    const snapshot = await getDocs(q);
    
    const now = new Date();
    for (const d of snapshot.docs) {
      const config = { id: d.id, ...d.data() } as any;
      const lastSent = config.lastSent ? new Date(config.lastSent) : new Date(0);
      
      let shouldSend = false;
      if (config.frequency === 'weekly') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (lastSent < oneWeekAgo) shouldSend = true;
      } else if (config.frequency === 'monthly') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (lastSent < oneMonthAgo) shouldSend = true;
      }

      if (shouldSend) {
        await sendReport(config);
      }
    }
  } catch (error) {
    console.error("Cron job error:", error);
  }
});

async function startServer() {
  const app = express();
  // Render assigns a port dynamically. We must use process.env.PORT!
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Use absolute pathing to guarantee Express finds the dist folder
    const distPath = path.join(__dirname, 'dist');
    console.log(`[Production] Serving static files from: ${distPath}`);
    
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
          console.error("Express failed to find dist/index.html. Ensure Vite built successfully.", err);
          res.status(500).send("Server Error: Built frontend not found.");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();