import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Calendar, PieChart, List, ChevronLeft, ChevronRight, 
  Trash2, Edit2, Check, X, Save, Upload, Download, RefreshCcw,
  Home, Coffee, ShoppingBag, CreditCard, ArrowUp, ArrowDown,
  Settings, Image as ImageIcon, DollarSign, Globe, Link as LinkIcon
} from 'lucide-react';

// --- Constants & Defaults ---
const STORAGE_KEY = 'fixcost_master_v1';

const CATEGORIES = {
  necessary: { label: 'จำเป็น', color: 'bg-rose-100 text-rose-700', icon: Home, chartColor: '#e11d48' },
  daily: { label: 'ใช้จ่ายทั่วไป', color: 'bg-orange-100 text-orange-700', icon: Coffee, chartColor: '#f97316' },
  luxury: { label: 'ฟุ่มเฟือย', color: 'bg-purple-100 text-purple-700', icon: ShoppingBag, chartColor: '#9333ea' },
  yearly: { label: 'รายปี', color: 'bg-blue-100 text-blue-700', icon: Calendar, chartColor: '#2563eb' },
};

const DEFAULT_DATA = [
  { id: 1, name: "ค่ารถ", amount: 15400, category: "necessary", isLimited: true, totalMonths: 48, dueDay: 1, startMonth: "2024-01", history: {}, image: "https://www.google.com/s2/favicons?domain=toyota.co.th&sz=128" },
  { id: 2, name: "ค่าเน็ตบ้าน", amount: 599, category: "necessary", frequency: "monthly", dueDay: 5, startMonth: "2024-01", history: {}, image: "https://www.google.com/s2/favicons?domain=true.th&sz=128" },
  { id: 3, name: "Netflix", amount: 169, category: "luxury", frequency: "monthly", dueDay: 1, startMonth: "2024-01", history: {}, image: "https://www.google.com/s2/favicons?domain=netflix.com&sz=128" },
  { id: 4, name: "ประกันรถยนต์", amount: 12000, category: "necessary", frequency: "yearly", dueMonth: 5, dueDay: 1, startMonth: "2024-01", history: {} }
];

// --- Helpers (Fixed Timezone Issue) ---
const formatCurrency = (num) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(num);

// ใช้แบบนี้ชัวร์กว่า ไม่โดนลด Timezone
const getMonthString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const parseMonthString = (str) => {
  const [y, m] = str.split('-').map(Number);
  return new Date(y, m - 1, 1);
};

const isCostActive = (cost, viewMonthStr) => {
  const viewDate = parseMonthString(viewMonthStr);
  const startDate = parseMonthString(cost.startMonth);

  if (viewDate < startDate) return false;

  if (cost.frequency === 'yearly') {
    if ((viewDate.getMonth() + 1) !== cost.dueMonth) return false;
  }

  if (cost.isLimited) {
    const monthsDiff = (viewDate.getFullYear() - startDate.getFullYear()) * 12 + (viewDate.getMonth() - startDate.getMonth());
    if (monthsDiff >= cost.totalMonths) return false;
  }

  return true;
};

const getInstallmentInfo = (cost, viewMonthStr) => {
  if (!cost.isLimited) return null;
  const viewDate = parseMonthString(viewMonthStr);
  const startDate = parseMonthString(cost.startMonth);
  const monthsDiff = (viewDate.getFullYear() - startDate.getFullYear()) * 12 + (viewDate.getMonth() - startDate.getMonth());
  const currentInstallment = Math.min(monthsDiff + 1, cost.totalMonths);
  
  // Calculate remaining debt
  const remainingMonths = cost.totalMonths - (currentInstallment - 1);
  const remainingDebt = remainingMonths * cost.amount;

  return { current: currentInstallment, total: cost.totalMonths, remainingDebt };
};

