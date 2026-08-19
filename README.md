# LockedIn

LockedIn is a small web application consisting of a backend and frontend that helps SRM students fetch academic data such as timetable and attendance, run lightweight ML utilities such as resume matching and sentiment analysis, and access a simple chatbot/utility API.

The project includes a Node.js/Express backend that scrapes SRM Academia when required, a React + Vite frontend, and a small Python ML workspace for model training and predictions.

---

## Highlights

- Login and scraping of SRM Academia to retrieve timetable and attendance data
- Chatbot endpoint with configurable LLM integration
- Resume matching using Python-based ML utilities
- Sentiment analysis using a trained ML model
- Docker and Docker Compose support
- Vercel configuration for frontend hosting
- File upload and document parsing support
- JWT-based authentication
- Optional AWS S3 integration

---

## Tech Stack

### Languages

- JavaScript
- Python

### Backend

- Node.js
- Express.js
- REST APIs

### Frontend

- React
- Vite

### Machine Learning

- Python
- Scikit-learn
- Pickle-based models

### Web Scraping

- Puppeteer
- Puppeteer Core
- Cheerio

### Security and Backend Libraries

- Express
- Helmet
- CORS
- Express Rate Limit
- JSON Web Token (JWT)
- Multer
- PDF-Parse

### Cloud

- AWS S3

### DevOps and Deployment

- Docker
- Docker Compose
- Vercel

---

## Repository Structure

```text
LockedIn/
└── LockedIn/
    ├── .dockerignore
    ├── .env.example
    ├── Dockerfile
    ├── docker-compose.yml
    ├── package.json
    ├── package-lock.json
    ├── server.js
    ├── timetableData.js
    ├── patch_login.js
    ├── vercel.json
    │
    ├── frontend/
    │   ├── README.md
    │   ├── package.json
    │   └── src/
    │
    ├── ml/
    │   ├── data_pipeline.py
    │   ├── train_model.py
    │   ├── predict.py
    │   ├── resume_matcher.py
    │   ├── analyze_sentiment.py
    │   ├── requirements.txt
    │   ├── model.pkl
    │   └── sentiment_model.pkl
    │
    ├── srm-scraper/
    │   └── additional scraper utilities
    │
    ├── scratch/
    │   └── experimentation
    │
    └── test_*.js
# LockedIn Backend

This backend provides APIs used by the frontend app:

- `POST /api/auth/login` -> logs into SRM Academia, scrapes timetable, and returns `student_data`
- `GET /api/leetcode/daily`
- `GET /api/leetcode/user/:username`
- `POST /api/chatbot/ask`
- `GET /api/health`

## Run

```bash
npm install
npm start
```

Server runs on `http://localhost:8000` by default.

## Gemini Setup

Set a Gemini API key before starting the server if you want the assistant to use the live model:

```bash
export GEMINI_API_KEY=your_api_key_here
export GEMINI_MODEL=gemini-2.5-flash
npm start
```

If `GEMINI_API_KEY` is not set, the chatbot endpoint stays available and falls back to deterministic local replies.

## Notes

- Credentials are accepted per request and not stored in files.
- Timetable JSON is fetched only by live scraping from Academia My Time Table.
- If scraping fails, the server falls back to sample timetable data for dashboard continuity.
- `POST /api/chatbot/ask` uses Gemini when configured and otherwise returns local fallback responses.
