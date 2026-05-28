const fs = require('fs');
const path = require('path');

// Support persistent storage path (e.g. for Railway volumes)
const storageDir = process.env.PERSISTENT_STORAGE_PATH || __dirname;
const STATS_FILE = path.join(storageDir, 'stats.json');

// Ensure storage directory exists
if (storageDir !== __dirname && !fs.existsSync(storageDir)) {
    try {
        fs.mkdirSync(storageDir, { recursive: true });
    } catch (err) {
        console.error(`Error creating storage directory ${storageDir}:`, err);
    }
}

function getInitialStats() {
    return {
        totalAdPlays: 0,
        adPlays: {},
        uniqueVisitors: []
    };
}

function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            const data = fs.readFileSync(STATS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading stats:', err);
    }
    return getInitialStats();
}

function saveStats(stats) {
    try {
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (err) {
        console.error('Error saving stats:', err);
    }
}

function updateAdPlay(stats, adUrl) {
    if (!adUrl) return stats;
    const newStats = { ...stats };
    newStats.totalAdPlays++;
    newStats.adPlays[adUrl] = (newStats.adPlays[adUrl] || 0) + 1;
    return newStats;
}

function addUniqueVisitor(stats, visitorId) {
    if (!visitorId || stats.uniqueVisitors.includes(visitorId)) return stats;
    const newStats = { ...stats };
    newStats.uniqueVisitors = [...newStats.uniqueVisitors, visitorId];
    return newStats;
}

module.exports = {
    loadStats,
    saveStats,
    updateAdPlay,
    addUniqueVisitor,
    getInitialStats
};
