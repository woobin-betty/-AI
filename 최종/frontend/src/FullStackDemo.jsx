// src/FullStackDemo.jsx
import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Check, Clock, AlertCircle, Trash2, Home, List, BarChart3, X, Server, Play, Database, Code, Target, TrendingUp, Award } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from './firebaseConfig';

// Firebase 초기화 (한 번만)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const FullStackDemo = () => {
  const [tasks, setTasks] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', deadline: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [serverRunning, setServerRunning] = useState(false);
  const [serverLogs, setServerLogs] = useState([]);
  const [showBackendPanel, setShowBackendPanel] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const [authToken, setAuthToken] = useState(null);

  // Cloud Function 엔드포인트 (Firebase Hosting rewrite로 /generatePlan -> 함수로 연결)
  const API_BASE = '/generatePlan';

  const addLog = (message, type = 'info') => {
    setServerLogs(prev => [...prev, { 
      message, 
      type, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // 백엔드 시뮬레이션: 실제로는 함수를 배포 후 startBackend 대신 서버를 "실행" 표시 가능
  const startBackend = async () => {
    setServerLogs([]);
    addLog('🚀 Cloud Function 준비 중...', 'info');
    await sleep(400);
    addLog('✅ 함수 엔드포인트 준비 완료', 'success');
    await sleep(200);
    addLog('📚 Swagger 대시보드(로컬 없음) — Firebase Functions 사용', 'info');
    setServerRunning(true);
    await sleep(400);
    addLog('🔐 자동 로그인(데모 토큰) 생성 중...', 'info');
    await sleep(400);
    const token = 'demo_jwt_token_' + Date.now();
    setAuthToken(token);
    addLog('✅ 로그인 완료 - 데모 JWT 발급', 'success');
  };

  // Cloud Function에 POST로 요청해 계획 생성 요청
  const generateDailyPlanWithBackend = async (task) => {
    setIsGenerating(true);

    if (!serverRunning) {
      alert('백엔드 서버(Cloud Function)를 먼저 시작해주세요!');
      setIsGenerating(false);
      return null;
    }

    try {
      addLog('📤 POST ' + API_BASE + ' - 과제 생성 요청', 'info');

      const resp = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task })
      });

      if (!resp.ok) {
        const text = await resp.text();
        addLog(`❌ 백엔드 오류: ${resp.status} ${text}`, 'error');
        setIsGenerating(false);
        return null;
      }

      const data = await resp.json();
      setApiResponse(data);
      addLog('✅ 201 Created - 과제 생성 완료', 'success');
      setIsGenerating(false);
      return data.plan || data;
    } catch (error) {
      addLog('❌ 네트워크 오류: ' + (error.message || error), 'error');
      setIsGenerating(false);
      return null;
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim() || !newTask.deadline) {
      alert('과제명과 마감일을 입력해주세요.');
      return;
    }

    const plan = await generateDailyPlanWithBackend(newTask);
    if (!plan) return;

    const task = {
      id: Date.now(),
      ...newTask,
      priority: calculatePriority(newTask.deadline),
      plan,
      progress: 0,
      completedSteps: [],
      completedDays: [],
      createdAt: new Date().toISOString()
    };

    // Firestore에 저장 (데모)
    try {
      const docRef = await addDoc(collection(db, 'tasks'), {
        ...task,
        createdAt: serverTimestamp()
      });
      addLog(`💾 Firestore에 저장됨 (id: ${docRef.id})`, 'success');
    } catch (err) {
      addLog('❌ Firestore 저장 오류: ' + err.message, 'error');
    }

    setTasks(prev => [...prev, task]);
    setShowAddModal(false);
    setNewTask({ title: '', description: '', deadline: '' });
  };

  const calculatePriority = (deadline) => {
    const daysLeft = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 2) return 'high';
    if (daysLeft <= 7) return 'medium';
    return 'low';
  };

  const deleteTask = (taskId) => {
    if (window.confirm('삭제하시겠습니까?')) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      addLog('🗑️ 과제 삭제 완료', 'info');
    }
  };

  const toggleStep = (taskId, stepIndex) => {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        const completedSteps = task.completedSteps.includes(stepIndex)
          ? task.completedSteps.filter(i => i !== stepIndex)
          : [...task.completedSteps, stepIndex];
        addLog(`✅ 단계 ${stepIndex + 1} 완료 상태 변경`, 'success');
        return { ...task, completedSteps, progress: Math.round((completedSteps.length / (task.plan?.steps?.length || 1)) * 100) };
      }
      return task;
    }));
  };

  const toggleDailyPlan = (taskId, dayIndex) => {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        const completedDays = task.completedDays.includes(dayIndex)
          ? task.completedDays.filter(i => i !== dayIndex)
          : [...task.completedDays, dayIndex];
        addLog(`✅ Day ${dayIndex + 1} 완료 상태 변경`, 'success');
        return { ...task, completedDays };
      }
      return task;
    }));
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'text-orange-600 bg-orange-50 border-orange-200',
      medium: 'text-blue-600 bg-blue-50 border-blue-200',
      low: 'text-gray-600 bg-gray-50 border-gray-200'
    };
    return colors[priority] || colors.low;
  };

  const getDaysLeft = (deadline) => {
    const daysLeft = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return '마감됨';
    if (daysLeft === 0) return '오늘';
    if (daysLeft === 1) return '내일';
    return `D-${daysLeft}`;
  };

  const getTodayTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(task => 
      task.plan?.dailyPlans?.some(p => p.date === today)
    ).map(task => ({
      ...task,
      todayPlan: task.plan.dailyPlans.find(p => p.date === today),
      dayIndex: task.plan.dailyPlans.findIndex(p => p.date === today)
    }));
  };

  const getStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.progress === 100).length;
    const inProgress = tasks.filter(t => t.progress > 0 && t.progress < 100).length;
    const avgProgress = total > 0 ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / total) : 0;
    return { total, completed, inProgress, avgProgress };
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

  // 컴포넌트 렌더 (원본 레이아웃/스타일 최대한 유지)
  const todayTasks = getTodayTasks();
  const stats = getStats();
  const sortedTasks = [...tasks].sort((a, b) => {
    const order = { high: 3, medium: 2, low: 1 };
    if (order[a.priority] !== order[b.priority]) return order[b.priority] - order[a.priority];
    return new Date(a.deadline) - new Date(b.deadline);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* 백엔드 제어 패널 */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setShowBackendPanel(!showBackendPanel)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:shadow-xl transition-all"
        >
          <Server className="w-5 h-5" />
          백엔드 제어판
        </button>
      </div>

      {showBackendPanel && (
        <div className="fixed top-20 right-4 w-96 bg-white rounded-xl shadow-2xl z-50 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <Server className="w-5 h-5" />
              백엔드 서버
            </h3>
            <button onClick={() => setShowBackendPanel(false)} className="hover:bg-white/20 rounded p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">서버 상태</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${serverRunning ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {serverRunning ? '🟢 실행 중' : '⚫ 중지'}
              </span>
            </div>
            {!serverRunning && (
              <button
                onClick={startBackend}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-2 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                서버 시작
              </button>
            )}
            {authToken && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                <span className="font-semibold">JWT:</span> {authToken.substring(0, 30)}...
              </div>
            )}
          </div>

          <div className="p-4 flex-1 overflow-y-auto bg-gray-900">
            <h4 className="text-white text-sm font-semibold mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" />
              서버 로그
            </h4>
            <div className="space-y-1 font-mono text-xs">
              {serverLogs.length === 0 ? (
                <div className="text-gray-500">로그가 없습니다</div>
              ) : (
                serverLogs.map((log, idx) => (
                  <div key={idx} className={`${ log.type === 'success' ? 'text-green-400' : log.type === 'error' ? 'text-red-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-gray-400' }`}>
                    <span className="text-gray-600">[{log.timestamp}]</span> {log.message}
                  </div>
                ))
              )}
            </div>
          </div>

          {apiResponse && (
            <div className="p-4 border-t bg-gray-50 max-h-48 overflow-y-auto">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Database className="w-4 h-4" />
                최근 API 응답
              </h4>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(apiResponse, null, 2).substring(0, 300)}...
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 메인 앱 */}
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl relative pb-20">
        <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white sticky top-0 z-40">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">AI 과제 관리</h1>
                  <p className="text-xs opacity-90">풀스택 데모</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(true)} 
                className="w-12 h-12 bg-white text-purple-600 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-4">
          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 border border-blue-200">
                  <List className="w-5 h-5 text-blue-600 mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
                  <p className="text-xs text-blue-600">전체</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 border border-green-200">
                  <Award className="w-5 h-5 text-green-600 mb-1" />
                  <p className="text-2xl font-bold text-green-700">{stats.completed}</p>
                  <p className="text-xs text-green-600">완료</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3 border border-orange-200">
                  <TrendingUp className="w-5 h-5 text-orange-600 mb-1" />
                  <p className="text-2xl font-bold text-orange-700">{stats.inProgress}</p>
                  <p className="text-xs text-orange-600">진행중</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 border border-purple-200">
                  <BarChart3 className="w-5 h-5 text-purple-600 mb-1" />
                  <p className="text-2xl font-bold text-purple-700">{stats.avgProgress}%</p>
                  <p className="text-xs text-purple-600">평균</p>
                </div>
              </div>

              {/* Today Tasks */}
              <div className="bg-white rounded-xl p-4 border-2 border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Check className="w-5 h-5 text-purple-600" />
                    오늘 할 일
                  </h2>
                  {todayTasks.length > 0 && (
                    <span className="text-sm text-gray-500">{todayTasks.length}개</span>
                  )}
                </div>
                {todayTasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Check className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">오늘 예정된 작업이 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayTasks.map(task => (
                      <div 
                        key={task.id} 
                        onClick={() => openTaskDetail(task)}
                        className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-sm flex-1">{task.title}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                            {getDaysLeft(task.deadline)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{task.todayPlan?.title}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {task.todayPlan?.duration}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks List */}
              {sortedTasks.length > 0 && (
                <div className="space-y-3">
                  {sortedTasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={() => openTaskDetail(task)}
                      className="bg-white rounded-xl p-4 border-2 border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">{task.title}</h3>
                          {task.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>
                          )}
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2 mb-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                          {task.priority === 'high' ? '긴급' : task.priority === 'medium' ? '보통' : '여유'}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getDaysLeft(task.deadline)}
                        </span>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>진행률</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tasks.length === 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 text-center border-2 border-purple-100">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Target className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">첫 과제를 추가해보세요</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    백엔드 + AI가 자동으로<br/>상세한 일일 계획을 만들어드립니다
                  </p>
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    과제 추가하기
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Add Task Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
            <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-4 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">새 과제 추가</h2>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setNewTask({ title: '', description: '', deadline: '' });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {!serverRunning && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    ⚠️ 백엔드 서버를 먼저 시작해주세요
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">과제명 *</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="예: 데이터베이스 설계 보고서"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                    disabled={isGenerating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">과제 설명</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="과제 내용을 입력하세요 (선택)"
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg resize-none focus:border-purple-500 focus:outline-none"
                    disabled={isGenerating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">마감일 *</label>
                  <input
                    type="date"
                    value={newTask.deadline}
                    onChange={(e) => setNewTask(prev => ({ ...prev, deadline: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                    disabled={isGenerating}
                  />
                </div>

                {isGenerating && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-6 h-6 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-semibold text-purple-700">백엔드에서 AI 계획 생성 중...</span>
                    </div>
                    <p className="text-xs text-purple-600 ml-9">Cloud Function이 일일 계획을 작성하고 있습니다</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewTask({ title: '', description: '', deadline: '' });
                    }}
                    disabled={isGenerating}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold disabled:opacity-50 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAddTask}
                    disabled={isGenerating || !newTask.title.trim() || !newTask.deadline || !serverRunning}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 hover:shadow-lg transition-all"
                  >
                    {isGenerating ? '생성 중...' : '추가하기'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Task Detail Modal */}
        {showTaskDetail && selectedTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
            <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-4 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">과제 상세</h2>
                <button 
                  onClick={() => setShowTaskDetail(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-6">
                <div>
                  <h3 className="text-xl font-bold mb-2">{selectedTask.title}</h3>
                  {selectedTask.description && (
                    <p className="text-sm text-gray-600 mb-3">{selectedTask.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>예상 {selectedTask.plan?.estimatedHours || 4}시간</span>
                  </div>
                </div>

                {/* Daily Plans */}
                {selectedTask.plan?.dailyPlans && (
                  <div>
                    <h4 className="font-bold text-lg mb-3 flex items-center gap-2">📅 일일 계획</h4>
                    <div className="space-y-3">
                      {selectedTask.plan.dailyPlans.map((day, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border-2 ${ selectedTask.completedDays.includes(idx) ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200' }`}>
                          <div className="flex gap-3">
                            <button onClick={() => toggleDailyPlan(selectedTask.id, idx)} className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${ selectedTask.completedDays.includes(idx) ? 'bg-green-600 border-green-600' : 'border-gray-300 hover:border-green-500' }`}>
                              {selectedTask.completedDays.includes(idx) && (<Check className="w-5 h-5 text-white" />)}
                            </button>
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className={`text-sm font-semibold ${ selectedTask.completedDays.includes(idx) ? 'line-through text-gray-500' : '' }`}>Day {day.day}: {day.title}</span>
                                <span className="text-xs text-gray-500">{day.duration}</span>
                              </div>
                              <p className="text-xs text-gray-600 mb-2">{day.focus}</p>
                              <div className="space-y-1">
                                {day.tasks.map((t, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                                    <span>{t}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Steps */}
                <div>
                  <h4 className="font-bold text-lg mb-3 flex items-center gap-2">🎯 단계별 가이드</h4>
                  <div className="space-y-3">
                    {selectedTask.plan?.steps.map((step, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border-2 ${ selectedTask.completedSteps.includes(idx) ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200' }`}>
                        <div className="flex gap-3">
                          <button onClick={() => toggleStep(selectedTask.id, idx)} className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${ selectedTask.completedSteps.includes(idx) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-500' }`}>
                            {selectedTask.completedSteps.includes(idx) && (<Check className="w-5 h-5 text-white" />)}
                          </button>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className={`text-sm font-semibold ${ selectedTask.completedSteps.includes(idx) ? 'line-through text-gray-500' : '' }`}>{step.title}</span>
                              <span className="text-xs text-gray-500">{step.duration}</span>
                            </div>
                            <p className="text-xs text-gray-600">{step.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checklist */}
                <div className="pb-4">
                  <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    제출 전 체크리스트
                  </h4>
                  <div className="space-y-2">
                    {selectedTask.plan?.checklist.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                        <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 z-40 max-w-md mx-auto">
          <div className="grid grid-cols-4">
            {[
              { id: 'dashboard', label: '홈', icon: Home },
              { id: 'today', label: '오늘', icon: Check },
              { id: 'tasks', label: '과제', icon: List },
              { id: 'calendar', label: '캘린더', icon: Calendar }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id)}
                className={`flex flex-col items-center py-3 transition-all ${ currentView === tab.id ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600' }`}
              >
                <tab.icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default FullStackDemo;
