function projectToPoint(c, res, origin) {
    var r = 6378137;
    var max = 85.0511287798;
    var px = c.x * Math.PI / 180 * r;
    var lat = Math.max(Math.min(max, c.y), -max) * Math.PI / 180;
    var py = r * Math.log(Math.tan(Math.PI / 4 + lat / 2));
    
    return {
        x: (px - origin[0]) / res,
        y: (origin[1] - py) / res
    };
}

const res = 152.8740565703525; // approx zoom 10
const origin = [-20037508.34, 20037508.34];

console.log('Projected:', projectToPoint({x: 116.4, y: 39.9}, res, origin));
