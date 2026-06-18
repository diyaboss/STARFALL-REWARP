const config = require('../../config');
const adjustForBoundaries = (position, radius, borderOffset, gameWidth, gameHeight) => {
    // Starfall v19: no hard world wall. Players can continue moving past the old map edge.
    // The client warns them and Warp Drive helps them return to active lanes.
    return position;
};

module.exports = {
    adjustForBoundaries
};