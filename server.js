require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        AlignmentType, WidthType, BorderStyle, ShadingType } = require('docx');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const JSZip = require('jszip');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Read API key from environment
function getApiKey() {
    return process.env.ANTHROPIC_API_KEY || null;
}

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = crypto.randomBytes(8).toString('hex') + ext;
        cb(null, safeName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to call Claude API
async function callClaudeAPI(apiKey, messages, maxTokens = 4096) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: maxTokens,
            messages: messages
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Claude API request failed');
    }
    
    return await response.json();
}

// Extract text from DOCX file
async function extractDocxText(filePath) {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

// Extract text from PDF file
async function extractPdfText(filePath) {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text;
}

// Extract text from uploaded file
async function extractFileText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.docx') {
        return await extractDocxText(filePath);
    } else if (ext === '.pdf') {
        return await extractPdfText(filePath);
    } else {
        throw new Error('Unsupported file format');
    }
}

// Parse sessions from learning plan using Claude
async function parseSessionsFromPlan(text, apiKey) {
    const messages = [{
        role: 'user',
        content: `Extract all session information from this learning plan document and format as JSON.

Document content:
${text}

Extract each session with:
- week (number or range like "1" or "10-11")
- session_no (number or range like "1" or "1-2")
- title (full session title)
- outcome (learning outcome)
- trainer_activities (what trainer does)
- trainee_activities (what trainees do)
- resources (textbooks, materials)
- assessments (how learning is checked)

Return ONLY a valid JSON array, no other text:
[{"week":"1","session_no":"1","title":"...","outcome":"...","trainer_activities":"...","trainee_activities":"...","resources":"...","assessments":"..."}]`
    }];
    
    const response = await callClaudeAPI(apiKey, messages, 16384);
    const content = response.content[0].text;
    
    console.log('Claude response length:', content.length);
    console.log('Claude response preview:', content.substring(0, 500));
    
    // Strip markdown code fences if present
    let cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    
    // Extract JSON array from response
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        console.error('Full Claude response:', content);
        throw new Error('Could not extract session data from learning plan. Claude may not have returned valid JSON.');
    }
    
    try {
        return JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
        console.error('JSON parse error:', parseErr.message);
        console.error('Attempted to parse:', jsonMatch[0].substring(0, 500));
        throw new Error('Claude returned malformed JSON. Please try again.');
    }
}

// Create border helper
function createBorder() {
    const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
    return { top: border, bottom: border, left: border, right: border };
}

// Generate learning outcomes
function generateLearningOutcomes(outcome, title) {
    const outcomes = [outcome];
    
    if (title.includes('Assessment') || title.includes('CAT') || title.includes('Exam')) {
        outcomes.push("Demonstrate competency in the subject area");
        outcomes.push("Apply knowledge under timed conditions");
    } else {
        outcomes.push("Apply theoretical concepts in practical scenarios");
        outcomes.push("Demonstrate understanding through hands-on activities");
    }
    
    return outcomes;
}

// Scale step times proportionally to the configured session duration
function scaleTimes(baseSteps, baseDuration, actualDuration) {
    const ratio = actualDuration / baseDuration;
    return baseSteps.map((s, i, arr) => {
        if (i === arr.length - 1) {
            // Last step gets the remainder to ensure times sum exactly
            const usedTime = arr.slice(0, -1).reduce((sum, step) => sum + Math.round(step.time * ratio), 0);
            return { ...s, time: actualDuration - usedTime };
        }
        return { ...s, time: Math.round(s.time * ratio) };
    });
}

