import { Scraper } from './lib/scraper';

async function test() {
    const scraper = new Scraper();
    try {
        console.log('Initializing scraper...');
        await scraper.init();
        // console.log('Logging in...');
        // await scraper.login(); // Login not required

        console.log('Fetching schedule for range 11/21 - 11/23...');
        const startDate = new Date(2025, 10, 21); // Month is 0-indexed
        const endDate = new Date(2025, 10, 23);

        const bookings = await scraper.fetchDateRange(startDate, endDate);

        console.log(`Found ${bookings.length} bookings.`);
        bookings.forEach(b => {
            console.log(`[${b.venueId}] ${b.timeSlot}: ${b.department} (${b.booker})`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await scraper.close();
    }
}

test();
