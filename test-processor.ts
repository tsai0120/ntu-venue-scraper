import { DataProcessor } from './lib/processor';
import { Booking } from './types';

const mockBookings: Booking[] = [
    // Dept A: Front Heavy (Has 18-20 on Venue 1, but no 20-22)
    { venueId: 'Venue 1', date: '2023-11-21', timeSlot: '18:00', department: 'Dept A', booker: 'User A', status: 'Booked' },
    { venueId: 'Venue 1', date: '2023-11-21', timeSlot: '19:00', department: 'Dept A', booker: 'User A', status: 'Booked' },

    // Dept B: Back Heavy (Has 20-22 on Venue 2, but no 18-20)
    { venueId: 'Venue 2', date: '2023-11-21', timeSlot: '20:00', department: 'Dept B', booker: 'User B', status: 'Booked' },
    { venueId: 'Venue 2', date: '2023-11-21', timeSlot: '21:00', department: 'Dept B', booker: 'User B', status: 'Booked' },

    // Dept C: Full Block (Has 18-22 on Venue 3)
    { venueId: 'Venue 3', date: '2023-11-21', timeSlot: '18:00', department: 'Dept C', booker: 'User C', status: 'Booked' },
    { venueId: 'Venue 3', date: '2023-11-21', timeSlot: '19:00', department: 'Dept C', booker: 'User C', status: 'Booked' },
    { venueId: 'Venue 3', date: '2023-11-21', timeSlot: '20:00', department: 'Dept C', booker: 'User C', status: 'Booked' },
    { venueId: 'Venue 3', date: '2023-11-21', timeSlot: '21:00', department: 'Dept C', booker: 'User C', status: 'Booked' },
];

console.log('--- Testing Academic Week ---');
console.log('2025-11-16:', DataProcessor.getAcademicWeek('2025-11-16')); // Should be Week 12
console.log('2025-12-21:', DataProcessor.getAcademicWeek('2025-12-21')); // Should be Winter Break

console.log('\n--- Testing Aggregation ---');
const stats = DataProcessor.aggregateStats(mockBookings);
console.table(stats);

console.log('\n--- Testing Swap Suggestions (Target: Dept A) ---');
const suggestions = DataProcessor.generateSwapSuggestions(mockBookings, 'Dept A');
console.log(JSON.stringify(suggestions, null, 2));

console.log('\n--- Testing Swap Suggestions (Target: Dept C - No match) ---');
const suggestionsC = DataProcessor.generateSwapSuggestions(mockBookings, 'Dept C');
console.log(JSON.stringify(suggestionsC, null, 2));