// Generate session steps
function generateSessionSteps(sessionData, duration = 120) {
    const isAssessment = sessionData.title.includes('Assessment') || 
                        sessionData.title.includes('CAT') || 
                        sessionData.title.includes('Exam');
    
    const BASE_DURATION = 120;
    let baseSteps;

    if (isAssessment) {
        baseSteps = [
            {
                step: "Introduction",
                time: 5,
                trainerActivity: "Call class to order, take attendance, explain assessment instructions",
                traineeActivity: "Settle in, prepare materials, review instructions",
                assessment: "Understanding of assessment requirements"
            },
            {
                step: "Assessment Preparation",
                time: 10,
                trainerActivity: "Distribute materials, answer clarifying questions",
                traineeActivity: "Organize workspace, review instructions",
                assessment: "Readiness check"
            },
            {
                step: "Assessment Execution",
                time: 90,
                trainerActivity: sessionData.trainer_activities,
                traineeActivity: sessionData.trainee_activities,
                assessment: "Monitor progress and integrity"
            },
            {
                step: "Submission & Review",
                time: 15,
                trainerActivity: "Collect submissions, provide immediate feedback",
                traineeActivity: "Submit work, ask questions",
                assessment: "Verify submissions"
            }
        ];
    } else {
        baseSteps = [
            {
                step: "Introduction",
                time: 5,
                trainerActivity: "Call class to order, take attendance, state learning outcomes",
                traineeActivity: "Settle in, respond to roll call",
                assessment: "Oral questions on previous lesson"
            },
            {
                step: "Concept Introduction",
                time: 20,
                trainerActivity: "Present theoretical concepts, explain key principles",
                traineeActivity: "Take notes, ask questions, participate in discussions",
                assessment: "Comprehension check questions"
            },
            {
                step: "Demonstration",
                time: 25,
                trainerActivity: sessionData.trainer_activities,
                traineeActivity: "Observe demonstration, note key steps",
                assessment: "Observation and oral questions"
            },
            {
                step: "Guided Practice",
                time: 40,
                trainerActivity: "Supervise practice, provide guidance, answer questions",
                traineeActivity: sessionData.trainee_activities,
                assessment: "Monitor progress, provide feedback"
            },
            {
                step: "Independent Practice",
                time: 25,
                trainerActivity: "Monitor individual work, provide support as needed",
                traineeActivity: "Complete assigned tasks independently",
                assessment: "Review completed work"
            },
            {
                step: "Session Review",
                time: 5,
                trainerActivity: "Summarize key points, preview next lesson",
                traineeActivity: "Ask questions, note homework",
                assessment: "Exit reflection"
            }
        ];
    }

    return scaleTimes(baseSteps, BASE_DURATION, duration);
}

