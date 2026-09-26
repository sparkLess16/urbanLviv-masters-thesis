import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const analyzeReportWithAI = async (report) => {
  const prompt = `
You are an AI assistant helping a city administration process citizen issue reports.

Your task is to analyze the report and generate:
1. AI priority level
2. Official administrative summary
3. Actionable recommendations for city authorities

Return ONLY valid JSON without markdown, explanations, or code blocks.

JSON format:
{
  "suggest_priority_id": "low | medium | high | critical",
  "official_summary": "2-3 professional sentences summarizing the issue",
  "recommendations": ["short recommendation 1", "short recommendation 2", "short recommendation 3", "short recommendation 4"]
}

Priority rules:
- critical → immediate danger to people, traffic safety, fire, electricity hazards, major infrastructure damage
- high → serious public inconvenience or rapidly worsening issue
- medium → important issue but not urgent
- low → minor issue with limited impact

Requirements for official_summary:
- 2-3 sentences
- professional and neutral tone
- summarize the issue clearly
- mention location or impact if relevant
- avoid repetition
- do not invent facts

Requirements for recommendations:
- return an array of 4-5 short bullet-point recommendations
- each recommendation should be 1 sentence
- include immediate actions and preventive actions
- keep each item concise
- do not use numbering

Use English language for all generated content.

Report data:

Title:
${report.title}

Description:
${report.description}

Location:
${report.location}

Type:
${report.type_id}

User selected priority:
${report.priority_id}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text;

  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Failed to parse Gemini response:", cleaned);
    throw error;
  }
};
