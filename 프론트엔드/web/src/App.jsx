import React, { useState } from "react";
import AddTask from "./AddTask";
import TaskList from "./TaskList";

export default function App() {
  const [flag, setFlag] = useState(false);
  return (
    <div style={{ maxWidth: 800, margin: "20px auto", padding: 20 }}>
      <h1>스마트 일정 관리 MVP</h1>
      <AddTask onCreated={() => setFlag(f => !f)} />
      <TaskList refreshFlag={flag} />
    </div>
  );
}
