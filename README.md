# Student Performance Dashboard

A comprehensive web application designed to track, analyze, and visualize student performance data. Built with React, Vite, and TypeScript, and powered by Firebase for robust backend services. The application is containerized using Docker and optimized for deployment on Render.

## 🚀 Tech Stack

* **Frontend:** React, Vite, TypeScript
* **Styling & UI:** Tailwind CSS, shadcn/ui
* **Backend/Database:** Firebase (Authentication, Firestore)
* **Containerization:** Docker (Multi-stage builds)
* **Deployment:** Render
* **Server:** Node.js (Serving static assets via `tsx`)

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v20 or higher recommended)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local container testing)
* A [Firebase](https://firebase.google.com/) account and project

## ⚙️ Environment Variables

Create a `.env` file in the root directory (you can copy `.env.example`) and add your Firebase configuration keys. **Never commit your `.env` file to version control.**

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
💻 Local Development
Clone the repository:  

Bash
git clone [https://github.com/your-username/student-performance-dashboard.git](https://github.com/your-username/student-performance-dashboard.git)
cd student-performance-dashboard
Install dependencies:

Bash
npm install
Start the Vite development server:

Bash
npm run dev
The application will be available at http://localhost:5173.

🐳 Docker Setup
This project uses a highly optimized, multi-stage Dockerfile to keep the production image lightweight and prevent Out-Of-Memory (OOM) errors during build time.

To build and run the application locally using Docker:

Build the image and start the container:

Bash
docker-compose up --build
The server will start and be available at http://localhost:3000.

☁️ Deployment (Render)
This application is configured for seamless deployment as a Web Service on Render using Docker.

Connect your GitHub repository to a new Render Web Service.

Render will automatically detect the Dockerfile and set the Runtime to Docker.

Go to the Environment tab in your Render dashboard and add all the required VITE_FIREBASE_* variables.

Render will automatically pull these variables during the build stage (via Docker ARG) to successfully compile the Vite application, and then serve it using the lightweight Node.js server setup.

📂 Project Structure
/src: Contains the main React application code (main.tsx, App.tsx, firebase.ts).

/components/ui: Reusable UI components (buttons, cards, dialogs, etc.) built with shadcn/ui.

/lib: Utility functions (utils.ts).

server.ts: The entry point for the production Node.js server.

firebaseConfig.ts & firebase-blueprint.json: Firebase setup and structural blueprints.

Dockerfile & docker-compose.yml: Containerization and deployment configuration.

📝 License
  
This project is licensed under the MIT License.