// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// 단순한 계획 생성 로직 (프론트와 동일한 구조 반환)
function calculatePriority(deadline) {
  const daysLeft = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 2) return 'high';
  if (daysLeft <= 7) return 'medium';
  return 'low';
}

function generatePlan(task) {
  const daysLeft = Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24));
  const today = new Date();
  const dailyPlans = [];
  const days = Math.max(1, Math.min(daysLeft, 7));

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);

    let title, focus, tasksArr;
    if (i === 0) {
      title = "자료 조사 및 계획 수립";
      focus = "과제 요구사항 분석과 전체 계획 수립";
      tasksArr = [
        "과제 요구사항 꼼꼼히 읽기",
        "필요한 자료 및 참고문헌 조사",
        "전체 일정 및 작업 계획 수립"
      ];
    } else if (i === days - 1) {
      title = "최종 검토 및 제출";
      focus = "완성도 점검 및 제출 준비";
      tasksArr = [
        "전체 내용 최종 검토",
        "오타 및 형식 오류 확인",
        "제출 전 체크리스트 확인 후 제출"
      ];
    } else {
      title = `핵심 작업 수행 (${i}일차)`;
      focus = "주요 과제 내용 작성 및 진행";
      tasksArr = [
        `${i}일차 목표 작업 수행`,
        "작성 내용 정리 및 보완",
        "진행 상황 점검 및 다음 계획"
      ];
    }

    dailyPlans.push({
      day: i + 1,
      date: d.toISOString().split('T')[0],
      title,
      tasks: tasksArr,
      duration: i === 0 || i === days - 1 ? '1.5시간' : '2시간',
      focus
    });
  }

  const plan = {
    difficulty: daysLeft <= 3 ? '어려움' : daysLeft <= 7 ? '보통' : '쉬움',
    estimatedHours: Math.max(daysLeft * 1.5, 4),
    dailyPlans,
    steps: [
      { title: '1단계: 요구사항 분석 및 자료 조사', duration: '1-2시간', description: '과제의 정확한 요구사항을 파악하고 필요한 자료를 조사합니다.' },
      { title: '2단계: 개요 작성 및 구조 설계', duration: '1시간', description: '전체적인 구조를 설계하고 개요를 작성합니다.' },
      { title: '3단계: 핵심 내용 작성', duration: '3-4시간', description: '과제의 주요 내용을 구체적으로 작성합니다.' },
      { title: '4단계: 세부 내용 보완', duration: '2시간', description: '부족한 부분을 보완하고 내용을 다듬습니다.' },
      { title: '5단계: 검토 및 수정', duration: '1-2시간', description: '전체 내용을 검토하고 수정합니다.' },
      { title: '6단계: 최종 점검 및 제출', duration: '30분', description: '최종 점검 후 제출합니다.' }
    ],
    checklist: [
      '모든 요구사항이 충족되었는지 확인',
      '참고 문헌 및 출처가 올바르게 표기되었는지 확인',
      '오타 및 문법 오류 검토',
      '제출 형식 및 파일명 확인',
      '제출 기한 및 방법 재확인'
    ]
  };

  return plan;
}

app.post('/', async (req, res) => {
  try {
    const payload = req.body;
    const task = payload?.task;
    if (!task || !task.title || !task.deadline) {
      return res.status(400).json({ error: 'task.title and task.deadline are required' });
    }

    const plan = generatePlan(task);
    const docData = {
      ...task,
      plan,
      priority: calculatePriority(task.deadline),
      progress: 0,
      completedSteps: [],
      completedDays: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Firestore에 저장
    const docRef = await db.collection('tasks').add(docData);

    return res.status(201).json({ id: docRef.id, ...docData, plan });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'internal error' });
  }
});

// Cloud Function으로 배포할 때 함수명: api
exports.api = functions.https.onRequest(app);

// 루트 엔드포인트도 지원 (간단 테스트)
exports.generatePlan = functions.https.onRequest(app);
