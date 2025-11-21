'use client';

import { useState, useEffect, useMemo } from 'react';
import { Booking, DepartmentStats, SwapSuggestion } from '@/types';

// College list
const COLLEGES = [
  '1 文學院', '2 理學院', '3 社會科學院', '4 醫學院', '5 工學院',
  '6 生物資源暨農學院', '7 管理學院', '8 公共衛生學院', '9 電機資訊學院',
  'A 法學院', 'B 生命科學院'
];

// Academic Calendar Helper
const getWeekRange = (weekNum: number) => {
  const start = new Date('2025-08-31');
  start.setDate(start.getDate() + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: `Week ${weekNum} (${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()})`
  };
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [allStats, setAllStats] = useState<DepartmentStats[]>([]);
  const [allSuggestions, setAllSuggestions] = useState<SwapSuggestion[]>([]); // Store all suggestions
  const [filteredSuggestions, setFilteredSuggestions] = useState<SwapSuggestion[]>([]); // Filtered for display
  const [academicWeek, setAcademicWeek] = useState('');
  const [fromCache, setFromCache] = useState(false);

  // Group data from API
  const [groups, setGroups] = useState<any[]>([]);
  const [ungroupedDepts, setUngroupedDepts] = useState<string[]>([]);

  // UI State
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [scheduleView, setScheduleView] = useState<'list' | 'table'>('list');
  const [sortBy, setSortBy] = useState<'time' | 'venue'>('time');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<string | null>(null); // Key: "date-venue"
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);
  const [selectedWeek, setSelectedWeek] = useState<number>(12);
  const [myDept, setMyDept] = useState<string>('');
  const [filterDepts, setFilterDepts] = useState<string[]>([]);

  // Filter UI state
  const [selectedCollege, setSelectedCollege] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  // Teams editor modal
  const [showTeamsEditor, setShowTeamsEditor] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [selectedAlias, setSelectedAlias] = useState<string>('');

  // Expanded dept details
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  // Fetch groups and ungrouped departments on mount
  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups || []);
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };

  const fetchUngroupedDepts = async () => {
    try {
      const res = await fetch('/api/ungrouped-depts');
      const data = await res.json();
      if (data.success) {
        setUngroupedDepts(data.ungroupedDepartments || []);
      }
    } catch (err) {
      console.error('Failed to load ungrouped depts:', err);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchUngroupedDepts();
  }, []);

  // Filter swap suggestions when myDept changes
  const handleFilterSwaps = () => {
    if (!myDept) {
      setFilteredSuggestions(allSuggestions);
    } else {
      const filtered = allSuggestions.filter(s =>
        s.fromDept === myDept || s.toDept === myDept
      );
      setFilteredSuggestions(filtered);
    }
  };

  // Update filtered suggestions when allSuggestions change
  useEffect(() => {
    handleFilterSwaps();
  }, [allSuggestions, myDept]);

  // Helper to get Team Name from Department Name
  const getTeamName = (deptName: string) => {
    const group = groups.find(g => g.name === deptName || g.aliases.includes(deptName));
    return group ? group.name : 'Null';
  };

  const formatDateWithDay = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['(日)', '(一)', '(二)', '(三)', '(四)', '(五)', '(六)'];
    return `${dateStr} ${days[date.getDay()]}`;
  };

  // Derived State: Filtered Bookings
  const filteredBookings = useMemo(() => {
    if (filterDepts.length === 0) return allBookings;
    return allBookings.filter(b => {
      const teamName = getTeamName(b.department);
      return filterDepts.includes(teamName);
    });
  }, [allBookings, filterDepts, groups]);

  // Derived State: Filtered Stats
  const filteredStats = useMemo(() => {
    if (filterDepts.length === 0) return allStats;
    return allStats.filter(s => filterDepts.includes(s.department));
  }, [allStats, filterDepts]);

  // Derived Lists for Dropdowns
  const allDepts = useMemo(() => Array.from(new Set(allBookings.map(b => b.department))).sort(), [allBookings]);
  const allTeamNames = useMemo(() => groups.map(g => g.name).sort(), [groups]);

  // Add Filter Helper
  const addFilterDept = (val: string) => {
    if (!filterDepts.includes(val)) {
      setFilterDepts([...filterDepts, val]);
    }
  };

  // Handle Save Team
  const handleSaveTeam = async (deptName: string, newTeamName: string) => {
    // Find if team exists
    let targetGroup = groups.find(g => g.name === newTeamName);

    // Remove dept from any other group first
    for (const g of groups) {
      if (g.aliases.includes(deptName) && g.name !== newTeamName) {
        const updated = { ...g, aliases: g.aliases.filter(a => a !== deptName) };
        await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', group: updated })
        });
      }
    }

    if (targetGroup) {
      // Update existing
      if (!targetGroup.aliases.includes(deptName)) {
        const updated = { ...targetGroup, aliases: [...targetGroup.aliases, deptName] };
        await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', group: updated })
        });
      }
    } else {
      // Create new
      const newGroup = {
        id: newTeamName.toLowerCase().replace(/\s+/g, '-'),
        name: newTeamName,
        aliases: [deptName],
        college: 'Other'
      };
      await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', group: newGroup })
      });
    }

    // Refresh
    fetchGroups();
  };

  const handleScrape = async (forceRefresh = false) => {
    setLoading(true);
    try {
      let url = `/api/scrape?`;

      if (viewMode === 'day') {
        const [year, month, day] = date.split('-').map(Number);
        url += `year=${year}&month=${month}&day=${day}`;
      } else {
        const { start, end } = getWeekRange(selectedWeek);
        url += `startDate=${start}&endDate=${end}`;
      }

      // Client-side filtering now, so we don't send filterDepts
      if (forceRefresh) url += `&refresh=true`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setAllBookings(data.data);
        setAllStats(data.stats);
        setAllSuggestions(data.suggestions); // Store all suggestions
        setFilteredSuggestions(data.suggestions); // Initially show all
        setAcademicWeek(data.academicWeek);
        setFromCache(data.fromCache || false);

        // Initialize expanded dates (expand all by default)
        const uniqueDates = new Set(data.data.map((b: Booking) => b.date));
        setExpandedDates(uniqueDates as Set<string>);
      } else {
        alert('Scraping failed: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  // Add team to filter
  const addTeamToFilter = () => {
    if (selectedTeam && !filterDepts.includes(selectedTeam)) {
      setFilterDepts([...filterDepts, selectedTeam]);
      setSelectedTeam('');
    }
  };

  // Remove team from filter
  const removeTeamFromFilter = (teamName: string) => {
    setFilterDepts(filterDepts.filter(d => d !== teamName));
  };

  // Get teams for selected college
  const getTeamsForCollege = (college: string) => {
    // For joint teams, show in multiple colleges
    return groups.filter(g => {
      // Check if the team belongs to this college (support multiple colleges)
      // Fallback to single college property for backward compatibility
      const colleges = g.colleges || (g.college ? [g.college] : []);
      return colleges.includes(college);
    });
  };

  // Toggle expanded dept details
  const toggleDeptDetails = (deptName: string) => {
    setExpandedDept(expandedDept === deptName ? null : deptName);
  };

  // Get bookings for a specific department
  const getBookingsForDept = (deptName: string) => {
    return allBookings.filter(b => b.department === deptName);
  };

  // Group bookings by date for better display
  const bookingsByDate = filteredBookings.reduce((acc, b) => {
    if (!acc[b.date]) acc[b.date] = [];
    acc[b.date].push(b);
    return acc;
  }, {} as Record<string, Booking[]>);

  // Get time period display
  const getTimePeriod = () => {
    if (viewMode === 'day') {
      return date;
    } else {
      const { start, end } = getWeekRange(selectedWeek);
      const startDate = new Date(start);
      const endDate = new Date(end);
      return `Week ${selectedWeek}: ${startDate.getMonth() + 1}/${startDate.getDate()} ~ ${endDate.getMonth() + 1}/${endDate.getDate()}`;
    }
  };

  // Save/Update group
  const saveGroup = async (group: any, action: 'add' | 'update' | 'delete') => {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, group })
      });
      const data = await res.json();
      if (data.success) {
        await fetchGroups();
        setEditingGroup(null);
      } else {
        alert('Failed to save group');
      }
    } catch (err) {
      console.error('Failed to save group:', err);
      alert('Error saving group');
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-blue-900">NTU Volleyball Court Optimizer</h1>
          <p className="text-slate-700">Scrape schedules, analyze usage, and find swap opportunities.</p>
        </header>

        {/* Control Panel */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            {/* View Mode */}
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setViewMode('day')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'day' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
              >
                Single Day
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
              >
                Academic Week
              </button>
            </div>

            {/* Date / Week Selector */}
            {viewMode === 'day' ? (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            ) : (
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {Array.from({ length: 18 }, (_, i) => i + 1).map(w => (
                  <option key={w} value={w}>{getWeekRange(w).label}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => handleScrape(false)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">↻</span> Fetching...
                </>
              ) : (
                <>
                  📅 Fetch Schedule
                  {fromCache && <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded">cached</span>}
                </>
              )}
            </button>

            <button
              onClick={() => handleScrape(true)}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Force refresh - scrape new data"
            >
              🔄 Refresh
            </button>

            <button
              onClick={() => setShowTeamsEditor(true)}
              className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              ⚙️ Edit Teams
            </button>
          </div>

          {/* Two-Dropdown Filter with Chips */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-1/3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFilterDept(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Select Department...</option>
                  {allDepts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="w-1/3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Team</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFilterDept(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Select Team...</option>
                  {allTeamNames.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Teams Chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              {filterDepts.map(team => (
                <div key={team} className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                  <span>{team}</span>
                  <button
                    onClick={() => removeTeamFromFilter(team)}
                    className="hover:bg-blue-200 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Teams Editor Modal */}
      {
        showTeamsEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto text-slate-900">
              <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Teams Editor (系隊編輯器)</h2>
                <button
                  onClick={() => {
                    setShowTeamsEditor(false);
                    setEditingGroup(null);
                  }}
                  className="text-slate-600 hover:text-slate-800 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Add New Team Button */}
                <button
                  onClick={() => {
                    setEditingGroup({ id: `team-${Date.now()}`, name: '', colleges: [], aliases: [] });
                    setSelectedAlias('');
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  + Add New Team
                </button>

                {/* Editing Form */}
                {editingGroup && (
                  <div className="bg-gray-50 p-4 rounded-lg border-2 border-blue-300">
                    <h3 className="font-semibold mb-3">
                      {editingGroup.name ? `Editing: ${editingGroup.name}` : 'New Team'}
                    </h3>
                    <div className="space-y-3">
                      {/* Team Name */}
                      <div>
                        <label className="block text-sm font-medium mb-1">Team Name (系隊名稱):</label>
                        <input
                          type="text"
                          value={editingGroup.name}
                          onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-slate-900"
                          placeholder="e.g., 歷史資管聯隊"
                        />
                      </div>

                      {/* Multi-Select Colleges (Checkboxes) */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Colleges (學院, can select multiple):</label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-3 bg-white text-slate-900">
                          {COLLEGES.map(college => (
                            <label key={college} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={editingGroup.colleges?.includes(college) || false}
                                onChange={(e) => {
                                  const colleges = editingGroup.colleges || [];
                                  if (e.target.checked) {
                                    setEditingGroup({ ...editingGroup, colleges: [...colleges, college] });
                                  } else {
                                    setEditingGroup({ ...editingGroup, colleges: colleges.filter((c: string) => c !== college) });
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">{college}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Aliases (Dropdown + Chips) */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Aliases (別名 - 抽場帳號):</label>
                        <div className="flex gap-2 mb-2">
                          <select
                            value={selectedAlias}
                            onChange={(e) => setSelectedAlias(e.target.value)}
                            className="flex-1 border rounded px-3 py-2 text-sm bg-white text-slate-900"
                          >
                            <option value="">-- Select Account Name --</option>
                            {ungroupedDepts
                              .filter(dept => !(editingGroup.aliases || []).includes(dept))
                              .map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                          </select>
                          <button
                            onClick={() => {
                              if (selectedAlias && !(editingGroup.aliases || []).includes(selectedAlias)) {
                                setEditingGroup({
                                  ...editingGroup,
                                  aliases: [...(editingGroup.aliases || []), selectedAlias]
                                });
                                setSelectedAlias('');
                              }
                            }}
                            disabled={!selectedAlias}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add
                          </button>
                        </div>

                        {/* Selected Aliases as Chips */}
                        <div className="flex flex-wrap gap-2">
                          {(editingGroup.aliases || []).map((alias: string) => (
                            <div key={alias} className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded flex items-center gap-2 text-sm">
                              <span>{alias}</span>
                              <button
                                onClick={() => {
                                  setEditingGroup({
                                    ...editingGroup,
                                    aliases: editingGroup.aliases.filter((a: string) => a !== alias)
                                  });
                                }}
                                className="hover:bg-blue-200 rounded-full w-5 h-5 flex items-center justify-center"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Save/Cancel Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!editingGroup.name) {
                              alert('Please enter a team name');
                              return;
                            }
                            const action = groups.find(g => g.id === editingGroup.id) ? 'update' : 'add';
                            await saveGroup(editingGroup, action);
                            await fetchUngroupedDepts(); // Refresh ungrouped list
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingGroup(null);
                            setSelectedAlias('');
                          }}
                          className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Teams List (Flat List) */}
                <div className="space-y-3">
                  {groups.map((team: any) => (
                    <div key={team.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors flex justify-between items-start shadow-sm">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-lg text-gray-900">{team.name}</span>
                          <div className="flex gap-1">
                            {team.colleges?.map((c: string) => (
                              <span key={c} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-sm text-slate-600">
                          <span className="font-medium">Aliases:</span> {team.aliases?.length > 0 ? team.aliases.join(', ') : <span className="italic text-gray-400">None</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingGroup(team)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${team.name}?`)) {
                              saveGroup(team, 'delete');
                            }
                          }}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-sm font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        allBookings.length > 0 && (
          <div className="space-y-8">

            {/* Stats & Suggestions */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Department Statistics */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-1 text-gray-800">
                  Department Statistics
                </h2>
                <p className="text-sm text-slate-600 mb-4">{getTimePeriod()}</p>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="p-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Department</th>
                        <th className="p-2 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Total Hours</th>
                        <th className="p-2 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider text-orange-700">Front (18-20)</th>
                        <th className="p-2 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider text-indigo-700">Back (20-22)</th>
                        <th className="p-2 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider text-green-700">Full Blocks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStats.map((s, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => toggleDeptDetails(s.department)}>
                          <td className="p-2 font-medium text-blue-600 text-slate-700">{s.department}</td>
                          <td className="p-2 text-center text-slate-700">{s.totalHours}</td>
                          <td className="p-2 text-center text-orange-600 font-medium">{s.frontSlots}</td>
                          <td className="p-2 text-center text-indigo-600 font-medium">{s.backSlots}</td>
                          <td className="p-2 text-center text-green-600 font-bold">{s.fullBlocks}</td>
                        </tr>
                      ))}
                      {expandedDept && filteredStats.find(s => s.department === expandedDept) && (
                        <tr>
                          <td colSpan={5} className="p-4 bg-blue-50 border-b">
                            {/* Details content */}
                            <div className="text-xs space-y-1">
                              <div className="font-semibold mb-2 text-slate-800">Bookings for {expandedDept}:</div>
                              {getBookingsForDept(expandedDept).map((b, idx) => (
                                <div key={idx} className="flex gap-2 text-slate-800">
                                  <span className="font-mono">{b.date}</span>
                                  <span className="font-mono">{b.timeSlot}</span>
                                  <span>{b.venueId}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Swap Suggestions */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Swap Suggestions</h2>

                {/* My Dept Filter (Dropdown) */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-800 mb-2">My Team (Filter Swaps):</label>
                  <div className="flex gap-2">
                    <select
                      value={myDept}
                      onChange={(e) => setMyDept(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                    >
                      <option value="">-- All Teams --</option>
                      {allTeamNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleFilterSwaps}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Filter
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto max-h-96 pr-2 space-y-4">
                  {filteredSuggestions.length === 0 ? (
                    <p className="text-slate-600 italic">No swap opportunities found.</p>
                  ) : (
                    filteredSuggestions.map((s: SwapSuggestion, i: number) => (
                      <div key={i} className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold">SWAP</span>
                            <span className="font-bold text-slate-800 text-sm">{s.date}</span>
                          </div>
                        </div>
                        <div className="font-medium text-gray-900 mb-2 text-lg text-center bg-white/50 p-2 rounded border border-yellow-200">
                          {s.fromDept} ↔ {s.toDept}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                          <div className="bg-orange-50 p-2 rounded border border-orange-100">
                            <div className="font-semibold text-orange-800 mb-1">Gives (Front):</div>
                            {s.fromSlots?.map((slot, idx) => <div key={idx} className="text-slate-700">{slot}</div>)}
                          </div>
                          <div className="bg-indigo-50 p-2 rounded border border-indigo-100">
                            <div className="font-semibold text-indigo-800 mb-1">Receives (Back):</div>
                            {s.toSlots?.map((slot, idx) => <div key={idx} className="text-slate-700">{slot}</div>)}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 italic border-t border-yellow-200 pt-2 mt-2">Why: {s.benefit}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-800">Schedule ({filteredBookings.length})</h2>
                  {academicWeek && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{academicWeek}</span>}
                </div>

                {/* View & Sort Controls (Moved Here) */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                    <button
                      onClick={() => setScheduleView('list')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-all ${scheduleView === 'list' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      List
                    </button>
                    <button
                      onClick={() => setScheduleView('table')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-all ${scheduleView === 'table' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      Table
                    </button>
                  </div>

                  {scheduleView === 'list' && (
                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                      <span className="text-xs font-semibold text-slate-500 px-2">Sort:</span>
                      <button
                        onClick={() => setSortBy('time')}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${sortBy === 'time' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-800'}`}
                      >
                        Time
                      </button>
                      <button
                        onClick={() => setSortBy('venue')}
                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${sortBy === 'venue' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-800'}`}
                      >
                        Venue
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                {Object.entries(bookingsByDate).sort().map(([dateKey, dateBookings]) => {
                  const isExpanded = expandedDates.has(dateKey);

                  // Sort bookings
                  const sortedBookings = [...dateBookings].sort((a, b) => {
                    if (sortBy === 'time') return a.timeSlot.localeCompare(b.timeSlot) || a.venueId.localeCompare(b.venueId);
                    return a.venueId.localeCompare(b.venueId) || a.timeSlot.localeCompare(b.timeSlot);
                  });

                  return (
                    <div key={dateKey} className="border rounded-lg overflow-hidden">
                      {/* Date Header (Toggle) */}
                      <div
                        className="bg-gray-50 p-3 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => {
                          const newSet = new Set(expandedDates);
                          if (newSet.has(dateKey)) newSet.delete(dateKey);
                          else newSet.add(newSet.has(dateKey) ? dateKey : dateKey);
                          setExpandedDates(newSet);
                        }}
                      >
                        <h3 className="text-lg font-semibold text-slate-800">{formatDateWithDay(dateKey)}</h3>
                        <span className="text-slate-500">{isExpanded ? '▼' : '▶'}</span>
                      </div>

                      {isExpanded && (
                        <div className="p-4">
                          {scheduleView === 'list' ? (
                            /* List View */
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gray-50 border-b">
                                    <th className="p-3 font-semibold text-slate-700 w-32">Venue</th>
                                    <th className="p-3 font-semibold text-slate-700 w-32">Time</th>
                                    <th className="p-3 font-semibold text-slate-700">Team</th>
                                    <th className="p-3 font-semibold text-slate-700">Department</th>
                                    <th className="p-3 font-semibold text-slate-700 w-24">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedBookings.map((b, i) => (
                                    <tr key={i} className="border-b hover:bg-gray-50">
                                      <td className="p-3 text-slate-800">{b.venueId}</td>
                                      <td className="p-3 text-slate-700 font-mono">{b.timeSlot}</td>
                                      <td className="p-3 font-medium text-blue-700">{getTeamName(b.department)}</td>
                                      <td className="p-3 text-slate-600 text-sm">{b.department}</td>
                                      <td className="p-3">
                                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                          {b.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            /* Table View (2x7 Grid) */
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse border border-gray-200">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border p-2 text-slate-700 w-20 font-semibold">Time</th>
                                    {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                      <th key={n} className="border p-2 text-slate-700 text-center font-semibold">排球場 {n}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Front Slots (18:00 - 20:00) */}
                                  <tr>
                                    <td className="border p-2 font-semibold text-slate-700 bg-orange-50 text-center">18:00<br />|<br />20:00</td>
                                    {[1, 2, 3, 4, 5, 6, 7].map(n => {
                                      const venueId = `排球場${n}`;
                                      const cellKey = `${dateKey}-${venueId}-front`;
                                      // Find booking for this venue in 18-20 range
                                      const booking = dateBookings.find(b => b.venueId === venueId && parseInt(b.timeSlot) < 20);

                                      // Determine display name
                                      let displayName = '-';
                                      let isTeam = false;
                                      if (booking) {
                                        const team = getTeamName(booking.department);
                                        if (team !== 'Null') {
                                          displayName = team;
                                          isTeam = true;
                                        } else {
                                          displayName = booking.department;
                                        }
                                      }

                                      const isActive = activeCell === cellKey;

                                      return (
                                        <td
                                          key={n}
                                          className={`border p-2 text-center h-24 align-middle transition-colors relative cursor-pointer ${isActive ? 'bg-blue-50 ring-2 ring-blue-400' : 'hover:bg-gray-50'}`}
                                          onClick={() => booking && setActiveCell(isActive ? null : cellKey)}
                                        >
                                          {booking ? (
                                            <div className="flex flex-col items-center justify-center h-full w-full">
                                              <span className={`font-bold text-sm ${isTeam ? 'text-blue-700' : 'text-slate-700'}`}>
                                                {displayName}
                                              </span>

                                              {/* Click to Reveal Details */}
                                              {isActive && (
                                                <div className="absolute z-20 bottom-full mb-2 bg-white border border-slate-200 shadow-xl rounded-lg p-3 text-left w-48 text-sm">
                                                  <div className="font-bold text-slate-800 mb-1">{booking.department}</div>
                                                  <div className="text-slate-600 text-xs mb-1">{booking.timeSlot}</div>
                                                  <div className="text-slate-500 text-xs">{venueId}</div>
                                                  <div className="mt-2 text-xs text-blue-600 font-medium">
                                                    {isTeam ? `Team: ${displayName}` : 'Unassigned Team'}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {/* Back Slots (20:00 - 22:00) */}
                                  <tr>
                                    <td className="border p-2 font-semibold text-slate-700 bg-indigo-50 text-center">20:00<br />|<br />22:00</td>
                                    {[1, 2, 3, 4, 5, 6, 7].map(n => {
                                      const venueId = `排球場${n}`;
                                      const cellKey = `${dateKey}-${venueId}-back`;
                                      // Find booking for this venue in 20-22 range
                                      const booking = dateBookings.find(b => b.venueId === venueId && parseInt(b.timeSlot) >= 20);

                                      // Determine display name
                                      let displayName = '-';
                                      let isTeam = false;
                                      if (booking) {
                                        const team = getTeamName(booking.department);
                                        if (team !== 'Null') {
                                          displayName = team;
                                          isTeam = true;
                                        } else {
                                          displayName = booking.department;
                                        }
                                      }

                                      const isActive = activeCell === cellKey;

                                      return (
                                        <td
                                          key={n}
                                          className={`border p-2 text-center h-24 align-middle transition-colors relative cursor-pointer ${isActive ? 'bg-blue-50 ring-2 ring-blue-400' : 'hover:bg-gray-50'}`}
                                          onClick={() => booking && setActiveCell(isActive ? null : cellKey)}
                                        >
                                          {booking ? (
                                            <div className="flex flex-col items-center justify-center h-full w-full">
                                              <span className={`font-bold text-sm ${isTeam ? 'text-blue-700' : 'text-slate-700'}`}>
                                                {displayName}
                                              </span>

                                              {/* Click to Reveal Details */}
                                              {isActive && (
                                                <div className="absolute z-20 bottom-full mb-2 bg-white border border-slate-200 shadow-xl rounded-lg p-3 text-left w-48 text-sm">
                                                  <div className="font-bold text-slate-800 mb-1">{booking.department}</div>
                                                  <div className="text-slate-600 text-xs mb-1">{booking.timeSlot}</div>
                                                  <div className="text-slate-500 text-xs">{venueId}</div>
                                                  <div className="mt-2 text-xs text-blue-600 font-medium">
                                                    {isTeam ? `Team: ${displayName}` : 'Unassigned Team'}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      }
      </div>
    </main>
  );
}
