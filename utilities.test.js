const { updateAdPlay, addUniqueVisitor, getInitialStats } = require('./utilities');

describe('Stats Utilities', () => {
    let stats;

    beforeEach(() => {
        stats = getInitialStats();
    });

    describe('updateAdPlay', () => {
        it('should increment totalAdPlays and update adPlays map', () => {
            const adUrl = 'https://example.com';
            const newStats = updateAdPlay(stats, adUrl);
            
            expect(newStats.totalAdPlays).toBe(1);
            expect(newStats.adPlays[adUrl]).toBe(1);
        });

        it('should increment counts for existing ads', () => {
            const adUrl = 'https://example.com';
            let currentStats = updateAdPlay(stats, adUrl);
            currentStats = updateAdPlay(currentStats, adUrl);
            
            expect(currentStats.totalAdPlays).toBe(2);
            expect(currentStats.adPlays[adUrl]).toBe(2);
        });

        it('should handle null/undefined adUrl', () => {
            const newStats = updateAdPlay(stats, null);
            expect(newStats).toEqual(stats);
        });
    });

    describe('addUniqueVisitor', () => {
        it('should add a new visitor ID', () => {
            const visitorId = 'v123';
            const newStats = addUniqueVisitor(stats, visitorId);
            
            expect(newStats.uniqueVisitors).toContain(visitorId);
            expect(newStats.uniqueVisitors.length).toBe(1);
        });

        it('should not add the same visitor ID twice', () => {
            const visitorId = 'v123';
            let currentStats = addUniqueVisitor(stats, visitorId);
            currentStats = addUniqueVisitor(currentStats, visitorId);
            
            expect(currentStats.uniqueVisitors.length).toBe(1);
        });

        it('should handle null/undefined visitorId', () => {
            const newStats = addUniqueVisitor(stats, null);
            expect(newStats).toEqual(stats);
        });
    });
});
