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
        const stats = this.aggregateStats(bookings);
        const suggestions: SwapSuggestion[] = [];

        const frontHeavy = stats.filter(s => s.frontSlots > s.backSlots);
        const backHeavy = stats.filter(s => s.backSlots > s.frontSlots);

        // Simple matching algorithm
        frontHeavy.forEach(fDept => {
            // Find a matching back heavy dept
            // Ideally one that has a surplus of back slots equal to this dept's surplus of front slots
            const surplusFront = fDept.frontSlots - fDept.backSlots;

            // Look for best match
            const match = backHeavy.find(bDept => (bDept.backSlots - bDept.frontSlots) > 0);

            if (match) {
                // Only add if it involves the target department (if specified)
                if (targetDept && fDept.department !== targetDept && match.department !== targetDept) {
                    return;
                }

                suggestions.push({
                    type: 'SWAP_SLOTS',
                    fromDept: fDept.department,
                    toDept: match.department,
                    description: `${fDept.department} gives Front Slots (18-20) to ${match.department}, receives Back Slots (20-22).`,
                    benefit: `Helps both form full blocks. ${fDept.department} has excess Front, ${match.department} has excess Back.`,
                    score: 0.8 // Placeholder score
                });
            }
        });

        return suggestions;
    }
}