// Create session plan document
function createSessionPlanDocument(sessionData, courseInfo) {
    const borders = createBorder();
    const headerShading = { fill: "D5E8F0", type: ShadingType.CLEAR };
    const margins = { top: 80, bottom: 80, left: 120, right: 120 };
    
    const outcomes = generateLearningOutcomes(sessionData.outcome, sessionData.title);
    const steps = generateSessionSteps(sessionData, courseInfo.duration || 120);
    
    // Header Table
    const headerTable = new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
            new TableRow({
                children: [
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun({ text: "Date:", bold: true })] })] }),
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun("")] })] }),
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun({ text: "Time:", bold: true })] })] }),
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun(courseInfo.duration + " minutes")] })] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun({ text: "Institution:", bold: true })] })] }),
                    new TableCell({ borders, margins, columnSpan: 2, children: [new Paragraph({ children: [new TextRun(courseInfo.institution)] })] }),
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun({ text: "Level: " + courseInfo.level })] })] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun({ text: "Unit Code:", bold: true })] })] }),
                    new TableCell({ borders, margins, columnSpan: 2, children: [new Paragraph({ children: [new TextRun(courseInfo.unitCode)] })] }),
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun({ text: "Class:", bold: true }), new TextRun(" " + courseInfo.classes)] })] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun({ text: "Unit of Competence:", bold: true })] })] }),
                    new TableCell({ borders, margins, columnSpan: 3, children: [new Paragraph({ children: [new TextRun(courseInfo.courseName)] })] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun({ text: "Session title:", bold: true })] })] }),
                    new TableCell({ borders, margins, columnSpan: 3, children: [new Paragraph({ children: [new TextRun(sessionData.title)] })] })
                ]
            })
        ]
    });
    
    // Learning Outcomes Table
    const outcomesTable = new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
            new TableRow({
                children: [new TableCell({ borders, margins, shading: headerShading, 
                    children: [new Paragraph({ children: [new TextRun({ text: "Learning outcome/s", bold: true })] })] })]
            }),
            new TableRow({
                children: [new TableCell({ borders, margins,
                    children: [
                        new Paragraph({ children: [new TextRun("By the end of the session, the trainee should be able to:")] }),
                        ...outcomes.map((o, i) => new Paragraph({ children: [new TextRun(`${i + 1}. ${o}`)] }))
                    ]
                })]
            })
        ]
    });
    
    // Resources Table
    const resourcesTable = new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
            new TableRow({
                children: [new TableCell({ borders, margins, shading: headerShading,
                    children: [new Paragraph({ children: [new TextRun({ text: "Resources", bold: true })] })] })]
            }),
            new TableRow({
                children: [new TableCell({ borders, margins,
                    children: [
                        new Paragraph({ children: [new TextRun({ text: "Reference Materials:", bold: true })] }),
                        new Paragraph({ children: [new TextRun(sessionData.resources)] }),
                        new Paragraph({ children: [new TextRun("")] }),
                        new Paragraph({ children: [new TextRun({ text: "Learning aids:", bold: true })] }),
                        new Paragraph({ children: [new TextRun("Computer lab, projector, software tools")] })
                    ]
                })]
            })
        ]
    });
    
    // Session Delivery Table
    const deliveryTable = new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [
            new TableRow({
                children: [
                    new TableCell({ borders, margins, shading: headerShading, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Step", bold: true })] })] }),
                    new TableCell({ borders, margins, shading: headerShading, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Time", bold: true })] })] }),
                    new TableCell({ borders, margins, shading: headerShading, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Trainer Activity", bold: true })] })] }),
                    new TableCell({ borders, margins, shading: headerShading, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Trainee Activity", bold: true })] })] }),
                    new TableCell({ borders, margins, shading: headerShading, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Assessment", bold: true })] })] })
                ]
            }),
            ...steps.map(s => new TableRow({
                children: [
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun({ text: s.step, bold: true })] })] }),
                    new TableCell({ borders, margins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(s.time + " min")] })] }),
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun(s.trainerActivity)] })] }),
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun(s.traineeActivity)] })] }),
                    new TableCell({ borders, margins, children: [new Paragraph({ children: [new TextRun(s.assessment)] })] })
                ]
            }))
        ]
    });
    
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                }
            },
            children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "SESSION PLAN", bold: true, size: 32 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Week ${sessionData.week} - Session ${sessionData.session_no}`, size: 24 })] }),
                new Paragraph({ children: [new TextRun("")] }),
                headerTable,
                new Paragraph({ children: [new TextRun("")] }),
                outcomesTable,
                new Paragraph({ children: [new TextRun("")] }),
                resourcesTable,
                new Paragraph({ children: [new TextRun("")] }),
                deliveryTable
            ]
        }]
    });
    
    return doc;
}

// API endpoint to extract sessions from learning plan
app.post('/api/extract-sessions', upload.single('learningPlan'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const apiKey = getApiKey();
        if (!apiKey) {
            return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured. Set it in your .env file.' });
        }
        
        // Extract text from file
        const text = await extractFileText(req.file.path);
        
        // Parse sessions using Claude
        const sessions = await parseSessionsFromPlan(text, apiKey);
        
        res.json({ sessions });
        
    } catch (error) {
        console.error('Error extracting sessions:', error);
        res.status(500).json({ error: error.message });
    } finally {
        // Always clean up uploaded file
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
    }
});

// API endpoint to redistribute sessions across a different number of weeks
app.post('/api/redistribute-sessions', async (req, res) => {
    try {
        const { sessions, targetWeeks, sessionsPerWeek } = req.body;
        
        if (!sessions || !targetWeeks) {
            return res.status(400).json({ error: 'Missing required fields: sessions and targetWeeks' });
        }
        
        const perWeek = sessionsPerWeek || 3;
        const totalSlots = targetWeeks * perWeek;
        const redistributed = [];
        
        for (let i = 0; i < totalSlots; i++) {
            const week = Math.floor(i / perWeek) + 1;
            const sessionInWeek = (i % perWeek) + 1;
            
            // Map source session using modular index so content wraps if fewer sessions than slots
            const sourceIndex = i < sessions.length ? i : null;
            
            if (sourceIndex !== null) {
                redistributed.push({
                    ...sessions[sourceIndex],
                    week: String(week),
                    session_no: String(sessionInWeek)
                });
            }
            // If document has fewer sessions than target slots, stop (don't fabricate content)
        }
        
        // If document has MORE sessions than target slots, compress extras into last week
        if (sessions.length > totalSlots) {
            const remaining = sessions.slice(totalSlots);
            let extraSession = perWeek + 1;
            for (const s of remaining) {
                redistributed.push({
                    ...s,
                    week: String(targetWeeks),
                    session_no: String(extraSession++)
                });
            }
        }
        
        console.log(`Redistributed ${sessions.length} sessions into ${targetWeeks} weeks (${redistributed.length} total)`);
        res.json({ sessions: redistributed });
        
    } catch (error) {
        console.error('Error redistributing sessions:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to generate session plans
app.post('/api/generate-plans', async (req, res) => {
    try {
        const { sessions, courseInfo } = req.body;
        
        if (!sessions || !courseInfo) {
            return res.status(400).json({ error: 'Missing required fields: sessions and courseInfo' });
        }
        
        const generatedPlans = [];
        
        for (const session of sessions) {
            // Create document
            const doc = createSessionPlanDocument(session, courseInfo);
            
            // Generate buffer
            const buffer = await Packer.toBuffer(doc);
            
            // Create filename
            const cleanTitle = session.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
            const filename = `Week${session.week}_Session${session.session_no}_${cleanTitle}.docx`;
            
            generatedPlans.push({
                filename,
                buffer: buffer.toString('base64')
            });
        }
        
        res.json({ plans: generatedPlans });
        
    } catch (error) {
        console.error('Error generating plans:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to generate ZIP of all plans
app.post('/api/generate-zip', async (req, res) => {
    try {
        const { plans } = req.body;
        
        const zip = new JSZip();
        
        plans.forEach(plan => {
            const buffer = Buffer.from(plan.buffer, 'base64');
            zip.file(plan.filename, buffer);
        });
        
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=session-plans.zip');
        res.send(zipBuffer);
        
    } catch (error) {
        console.error('Error generating ZIP:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
