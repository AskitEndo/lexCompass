require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Allows requests from your frontend
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() }); // Store file in memory

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- AI Interaction Logic (Enhanced Gemini) ---
async function callGeminiAPI(prompt) {
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
        topP: 0.8,
        topK: 40,
      },
    });

    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Failed to generate content: ${error.message}`);
  }
}

// --- API Endpoints ---

// 1. ANALYZE ENDPOINT
app.post("/analyze", upload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  try {
    const documentText = req.file.buffer.toString("utf-8");
    const analysisPrompt = `Analyze the following legal text for a non-lawyer.
1. Decision Map: Identify the top 5-7 key sections, obligations, or deadlines.
2. Risk Radar: Identify the 2-3 highest-risk clauses that could negatively impact the user. For each, describe the clause, explain the risk in simple terms, and assign a risk score from 1-10 (1=low risk, 10=critical risk).

Important: Respond ONLY with a valid JSON object. Do not include the markdown characters \`\`\`json or any other text outside of the JSON structure.

The JSON format must be:
{
  "decisionMap": ["Point 1", "Point 2", ...],
  "riskRadar": [
    {
      "clause": "The exact text of the risky clause...", 
      "risk": "A simple explanation of the risk...",
      "riskScore": 7,
      "riskLevel": "high"
    },
    ...
  ]
}

Document Text:
"""
${documentText}
"""`;
    const rawResponse = await callGeminiAPI(analysisPrompt);
    const cleanedResponse = rawResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsedResponse = JSON.parse(cleanedResponse);

    // Enhance risk data with color coding
    if (parsedResponse.riskRadar) {
      parsedResponse.riskRadar = parsedResponse.riskRadar.map((risk) => ({
        ...risk,
        riskLevel:
          risk.riskScore >= 8
            ? "critical"
            : risk.riskScore >= 6
            ? "high"
            : risk.riskScore >= 4
            ? "medium"
            : "low",
        riskColor:
          risk.riskScore >= 8
            ? "#dc2626"
            : risk.riskScore >= 6
            ? "#ea580c"
            : risk.riskScore >= 4
            ? "#d97706"
            : "#059669",
      }));
    }

    res.json(parsedResponse);
  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze document." });
  }
});

// 2. CLAUSE COACH ENDPOINT
app.post("/coach", async (req, res) => {
  const { clause } = req.body;
  if (!clause) {
    return res.status(400).json({ error: "Clause is required." });
  }

  try {
    const coachPrompt = `A user is concerned about the following clause:
"${clause}"

Rewrite this clause to be safer and fairer for the user. Then, provide a brief, simple explanation of the changes.

Important: Respond ONLY with a valid JSON object. Do not include the markdown characters \`\`\`json or any other text outside of the JSON structure.

The JSON format must be:
{
  "suggestion": "The re-written, safer clause text...",
  "explanation": "A simple explanation of what was changed and why."
}`;
    const rawResponse = await callGeminiAPI(coachPrompt);
    const cleanedResponse = rawResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsedResponse = JSON.parse(cleanedResponse);
    res.json(parsedResponse);
  } catch (error) {
    console.error("Coaching Error:", error);
    res.status(500).json({ error: "Failed to get coaching suggestion." });
  }
});

app.listen(port, () => {
  console.log(
    `🧭 LexCompass backend (powered by Gemini) listening at http://localhost:${port}`
  );
});
