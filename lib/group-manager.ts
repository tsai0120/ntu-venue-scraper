import * as fs from 'fs';
import * as path from 'path';

export interface GroupMapping {
    id: string;
    name: string;        // e.g. "歷史資管聯隊"
    colleges: string[];  // e.g. ["文學院", "管理學院"] - support multiple colleges for joint teams
    aliases: string[];   // e.g. ["歷史系", "資管系", "資訊管理學系"]
}

const DATA_DIR = path.join(process.cwd(), 'data');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

export class GroupManager {
    static getGroups(): GroupMapping[] {
        if (!fs.existsSync(GROUPS_FILE)) {
            return [];
        }
        try {
            const data = fs.readFileSync(GROUPS_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading groups file:', error);
            return [];
        }
    }

    static saveGroups(groups: GroupMapping[]) {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
    }

    static addGroup(group: GroupMapping) {
        const groups = this.getGroups();
        groups.push(group);
        this.saveGroups(groups);
    }

    static updateGroup(id: string, updates: Partial<GroupMapping>) {
        const groups = this.getGroups();
        const index = groups.findIndex(g => g.id === id);
        if (index !== -1) {
            groups[index] = { ...groups[index], ...updates };
            this.saveGroups(groups);
        }
    }

    static deleteGroup(id: string) {
        const groups = this.getGroups().filter(g => g.id !== id);
        this.saveGroups(groups);
    }

    static normalizeDepartment(rawName: string): { groupName: string; colleges: string[] } {
        const groups = this.getGroups();
        for (const group of groups) {
            if (group.aliases.includes(rawName)) {
                return { groupName: group.name, colleges: group.colleges };
            }
        }
        // If no mapping found, return the raw name as-is with empty colleges
        return { groupName: rawName, colleges: ['未分類'] };
    }

    static getGroupsByCollege(): Record<string, GroupMapping[]> {
        const groups = this.getGroups();
        const byCollege: Record<string, GroupMapping[]> = {};

        groups.forEach(group => {
            // Add group to each of its colleges
            group.colleges.forEach(college => {
                if (!byCollege[college]) {
                    byCollege[college] = [];
                }
                byCollege[college].push(group);
            });
        });

        return byCollege;
    }

    static getAllGroupNames(): string[] {
        return this.getGroups().map(g => g.name);
    }

    static getUngroupedDepartments(allDepartments: string[]): string[] {
        const groups = this.getGroups();
        const assignedAliases = new Set<string>();

        // Collect all already-assigned aliases
        groups.forEach(group => {
            group.aliases.forEach(alias => assignedAliases.add(alias));
        });

        // Return departments that are not yet assigned
        return allDepartments.filter(dept => !assignedAliases.has(dept));
    }
}
