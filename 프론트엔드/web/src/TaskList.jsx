import React, { useEffect, useState } from "react";
import axios from "axios";

export default function TaskList({ refreshFlag }) {
  const [tasks, setTasks] = useState([]);
  const userId = "test_user_001"; // 실제로는 로그인된 사용자 id 사용

  const load = async () => {
    try {
      const res = await axios.get(`https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/tasks?userId=${userId}`);
      setTasks(res.data);
    } catch (e) {
      console.error(e);
      alert("과제 불러오기 실패");
    }
  };

  useEffect(() => { load(); }, [refreshFlag]);

  const toggleStep = async (taskId, stepIndex, currentDone) => {
    try {
      await axios.put(`https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/tasks/${taskId}/step`, {
        stepIndex, done: !currentDone
      });
      load();
    } catch (e) {
      alert("업데이트 실패");
    }
  };

  return (
    <div>
      <h3>내 과제 목록</h3>
      {tasks.length === 0 && <p>등록된 과제가 없습니다.</p>}
      {tasks.map(t => (
        <div key={t.id} style={{ border: "1px solid #ddd", padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{t.title}</strong>
            <span>{t.dueDate}</span>
          </div>
          <p>{t.description}</p>
          <p>진행: {t.progress ?? 0}%</p>

          <div>
            <strong>체크리스트</strong>
            {(t.checklist || []).map((it, idx) => {
              // checklist item can be string or object
              const text = typeof it === "string" ? it : (it.step || it.text || JSON.stringify(it));
              const done = typeof it === "object" ? !!it.done : false;
              return (
                <div key={idx}>
                  <input type="checkbox" checked={done} onChange={() => toggleStep(t.id, idx, done)} />
                  {" "}{text}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
