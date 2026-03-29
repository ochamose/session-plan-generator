# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Node.js
Download and install Node.js from [nodejs.org](https://nodejs.org/)
- Choose the LTS (Long Term Support) version
- Verify installation: Open terminal and run `node --version`

### Step 2: Get Your API Key
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key (starts with `sk-ant-`)
5. **Important**: Copy and save it securely - you won't see it again!

### Step 3: Install & Configure
```bash
# Navigate to the application folder
cd session-plan-generator

# Install dependencies
npm install

# Set up your environment
cp .env.example .env
```

Edit `.env` and paste your API key:
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 4: Start the Server
```bash
npm start
```

You should see:
```
Server running on http://localhost:3000
```

### Step 5: Open the Application
Open your web browser and go to:
```
http://localhost:3000
```

### Step 6: Generate Session Plans

1. **Upload your learning plan document**
   - Supported formats: .docx or .pdf
   - The document should contain session information

2. **Fill in course information**:
   - Course Name: e.g., "Mobile App Development"
   - Unit Code: e.g., "IT/OS/ICT/CR/11/6"
   - Level: e.g., "6 (DIPLOMA)"
   - Classes: e.g., "ICT/L6/JAN/24"
   - Institution: e.g., "PC KINYANJUI TTI"

3. **Configure sessions**:
   - Total Weeks: 12 (adjust as needed)
   - Sessions Per Week: 3 (adjust as needed)
   - Session Duration: 120 minutes (step times scale automatically)

4. **Click "Generate Session Plans"**
   - If the document has a different number of weeks than configured, you'll be asked to **redistribute** the content or **use the document's actual weeks**
   - Wait for the process to complete
   - This may take 10-15 minutes for 36 sessions

5. **Download your files**:
   - Download individual session plans
   - Or click "Download All as ZIP"

## 📋 Sample Learning Plan Format

Your learning plan document should include sessions with:
- Week number
- Session number
- Session title
- Learning outcomes
- Trainer activities
- Trainee activities
- Resources/references
- Assessment methods

Example table format:
```
Week | Session | Title | Outcome | Trainer Activities | Trainee Activities | Resources | Assessment
1    | 1       | Intro | Learn X | Demonstrate Y      | Practice Z        | Book Ch.1 | Quiz
```

## ⚠️ Common Issues

### "ANTHROPIC_API_KEY is not configured"
- Make sure your `.env` file exists in the project root
- Ensure it contains `ANTHROPIC_API_KEY=sk-ant-...`
- Restart the server after editing `.env`

### "Could not extract session data"
- The learning plan may be too large for a single API call
- Check the server terminal for `Claude response preview:` logs
- Try a simpler document structure first

### "Port Already in Use"
- Another application is using port 3000
- Stop that application or change the port in `.env`:
  ```env
  PORT=3001
  ```
  Then restart and visit http://localhost:3001

### Server Won't Start
- Run `npm install` again
- Check Node.js version: `node --version` (should be v16+)
- Delete `node_modules` and run `npm install` again

## 💰 Cost Estimate

Generating 36 session plans:
- Estimated cost: **$0.10 - $0.20**
- This is based on Claude Sonnet 4 pricing
- Monitor your usage at console.anthropic.com

## 🎯 Tips for Best Results

1. **Use clear document structure**
   - Organize sessions in a table
   - Include all required fields
   - Be consistent with formatting

2. **Start small**
   - Test with 3-5 sessions first
   - Verify output quality
   - Then generate all sessions

3. **Review generated plans**
   - AI-generated content may need editing
   - Check for accuracy and completeness
   - Customize as needed

4. **Your API key is secure**
   - It's stored server-side in `.env`, never sent to the browser
   - `.env` is excluded from version control via `.gitignore`
   - Rotate keys regularly at console.anthropic.com

## 🆘 Need Help?

1. Check the main README.md for detailed documentation
2. Review error messages in the browser console (F12)
3. Check the server terminal for backend errors
4. Verify Claude API status at status.anthropic.com

## 📝 Next Steps

After successfully generating your first session plans:

1. **Customize the template**
   - Edit `server.js` to modify the session plan structure
   - Adjust learning outcomes, steps, and formatting

2. **Deploy online**
   - See deployment instructions in README.md
   - Deploy to Heroku, Vercel, or your own server

3. **Add features**
   - Custom templates per course
   - User authentication
   - Session plan library
   - Export to different formats

Happy session planning! 🎓
