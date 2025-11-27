// Firebase Functions - index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Helper: attempt to parse JSON from AI output
function tryParseJSON(text) {
  try { return JSON.parse(text); }
  catch (e) {
    const m = text.match(/\{[\s\S]*\}$/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Cannot parse JSON from AI response.");
  }
}

// Dummy plan generator (used if no OpenAI key)
function generateDummyPlan(title) {
  const steps = [
    { step: "자료 조사", minutes: 60 },
    { step: "초안 작성", minutes: 90 },
    { step: "최종 검토 및 제출", minutes: 30 }
  ];
  return {
    steps,
    totalMinutes: steps.reduce((s, x) => s + (x.minutes || 0), 0),
    checklist: ["파일 형식 확인", "오탈자 점검", "참고문헌 기재"]
  };
}

// POST /generateTask
// body: { title, description, dueDate, userId }
app.post("/generateTask", async (req, res) => {
  try {
    const { title, description = "", dueDate, userId } = req.body;
    if (!title || !dueDate || !userId) return res.status(400).json({ error: "title, dueDate, userId required" });

    // Try get OpenAI key from functions config or env
    const OPENAI_KEY = functions.config().openai?.key || process.env.OPENAI_KEY || null;
    let plan;
    if (!OPENAI_KEY) {
      // No API key -> use dummy plan
      plan = generateDummyPlan(title);
    } else {
      // Call OpenAI (chat completions) to create plan
      const prompt = `
You are an assistant that returns a JSON plan for a student's assignment.
Input:
title: ${title}
description: ${description}
dueDate: ${dueDate}

Return JSON exactly in this format:
{
  "steps":[ {"step":"name","minutes":60}, ... ],
  "totalMinutes": 180,
  "checklist": ["item1","item2"]
}
Provide 3-6 steps with estimated minutes per step.
`;
      const aiResp = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600
        },
        { headers: { Authorization: `Bearer ${OPENAI_KEY}` } }
      );

      const aiText = aiResp.data.choices?.[0]?.message?.content || aiResp.data.choices?.[0]?.text || "";
      plan = tryParseJSON(aiText);
    }

    // Save task
    const taskData = {
      userId,
      title,
      description,
      dueDate,
      estimatedTime: plan.totalMinutes || null,
      priority: "auto",
      status: "not_started",
      progress: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const taskRef = await db.collection("tasks").add(taskData);

    // Save checklist/steps document
    const items = (plan.steps || []).map(s => ({ step: s.step || (s.name || "step"), minutes: s.minutes || s.time || 0, done: false }));
    await db.collection("checklists").add({
      taskId: taskRef.id,
      items
    });

    // Denormalize: add 'checklist' field to task doc for quick read
    await taskRef.update({ checklist: plan.checklist || items.map(i => i.step) });

    res.json({ success: true, taskId: taskRef.id, plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /tasks?userId=xxx
app.get("/tasks", async (req, res) => {
  try {
    const userId = req.query.userId;
    let q = db.collection("tasks");
    if (userId) q = q.where("userId", "==", userId);
    const snap = await q.get();
    const tasks = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      // attach checklist items (if present in checklists collection)
      const cis = await db.collection("checklists").where("taskId", "==", d.id).limit(1).get();
      const checklist = cis.empty ? (data.checklist || []) : cis.docs[0].data().items;
      return { id: d.id, ...data, checklist };
    }));
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /tasks/:id/step  body: { stepIndex: number, done: boolean }
app.put("/tasks/:id/step", async (req, res) => {
  try {
    const { id } = req.params;
    const { stepIndex, done } = req.body;
    if (typeof stepIndex !== "number" || typeof done !== "boolean") {
      return res.status(400).json({ error: "stepIndex(number) and done(boolean) required" });
    }

    const checkSnap = await db.collection("checklists").where("taskId", "==", id).limit(1).get();
    if (checkSnap.empty) return res.status(404).json({ error: "Checklist not found" });

    const checkDoc = checkSnap.docs[0];
    const items = checkDoc.data().items || [];
    if (!items[stepIndex]) return res.status(400).json({ error: "stepIndex out of range" });

    items[stepIndex].done = done;
    await checkDoc.ref.update({ items });

    const completed = items.filter(i => i.done).length;
    const progress = Math.round((completed / items.length) * 100);
    await db.collection("tasks").doc(id).update({ progress });

    res.json({ success: true, progress });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Export as "api" function
exports.api = functions.https.onRequest(app);
