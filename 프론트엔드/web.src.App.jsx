import AddTask from "./AddTask";
import TaskList from "./TaskList";
import { useState } from "react";

export default function App() {
  const [refreshFlag, setRefreshFlag] = useState(false);
  return (
    <div style={{ padding: 20 }}>
      <h1>스마트 일정 관리 (MVP)</h1>
      <AddTask onCreated={() => setRefreshFlag(!refreshFlag)} />
      <TaskList key={String(refreshFlag)} />
    </div>
  );
}
