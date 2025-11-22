import { NextResponse } from 'next/server';
import { GroupManager } from '@/lib/group-manager';

export async function GET() {
    try {
        const groups = GroupManager.getGroups();
        const byCollege = GroupManager.getGroupsByCollege();
        const allNames = GroupManager.getAllGroupNames();

        return NextResponse.json({
            success: true,
            groups,
            byCollege,
            allNames
        });
    } catch (error) {
        console.error('Failed to fetch groups:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, group } = body;

        if (action === 'add') {
            GroupManager.addGroup(group);
        } else if (action === 'update') {
            GroupManager.updateGroup(group.id, group);
        } else if (action === 'delete') {
            GroupManager.deleteGroup(group.id);
        } else if (action === 'saveAll') {
            GroupManager.saveGroups(body.groups);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to modify groups:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
