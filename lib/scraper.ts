import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import { Booking } from '../types';

const NTU_USER = 'B080075';
const NTU_PASS = 'b080075';
const LOGIN_URL = 'https://rent.pe.ntu.edu.tw/venues/?K=89'; // Redirects to login usually

export class Scraper {
    private browser: Browser | null = null;
    private page: Page | null = null;

    async init() {
        this.browser = await puppeteer.launch({
            headless: false, // Headful for debugging/visual confirmation
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1280, height: 800 });
    }

    async goToMultiView() {
        if (!this.page) await this.init();
        if (!this.page) throw new Error('Browser not initialized');

        console.log('Navigating to venue page...');
        await this.page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });

        // 1. Click "場地時段"
        const scheduleTabFound = await this.page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(el => el.textContent?.includes('場地時段'));
            if (target) {
                target.click();
                return true;
            }
            return false;
        });
        if (!scheduleTabFound) throw new Error('Schedule tab not found');
        await new Promise(r => setTimeout(r, 1000));

        // 2. Click "多面" (Multi-view)
        const multiViewFound = await this.page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, button, input[type="button"], span'));
            const target = elements.find(el => el.textContent?.includes('多面'));
            if (target) {
                (target as HTMLElement).click();
                return true;
            }
            return false;
        });
        if (!multiViewFound) throw new Error('Multi-view button not found');
        console.log('Switched to Multi-view...');
        await new Promise(r => setTimeout(r, 3000)); // Wait for view reload
    }

    async selectDate(year: number, month: number, day: number) {
        if (!this.page) throw new Error('Page not initialized');

        // Pad month and day with zeros: 12/03 not 12/3
        const paddedMonth = month.toString().padStart(2, '0');
        const paddedDay = day.toString().padStart(2, '0');
        const dateStr = `${paddedMonth} / ${paddedDay}`; // Format: "12 / 03"

        console.log(`Attempting to select date: ${dateStr}`);

        // Determine if we need to navigate backward or forward
        const today = new Date();
        const targetDate = new Date(year, month - 1, day);
        const navigateBackward = targetDate < today;

        let found = false;
        let attempts = 0;
        const maxAttempts = 20; // Increased to handle longer ranges

        while (!found && attempts < maxAttempts) {
            // Check if date is visible
            const dateClicked = await this.page.evaluate((targetDateStr) => {
                const links = Array.from(document.querySelectorAll('a.DTSMenu'));
                // The text might contain spaces like "12 / 03 ( 五 )"
                const target = links.find(el => el.textContent?.replace(/\s/g, '').includes(targetDateStr.replace(/\s/g, '')));
                if (target) {
                    (target as HTMLElement).click();
                    return true;
                }
                return false;
            }, dateStr);

            if (dateClicked) {
                found = true;
                console.log(`Selected date: ${dateStr}`);
                await new Promise(r => setTimeout(r, 3000)); // Wait for schedule reload
            } else {
                // Date not found, navigate in the appropriate direction
                const direction = navigateBackward ? 'Left' : 'Right';
                console.log(`Date not found, clicking ${direction}...`);

                const navClicked = await this.page.evaluate((dir) => {
                    const navBtn = document.querySelector(`.ShowScheduleBtn.${dir}`);
                    if (navBtn) {
                        (navBtn as HTMLElement).click();
                        return true;
                    }
                    return false;
                }, direction);

                if (!navClicked) {
                    console.warn(`${direction} button not found or not clickable.`);
                    break;
                }
                await new Promise(r => setTimeout(r, 2000)); // Wait for menu slide
                attempts++;
            }
        }

        if (!found) {
            throw new Error(`Could not find date ${dateStr} after ${attempts} attempts.`);
        }
    }

    async parseGrid(year: number, month: number, day: number): Promise<Booking[]> {
        if (!this.page) throw new Error('Page not initialized');

        const content = await this.page.content();
        const $ = cheerio.load(content);
        const bookings: Booking[] = [];

        // Get Venue Names
        const venues: string[] = [];
        $('.HVenuesMain').children().each((i, el) => {
            venues.push($(el).text().trim());
        });
        console.log('Found venues:', venues);

        // Construct target date string (YYYY-MM-DD)
        const targetDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        console.log(`Filtering columns for date: ${targetDateStr}`);

        // Determine Day of Week (0=Sun, 1=Mon, ..., 6=Sat)
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Parse SContents (Columns of Time Slots)
        // Structure: .SContents -> div (Venue Column) -> div (Time Slot Cell)
        // Filter by 'd' attribute
        const columns = $('.SContents').children().filter((i, el) => $(el).attr('d') === targetDateStr);

        if (columns.length === 0) {
            console.warn(`No columns found for date ${targetDateStr}. Available dates:`,
                $('.SContents').children().map((i, el) => $(el).attr('d')).get().filter((v, i, a) => a.indexOf(v) === i)
            );
        }

        columns.each((colIndex, colEl) => {
            // The columns are sorted by venue. 
            // We assume the filtered columns correspond to the venues in order.
            // Or we can use 'vs' attribute if we knew the mapping.
            // For now, map index to venues array.
            const venueName = venues[colIndex] || `Venue ${colIndex + 1}`;

            $(colEl).children().each((rowIndex, cellEl) => {
                const cellText = $(cellEl).text().trim(); // e.g. "18 ~ 19全校運動會radio_button_checked"

                // Extract Time Range: "18 ~ 19"
                const timeMatch = cellText.match(/(\d{1,2})\s*~\s*(\d{1,2})/);

                if (timeMatch) {
                    const startHour = parseInt(timeMatch[1], 10);
                    const endHour = parseInt(timeMatch[2], 10);
                    const timeSlot = `${startHour}:00`;

                    // Filter Logic:
                    // Weekdays: Only 18:00 - 22:00 (Start hour 18, 19, 20, 21)
                    // Weekends: All day
                    if (!isWeekend) {
                        if (startHour < 18 || startHour >= 22) return;
                    }

                    // Extract Booking Info
                    // Remove the time range from text
                    let bookingInfo = cellText.replace(timeMatch[0], '').trim();
                    // Remove "radio_button_checked" or similar UI text
                    bookingInfo = bookingInfo.replace(/radio_button_checked/g, '').trim();

                    if (bookingInfo && bookingInfo !== '可預約' && bookingInfo !== '已過期') {
                        let department = bookingInfo;
                        let booker = '';
                        let status = 'Booked';

                        if (bookingInfo.includes('/')) {
                            const parts = bookingInfo.split('/');
                            department = parts[0].trim();
                            booker = parts[1]?.trim() || '';
                        }

                        // Clean up department name (remove brackets etc if needed)
                        department = department.replace(/\(.*\)/, '').trim();

                        bookings.push({
                            venueId: venueName,
                            date: targetDateStr,
                            timeSlot,
                            department,
                            booker,
                            status
                        });
                    }
                }
            });
        });

        return bookings;
    }

    async fetchSchedule(year: number, month: number, day: number): Promise<Booking[]> {
        await this.goToMultiView();
        await this.selectDate(year, month, day);
        return await this.parseGrid(year, month, day);
    }

    async fetchDateRange(startDate: Date, endDate: Date): Promise<Booking[]> {
        await this.goToMultiView();

        const allBookings: Booking[] = [];
        const current = new Date(startDate);

        while (current <= endDate) {
            const y = current.getFullYear();
            const m = current.getMonth() + 1;
            const d = current.getDate();

            try {
                await this.selectDate(y, m, d);
                const bookings = await this.parseGrid(y, m, d);
                allBookings.push(...bookings);
            } catch (e) {
                console.error(`Failed to scrape ${y}/${m}/${d}:`, e);
            }

            // Next day
            current.setDate(current.getDate() + 1);
        }

        return allBookings;
    }

    async debugMultiView() {
        if (!this.page) await this.init();
        if (!this.page) throw new Error('Browser not initialized');

        console.log('Navigating to venue page...');
        await this.page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });

        // Click "場地時段"
        const scheduleTabFound = await this.page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(el => el.textContent?.includes('場地時段'));
            if (target) {
                target.click();
                return true;
            }
            return false;
        });

        if (!scheduleTabFound) throw new Error('Schedule tab not found');
        console.log('Clicked Venue Schedule tab...');
        await new Promise(r => setTimeout(r, 2000));

        // Find and click "多面"
        const multiViewFound = await this.page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a, button, input[type="button"], span'));
            const target = elements.find(el => el.textContent?.includes('多面'));
            if (target) {
                (target as HTMLElement).click();
                return true;
            }
            return false;
        });

        if (multiViewFound) {
            console.log('Clicked "多面" (Multi-view)...');
            await new Promise(r => setTimeout(r, 5000)); // Wait for reload

            const content = await this.page.content();
            fs.writeFileSync('multi_view_debug.html', content);
            console.log('Saved multi-view HTML to multi_view_debug.html');

            const $ = cheerio.load(content);

            console.log('--- Multi-view HTML Structure ---');
            // Check for date headers or similar
            const potentialDates: string[] = [];
            $('a, span, div').each((i, el) => {
                const text = $(el).text().trim();
                if (text.match(/\d+\/\d+\s*\(\s*.\s*\)/)) { // Match 11/21 ( 五 )
                    potentialDates.push(`Tag: ${el.tagName}, Text: ${text}, Class: ${$(el).attr('class')}`);
                }
            });
            console.log('Potential Date Elements:', potentialDates.slice(0, 10));

            // Log table structure
            const tables = $('table');
            console.log(`Found ${tables.length} tables.`);
            tables.each((i, table) => {
                console.log(`Table ${i} rows: ${$(table).find('tr').length}`);
                // Log first few rows
                $(table).find('tr').slice(0, 3).each((j, row) => {
                    console.log(`Table ${i} Row ${j}:`, $(row).text().replace(/\s+/g, ' ').trim());
                });
            });

        } else {
            console.log('Could not find "多面" button.');
            // Log all buttons to see what's available
            const buttons = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('a, button, input[type="button"]'))
                    .map(el => el.textContent?.trim())
                    .filter(t => t && t.length > 0);
            });
            console.log('Available buttons:', buttons);
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}
