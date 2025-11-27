import React, { useState } from "react";
import axios from "axios";

export default function AddTask({ onCreated }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const userId = "test_user_001"; // 실제로는 로그인된 사용자 id 사용

  const create = async () => {
    if (!title || !due) return alert("제목과 마감일을 입력하세요.");
    try {
      const res = await axios.post(
        "https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/generateTask",
        { title, description: desc, dueDate: due, userId }
      );
      if (res.data.success) {
        alert("과제 생성됨: " + res.data.taskId);
        setTitle(""); setDesc(""); setDue("");
        onCreated && onCreated();
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
      <input placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} style={{width:"100%", padding:8}} />
      <br /><br />
      <textarea placeholder="설명" value={desc} onChange={e => setDesc(e.target.value)} style={{width:"100%", padding:8}} rows={4} />
      <br /><br />
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      <br /><br />
      <button onClick={create}>생성</button>
    </div>
  );
}
