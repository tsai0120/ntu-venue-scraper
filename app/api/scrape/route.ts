import { NextResponse } from 'next/server';
import { Scraper } from '@/lib/scraper';
import { DataProcessor } from '@/lib/processor';
import { DataManager } from '@/lib/data-manager';
import { Booking } from '@/types';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // Date Params
    const year = parseInt(searchParams.get('year') || '2025');
    const month = parseInt(searchParams.get('month') || '11');
    const day = parseInt(searchParams.get('day') || '21');

    // Range Params (Optional)
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Filter Params
    const targetDept = searchParams.get('targetDept') || undefined;
    const filterDepts = searchParams.get('filterDepts')?.split(',') || [];

    // Force refresh param
    const forceRefresh = searchParams.get('refresh') === 'true';

    console.log(`API Request: ${startDateStr ? `Range ${startDateStr} to ${endDateStr}` : `Single Date ${year}/${month}/${day}`}`);

    try {
        let bookings: Booking[] = [];

        if (!forceRefresh) {
            // Try to get from cache first
            const cachedBookings = DataManager.getBookings();

            if (startDateStr && endDateStr) {
                // Filter cached bookings by date range
                bookings = cachedBookings.filter(b => b.date >= startDateStr && b.date <= endDateStr);
                console.log(`Found ${bookings.length} cached bookings for range ${startDateStr} to ${endDateStr}`);
            } else {
                // Filter cached bookings by specific date
                const targetDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                bookings = cachedBookings.filter(b => b.date === targetDateStr);
                console.log(`Found ${bookings.length} cached bookings for date ${targetDateStr}`);
            }
        }

        // If no cached data or force refresh, scrape
        if (bookings.length === 0 || forceRefresh) {
            console.log('Cache miss or force refresh, scraping...');
            const scraper = new Scraper();
            await scraper.init();

            if (startDateStr && endDateStr) {
                bookings = await scraper.fetchDateRange(new Date(startDateStr), new Date(endDateStr));
            } else {
                bookings = await scraper.fetchSchedule(year, month, day);
            }

            await scraper.close();

            // Save to cache
            DataManager.saveBookings(bookings);
            console.log('Saved to cache');
        }

        // Filter Data - REMOVED for client-side filtering
        // We now return ALL bookings so the client can filter instantly
        const filteredBookings = bookings;

        // Process Data
        const stats = DataProcessor.aggregateStats(filteredBookings);
        const suggestions = DataProcessor.generateSwapSuggestions(filteredBookings, targetDept);
        const academicWeek = DataProcessor.getAcademicWeek(bookings[0]?.date || `${year}-${month}-${day}`);

        return NextResponse.json({
            success: true,
            data: filteredBookings,
            stats,
            suggestions,
            academicWeek,
            fromCache: bookings.length > 0 && !forceRefresh
        });
    } catch (error) {
        console.error('Scrape failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
