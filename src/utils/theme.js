// 🌑 MOON NEXUS THEME DEFINITION
module.exports = {
    // 🎨 Color Palette
    COLORS: {
        PRIMARY: '#E3E4E6',   // Soft Silver (Moonlight)
        SECONDARY: '#2B2D31', // Deep Space (Background)
        ACCENT: '#00F3FF',    // Cyan/Electric Blue (Tech/Energy)
        ERROR: '#FF3E3E',     // Red Eclipse (Critical)
        SUCCESS: '#00FF9D',   // Green Orbit (Success)
        WARNING: '#FFD700',   // Solar Flare (Warning)
        GRAVITY: '#111214'    // Darker than Space (Footers/Borders)
    },

    // 🖼️ Icons & Assets
    ICONS: {
        MOON_FULL: 'https://cdn-icons-png.flaticon.com/512/11529/11529141.png', // HD Moon Render
        MOON_CRESCENT: 'https://cdn-icons-png.flaticon.com/512/3594/3594273.png',
        SATELLITE: '🛰️',
        HAMMER: '🔨',
        SHIELD: '🛡️',
        CHECK: '✅',
        CROSS: '❌'
    },

    // 🎞️ Animation Frames (Moon Phases)
    // Used for "Thinking" or "Loading" states
    ANIMATIONS: {
        LOADING: [
            '🌑 Initiating Sequence...',
            '🌒 Calibrating Sensors...',
            '🌓 Synchronizing Orbit...',
            '🌔 Receiving Transmission...',
            '🌕 Data Acquired.'
        ],
        SEARCHING: [
            '🔍 Scanning Sector 1...',
            '📡 Pinging Satellites...',
            '🔭 Locking Target...'
        ],
        EXECUTING_BAN: [
            '⚖️ Judging Soul...',
            '🔨 Charging Heavy Cannon...',
            '💥 Ejecting from Atmosphere...'
        ]
    },

    // 📝 Standardized Footers
    FOOTER: {
        text: 'Sovereign Nexus • Lunar Operations',
        iconURL: 'https://cdn-icons-png.flaticon.com/512/11529/11529141.png'
    }
};
