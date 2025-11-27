import { useEffect, useState } from "react";
import axios from "axios";

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const userId = "TEST_USER_ID"; // 바꾸세요

  const load = async () => {
    try {
      const res = await axios.get(`https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/tasks?userId=${userId}`);
      setTasks(res.data);
    } catch (e) {
      console.error(e);
      alert("불러오기 실패");
    }
  };

  useEffect(() => { load(); }, []);

  const toggleStep = async (taskId, stepIndex, currentDone) => {
    try {
      const res = await axios.put(`https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/tasks/${taskId}/step`, {
        stepIndex,
        done: !currentDone
      });
      // refresh
      load();
    } catch (e) {
      alert("업데이트 실패");
    }
  };

  return (
    <div>
      <h3>내 과제 목록</h3>
      {tasks.map(t => (
        <div key={t.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 8 }}>
          <h4>{t.title} <small>({t.dueDate})</small></h4>
          <p>{t.description}</p>
          <p>진행: {t.progress ?? 0}%</p>

          <div>
            <strong>체크리스트</strong>
            {(t.checklist || []).map((it, idx) => (
              <div key={idx}>
                <input
                  type="checkbox"
                  checked={!!it.done}
                  onChange={() => toggleStep(t.id, idx, !!it.done)}
                />
                {it.step || it.text || it}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