// --- Main Component ---
export default function App() {
  const [dataMonth, setDataMonth] = useState(getMonthString(new Date()));
  const [costs, setCosts] = useState([]);
  const [incomes, setIncomes] = useState({});
  const [savings, setSavings] = useState({});
  const [activeTab, setActiveTab] = useState('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCosts(parsed.costs || []);
        setIncomes(parsed.incomes || {});
        setSavings(parsed.savings || {});
        setDataMonth(parsed.dataMonth || getMonthString(new Date()));
      } catch (e) {
        console.error("Load error", e);
        loadDefault();
      }
    } else {
      loadDefault();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      costs, incomes, savings, dataMonth
    }));
  }, [costs, incomes, savings, dataMonth]);

  const loadDefault = () => {
    setCosts(DEFAULT_DATA);
    setIncomes({});
    setSavings({});
    setDataMonth(getMonthString(new Date()));
  };

  const currentIncome = incomes[dataMonth] || 0;
  const currentSavings = savings[dataMonth] || 0;

  const activeCosts = useMemo(() => {
    let active = costs.filter(c => isCostActive(c, dataMonth));
    if (!reorderMode) {
        active.sort((a, b) => a.dueDay - b.dueDay);
    }
    return active;
  }, [costs, dataMonth, reorderMode]);

  const totalCostAmount = activeCosts.reduce((sum, c) => sum + Number(c.amount), 0);
  
  const paidCostsAmount = activeCosts.reduce((sum, c) => {
    const isPaid = c.history?.[dataMonth]?.paid;
    return sum + (isPaid ? Number(c.amount) : 0);
  }, 0);

  const pendingAmount = totalCostAmount - paidCostsAmount;
  const netRemaining = currentIncome - currentSavings - totalCostAmount; 

  // Fix: Ensure we correctly manipulate the date object
  const handleMonthChange = (offset) => {
    const date = parseMonthString(dataMonth);
    date.setMonth(date.getMonth() + offset);
    setDataMonth(getMonthString(date));
  };

  const togglePaid = (costId) => {
    setCosts(prev => prev.map(c => {
      if (c.id !== costId) return c;
      const isPaid = c.history?.[dataMonth]?.paid;
      return {
        ...c,
        history: {
          ...c.history,
          [dataMonth]: { paid: !isPaid, paidAt: new Date().toISOString() }
        }
      };
    }));
  };

  const deleteCost = (id) => {
    if (confirm('ลบรายการนี้ใช่ไหม?')) {
      setCosts(prev => prev.filter(c => c.id !== id));
    }
  };

  const moveItem = (index, direction) => {
    const newCosts = [...costs];
    const item = activeCosts[index];
    const mainIndex = costs.findIndex(c => c.id === item.id);
    
    if (direction === -1 && mainIndex > 0) {
      [newCosts[mainIndex], newCosts[mainIndex - 1]] = [newCosts[mainIndex - 1], newCosts[mainIndex]];
    } else if (direction === 1 && mainIndex < newCosts.length - 1) {
      [newCosts[mainIndex], newCosts[mainIndex + 1]] = [newCosts[mainIndex + 1], newCosts[mainIndex]];
    }
    setCosts(newCosts);
  };

  const handleSaveCost = (costData) => {
    if (editingCost) {
      setCosts(prev => prev.map(c => c.id === editingCost.id ? { ...c, ...costData } : c));
    } else {
      setCosts(prev => [...prev, { ...costData, id: Date.now(), history: {} }]);
    }
    setIsModalOpen(false);
    setEditingCost(null);
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ costs, incomes, savings }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `fixcost_backup_${dataMonth}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.costs) setCosts(parsed.costs);
        if (parsed.incomes) setIncomes(parsed.incomes);
        if (parsed.savings) setSavings(parsed.savings);
        alert('กู้คืนข้อมูลเรียบร้อย!');
        setIsSettingsOpen(false);
      } catch (err) {
        alert('ไฟล์ไม่ถูกต้อง');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-24 font-sans selection:bg-blue-100">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">FixedCost Pro</h1>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Settings size={20} />
          </button>
        </div>
        
        {/* Month Selector */}
        <div className="flex items-center justify-between px-4 pb-3">
          <button onClick={() => handleMonthChange(-1)} className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"><ChevronLeft size={24} /></button>
          <span className="text-lg font-semibold tabular-nums select-none">
             {parseMonthString(dataMonth).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => handleMonthChange(1)} className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"><ChevronRight size={24} /></button>
        </div>

        {/* Tab Nav */}
        <div className="flex border-t border-gray-100">
          <button onClick={() => setActiveTab('list')} className={`flex-1 py-3 text-sm font-medium flex justify-center gap-2 ${activeTab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
            <List size={18} /> รายการจ่าย
          </button>
          <button onClick={() => setActiveTab('calendar')} className={`flex-1 py-3 text-sm font-medium flex justify-center gap-2 ${activeTab === 'calendar' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
            <Calendar size={18} /> ปฏิทิน
          </button>
          <button onClick={() => setActiveTab('charts')} className={`flex-1 py-3 text-sm font-medium flex justify-center gap-2 ${activeTab === 'charts' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
            <PieChart size={18} /> สรุปกราฟ
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto">
        {activeTab === 'list' && (
          <div className="space-y-4 animate-fade-in">
            {/* Income / Savings Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                <label className="text-xs text-gray-500 block mb-1">รายรับ (เดือนนี้)</label>
                <div className="flex items-center text-green-600">
                  <DollarSign size={14} className="mr-1" />
                  <input 
                    type="number" 
                    value={incomes[dataMonth] || ''} 
                    onChange={(e) => setIncomes({...incomes, [dataMonth]: parseFloat(e.target.value)})}
                    placeholder="0"
                    className="w-full bg-transparent outline-none font-bold tabular-nums"
                  />
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                <label className="text-xs text-gray-500 block mb-1">เงินออม</label>
                <div className="flex items-center text-blue-600">
                  <ArrowDown size={14} className="mr-1" />
                  <input 
                    type="number" 
                    value={savings[dataMonth] || ''} 
                    onChange={(e) => setSavings({...savings, [dataMonth]: parseFloat(e.target.value)})}
                    placeholder="0"
                    className="w-full bg-transparent outline-none font-bold tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Summary Chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex-shrink-0 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium">
                    รวมทั้งหมด: {formatCurrency(totalCostAmount)}
                </div>
                {Object.keys(CATEGORIES).map(catKey => {
                    const catTotal = activeCosts.filter(c => c.category === catKey).reduce((s, c) => s + Number(c.amount), 0);
                    if(catTotal === 0) return null;
                    return (
                        <div key={catKey} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border ${CATEGORIES[catKey].color.replace('bg-', 'border-').replace('text-', 'text-')} bg-white`}>
                           {CATEGORIES[catKey].label}: {formatCurrency(catTotal)}
                        </div>
                    )
                })}
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center mt-2">
                <h2 className="text-sm font-semibold text-gray-600">รายการที่ต้องจ่าย ({activeCosts.length})</h2>
                <button 
                  onClick={() => setReorderMode(!reorderMode)}
                  className={`text-xs px-2 py-1 rounded border ${reorderMode ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-500'}`}
                >
                    {reorderMode ? 'เสร็จสิ้น' : 'จัดเรียง'}
                </button>
            </div>

            {/* The List */}
            <div className="space-y-3">
              {activeCosts.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                    <div className="inline-block p-4 bg-gray-100 rounded-full mb-2"><Coffee size={32} /></div>
                    <p>เดือนนี้ไม่มีรายจ่าย สบายตัว!</p>
                </div>
              ) : (
                activeCosts.map((cost, index) => {
                  const isPaid = cost.history?.[dataMonth]?.paid;
                  const CatIcon = CATEGORIES[cost.category].icon;
                  const installmentInfo = getInstallmentInfo(cost, dataMonth);

                  return (
                    <div key={cost.id} className={`bg-white rounded-xl p-3 shadow-sm border transition-all ${isPaid ? 'border-green-200 opacity-75' : 'border-gray-100'}`}>
                      <div className="flex gap-3 items-center">
                        {/* Status Checkbox */}
                        <div 
                          onClick={() => togglePaid(cost.id)}
                          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${isPaid ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          <Check size={20} />
                        </div>

                        {/* Logo Image */}
                        <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                           {cost.image ? (
                             <img src={cost.image} alt="logo" className="w-full h-full object-contain" />
                           ) : (
                             <CatIcon size={18} className="text-gray-400" />
                           )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0" onClick={() => !reorderMode && setEditingCost(cost) || reorderMode && setIsModalOpen(true) && setEditingCost(cost)}> 
                           <div className="flex justify-between items-start">
                              <h3 className={`font-medium truncate ${isPaid ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{cost.name}</h3>
                              <span className="font-bold text-gray-900 tabular-nums">{formatCurrency(cost.amount)}</span>
                           </div>
                           
                           {/* Details Line */}
                           <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                              <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${CATEGORIES[cost.category].color}`}>
                                {CATEGORIES[cost.category].label}
                              </span>
                              <span>จ่ายวันที่: {cost.dueDay}</span>
                              
                              {/* Installment Badge */}
                              {installmentInfo && (
                                <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                  งวดที่ {installmentInfo.current}/{installmentInfo.total}
                                </span>
                              )}
                           </div>
                           
                           {/* Remaining Debt Line */}
                           {installmentInfo && (
                               <div className="mt-1.5 text-xs text-gray-400 flex items-center gap-1">
                                   <CreditCard size={10} />
                                   <span>ยอดหนี้คงเหลือ: <span className="font-medium text-gray-600">{formatCurrency(installmentInfo.remainingDebt)}</span></span>
                               </div>
                           )}
                        </div>

                        {/* Reorder / Edit Actions */}
                        {reorderMode && (
                            <div className="flex flex-col gap-1">
                                <button onClick={() => moveItem(index, -1)} disabled={index === 0} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"><ArrowUp size={16} /></button>
                                <button onClick={() => moveItem(index, 1)} disabled={index === activeCosts.length - 1} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"><ArrowDown size={16} /></button>
                            </div>
                        )}
                        {!reorderMode && (
                             <button onClick={() => { setEditingCost(cost); setIsModalOpen(true); }} className="text-gray-300 hover:text-gray-600 p-1">
                                <Edit2 size={16} />
                             </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <button 
                onClick={() => { setEditingCost(null); setIsModalOpen(true); }}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
                <Plus size={20} /> เพิ่มรายการใหม่
            </button>
          </div>
        )}

        {activeTab === 'calendar' && (
          <CalendarComponent activeCosts={activeCosts} dataMonth={dataMonth} />
        )}

        {activeTab === 'charts' && (
          <ChartComponent activeCosts={activeCosts} total={totalCostAmount} />
        )}
      </main>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-gray-100 z-20">
         <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
             <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">เงินคงเหลือสุทธิ</p>
                <p className={`text-xl font-bold ${netRemaining < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                    {formatCurrency(netRemaining)}
                </p>
             </div>
             <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide">ยอดรอจ่าย</p>
                <p className="text-lg font-semibold text-orange-500">
                    {formatCurrency(pendingAmount)}
                </p>
             </div>
         </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <CostModal 
          isOpen={isModalOpen} 
          onClose={() => { setIsModalOpen(false); setEditingCost(null); }} 
          initialData={editingCost} 
          onSave={handleSaveCost}
          onDelete={editingCost ? () => { deleteCost(editingCost.id); setIsModalOpen(false); } : null}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">ตั้งค่า</h2>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
                </div>
                
                <div className="space-y-4">
                    <button onClick={handleExport} className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium">
                        <Download size={20} className="text-blue-500" /> สำรองข้อมูล (Backup JSON)
                    </button>
                    
                    <label className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium cursor-pointer">
                        <Upload size={20} className="text-green-500" /> กู้คืนข้อมูล (Restore)
                        <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>

                    <button onClick={() => { if(confirm('ล้างข้อมูลทั้งหมด? ย้อนกลับไม่ได้นะ')) loadDefault(); setIsSettingsOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-medium mt-8">
                        <RefreshCcw size={20} /> ล้างข้อมูลใหม่หมด (Reset)
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// --- Sub Components ---

function CalendarComponent({ activeCosts, dataMonth }) {
    // Show ONLY current month
    // Navigation is handled by the main header buttons
    const date = parseMonthString(dataMonth);
    const currentMonthStr = dataMonth;

    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-fade-in">
             {/* No title needed here as it's in the header, or we can keep it for context */}
             <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-bold text-gray-800">
                    {date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                    {activeCosts.length} รายการ
                </span>
             </div>
            <MonthGrid activeCosts={activeCosts} monthDate={date} currentMonthStr={currentMonthStr} />
        </div>
    );
}

function MonthGrid({ activeCosts, monthDate, currentMonthStr }) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);

    return (
        <>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                    <div key={d} className="text-xs font-bold text-gray-400 uppercase">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {blanks.map(i => <div key={`blank-${i}`} className="h-12"></div>)}
                {days.map(d => {
                    const costsThisDay = activeCosts.filter(c => c.dueDay === d);
                    // Check paid status for this specific month
                    const isPaid = costsThisDay.length > 0 && costsThisDay.every(c => c.history?.[currentMonthStr]?.paid);
                    
                    return (
                        <div key={d} className={`h-12 border border-gray-50 rounded-lg flex flex-col items-center justify-start pt-1 relative ${costsThisDay.length > 0 ? 'bg-gray-50' : ''}`}>
                            <span className={`text-sm ${costsThisDay.length > 0 ? 'font-bold text-gray-800' : 'text-gray-400'}`}>{d}</span>
                            <div className="flex gap-0.5 mt-1">
                                {costsThisDay.map((c, i) => (
                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${c.history?.[currentMonthStr]?.paid ? 'bg-green-500' : 'bg-rose-500'}`} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Mini List below calendar */}
            {activeCosts.length > 0 && (
                 <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">รายละเอียดในปฏิทิน</h4>
                    {activeCosts.sort((a,b) => a.dueDay - b.dueDay).map(c => (
                         <div key={c.id} className="flex justify-between items-center text-sm p-2 rounded hover:bg-gray-50">
                             <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-gray-400 w-5 text-center">{c.dueDay}</span>
                                <span className="truncate max-w-[150px] text-gray-700">{c.name}</span>
                             </div>
                             <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.history?.[currentMonthStr]?.paid ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'}`}>
                                {c.history?.[currentMonthStr]?.paid ? 'จ่ายแล้ว' : 'รอจ่าย'}
                             </span>
                         </div>
                    ))}
                 </div>
            )}
        </>
    );
}

function ChartComponent({ activeCosts, total }) {
    if (activeCosts.length === 0) return <div className="text-center p-10 text-gray-400">ไม่มีข้อมูลกราฟ</div>;
    
    // Group by category
    const data = Object.keys(CATEGORIES).map(cat => {
        const val = activeCosts.filter(c => c.category === cat).reduce((acc, curr) => acc + Number(curr.amount), 0);
        return { name: CATEGORIES[cat].label, value: val, color: CATEGORIES[cat].chartColor, key: cat };
    }).filter(d => d.value > 0);

    // Calculate SVG paths (Simple Donut)
    let cumulativePercent = 0;
    
    function getCoordinatesForPercent(percent) {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    }

    const slices = data.map(slice => {
        const percent = slice.value / total;
        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
        cumulativePercent += percent;
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
        const largeArcFlag = percent > 0.5 ? 1 : 0;
        const pathData = [
            `M ${startX} ${startY}`, // Move
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
            `L 0 0`, // Line to center
        ].join(' ');
        return { ...slice, path: pathData };
    });

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
            <h3 className="text-lg font-bold mb-4">สัดส่วนรายจ่ายรายเดือน</h3>
            <div className="relative w-48 h-48 mb-6">
                 {/* Pure CSS/SVG Chart because libraries are heavy */}
                 <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                    {slices.map((slice, i) => (
                        <path key={i} d={slice.path} fill={slice.color} stroke="white" strokeWidth="0.02" />
                    ))}
                    {slices.length === 1 && <circle cx="0" cy="0" r="1" fill={slices[0].color} />}
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="bg-white rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-sm">
                         <span className="text-xs text-gray-400">ยอดรวม</span>
                         <span className="font-bold text-sm text-gray-800">{formatCurrency(total)}</span>
                     </div>
                 </div>
            </div>
            
            <div className="w-full space-y-3">
                {data.map(d => (
                    <div key={d.key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></span>
                            <span className="text-gray-600">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-medium">{formatCurrency(d.value)}</span>
                            <span className="text-xs text-gray-400 w-8 text-right">{Math.round((d.value/total)*100)}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CostModal({ isOpen, onClose, initialData, onSave, onDelete }) {
    const [formData, setFormData] = useState({
        name: '', amount: '', category: 'necessary', frequency: 'monthly',
        dueDay: 1, dueMonth: 1, isLimited: false, totalMonths: 10, startMonth: getMonthString(new Date()),
        image: null,
        urlInput: '' // temp field for url input
    });

    useEffect(() => {
        if (initialData) {
            setFormData({ ...initialData, urlInput: '' });
        }
    }, [initialData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...formData,
            amount: parseFloat(formData.amount),
            dueDay: parseInt(formData.dueDay),
            dueMonth: parseInt(formData.dueMonth),
            totalMonths: parseInt(formData.totalMonths)
        });
    };

    const handleUrlBlur = () => {
        const url = formData.urlInput;
        if (!url) return;
        try {
            const fullUrl = url.startsWith('http') ? url : `https://${url}`;
            const hostname = new URL(fullUrl).hostname;
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
            setFormData(prev => ({ ...prev, image: faviconUrl }));
        } catch (e) {
            console.error("Invalid URL");
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500000) { // 500kb limit
                alert("ไฟล์ใหญ่ไป ขอไม่เกิน 500KB");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, image: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm sm:p-4">
            <div className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up">
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="flex justify-between items-center">
                         <h2 className="text-xl font-bold text-gray-800">{initialData ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</h2>
                         <button type="button" onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                    </div>

                    {/* Image / Icon Section */}
                    <div className="flex flex-col items-center gap-3">
                         {/* Preview Circle */}
                        <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-200 overflow-hidden relative shadow-inner">
                            {formData.image ? (
                                <img src={formData.image} alt="preview" className="w-full h-full object-contain p-2" />
                            ) : (
                                <ImageIcon className="text-gray-300" size={32} />
                            )}
                             {/* Hidden clear button if image exists */}
                             {formData.image && (
                                 <button 
                                    type="button"
                                    onClick={() => setFormData({...formData, image: null})}
                                    className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 flex items-center justify-center transition-all group"
                                 >
                                    <X className="text-white opacity-0 group-hover:opacity-100" />
                                 </button>
                             )}
                        </div>

                        {/* Input Options */}
                        <div className="w-full space-y-2">
                             {/* URL Input */}
                             <div className="flex items-center bg-gray-100 rounded-xl px-3 py-2">
                                <Globe size={16} className="text-gray-400 mr-2" />
                                <input 
                                    type="text"
                                    placeholder="พิมพ์ชื่อเว็บดึงโลโก้ (เช่น netflix.com)"
                                    className="bg-transparent w-full text-sm outline-none"
                                    value={formData.urlInput}
                                    onChange={(e) => setFormData({...formData, urlInput: e.target.value})}
                                    onBlur={handleUrlBlur}
                                />
                             </div>
                             
                             <div className="text-center text-xs text-gray-400">หรือ</div>

                             {/* File Upload */}
                             <label className="flex items-center justify-center gap-2 w-full py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                                <Upload size={16} /> อัปโหลดรูปเอง
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                             </label>
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                             <label className="text-xs font-semibold text-gray-500 uppercase">ชื่อรายการ</label>
                             <input required className="w-full border-b border-gray-200 py-2 text-lg focus:outline-none focus:border-blue-500" 
                                placeholder="เช่น ค่า Netflix"
                                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div>
                             <label className="text-xs font-semibold text-gray-500 uppercase">จำนวนเงิน</label>
                             <input required type="number" step="0.01" className="w-full border-b border-gray-200 py-2 text-lg focus:outline-none focus:border-blue-500 font-mono" 
                                placeholder="0.00"
                                value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                        </div>
                         <div>
                             <label className="text-xs font-semibold text-gray-500 uppercase">หมวดหมู่</label>
                             <select className="w-full border-b border-gray-200 py-2.5 bg-transparent focus:outline-none" 
                                value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                {Object.keys(CATEGORIES).map(k => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
                             </select>
                        </div>
                    </div>

                    {/* Timing */}
                    <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                        <div className="flex gap-4">
                             <label className="flex items-center gap-2 cursor-pointer">
                                 <input type="radio" name="freq" checked={formData.frequency === 'monthly'} onChange={() => setFormData({...formData, frequency: 'monthly'})} className="text-blue-600" />
                                 <span className="text-sm font-medium">รายเดือน</span>
                             </label>
                             <label className="flex items-center gap-2 cursor-pointer">
                                 <input type="radio" name="freq" checked={formData.frequency === 'yearly'} onChange={() => setFormData({...formData, frequency: 'yearly'})} className="text-blue-600" />
                                 <span className="text-sm font-medium">รายปี</span>
                             </label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">วันที่จ่าย (1-31)</label>
                                <input type="number" min="1" max="31" value={formData.dueDay} onChange={e => setFormData({...formData, dueDay: e.target.value})} className="w-full p-2 rounded border border-gray-200" />
                            </div>
                            {formData.frequency === 'yearly' && (
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">เดือนที่จ่าย</label>
                                    <select value={formData.dueMonth} onChange={e => setFormData({...formData, dueMonth: parseInt(e.target.value)})} className="w-full p-2 rounded border border-gray-200">
                                        {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{new Date(2000, m-1, 1).toLocaleDateString('th-TH', {month:'short'})}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-2">
                             <span className="text-sm font-medium text-gray-700">มีกำหนดงวดผ่อน?</span>
                             <div 
                                onClick={() => setFormData({...formData, isLimited: !formData.isLimited})}
                                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${formData.isLimited ? 'bg-blue-600' : 'bg-gray-300'}`}
                             >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${formData.isLimited ? 'translate-x-6' : ''}`} />
                             </div>
                        </div>

                        {formData.isLimited && (
                            <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">จำนวนงวดทั้งหมด</label>
                                    <input type="number" value={formData.totalMonths} onChange={e => setFormData({...formData, totalMonths: e.target.value})} className="w-full p-2 rounded border border-gray-200" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">เดือนที่เริ่มผ่อน</label>
                                    <input type="month" value={formData.startMonth} onChange={e => setFormData({...formData, startMonth: e.target.value})} className="w-full p-2 rounded border border-gray-200" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        {initialData && (
                            <button type="button" onClick={onDelete} className="flex-1 py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-medium transition-colors">
                                ลบรายการ
                            </button>
                        )}
                        <button type="submit" className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-colors flex justify-center items-center gap-2">
                            <Save size={18} /> บันทึก
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}