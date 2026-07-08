import * as maptalks from 'maptalks';
import Painter from './Painter';
import earcut from 'earcut';
import { getTargetZoom } from './Painter';
import DynamicBuffer from './Buffer';

const options = {
    'project' : true
};

export default class PolygonPainter extends Painter {
    constructor(gl, map, options) {
        super(gl, map, options);
        this.buffer = new DynamicBuffer();
        this._vertexCount = 0;
        this.bboxes = [];
    }

    getArrays() {
        return this.buffer.getArrays();
    }

    addPolygon(polygon, style) {
        if (!polygon) {
            return this;
        }
        if (style.symbol['polygonOpacity'] <= 0) {
            return this;
        }

        const vertice = this._getVertice(polygon);

        if (vertice[0] && Array.isArray(vertice[0][0]) && Array.isArray(vertice[0][0][0])) {
            for (let i = 0, l = vertice.length; i < l; i++) {
                this.addPolygon(vertice[i], style);
            }
            return this;
        }
        vertice.forEach(ring => {
            if (!ring.length) {
                return;
            }
            if (!this._equalCoord(ring[0], ring[ring.length - 1])) {
                ring.push(ring[0], ring[1]);
            }
        });
        const targetZ = getTargetZoom(this.map);
        const data = earcut.flatten(vertice);

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        if (this.options['project']) {
            const v = [];
            let c;
            for (let i = 0, l = data.vertices.length; i < l; i += 2) {
                c = this.map.coordinateToPoint(new maptalks.Coordinate(data.vertices[i], data.vertices[i + 1]), targetZ);
                if (c.x < minX) minX = c.x;
                if (c.y < minY) minY = c.y;
                if (c.x > maxX) maxX = c.x;
                if (c.y > maxY) maxY = c.y;
                v.push(c.x, c.y);
            }
            data.vertices = v;
        }

        let triangles = earcut(data.vertices, data.holes, 2);
        if (triangles.length <= 2) {
            return this;
        }
        const deviation = earcut.deviation(data.vertices, data.holes, 2, triangles);
        if (Math.round(deviation * 1E3) / 1E3 !== 0) {
            if (console) {
                console.warn('Failed triangluation.');
            }
            return this;
        }

        if (minX !== Infinity) {
            this.bboxes.push({
                minX: minX,
                minY: minY,
                maxX: maxX,
                maxY: maxY,
                data: polygon
            });
        }

        const styleValue = this._computeStyleValue(style);
        const count = this._vertexCount;

        if (count > 0) {
            triangles = triangles.map(e => e + count);
        }

        // Push interleaved vertices: [x, y, style]
        for (let i = 0; i < data.vertices.length; i += 2) {
            this.buffer.pushVertex(data.vertices[i], data.vertices[i + 1], styleValue);
            this._vertexCount++;
        }

        // Push elements
        this.buffer.pushElementArray(triangles);

        return this;
    }

    _getVertice(geo) {
        if (geo.geometry) {
            geo = geo.geometry.coordinates;
        } else if (geo.coordinates) {
            geo = geo.coordinates;
        }
        return geo;
    }

    _computeStyleValue(style) {
        return style.index * 100 + (style.symbol['polygonOpacity'] || 1) * 10;
    }

    _equalCoord(c1, c2) {
        return c1[0] === c2[0] && c1[1] === c2[1];
    }
}

PolygonPainter.mergeOptions(options);
