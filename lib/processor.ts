import { Booking, DepartmentStats, SwapSuggestion } from '@/types';
import { GroupManager } from './group-manager';

export class DataProcessor {

    /**
     * Normalizes department name using GroupManager.
     */
    static normalizeDepartment(rawName: string): string {
        // Only run on server-side (where fs is available)
        if (typeof window === 'undefined') {
            return GroupManager.normalizeDepartment(rawName).groupName;
        }
        return rawName;
    }

    /**
     * Aggregates booking statistics by department.
     */
    static aggregateStats(bookings: Booking[]): DepartmentStats[] {
        const statsMap = new Map<string, DepartmentStats>();

        // Helper to get or create stats
        const getStats = (dept: string) => {
            if (!statsMap.has(dept)) {
                statsMap.set(dept, {
                    department: dept,
                    totalHours: 0,
                    frontSlots: 0,
                    backSlots: 0,
                    fullBlocks: 0
                });
            }
            return statsMap.get(dept)!;
        };

        // Sort bookings by venue and time to easily find blocks
        const sortedBookings = [...bookings].sort((a, b) => {
            if (a.venueId !== b.venueId) return a.venueId.localeCompare(b.venueId);
            return a.timeSlot.localeCompare(b.timeSlot);
        });

        // Process bookings
        sortedBookings.forEach(booking => {
            const normalizedDept = this.normalizeDepartment(booking.department);
            const stats = getStats(normalizedDept);
            stats.totalHours += 1;

            const hour = parseInt(booking.timeSlot.split(':')[0], 10);
            if (hour >= 18 && hour < 20) {
                stats.frontSlots += 1;
            } else if (hour >= 20 && hour < 22) {
                stats.backSlots += 1;
            }
        });

        // Calculate Full Blocks (Contiguous 18-22 on same venue)
        // We need to look for sequences: 18, 19, 20, 21 on same venue for same dept
        // Simplified: Just check if a dept has 18,19,20,21 on same venue
        const bookingsByVenue = new Map<string, Booking[]>();
        bookings.forEach(b => {
            const key = `${b.venueId}-${b.date}`;
            if (!bookingsByVenue.has(key)) bookingsByVenue.set(key, []);
            bookingsByVenue.get(key)!.push(b);
        });

        bookingsByVenue.forEach(venueBookings => {
            // Group by dept within this venue
            const deptBookings = new Map<string, number[]>();
            venueBookings.forEach(b => {
                const normalizedDept = this.normalizeDepartment(b.department);
                if (!deptBookings.has(normalizedDept)) deptBookings.set(normalizedDept, []);
                deptBookings.get(normalizedDept)!.push(parseInt(b.timeSlot.split(':')[0], 10));
            });

            deptBookings.forEach((hours, dept) => {
                // Check for 18, 19, 20, 21
                const has18 = hours.includes(18);
                const has19 = hours.includes(19);
                const has20 = hours.includes(20);
                const has21 = hours.includes(21);

                if (has18 && has19 && has20 && has21) {
                    getStats(dept).fullBlocks += 1;
                }
            });
        });

        return Array.from(statsMap.values());
    }

