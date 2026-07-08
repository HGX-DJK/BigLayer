import * as maptalks from 'maptalks';
import Painter from './Painter';
import earcut from 'earcut';
import Point from '@mapbox/point-geometry';
import { getTargetZoom } from './Painter';
import DynamicBuffer from './Buffer';

const options = {
    'project' : true
};

export default class ExtrudePainter extends Painter {
    constructor(gl, map, options) {
        super(gl, map, options);
        this.buffer = new DynamicBuffer();
        this._vertexCount = 0;
        this.bboxes = [];
    }

    getArrays() {
        return this.buffer.getArrays();
    }

    addPolygon(polygon, height, style) {
        if (!polygon) {
            return this;
        }
        if (style.symbol['polygonOpacity'] <= 0) {
            return this;
        }

        const vertice = this._getVertice(polygon);

        if (vertice[0] && Array.isArray(vertice[0][0]) && Array.isArray(vertice[0][0][0])) {
            for (let i = 0, l = vertice.length; i < l; i++) {
                this.addPolygon(vertice[i], height, style);
            }
            return this;
        }

        this._fillArrays(vertice, height, style);

        // Compute bounding box for spatial index (2D projection)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const targetZ = getTargetZoom(this.map);
        const flat = earcut.flatten(vertice).vertices;
        for (let i = 0, l = flat.length; i < l; i += 2) {
            const c = this.options['project'] ?
                this.map.coordinateToPoint(new maptalks.Coordinate(flat[i], flat[i + 1]), targetZ) :
                {x: flat[i], y: flat[i+1]};
            if (c.x < minX) minX = c.x;
            if (c.y < minY) minY = c.y;
            if (c.x > maxX) maxX = c.x;
            if (c.y > maxY) maxY = c.y;
        }
        if (minX !== Infinity) {
            this.bboxes.push({
                minX: minX, minY: minY, maxX: maxX, maxY: maxY,
                data: polygon
            });
        }
        return this;
    }

    _fillArrays(vertice, height, style) {
        const targetZ = getTargetZoom(this.map);
        const data = earcut.flatten(vertice);

        const bottom = [];
        const top = [];
        let c;
        for (let i = 0, l = data.vertices.length; i < l; i += 2) {
            if (i === l - 2) {
                if (this._equalCoord([data.vertices[i], data.vertices[i + 1]], [data.vertices[0], data.vertices[1]])) {
                    continue;
                }
            }
            if (this.options['project']) {
                c = this.map.coordinateToPoint(new maptalks.Coordinate(data.vertices[i], data.vertices[i + 1]), targetZ);
                bottom.push(c.x, c.y, 0);
                top.push(c.x, c.y, height);
            } else {
                bottom.push(data.vertices[i], data.vertices[i + 1], 0);
                top.push(data.vertices[i], data.vertices[i + 1], height);
            }
        }

        data.vertices = bottom;
        const triangles = earcut(data.vertices, data.holes, 3);
        if (triangles.length <= 2) {
            return;
        }
        const deviation = earcut.deviation(data.vertices, data.holes, 3, triangles);
        if (Math.round(deviation * 1E3) / 1E3 !== 0) {
            if (console) console.warn('Failed triangluation.');
            return;
        }

        const count = bottom.length / 3;
        const styleValue = style.index * 100 + (style.symbol['polygonOpacity'] || 1) * 10;

        // push bottom vertices (normal: 0, 0, -1)
        for (let i = 0; i < count; i++) {
            this.buffer.pushVertex(bottom[i * 3], bottom[i * 3 + 1], bottom[i * 3 + 2], 0, 0, -1, styleValue);
        }
        const bottomTriangles = triangles.map(e => e + this._vertexCount);
        this.buffer.pushElementArray(bottomTriangles);
        this._vertexCount += count;

        // push top vertices (normal: 0, 0, 1)
        for (let i = 0; i < count; i++) {
            this.buffer.pushVertex(top[i * 3], top[i * 3 + 1], top[i * 3 + 2], 0, 0, 1, styleValue);
        }
        const topTriangles = triangles.map(e => e + this._vertexCount);
        this.buffer.pushElementArray(topTriangles);
        this._vertexCount += count;

        // push wall vertices
        for (let i = 0, l = count; i < l - 1; i++) {
            const ii = i * 3;
            const normal = new Point(bottom[ii + 3], bottom[ii + 4]).sub(new Point(bottom[ii], bottom[ii + 1]))._unit()._perp();

            const vOffset = this._vertexCount;
            this.buffer.pushVertex(bottom[ii], bottom[ii + 1], bottom[ii + 2], normal.x, normal.y, 0, styleValue);
            this.buffer.pushVertex(bottom[ii + 3], bottom[ii + 4], bottom[ii + 5], normal.x, normal.y, 0, styleValue);
            this.buffer.pushVertex(top[ii + 3], top[ii + 4], top[ii + 5], normal.x, normal.y, 0, styleValue);
            this.buffer.pushVertex(top[ii], top[ii + 1], top[ii + 2], normal.x, normal.y, 0, styleValue);
            this._vertexCount += 4;

            this.buffer.pushElement(vOffset, vOffset + 1, vOffset + 2);
            this.buffer.pushElement(vOffset, vOffset + 2, vOffset + 3);
        }
    }

    _getVertice(geo) {
        if (geo.geometry) {
            geo = geo.geometry.coordinates;
        } else if (geo.coordinates) {
            geo = geo.coordinates;
        }
        return geo;
    }

    _equalCoord(c1, c2) {
        return c1[0] === c2[0] && c1[1] === c2[1];
    }
}

ExtrudePainter.mergeOptions(options);
