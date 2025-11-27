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

// === POST /generateTask
// body: { title, description, dueDate, userId }
app.post("/generateTask", async (req, res) => {
  try {
    const { title, description, dueDate, userId } = req.body;
    if (!title || !dueDate || !userId) {
      return res.status(400).json({ error: "title, dueDate, userId required" });
    }

    // 1) Call LLM to generate steps/estimated times/checklist
    const OPENAI_KEY = functions.config().openai?.key || process.env.OPENAI_KEY;
    if (!OPENAI_KEY) {
      return res.status(500).json({ error: "OpenAI key not configured" });
    }

    // Prompt: request JSON with steps and totalTime
    const prompt = `
You are an assistant that returns a JSON plan for a student assignment.
Input:
title: ${title}
description: ${description || ""}
dueDate: ${dueDate}

Return JSON exactly in this format:
{
  "steps": [{"step":"step name", "minutes":60}, ...],
  "totalMinutes": 180,
  "checklist": ["item1","item2"]
}
Make 3-6 steps, estimate minutes per step.
`;

    const aiResp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini", // change if needed
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600
      },
      { headers: { Authorization: `Bearer ${OPENAI_KEY}` } }
    );

    const aiText = aiResp.data.choices[0].message.content.trim();
    // Try parse JSON out of response
    let plan;
    try {
      plan = JSON.parse(aiText);
    } catch (e) {
      // attempt to extract JSON substring
      const jsonMatch = aiText.match(/\{[\s\S]*\}$/);
      if (jsonMatch) plan = JSON.parse(jsonMatch[0]);
      else throw new Error("AI did not return valid JSON");
    }

    // 2) Save task into Firestore
    const taskData = {
      userId,
      title,
      description: description || "",
      dueDate,
      estimatedTime: plan.totalMinutes || plan.totalTime || null,
      priority: "auto",
      status: "not_started",
      progress: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const taskRef = await db.collection("tasks").add(taskData);

    // 3) Save checklist (steps) as separate doc for simplicity
    const steps = (plan.steps || []).map(s => ({ step: s.step || s.name || "step", minutes: s.minutes || s.time || 0, done: false }));
    await db.collection("checklists").add({
      taskId: taskRef.id,
      items: steps
    });

    // Save checklist items as "checklist" field in task too (denormalized)
    await taskRef.update({ checklist: plan.checklist || steps.map(s => s.step) });

    res.json({ success: true, taskId: taskRef.id, plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// === GET /tasks?userId=xxx
app.get("/tasks", async (req, res) => {
  try {
    const userId = req.query.userId;
    const q = userId ? db.collection("tasks").where("userId", "==", userId) : db.collection("tasks");
    const snap = await q.get();
    const tasks = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      // fetch checklist
      const checkSnap = await db.collection("checklists").where("taskId", "==", d.id).get();
      const checklist = checkSnap.empty ? data.checklist || [] : checkSnap.docs[0].data().items;
      return { id: d.id, ...data, checklist };
    }));
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// === PUT /tasks/:id/step
// body: { stepIndex: number, done: boolean }
app.put("/tasks/:id/step", async (req, res) => {
  try {
    const { id } = req.params;
    const { stepIndex, done } = req.body;
    if (typeof stepIndex !== "number" || typeof done !== "boolean") {
      return res.status(400).json({ error: "stepIndex(number) and done(boolean) required" });
    }

    // find checklist doc
    const checkSnap = await db.collection("checklists").where("taskId", "==", id).limit(1).get();
    if (checkSnap.empty) return res.status(404).json({ error: "Checklist not found" });

    const checkDoc = checkSnap.docs[0];
    const items = checkDoc.data().items || [];
    if (!items[stepIndex]) return res.status(400).json({ error: "stepIndex out of range" });
    items[stepIndex].done = done;

    // update checklist doc
    await checkDoc.ref.update({ items });

    // update task.progress
    const completed = items.filter(i => i.done).length;
    const progress = Math.round((completed / items.length) * 100);
    await db.collection("tasks").doc(id).update({ progress });

    res.json({ success: true, progress });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// expose express app as function
exports.api = functions.https.onRequest(app);
