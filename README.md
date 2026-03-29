# Session Plan Generator

AI-powered session plan generator using Claude API. Automatically generate professional session plans from learning plan documents.

## Features

- 📄 **Document Upload**: Upload learning plans in .docx or .pdf format
- 🤖 **AI-Powered**: Uses Claude API to intelligently extract and generate session plans
- 📝 **Professional Templates**: Generates properly formatted Word documents
- 📦 **Bulk Download**: Download all session plans as a ZIP file
- ⚙️ **Customizable**: Configure course details, weeks, sessions, and duration
- 📅 **Week Mismatch Detection**: Automatically detects if the learning plan has fewer/more weeks than configured, with options to redistribute or adjust
- 🔒 **Secure**: API key stored server-side in `.env`, Helmet security headers, sanitized file uploads
- 🎨 **Modern UI**: Clean, intuitive 3-step interface

## Prerequisites

- Node.js (v16 or higher)
- Claude API key from [console.anthropic.com](https://console.anthropic.com/)

## Installation

### 1. Clone or Download

```bash
# If you have the files
cd session-plan-generator
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example file and add your Claude API key:

```bash
cp .env.example .env
```

Edit `.env` and set your API key:

```env
PORT=3000
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> **Required**: Get your API key from [console.anthropic.com](https://console.anthropic.com/)

## Running Locally

### Start the Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

### Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## Usage Guide

### Step 1: Upload Documents
Upload your learning plan document (.docx or .pdf).

### Step 2: Course Information
Fill in the required course details:
- Course Name (e.g., Mobile App Development)
- Unit Code (e.g., IT/OS/ICT/CR/11/6)
- Level (e.g., 6 DIPLOMA)
- Classes (e.g., ICT/L6/JAN/24)
- Institution Name
- Trainer Name (optional)

### Step 3: Session Configuration
- Total Weeks (default: 12)
- Sessions Per Week (default: 3)
- Session Duration in minutes (default: 120)

> **Note**: Session step times scale proportionally with the configured duration.

### Step 4: Generate
Click "Generate Session Plans" and wait for the process to complete.

If the learning plan contains a different number of weeks than your configuration, you will be prompted to either:
- **Redistribute** — spread the extracted sessions across your configured number of weeks
- **Use actual** — adjust the week count to match the document

### Step 5: Download
- Download individual session plans
- Or download all as a ZIP file

## File Structure

```
session-plan-generator/
├── server.js              # Express server with Claude API integration
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (not committed)
├── .env.example           # Example environment variables
├── .gitignore             # Git ignore rules
├── public/                # Frontend files
│   ├── index.html        # Main HTML interface
│   └── script.js         # Frontend JavaScript
├── uploads/              # Temporary file storage (auto-created, auto-cleaned)
├── README.md             # This file
└── QUICKSTART.md          # Quick start guide
```

## API Endpoints

### POST /api/extract-sessions
Extracts session information from a learning plan document. Uses the `ANTHROPIC_API_KEY` from `.env`.

**Request:**
- `learningPlan`: File (multipart/form-data)

**Response:**
```json
{
  "sessions": [
    {
      "week": "1",
      "session_no": "1",
      "title": "Session title",
      "outcome": "Learning outcome",
      "trainer_activities": "Activities",
      "trainee_activities": "Activities",
      "resources": "Resources",
      "assessments": "Assessment methods"
    }
  ]
}
```

### POST /api/redistribute-sessions
Redistributes extracted sessions across a different number of weeks.

**Request:**
```json
{
  "sessions": [...],
  "targetWeeks": 12,
  "sessionsPerWeek": 3
}
```

**Response:**
```json
{
  "sessions": [
    {
      "week": "1",
      "session_no": "1",
      "title": "..."
    }
  ]
}
```

### POST /api/generate-plans
Generates Word documents for session plans.

**Request:**
```json
{
  "sessions": [...],
  "courseInfo": {
    "courseName": "...",
    "unitCode": "...",
    "level": "...",
    "classes": "...",
    "institution": "...",
    "duration": 120
  }
}
```

**Response:**
```json
{
  "plans": [
    {
      "filename": "Week1_Session1_Title.docx",
      "buffer": "base64-encoded-data"
    }
  ]
}
```

### POST /api/generate-zip
Creates a ZIP file containing all session plans.

**Request:**
```json
{
  "plans": [...]
}
```

**Response:**
Binary ZIP file download

## Deployment

### Deploy to Heroku

1. Create a Heroku account and install Heroku CLI

2. Login and create app:
```bash
heroku login
heroku create your-app-name
```

3. Deploy:
```bash
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

4. Open app:
```bash
heroku open
```

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

### Deploy to AWS/DigitalOcean

1. Set up a server (Ubuntu recommended)
2. Install Node.js
3. Clone repository
4. Install dependencies: `npm install`
5. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start server.js
pm2 startup
pm2 save
```

6. Set up nginx as reverse proxy
7. Configure SSL with Let's Encrypt

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | — | Claude API key from console.anthropic.com |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `ALLOWED_ORIGINS` | No | — | Comma-separated list of allowed CORS origins |
| `MAX_FILE_SIZE` | No | `10` | Maximum upload size in MB |

## Troubleshooting

### "ANTHROPIC_API_KEY is not configured"
- Ensure your `.env` file exists and contains `ANTHROPIC_API_KEY=sk-ant-...`
- Restart the server after editing `.env`
- Check that your API key has sufficient credits at [console.anthropic.com](https://console.anthropic.com/)

### File Upload Issues
- Check file size (max 10MB)
- Ensure file format is .docx or .pdf
- Verify file is not corrupted

### "Could not extract session data"
- The learning plan may be too large — Claude's response was likely truncated
- Try a simpler or shorter document first
- Check server console for the `Claude response preview:` log to see what was returned

### "Claude returned malformed JSON"
- Claude's response contained invalid JSON — try generating again
- Check server logs for details on the parse error

## Cost Considerations

### Claude API Pricing
- Model: Claude Sonnet 4 (claude-sonnet-4-20250514)
- Approximate cost: $3-5 per 1M input tokens, $15 per 1M output tokens
- Typical session plan: ~2000 tokens total
- 36 session plans: approximately $0.10-0.20

Always monitor your API usage at [console.anthropic.com](https://console.anthropic.com/)

## Security

The following security measures are built in:

1. **Server-side API key** — stored in `.env`, never exposed to the browser
2. **Helmet** — sets secure HTTP headers (X-Frame-Options, X-Content-Type-Options, etc.)
3. **Sanitized uploads** — filenames are replaced with random hex strings to prevent path traversal
4. **Auto-cleanup** — uploaded files are deleted after processing (even on errors)
5. **`.gitignore`** — prevents `.env`, uploads, and generated files from being committed

For production, also consider:
- Adding rate limiting
- Adding authentication
- Using HTTPS
- Restricting CORS origins via `ALLOWED_ORIGINS`

## Limitations

- Maximum file size: 10MB
- Supported formats: .docx, .pdf
- Rate limits apply based on Claude API tier
- Generated plans may need manual review

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Claude API documentation
3. Check server logs for errors

## License

MIT License - Feel free to modify and use for your needs

## Credits

Built with:
- Claude API by Anthropic
- Express.js
- Helmet (security headers)
- docx library (Word document generation)
- Mammoth.js (DOCX text extraction)
- PDF-Parse (PDF text extraction)
- JSZip (ZIP archive creation)

---

**Note**: This tool uses AI to generate session plans. Always review and verify the generated content before use in educational settings.
