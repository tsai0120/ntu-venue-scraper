'use client';

import { useState, useEffect } from 'react';
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<DepartmentStats[]>([]);
  const [allSuggestions, setAllSuggestions] = useState<SwapSuggestion[]>([]); // Store all suggestions
  const [filteredSuggestions, setFilteredSuggestions] = useState<SwapSuggestion[]>([]); // Filtered for display
  const [academicWeek, setAcademicWeek] = useState('');
  const [fromCache, setFromCache] = useState(false);

  // Group data from API
  const [groups, setGroups] = useState<any[]>([]);
  const [groupsByCollege, setGroupsByCollege] = useState<Record<string, any[]>>({});
  const [allTeamNames, setAllTeamNames] = useState<string[]>([]);
  const [ungroupedDepts, setUngroupedDepts] = useState<string[]>([]);

  // UI State
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
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
        setGroupsByCollege(data.byCollege || {});
        setAllTeamNames(data.allNames || []);
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

      // Don't send myDept to API anymore - we filter client-side
      if (filterDepts.length > 0) url += `&filterDepts=${encodeURIComponent(filterDepts.join(','))}`;
      if (forceRefresh) url += `&refresh=true`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setBookings(data.data);
        setStats(data.stats);
        setAllSuggestions(data.suggestions); // Store all suggestions
        setFilteredSuggestions(data.suggestions); // Initially show all
        setAcademicWeek(data.academicWeek);
        setFromCache(data.fromCache || false);
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
      // Check if the team belongs to this college
      if (g.college === college) return true;
      // For joint teams, check if any alias suggests it belongs to multiple colleges
      // This is a simplified approach - you might want to enhance this logic
      return false;
    });
  };

  // Toggle expanded dept details
  const toggleDeptDetails = (deptName: string) => {
    setExpandedDept(expandedDept === deptName ? null : deptName);
  };

  // Get bookings for a specific department
  const getBookingsForDept = (deptName: string) => {
    return bookings.filter(b => b.department === deptName);
  };

  // Group bookings by date for better display
  const bookingsByDate = bookings.reduce((acc, b) => {
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
              <label className="text-sm font-medium text-slate-800 pt-2 whitespace-nowrap">Filter Departments / Teams:</label>

              <div className="flex-1">
                {/* Dropdowns */}
                <div className="flex gap-2 mb-3">
                  <select
                    value={selectedCollege}
                    onChange={(e) => {
                      setSelectedCollege(e.target.value);
                      setSelectedTeam('');
                    }}
                    className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">-- Select College --</option>
                    {COLLEGES.map(college => (
                      <option key={college} value={college}>{college}</option>
                    ))}
                  </select>

                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    disabled={!selectedCollege}
                    className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Select Team --</option>
                    {selectedCollege && getTeamsForCollege(selectedCollege).map(team => (
                      <option key={team.id} value={team.name}>{team.name}</option>
                    ))}
                  </select>

                  <button
                    onClick={addTeamToFilter}
                    disabled={!selectedTeam}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>

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
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Teams Editor Modal */}
        {showTeamsEditor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                          className="w-full border rounded px-3 py-2"
                          placeholder="e.g., 歷史資管聯隊"
                        />
                      </div>

                      {/* Multi-Select Colleges (Checkboxes) */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Colleges (學院, can select multiple):</label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-3 bg-white">
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
                            className="flex-1 border rounded px-3 py-2 text-sm bg-white"
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
                            const action = groups.find(g => g.id === editingGroup.id) ? 'update' : 'add';
                            await saveGroup(editingGroup, action);
                            await fetchUngroupedDepts(); // Refresh ungrouped list
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingGroup(null);
                            setSelectedAlias('');
                          }}
                          className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Teams List by College */}
                {Object.entries(groupsByCollege).map(([college, teams]) => (
                  <div key={college} className="border rounded-lg p-4">
                    <h3 className="font-bold text-lg mb-3">{college}</h3>
                    <div className="space-y-2">
                      {teams.map((team: any) => (
                        <div key={team.id} className="bg-white p-3 rounded border flex justify-between items-start">
                          <div>
                            <div className="font-semibold">{team.name}</div>
                            <div className="text-sm text-slate-700">Aliases: {team.aliases.join(', ')}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingGroup(team)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete ${team.name}?`)) {
                                  saveGroup(team, 'delete');
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {bookings.length > 0 && (
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
                    <thead className="sticky top-0 bg-white">
                      <tr className="bg-gray-50 border-b">
                        <th className="p-2 text-left">Team</th>
                        <th className="p-2 text-center">Total Hr</th>
                        <th className="p-2 text-center">Front</th>
                        <th className="p-2 text-center">Back</th>
                        <th className="p-2 text-center">Full</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((s, i) => (
                        <>
                          <tr
                            key={i}
                            className="border-b hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleDeptDetails(s.department)}
                          >
                            <td className="p-2 font-medium text-blue-600">{s.department}</td>
                            <td className="p-2 text-center">{s.totalHours}</td>
                            <td className="p-2 text-center text-orange-600 font-medium">{s.frontSlots}</td>
                            <td className="p-2 text-center text-indigo-600 font-medium">{s.backSlots}</td>
                            <td className="p-2 text-center text-green-600 font-bold">{s.fullBlocks}</td>
                          </tr>
                          {expandedDept === s.department && (
                            <tr>
                              <td colSpan={5} className="p-4 bg-blue-50 border-b">
                                <div className="text-xs space-y-1">
                                  <div className="font-semibold mb-2">Bookings for {s.department}:</div>
                                  {getBookingsForDept(s.department).map((b, idx) => (
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
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Swap Suggestions */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Swap Suggestions</h2>

                {/* My Dept Filter (Dropdown) */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-800 mb-2">My Team (Filter Swaps):</label>
                  <div className="flex gap-2">
                    <select
                      value={myDept}
                      onChange={(e) => setMyDept(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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

                {filteredSuggestions.length === 0 ? (
                  <p className="text-slate-600 italic">No swap opportunities found.</p>
                ) : (
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {filteredSuggestions.map((s: SwapSuggestion, i: number) => (
                      <div key={i} className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold">SWAP</span>
                          <span className="font-medium text-gray-800">{s.fromDept} ↔ {s.toDept}</span>
                        </div>
                        <p className="text-sm text-slate-800 mb-1">{s.description}</p>
                        <p className="text-xs text-slate-600">Why: {s.benefit}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Schedule Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Schedule ({bookings.length} bookings)</h2>
                {academicWeek && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{academicWeek}</span>}
              </div>

              <div className="space-y-8">
                {Object.entries(bookingsByDate).sort().map(([dateKey, dateBookings]) => (
                  <div key={dateKey}>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2 sticky top-0 bg-white py-2 border-b">{dateKey}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="p-3 font-semibold text-slate-700 w-32">Venue</th>
                            <th className="p-3 font-semibold text-slate-700 w-32">Time</th>
                            <th className="p-3 font-semibold text-slate-700">Department</th>
                            <th className="p-3 font-semibold text-slate-700 w-24">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dateBookings.map((b, i) => (
                            <tr key={i} className="border-b hover:bg-gray-50">
                              <td className="p-3 text-gray-800">{b.venueId}</td>
                              <td className="p-3 text-slate-700 font-mono">{b.timeSlot}</td>
                              <td className="p-3 font-medium text-blue-600">{b.department}</td>
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
