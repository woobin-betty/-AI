import { useState } from "react";
import axios from "axios";

export default function AddTask({ onCreated }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const userId = "TEST_USER_ID"; // 바꾸세요

  const create = async () => {
    if (!title || !due) return alert("제목과 마감일 필요");
    try {
      const res = await axios.post(
        "https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/generateTask",
        { title, description: desc, dueDate: due, userId }
      );
      if (res.data.success) {
        alert("생성됨: " + res.data.taskId);
        onCreated && onCreated();
        setTitle(""); setDesc(""); setDue("");
      } else {
        alert("생성 실패");
      }
    } catch (e) {
      alert("에러: " + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <h3>과제 추가 (AI 자동 계획)</h3>
      <input placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} />
      <br />
      <textarea placeholder="설명" value={desc} onChange={e => setDesc(e.target.value)} />
      <br />
      <input type="date" value={due} onChange={e => setDue(e.target.value)} />
      <br />
      <button onClick={create}>생성</button>
    </div>
  );
}
