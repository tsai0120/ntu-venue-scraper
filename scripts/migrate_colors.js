const fs = require('fs');
const path = require('path');

const GROUPS_FILE = path.join(__dirname, '../data/groups.json');

const COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981',
    '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#D946EF',
    '#F43F5E', '#64748B', '#78716C', '#14B8A6', '#A855F7'
];

try {
    const data = fs.readFileSync(GROUPS_FILE, 'utf-8');
    const groups = JSON.parse(data);

    const updatedGroups = groups.map((group, index) => ({
        ...group,
        color: group.color || COLORS[index % COLORS.length]
    }));

    fs.writeFileSync(GROUPS_FILE, JSON.stringify(updatedGroups, null, 2));
    console.log('Successfully added colors to groups.json');
} catch (error) {
    console.error('Error migrating colors:', error);
}
