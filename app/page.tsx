'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { Booking, DepartmentStats, SwapSuggestion, Group } from '@/types';

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

  const [allTeamNames, setAllTeamNames] = useState<string[]>([]);
  const [ungroupedDepts, setUngroupedDepts] = useState<string[]>([]);

  // UI State
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [scheduleView, setScheduleView] = useState<'list' | 'table'>('list');
  const [sortBy, setSortBy] = useState<'time' | 'venue'>('time');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<string | null>(null); // Key: "date-venue"
  const [date, setDate] = useState<string>('');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState<string>('');

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
  const [activeBooking, setActiveBooking] = useState<{ booking: Booking, anchorEl: HTMLElement | null } | null>(null);

  // Editor State
  const [editorSearch, setEditorSearch] = useState('');
  const [editorCollege, setEditorCollege] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAliases, setEditAliases] = useState<string[]>([]);
  const [editColor, setEditColor] = useState('#333333');

  // Filter State
  const [filterCollege, setFilterCollege] = useState('');
  const [filterTeamSelect, setFilterTeamSelect] = useState('');

  // Swap Filter State
  const [swapCollege, setSwapCollege] = useState('');
  const [swapTeamSelect, setSwapTeamSelect] = useState('');
  const [targetDept, setTargetDept] = useState<string>(''); // Added targetDept state

  // Fetch groups and ungrouped departments on mount
  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups || []);
        setAllTeamNames(data.allNames || []); // Corrected: allNames from groupsData
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
    const loadData = async () => {
      try {
        // Load Groups
        const groupsRes = await fetch('/api/groups');
        const groupsData = await groupsRes.json();
        if (groupsData.success) {
          setGroups(groupsData.groups || []);
          setAllTeamNames(groupsData.allNames || []);
        }

        // Load Ungrouped Departments
        const ungroupedRes = await fetch('/api/ungrouped-depts');
        const ungroupedData = await ungroupedRes.json();
        if (ungroupedData.success) {
          setUngroupedDepts(ungroupedData.ungroupedDepartments || []);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    loadData();
  }, []);

  // Filter swap suggestions when myDept changes
  const handleFilterSwaps = () => {
    const deptToFilter = targetDept || myDept; // Use targetDept if set, otherwise myDept
    if (!deptToFilter) {
      setFilteredSuggestions(allSuggestions);
    } else {
      const filtered = allSuggestions.filter(s =>
        s.fromDept === deptToFilter || s.toDept === deptToFilter
      );
      setFilteredSuggestions(filtered);
    }
  };

  // Update filtered suggestions when allSuggestions change
  useEffect(() => {
    handleFilterSwaps();
  }, [allSuggestions, myDept, targetDept]); // Added targetDept to dependencies

  // Helper to get Team Name from Department Name
  const getTeamName = (deptName: string) => {
    const group = groups.find(g => g.name === deptName || g.aliases?.includes(deptName));
    return group ? group.name : 'Null';
  };

  const formatDateWithDay = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['(日)', '(一)', '(二)', '(三)', '(四)', '(五)', '(六)'];
    return `${dateStr} ${days[date.getDay()]}`;
  };

  const isWeekend = (dateStr: string) => {
    const day = new Date(dateStr).getDay();
    return day === 0 || day === 6;
  };

  const handleSaveGroups = async (newGroups: Group[]) => {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveAll', groups: newGroups })
      });
      if (!res.ok) throw new Error('Failed to save groups');
      await fetchGroups(); // Refresh groups after saving
      await fetchUngroupedDepts(); // Refresh ungrouped depts
    } catch (error) {
      console.error('Error saving groups:', error);
      alert('Failed to save changes');
    }
  };

  const handleUpdateTeam = async (deptName: string, newTeamName: string) => {
    if (!newTeamName.trim()) return;

    const newGroups = [...groups];

    // 1. Remove from old group
    newGroups.forEach(g => {
      if (g.aliases?.includes(deptName)) {
        g.aliases = g.aliases?.filter((a: string) => a !== deptName);
      }
    });

    // 2. Add to new group
    const targetGroup = newGroups.find(g => g.name === newTeamName);
    if (targetGroup) {
      if (!targetGroup.aliases?.includes(deptName)) {
        if (!targetGroup.aliases) targetGroup.aliases = [];
        targetGroup.aliases.push(deptName);
      }
    } else {
      // Create new group
      newGroups.push({
        id: `team-${Date.now()}`, // Assign a unique ID for new groups
        name: newTeamName,
        aliases: [deptName],
        colleges: [], // Default empty colleges
        color: '#333333' // Default color
      });
    }

    // 3. Update State & Save
    setGroups(newGroups);
    await handleSaveGroups(newGroups);
  };

  // Helper to toggle team details
  const toggleTeamDetails = (teamName: string) => {
    setExpandedTeam(prev => (prev === teamName ? null : teamName));
  };

  // Derived State: Filtered Bookings
  const filteredBookings = useMemo(() => {
    if (!Array.isArray(allBookings)) return [];
    if (filterDepts.length === 0) return allBookings.filter(b => b); // Filter out nulls
    return allBookings.filter(b => {
      if (!b) return false;
      const teamName = getTeamName(b.department);
      return filterDepts.includes(teamName);
    });
  }, [allBookings, filterDepts, groups]);

  // Derived State: Filtered Stats
  const filteredStats = useMemo(() => {
    if (!Array.isArray(allStats)) return [];
    if (filterDepts.length === 0) return allStats.filter(s => s); // Filter out nulls
    return allStats.filter(s => s && filterDepts.includes(s.department));
  }, [allStats, filterDepts]);

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
    if (!b || !b.date) return acc;
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
        await fetchUngroupedDepts(); // Refresh ungrouped depts after group changes
        setEditingGroup(null);
        setEditingGroupId(null); // Clear inline editor
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
              <div className="w-1/3 space-y-2">
                <label className="block text-sm font-bold text-slate-900">Filter Departments / Teams</label>
                <div className="flex gap-2">
                  <select
                    value={filterCollege}
                    onChange={(e) => {
                      setFilterCollege(e.target.value);
                      setFilterTeamSelect('');
                    }}
                    className="w-1/2 p-2 border rounded-lg bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">All Colleges</option>
                    {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={filterTeamSelect}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !filterDepts.includes(val)) {
                        setFilterDepts([...filterDepts, val]);
                        setFilterTeamSelect(''); // Reset after add
                      }
                    }}
                    className="w-1/2 p-2 border rounded-lg bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    disabled={!filterCollege}
                  >
                    <option value="" disabled>Select Team...</option>
                    {filterCollege && getTeamsForCollege(filterCollege).map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-900 mb-2">Selected Filters:</label>
                {/* Selected Teams Chips */}
                <div className="flex flex-wrap gap-2">
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
                  {filterDepts.length === 0 && <span className="text-slate-400 text-sm italic">No filters applied</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Teams Editor Modal */}
        {showTeamsEditor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Manage Teams</h2>
                <button onClick={() => setShowTeamsEditor(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>

              <div className="p-4 bg-gray-50 border-b flex gap-4">
                {/* Editor Filters */}
                <select
                  className="border rounded p-2 text-slate-900"
                  value={editorCollege}
                  onChange={(e) => setEditorCollege(e.target.value)}
                >
                  <option value="">All Colleges</option>
                  {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Search teams..."
                  className="border rounded p-2 flex-1 text-slate-900"
                  value={editorSearch}
                  onChange={(e) => setEditorSearch(e.target.value)}
                />
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* New Team Card */}
                  {editingGroupId === 'NEW' ? (
                    <div className="col-span-full border rounded-lg p-4 bg-blue-50">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-slate-800">Create New Team</h3>
                        <button onClick={() => setEditingGroupId(null)} className="text-slate-500 hover:text-slate-700">Cancel</button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Team Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border rounded p-2 text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">Colleges (can select multiple):</label>
                          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-3 bg-white text-slate-900">
                            {COLLEGES.map(college => (
                              <label key={college} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                <input
                                  type="checkbox"
                                  checked={false} // New teams start with no colleges (edit not supported yet for new)
                                  disabled={true} // Disable for now as we don't have state for it
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm">{college}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">Aliases (Select from Ungrouped):</label>
                          <div className="flex gap-2 mb-2">
                            <select
                              className="flex-1 border rounded px-2 py-1 text-sm bg-white text-slate-900"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val && !editAliases.includes(val)) {
                                  setEditAliases([...editAliases, val]);
                                }
                                e.target.value = ''; // Reset select
                              }}
                            >
                              <option value="">-- Select Account --</option>
                              {ungroupedDepts
                                .filter(d => !editAliases.includes(d))
                                .sort()
                                .map(dept => (
                                  <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                          </div>
                          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded bg-gray-50">
                            {editAliases.map(alias => (
                              <span key={alias} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center gap-1">
                                {alias}
                                <button
                                  onClick={() => setEditAliases(editAliases.filter(a => a !== alias))}
                                  className="hover:text-blue-600 font-bold"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            {editAliases.length === 0 && <span className="text-gray-400 text-xs italic">No aliases selected</span>}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingGroupId(null)}
                            className="px-3 py-1 text-slate-600 hover:bg-slate-100 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              if (!editName.trim()) {
                                alert('Team name cannot be empty.');
                                return;
                              }
                              const newGroupData = {
                                id: `team-${Date.now()}`,
                                name: editName,
                                aliases: editAliases,
                                colleges: [],
                                color: editColor
                              };

                              const updatedGroups = [...groups, newGroupData];

                              setGroups(updatedGroups);
                              await handleSaveGroups(updatedGroups);
                              setEditingGroupId(null);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Create Team
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-500 cursor-pointer transition-colors min-h-[200px]"
                      onClick={() => {
                        setEditingGroupId('NEW');
                        setEditName('');
                        setEditAliases([]);
                        setEditColor('#333333');
                      }}>
                      <span className="text-2xl mb-2">+</span>
                      <span className="font-medium">Create New Team</span>
                    </div>
                  )}

                  {/* Existing Teams */}
                  {groups
                    .filter(g => !editorCollege || g.colleges?.includes(editorCollege))
                    .filter(g => !editorSearch || g.name.toLowerCase().includes(editorSearch.toLowerCase()) || g.aliases?.some((a: string) => a.toLowerCase().includes(editorSearch.toLowerCase())))
                    .map(group => (
                      <div key={group.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-lg text-gray-800">{group.name}</h3>
                            <div className="text-xs text-gray-500 mt-1">
                              {group.colleges?.join(', ') || 'Unassigned'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingGroupId(group.id || null);
                                setEditName(group.name);
                                setEditAliases([...group.aliases]);
                                setEditColor(group.color || '#333333');
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete team "${group.name}"? This cannot be undone.`)) {
                                  const newGroups = groups.filter(g => g.id !== group.id);
                                  setGroups(newGroups);
                                  await handleSaveGroups(newGroups);
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Inline Editor */}
                        {editingGroupId === group.id || (editingGroupId === 'NEW' && group.id === undefined) ? ( // Handle new group editing
                          <div className="mt-4 pt-4 border-t bg-blue-50 p-4 rounded-lg">
                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Team Name</label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full border rounded p-2 text-slate-900"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">Colleges (can select multiple):</label>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-3 bg-white text-slate-900">
                                  {COLLEGES.map(college => (
                                    <label key={college} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                      <input
                                        type="checkbox"
                                        checked={group.colleges?.includes(college) || false} // Use group.colleges for display
                                        onChange={(e) => {
                                          const currentColleges = group.colleges || [];
                                          const updatedColleges = e.target.checked
                                            ? [...currentColleges, college]
                                            : currentColleges.filter((c: string) => c !== college);
                                          // Update the group directly in the groups state for immediate visual feedback
                                          setGroups(prevGroups => prevGroups.map(g =>
                                            g.id === group.id ? { ...g, colleges: updatedColleges } : g
                                          ));
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm">{college}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">Aliases (Select from Ungrouped):</label>
                                <div className="flex gap-2 mb-2">
                                  <select
                                    className="flex-1 border rounded px-2 py-1 text-sm bg-white text-slate-900"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val && !editAliases.includes(val)) {
                                        setEditAliases([...editAliases, val]);
                                      }
                                      e.target.value = ''; // Reset select
                                    }}
                                  >
                                    <option value="">-- Select Account --</option>
                                    {ungroupedDepts
                                      .filter(d => !editAliases.includes(d))
                                      .sort()
                                      .map(dept => (
                                        <option key={dept} value={dept}>{dept}</option>
                                      ))}
                                  </select>
                                </div>
                                <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded bg-gray-50">
                                  {editAliases.map(alias => (
                                    <span key={alias} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center gap-1">
                                      {alias}
                                      <button
                                        onClick={() => setEditAliases(editAliases.filter(a => a !== alias))}
                                        className="hover:text-blue-600 font-bold"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                  {editAliases.length === 0 && <span className="text-gray-400 text-xs italic">No aliases selected</span>}
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingGroupId(null)}
                                  className="px-3 py-1 text-slate-600 hover:bg-gray-200 rounded"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!editName.trim()) {
                                      alert('Team name cannot be empty.');
                                      return;
                                    }
                                    const newGroupData = {
                                      id: group.id || `team-${Date.now()}`, // Use existing ID or generate new
                                      name: editName,
                                      aliases: editAliases,
                                      colleges: group.colleges || [], // Use colleges from the group state
                                      color: editColor
                                    };

                                    let updatedGroups;
                                    if (group.id) {
                                      // Update existing
                                      updatedGroups = groups.map(g => g.id === group.id ? newGroupData : g);
                                    } else {
                                      // Add new
                                      updatedGroups = [...groups, newGroupData];
                                    }

                                    setGroups(updatedGroups);
                                    await handleSaveGroups(updatedGroups);
                                    setEditingGroupId(null);
                                  }} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {group.aliases.map((alias: string) => (
                              <span key={alias} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                                {alias}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {allBookings.length > 0 && (
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
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-slate-900 font-bold">
                      <tr>
                        <th className="p-2 rounded-tl-lg">Department / Team</th>
                        <th className="p-2 text-center">Total Hours</th>
                        <th className="p-2 text-center text-orange-700">Front (18-20)</th>
                        <th className="p-2 text-center text-indigo-700">Back (20-22)</th>
                        <th className="p-2 text-center text-green-700 rounded-tr-lg">Full Blocks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStats.map((s, i) => (
                        <Fragment key={i}>
                          <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => toggleDeptDetails(s.department)}>
                            <td className="p-2 font-medium text-blue-700 text-slate-900">{s.department}</td>
                            <td className="p-2 text-center text-slate-900 font-bold">{s.totalHours}</td>
                            <td className="p-2 text-center text-orange-600 font-medium">{s.frontSlots}</td>
                            <td className="p-2 text-center text-indigo-600 font-medium">{s.backSlots}</td>
                            <td className="p-2 text-center text-green-600 font-bold">{s.fullBlocks}</td>
                          </tr>
                          {expandedDept === s.department && (
                            <tr>
                              <td colSpan={5} className="p-4 bg-blue-50 border-b">
                                <div className="text-xs space-y-1">
                                  <div className="font-semibold mb-2 text-slate-800">Bookings for {s.department}:</div>
                                  {getBookingsForDept(s.department).map((b, idx) => (
                                    <div key={idx} className="flex gap-2 text-slate-800">
                                      <span className="font-mono">{b.date}</span>
                                      <span className="font-mono">{b.timeSlot}</span>
                                      <span>{b.venueId}</span>
                                      <span className="text-slate-500">({b.department})</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
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
                  <div className="flex gap-2 mb-4">
                    <select
                      value={swapCollege}
                      onChange={(e) => {
                        setSwapCollege(e.target.value);
                        setSwapTeamSelect('');
                        setTargetDept(''); // Clear target dept when college changes
                      }}
                      className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                    >
                      <option value="">All Colleges</option>
                      {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={swapTeamSelect}
                      onChange={(e) => {
                        setSwapTeamSelect(e.target.value);
                        setTargetDept(e.target.value);
                      }}
                      disabled={!swapCollege}
                      className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 disabled:bg-gray-100"
                    >
                      <option value="">Select Team...</option>
                      {swapCollege && getTeamsForCollege(swapCollege).map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>      <button
                    onClick={handleFilterSwaps}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Filter
                  </button>
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
                            /* List View (Table) */
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
                                  {sortedBookings.map((slot, idx) => {
                                    // Determine Status
                                    const now = new Date();
                                    let endHour = 23; // Default to end of day if parsing fails
                                    try {
                                      const parts = slot.timeSlot.split(/[|-]/);
                                      if (parts.length >= 2) {
                                        const endTimePart = parts[parts.length - 1].trim();
                                        const [h] = endTimePart.split(':');
                                        endHour = parseInt(h, 10);
                                      }
                                    } catch (e) {
                                      console.warn('Failed to parse timeSlot:', slot.timeSlot);
                                    }

                                    // Need full date to compare
                                    const bookingEnd = new Date(dateKey);
                                    bookingEnd.setHours(endHour, 0, 0, 0);

                                    const isUsed = now > bookingEnd;
                                    const statusLabel = isUsed ? 'Used' : 'Booked';
                                    const statusColor = isUsed ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800';

                                    return (
                                      <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="p-3 text-slate-800 font-medium">{slot.venueId}</td>
                                        <td className="p-3 text-slate-700 font-mono">{slot.timeSlot}</td>
                                        <td className="p-3">
                                          <div
                                            className="font-bold text-blue-700 cursor-pointer hover:underline"
                                            onClick={(e) => {
                                              const foundBooking = allBookings.find(b =>
                                                b.date === dateKey &&
                                                b.timeSlot === slot.timeSlot &&
                                                b.venueId === slot.venueId &&
                                                b.department === slot.department
                                              );
                                              if (foundBooking) {
                                                setActiveBooking({ booking: foundBooking, anchorEl: e.currentTarget });
                                              }
                                            }}
                                          >
                                            {getTeamName(slot.department)}
                                          </div>
                                        </td>
                                        <td className="p-3 text-slate-600 text-sm">{slot.department}</td>
                                        <td className="p-3">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                            {statusLabel}
                                          </span>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            /* Table View (Grid) */
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse border border-gray-200">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border p-2 text-slate-900 w-24 font-bold">Time</th>
                                    {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                      <th key={n} className="border p-2 text-slate-900 text-center font-bold">排球場 {n}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Determine Rows based on Weekend/Weekday */}
                                  {(isWeekend(dateKey)
                                    ? [
                                      { label: '08:00\n|\n10:00', start: 8, end: 10, color: 'bg-gray-50' },
                                      { label: '10:00\n|\n12:00', start: 10, end: 12, color: 'bg-gray-50' },
                                      { label: '13:00\n|\n15:00', start: 13, end: 15, color: 'bg-gray-50' },
                                      { label: '15:00\n|\n17:00', start: 15, end: 17, color: 'bg-gray-50' },
                                      { label: '18:00\n|\n20:00', start: 18, end: 20, color: 'bg-orange-50' },
                                      { label: '20:00\n|\n22:00', start: 20, end: 22, color: 'bg-indigo-50' }
                                    ]
                                    : [
                                      { label: '18:00\n|\n20:00', start: 18, end: 20, color: 'bg-orange-50' },
                                      { label: '20:00\n|\n22:00', start: 20, end: 22, color: 'bg-indigo-50' }
                                    ]
                                  ).map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      <td className={`border p-2 font-bold text-slate-800 text-center whitespace-pre-line ${row.color}`}>{row.label}</td>
                                      {[1, 2, 3, 4, 5, 6, 7].map(n => {
                                        const venueId = `排球場${n}`;
                                        const cellKey = `${dateKey}-${venueId}-${row.start}`;

                                        // Flexible Venue Matching (Handle "排球場 1" vs "排球場1")
                                        const booking = dateBookings.find(b => {
                                          const bVenue = b.venueId.replace(/\s/g, '');
                                          const targetVenue = venueId.replace(/\s/g, '');
                                          const bStart = parseInt(b.timeSlot.split(':')[0], 10);
                                          return bVenue === targetVenue && bStart >= row.start && bStart < row.end;
                                        });

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
                                            onClick={(e) => booking && setActiveBooking({ booking, anchorEl: e.currentTarget })}
                                          >
                                            {booking ? (
                                              <div className="flex flex-col items-center justify-center h-full w-full">
                                                <span className={`font-bold text-sm ${isTeam ? 'text-blue-700' : 'text-slate-900'}`}>
                                                  {displayName}
                                                </span>


                                              </div>
                                            ) : (
                                              <span className="text-gray-300 text-xs">-</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
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
        )}
        {/* Global Schedule Popup */}
        {activeBooking && activeBooking.anchorEl && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setActiveBooking(null)}></div>
            <div
              className="fixed z-[9999] bg-white border border-slate-200 shadow-2xl rounded-lg p-4 text-left w-72 text-sm"
              style={{
                top: activeBooking.anchorEl.getBoundingClientRect().top - 10,
                left: activeBooking.anchorEl.getBoundingClientRect().left + activeBooking.anchorEl.getBoundingClientRect().width / 2,
                transform: 'translate(-50%, -100%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-slate-900 text-lg">
                  {activeBooking.booking.department}
                  <div className="text-xs font-normal text-slate-500">
                    {getTeamName(activeBooking.booking.department) !== 'Null' ? getTeamName(activeBooking.booking.department) : 'No Team'}
                  </div>
                </div>
                <button onClick={() => setActiveBooking(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <div className="space-y-1 mb-3 text-slate-600">
                <div><span className="font-semibold">Time:</span> {activeBooking.booking.timeSlot}</div>
                <div><span className="font-semibold">Venue:</span> {activeBooking.booking.venueId}</div>
                <div><span className="font-semibold">Booker:</span> {activeBooking.booking.booker || 'N/A'}</div>
              </div>

              <div className="border-t pt-3">
                <div className="font-semibold text-slate-800 mb-2">Edit Team Assignment:</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={getTeamName(activeBooking.booking.department) !== 'Null' ? getTeamName(activeBooking.booking.department) : ''}
                    placeholder="Enter Team Name..."
                    className="border rounded px-2 py-1 text-sm w-full text-slate-900"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateTeam(activeBooking.booking.department, e.currentTarget.value);
                        setActiveBooking(null);
                      }
                    }}
                  />
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      handleUpdateTeam(activeBooking.booking.department, input.value);
                      setActiveBooking(null);
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
