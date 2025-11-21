import { NextResponse } from 'next/server';
import { DataManager } from '@/lib/data-manager';
import { GroupManager } from '@/lib/group-manager';

export async function GET() {
    try {
        // Get all unique department names from cached bookings
        const bookings = DataManager.getBookings();
        const allDepts = [...new Set(bookings.map(b => b.department))];

        // Get ungrouped departments
        const ungrouped = GroupManager.getUngroupedDepartments(allDepts);

        return NextResponse.json({
            success: true,
            ungroupedDepartments: ungrouped.sort()
        });
    } catch (error) {
        console.error('Failed to fetch ungrouped departments:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
