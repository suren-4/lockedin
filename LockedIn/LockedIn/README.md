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