    /**
     * Calculates the academic week number.
     * Assumes Week 1 starts on Aug 31, 2025.
     */
    static getAcademicWeek(dateStr: string): string {
        const start = new Date('2025-08-31');
        const current = new Date(dateStr);

        // Calculate difference in weeks
        const diffTime = Math.abs(current.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weekNum = Math.floor(diffDays / 7) + 1;

        if (weekNum > 16) {
            return `寒假 (Week ${weekNum})`;
        }
        return `Week ${weekNum}`;
    }

    /**
     * Filters bookings by department.
     */
    static filterByDepartment(bookings: Booking[], departments: string[]): Booking[] {
        if (!departments || departments.length === 0) return bookings;
        return bookings.filter(b => departments.includes(b.department));
    }

    /**
     * Generates swap suggestions to optimize for full blocks (18:00-22:00).
     * Now accepts a target department to filter suggestions.
     */
    static generateSwapSuggestions(bookings: Booking[], targetDept?: string): SwapSuggestion[] {
        const suggestions: SwapSuggestion[] = [];

        // Helper to get Day of Week (0-6)
        const getDayOfWeek = (dateStr: string) => new Date(dateStr).getDay();

        // Group bookings by Team (Group Name) -> Date
        // Inventory: Map<TeamName, Map<Date, { front: number, back: number, frontSlots: string[], backSlots: string[] }>>
        const inventory = new Map<string, Map<string, { front: number, back: number, frontSlots: string[], backSlots: string[] }>>();

        bookings.forEach(b => {
            const teamName = this.normalizeDepartment(b.department);
            if (!inventory.has(teamName)) inventory.set(teamName, new Map());

            const teamInv = inventory.get(teamName)!;
            if (!teamInv.has(b.date)) teamInv.set(b.date, { front: 0, back: 0, frontSlots: [], backSlots: [] });

            const dayInv = teamInv.get(b.date)!;
            const hour = parseInt(b.timeSlot.split(':')[0], 10);
            const slotStr = `${b.venueId} ${b.timeSlot}`;

            if (hour >= 18 && hour < 20) {
                dayInv.front++;
                dayInv.frontSlots.push(slotStr);
            } else if (hour >= 20 && hour < 22) {
                dayInv.back++;
                dayInv.backSlots.push(slotStr);
            }
        });

        // Identify Surplus Candidates
        // Candidate: { team: string, date: string, type: 'FRONT' | 'BACK', slots: string[] }
        const surplusFront: { team: string, date: string, slots: string[] }[] = [];
        const surplusBack: { team: string, date: string, slots: string[] }[] = [];

        inventory.forEach((teamInv, teamName) => {
            teamInv.forEach((stats, date) => {
                // Rule: Must have > 1 slot to give
                // And preferably have imbalance (Front > Back)
                if (stats.front > 1 && stats.front > stats.back) {
                    surplusFront.push({ team: teamName, date, slots: stats.frontSlots });
                }
                if (stats.back > 1 && stats.back > stats.front) {
                    surplusBack.push({ team: teamName, date, slots: stats.backSlots });
                }
            });
        });

        // Find Matches
        // 1. Same Day Swap
        surplusFront.forEach(giver => {
            // Find receiver on same date who has surplus Back
            const receiver = surplusBack.find(r => r.date === giver.date && r.team !== giver.team);

            if (receiver) {
                // Check target filter
                if (targetDept && giver.team !== targetDept && receiver.team !== targetDept) return;

                suggestions.push({
                    type: 'SWAP_SLOTS',
                    fromDept: giver.team,
                    toDept: receiver.team,
                    description: `${giver.team} gives Front to ${receiver.team}, receives Back (Same Day).`,
                    benefit: `Both have surplus slots (>1) on ${giver.date}.`,
                    date: giver.date,
                    fromSlots: [giver.slots[0]], // Suggest giving one
                    toSlots: [receiver.slots[0]],
                    score: 0.9
                });
            }
        });

        // 2. Cross-Week Swap (Same Weekday)
        surplusFront.forEach(giver => {
            const giverDay = getDayOfWeek(giver.date);

            // Find receiver on DIFFERENT date but SAME weekday
            const receiver = surplusBack.find(r =>
                r.team !== giver.team &&
                r.date !== giver.date &&
                getDayOfWeek(r.date) === giverDay
            );

            if (receiver) {
                if (targetDept && giver.team !== targetDept && receiver.team !== targetDept) return;

                suggestions.push({
                    type: 'SWAP_SLOTS',
                    fromDept: giver.team,
                    toDept: receiver.team,
                    description: `${giver.team} gives Front (${giver.date}) to ${receiver.team}, receives Back (${receiver.date}).`,
                    benefit: `Cross-week swap on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][giverDay]}. Balances inventory across weeks.`,
                    date: `${giver.date} & ${receiver.date}`,
                    fromSlots: [giver.slots[0]],
                    toSlots: [receiver.slots[0]],
                    score: 0.85
                });
            }
        });

        return suggestions.sort((a, b) => b.score - a.score);
    }
}
