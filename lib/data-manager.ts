import * as fs from 'fs';
import * as path from 'path';
import { Booking } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

export class DataManager {
    static getBookings(): Booking[] {
        if (!fs.existsSync(BOOKINGS_FILE)) {
            return [];
        }
        try {
            const data = fs.readFileSync(BOOKINGS_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading bookings file:', error);
            return [];
        }
    }

    static saveBookings(newBookings: Booking[]) {
        const existing = this.getBookings();

        // Create a map for deduping based on a unique key
        // Key: date-timeSlot-venueId
        const bookingMap = new Map<string, Booking>();

        // Load existing
        existing.forEach(b => {
            const key = `${b.date}-${b.timeSlot}-${b.venueId}`;
            bookingMap.set(key, b);
        });

        // Merge new (overwrite existing)
        newBookings.forEach(b => {
            const key = `${b.date}-${b.timeSlot}-${b.venueId}`;
            bookingMap.set(key, b);
        });

        const merged = Array.from(bookingMap.values());

        // Sort by date and time
        merged.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.timeSlot.localeCompare(b.timeSlot);
        });

        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(merged, null, 2));
        console.log(`Saved ${merged.length} bookings to cache.`);
    }

    static clearCache() {
        if (fs.existsSync(BOOKINGS_FILE)) {
            fs.unlinkSync(BOOKINGS_FILE);
        }
    }
}
