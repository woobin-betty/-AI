import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")).render(<App />);

import { db, collection, addDoc } from "./firebase.js";

async function saveAssignment(title, deadline, description) {
  await addDoc(collection(db, "assignments"), {
    title,
    deadline,
    description,
  });

  alert("과제 저장 완료!");
}

export { saveAssignment };
