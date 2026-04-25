# 📊 EduAnalytics: Student Performance Dashboard

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google%20gemini&logoColor=white)

EduAnalytics is a full-stack, AI-powered platform designed for educators to track, analyze, and report on student performance metrics. Built with React, Express, Firebase, and Google's Gemini AI, it provides deep insights, beautiful data visualizations, and automated email reporting.

## ✨ Features

- **🔐 Secure Authentication:** Email/Password and Google OAuth login powered by Firebase.
- **📁 Bulk Data Upload:** Seamlessly upload student records via CSV parsing (`papaparse`).
- **📈 Advanced Data Visualization:** Interactive Bar, Line, and Pie charts using `recharts` to track attendance and grade distribution.
- **🤖 AI-Powered Insights:** Integration with Google Gemini API to automatically generate actionable insights and recommendations based on current classroom data.
- **✉️ Automated Email Reports:** Built-in Node.js backend using `node-cron` and `nodemailer` to schedule and send weekly or monthly performance summaries to educators.
- **🎛️ Dynamic Filtering:** Filter real-time data by Student ID, Class, Subject, Semester, Date Ranges, and custom tags.
- **✨ Smooth Animations:** High-performance UI animations powered by GSAP.

## 🛠️ Tech Stack

**Frontend:** React 19, Vite, Tailwind CSS v4, Shadcn UI, Recharts, GSAP  
**Backend:** Node.js, Express, TSX, Node-Cron, Nodemailer  
**Database & Auth:** Firebase (Firestore & Authentication)  
**AI Integration:** Google Gemini API  

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18+ recommended)
- A Google Gemini API Key
- A Firebase Project (with Firestore and Authentication enabled)
- SMTP Credentials (for email reporting, or default to Ethereal testing)

### 1. Clone the repository
```bash
git clone [https://github.com/your-username/student-performance-dashboard.git](https://github.com/your-username/student-performance-dashboard.git)
cd student-performance-dashboard
2. Install dependencies
Bash
npm install
3. Environment Variables
Rename .env.example to .env and fill in your configuration details:

Code snippet
GEMINI_API_KEY=your_gemini_api_key
APP_URL=http://localhost:3000

# Email Config
SMTP_HOST=smtp.your-email-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email
SMTP_PASS=your_password

# Firebase Config
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIRESTORE_DATABASE_ID="(default)"
4. Start the Application
This runs both the Vite frontend middleware and the Express backend concurrently:

Bash
npm run dev
☁️ Deployment Guide (Render)
This project uses a custom Express server to handle background cron jobs, meaning it must be deployed as a Web Service (Node environment), not a Static Site.

Push your code to GitHub. Ensure your package.json has the correct start script: "start": "NODE_ENV=production tsx server.ts".

Create a New Web Service on Render connected to your repository.

Configure the Service:

Environment: Node

Build Command: npm install && npm run build

Start Command: npm start

Add all Environment Variables from your .env file into the Render dashboard.

Deploy!

⚠️ Note on Free Tiers: If deploying on a free tier (like Render's free Web Service), the server will spin down after 15 minutes of inactivity. To ensure automated node-cron email reports run reliably, you can set up a free uptime monitor (like cron-job.org) to ping your https://your-app-url.com/api/health endpoint every 10 minutes.

🔒 Firebase Security Rules (Firestore)
To ensure users can only access their own uploaded records, set up the following rules in your Firebase console:

JavaScript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /students/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uploadedBy;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uploadedBy;
    }
    match /reportConfigs/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

📝 License
This project is MIT licensed.