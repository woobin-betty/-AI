
import React, { useState, useEffect } from 'react';
import { Home, Check, List, Calendar, Plus, X, Clock, Target, Award, TrendingUp, BarChart3, AlertCircle, Trash2, Loader } from 'lucide-react';

export default function TaskManagerApp() {
  const [tasks, setTasks] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', deadline: '' });

  useEffect(() => {
    const saved = localStorage.getItem('aiTasks');
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('aiTasks', JSON.stringify(tasks));
  }, [tasks]);

  const generatePlan = async (title, description, deadline) => {
    const daysUntil = Math.max(1, Math.ceil((new Date(deadline) - new Date()) / 86400000));

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `과제: ${title}\n설명: ${description}\n기간: ${daysUntil}일\n\nJSON만 출력:\n{"estimatedHours":숫자,"dailyPlans":[{"day":1,"title":"제목","duration":"시간","focus":"목표","tasks":["작업1","작업2"]}],"steps":[{"title":"단계","description":"설명","duration":"시간"}],"checklist":["항목"]}`
          }]
        })
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e) {}

    const days = Math.min(daysUntil, 7);
    return {
      estimatedHours: days * 2,
      dailyPlans: Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        title: `${i + 1}일차 학습`,
        duration: '2시간',
        focus: '핵심 학습',
        tasks: ['자료 조사', '내용 학습', '실습']
      })),
      steps: [
        { title: '자료 조사', description: '필요 자료 수집', duration: '2시간' },
        { title: '학습', description: '핵심 내용 학습', duration: `${Math.max(1, days * 2 - 3)}시간` },
        { title: '정리', description: '최종 정리', duration: '1시간' }
      ],
      checklist: ['요구사항 확인', '내용 검토', '제출 확인']
    };
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim() || !newTask.deadline) return;
    setIsGenerating(true);

    try {
      const plan = await generatePlan(newTask.title, newTask.description, newTask.deadline);
      const daysUntil = Math.ceil((new Date(newTask.deadline) - new Date()) / 86400000);

      setTasks(prev => [...prev, {
        id: Date.now(),
        ...newTask,
        priority: daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low',
        progress: 0,
        completedSteps: [],
        completedDays: [],
        plan
      }]);

      setShowAddModal(false);
      setNewTask({ title: '', description: '', deadline: '' });
    } finally {
      setIsGenerating(false);
    }
  };

  const getPriorityColor = (p) => ({
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-blue-100 text-blue-700 border-blue-200',
    low: 'bg-gray-100 text-gray-600 border-gray-200'
  })[p];

  const getDaysLeft = (deadline) => {
    const days = Math.ceil((new Date(deadline) - new Date()) / 86400000);
    if (days < 0) return '마감됨';
    if (days === 0) return '오늘';
    if (days === 1) return '내일';
    return `D-${days}`;
  };

  const toggleStep = (id, idx) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const completed = t.completedSteps.includes(idx) 
          ? t.completedSteps.filter(i => i !== idx)
          : [...t.completedSteps, idx];
        const progress = Math.round((completed.length / (t.plan?.steps?.length || 1)) * 100);
        const updated = { ...t, completedSteps: completed, progress };
        if (selectedTask?.id === id) setSelectedTask(updated);
        return updated;
      }
      return t;
    }));
  };

  const toggleDay = (id, idx) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const completed = t.completedDays.includes(idx)
          ? t.completedDays.filter(i => i !== idx)
          : [...t.completedDays, idx];
        const updated = { ...t, completedDays: completed };
        if (selectedTask?.id === id) setSelectedTask(updated);
        return updated;
      }
      return t;
    }));
  };

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.progress === 100).length,
    inProgress: tasks.filter(t => t.progress > 0 && t.progress < 100).length,
    avgProgress: tasks.length > 0 ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0
  };

  const todayTasks = tasks.map(t => {
    if (!t.plan?.dailyPlans) return null;
    const start = new Date(t.deadline);
    start.setDate(start.getDate() - t.plan.dailyPlans.length + 1);
    const idx = Math.floor((new Date() - start) / 86400000);
    if (idx >= 0 && idx < t.plan.dailyPlans.length) {
      return { ...t, dayIndex: idx, todayPlan: t.plan.dailyPlans[idx] };
    }
    return null;
  }).filter(Boolean);

  const sortedTasks = [...tasks].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority] || new Date(a.deadline) - new Date(b.deadline);
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto">
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 sticky top-0 z-30">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">AI 과제 관리</h1>
            <p className="text-xs text-blue-100">AI 맞춤 학습 계획</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="bg-white text-blue-600 p-2.5 rounded-lg">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-4">
        {currentView === 'dashboard' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white rounded-lg p-3 border">
                <List className="w-4 h-4 text-blue-600 mb-1" />
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-gray-500">전체</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <Award className="w-4 h-4 text-green-600 mb-1" />
                <p className="text-xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-xs text-gray-500">완료</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <TrendingUp className="w-4 h-4 text-orange-600 mb-1" />
                <p className="text-xl font-bold text-orange-600">{stats.inProgress}</p>
                <p className="text-xs text-gray-500">진행중</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <BarChart3 className="w-4 h-4 text-blue-600 mb-1" />
                <p className="text-xl font-bold text-blue-600">{stats.avgProgress}%</p>
                <p className="text-xs text-gray-500">평균</p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-blue-600" />오늘 할 일
                </h2>
                {todayTasks.length > 0 && <span className="text-xs text-gray-500">{todayTasks.length}개</span>}
              </div>
              {todayTasks.length === 0 ? (
                <div className="text-center py-6">
                  <Check className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">오늘 예정된 작업이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map(t => (
                    <div key={t.id} onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }} 
                      className="p-2.5 bg-blue-50 rounded-lg cursor-pointer border border-blue-200">
                      <div className="flex justify-between mb-1.5">
                        <h3 className="font-medium text-sm flex-1">{t.title}</h3>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${getPriorityColor(t.priority)}`}>
                          {getDaysLeft(t.deadline)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 mb-1">{t.todayPlan.title}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Clock className="w-3 h-3" />{t.todayPlan.duration}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {sortedTasks.filter(t => t.progress > 0 && t.progress < 100).length > 0 && (
              <div className="bg-white rounded-lg p-3 border">
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-600" />진행 중
                </h2>
                <div className="space-y-2">
                  {sortedTasks.filter(t => t.progress > 0 && t.progress < 100).slice(0, 3).map(t => (
                    <div key={t.id} onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}
                      className="p-2.5 bg-blue-50 rounded-lg cursor-pointer border border-blue-100">
                      <div className="flex justify-between items-center mb-1.5">
                        <h3 className="font-medium text-sm flex-1">{t.title}</h3>
                        <span className="text-xs font-bold text-blue-600">{t.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-blue-100 rounded-full">
                        <div className="h-full bg-blue-600" style={{ width: `${t.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 text-center border border-blue-200 mt-8">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-base font-semibold mb-1">첫 과제를 추가해보세요</h3>
                <p className="text-xs text-gray-600 mb-4">AI가 맞춤 학습 계획을 만들어드립니다</p>
                <button onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium">
                  과제 추가하기
                </button>
              </div>
            )}
          </div>
        )}

        {currentView === 'tasks' && (
          <div className="space-y-3">
            {sortedTasks.length === 0 ? (
              <div className="bg-white rounded-xl p-8 border text-center">
                <List className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-3">등록된 과제가 없습니다</p>
                <button onClick={() => setShowAddModal(true)} className="text-blue-600 text-sm font-medium">
                  첫 과제 추가하기 →
                </button>
              </div>
            ) : (
              sortedTasks.map(t => (
                <div key={t.id} onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}
                  className="bg-white rounded-xl p-4 border cursor-pointer">
                  <div className="flex justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1">{t.title}</h3>
                      {t.description && <p className="text-xs text-gray-600">{t.description}</p>}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setTasks(prev => prev.filter(x => x.id !== t.id)); }}
                      className="text-gray-400 ml-2 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 mb-3 text-xs">
                    <span className={`px-2 py-1 rounded-full ${getPriorityColor(t.priority)}`}>
                      {t.priority === 'high' ? '긴급' : t.priority === 'medium' ? '보통' : '여유'}
                    </span>
                    <span className="text-gray-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{getDaysLeft(t.deadline)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>진행률</span><span>{t.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-full bg-blue-600" style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {currentView === 'today' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
              <h2 className="text-xl font-bold mb-1">오늘의 목표</h2>
              <p className="text-blue-100 text-sm">{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
            </div>
            {todayTasks.length === 0 ? (
              <div className="bg-white rounded-xl p-8 border text-center">
                <Check className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">오늘 예정된 작업이 없습니다</p>
              </div>
            ) : (
              todayTasks.map(t => (
                <div key={t.id} className="bg-white rounded-xl p-4 border">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold mb-1">{t.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(t.priority)}`}>
                        {getDaysLeft(t.deadline)}
                      </span>
                    </div>
                    <button onClick={() => toggleDay(t.id, t.dayIndex)}
                      className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center ${
                        t.completedDays.includes(t.dayIndex) ? 'bg-green-600 border-green-600' : 'border-gray-300'
                      }`}>
                      {t.completedDays.includes(t.dayIndex) && <Check className="w-5 h-5 text-white" />}
                    </button>
                  </div>
                  <h4 className="font-medium text-sm mb-2">{t.todayPlan.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                    <Clock className="w-3 h-3" />{t.todayPlan.duration}
                  </div>
                  <div className="space-y-2">
                    {t.todayPlan.tasks.map((task, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t max-w-md mx-auto">
        <div className="grid grid-cols-4">
          {[
            { id: 'dashboard', label: '홈', icon: Home },
            { id: 'today', label: '오늘', icon: Check },
            { id: 'tasks', label: '과제', icon: List },
            { id: 'calendar', label: '캘린더', icon: Calendar }
          ].map(tab => (
            <button key={tab.id} onClick={() => setCurrentView(tab.id)}
              className={`flex flex-col items-center py-3 ${currentView === tab.id ? 'text-blue-600' : 'text-gray-400'}`}>
              <tab.icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
              <h2 className="text-lg font-semibold">새 과제 추가</h2>
              <button onClick={() => { setShowAddModal(false); setNewTask({ title: '', description: '', deadline: '' }); }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">과제명 *</label>
                <input type="text" value={newTask.title}
                  onChange={(e) => setNewTask(p => ({ ...p, title: e.target.value }))}
                  placeholder="예: 데이터베이스 설계"
                  className="w-full px-4 py-3 border rounded-lg"
                  disabled={isGenerating} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">과제 설명</label>
                <textarea value={newTask.description}
                  onChange={(e) => setNewTask(p => ({ ...p, description: e.target.value }))}
                  placeholder="과제 내용 (선택)" rows={3}
                  className="w-full px-4 py-3 border rounded-lg resize-none"
                  disabled={isGenerating} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">마감일 *</label>
                <input type="date" value={newTask.deadline}
                  onChange={(e) => setNewTask(p => ({ ...p, deadline: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border rounded-lg"
                  disabled={isGenerating} />
              </div>

              {isGenerating && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                    <span className="text-sm font-medium text-blue-700">AI가 학습 계획 생성 중...</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowAddModal(false); setNewTask({ title: '', description: '', deadline: '' }); }}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-3 border rounded-lg disabled:opacity-50">
                  취소
                </button>
                <button onClick={handleAddTask}
                  disabled={isGenerating || !newTask.title.trim() || !newTask.deadline}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                  {isGenerating ? '생성 중...' : '추가하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTaskDetail && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between">
              <h2 className="text-lg font-semibold">과제 상세</h2>
              <button onClick={() => setShowTaskDetail(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">{selectedTask.title}</h3>
                {selectedTask.description && <p className="text-sm text-gray-600 mb-3">{selectedTask.description}</p>}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>예상 {selectedTask.plan?.estimatedHours || 4}시간</span>
                </div>
              </div>

              {selectedTask.plan?.dailyPlans && (
                <div>
                  <h4 className="font-medium text-base mb-3">📅 일일 계획</h4>
                  <div className="space-y-3">
                    {selectedTask.plan.dailyPlans.map((d, i) => (
                      <div key={i} className={`p-3 rounded-lg border ${
                        selectedTask.completedDays.includes(i) ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                      }`}>
                        <div className="flex gap-3">
                          <button onClick={() => toggleDay(selectedTask.id, i)}
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                              selectedTask.completedDays.includes(i) ? 'bg-green-600 border-green-600' : 'border-gray-300'
                            }`}>
                            {selectedTask.completedDays.includes(i) && <Check className="w-4 h-4 text-white" />}
                          </button>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className={`text-sm font-medium ${selectedTask.completedDays.includes(i) ? 'line-through text-gray-500' : ''}`}>
                                Day {d.day}: {d.title}
                              </span>
                              <span className="text-xs text-gray-500">{d.duration}</span>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">{d.focus}</p>
                            <div className="space-y-1">
                              {d.tasks.map((t, j) => (
                                <div key={j} className="flex items-start gap-2 text-xs text-gray-600">
                                  <div className="w-1 h-1 rounded-full bg-gray-400 mt-1.5" />
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

              <div>
                <h4 className="font-medium text-base mb-3">🎯 단계별 가이드</h4>
                <div className="space-y-3">
                  {selectedTask.plan?.steps.map((s, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${
                      selectedTask.completedSteps.includes(i) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                    }`}>
                      <div className="flex gap-3">
                        <button onClick={() => toggleStep(selectedTask.id, i)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                            selectedTask.completedSteps.includes(i) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                          }`}>
                          {selectedTask.completedSteps.includes(i) && <Check className="w-4 h-4 text-white" />}
                        </button>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className={`text-sm font-medium ${selectedTask.completedSteps.includes(i) ? 'line-through text-gray-500' : ''}`}>
                              {s.title}
                            </span>
                            <span className="text-xs text-gray-500">{s.duration}</span>
                          </div>
                          <p className="text-xs text-gray-600">{s.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pb-4">
                <h4 className="font-medium text-base mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500" />제출 전 체크리스트
                </h4>
                <div className="space-y-2">
                  {selectedTask.plan?.checklist.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
