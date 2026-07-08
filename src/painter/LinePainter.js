import * as maptalks from 'maptalks';
import Painter from './Painter';
import Point from '@mapbox/point-geometry';
import { getTargetZoom } from './Painter';
import DynamicBuffer from './Buffer';

const options = {
    'project' : true
};

export default class LinePainter extends Painter {

    constructor(gl, map, options) {
        super(gl, map, options);
        this.buffer = new DynamicBuffer();
        this._vertexCount = 0;
        this.distance = 0;

        // 用于空间索引
        this.bboxes = [];
    }

    getArrays() {
        return this.buffer.getArrays();
    }

    addLine(line, style) {
        if (!line) {
            return this;
        }
        if (style.symbol['lineWidth'] <= 0 || style.symbol['lineOpacity'] <= 0) {
            return this;
        }

        const vertice = this._getVertice(line);

        if (vertice[0] && Array.isArray(vertice[0][0])) {
            for (let i = 0, l = vertice.length; i < l; i++) {
                this.addLine(vertice[i], style);
            }
            return this;
        }

        this._prepareToAdd();
        this._currentStyleValue = this._computeStyleValue(style);

        const targetZ = getTargetZoom(this.map);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        let currentVertex, nextVertex;
        for (let i = 0, l = vertice.length; i < l; i++) {
            let vertex = vertice[i];
            if (this.options['project']) {
                vertex = this.map.coordinateToPoint(new maptalks.Coordinate(vertex), targetZ).toArray();
            }
            currentVertex = Point.convert(vertex);

            // 更新 BBox
            if (currentVertex.x < minX) minX = currentVertex.x;
            if (currentVertex.y < minY) minY = currentVertex.y;
            if (currentVertex.x > maxX) maxX = currentVertex.x;
            if (currentVertex.y > maxY) maxY = currentVertex.y;

            if (i < l - 1) {
                let nv = vertice[i + 1];
                if (this.options['project']) {
                    nv = this.map.coordinateToPoint(new maptalks.Coordinate(nv), targetZ).toArray();
                }
                nextVertex = Point.convert(nv);
            } else {
                nextVertex = null;
            }
            this.addCurrentVertex(currentVertex, nextVertex);
        }

        if (minX !== Infinity) {
            this.bboxes.push({
                minX: minX,
                minY: minY,
                maxX: maxX,
                maxY: maxY,
                data: line
            });
        }
        return this;
    }

    addCurrentVertex(currentVertex, nextVertex) {
        if (!this.preVertex) {
            this.e1 = this.e2 = this.e3 = -1;
            this._waitForLeftCap = true;
            this.preVertex = currentVertex;
            return;
        }

        const normal = currentVertex.sub(this.preVertex)._unit()._perp()._mult(-1);
        let nextNormal;
        if (nextVertex) {
            nextNormal = nextVertex.sub(currentVertex)._unit()._perp()._mult(-1);
        }

        const preJoinNormal = this._getStartNormal(normal, this.preNormal);

        this._addLineEndVertexs(this.preVertex, preJoinNormal, this.distance);
        this.distance += currentVertex.dist(this.preVertex);

        if (!nextVertex) {
            const endNormal = this._getEndNormal(normal, nextNormal);
            this._addLineEndVertexs(currentVertex, endNormal, this.distance);
        }

        this.preNormal = normal;
        this.preVertex = currentVertex;
    }

    _prepareToAdd() {
        this.distance = 0;
        delete this.preVertex;
        delete this.preNormal;
    }

    _addLineEndVertexs(vertex, joinNormal, linesofar) {
        let extrude = joinNormal.normal[0];
        this.e3 = this._addVertex(vertex, extrude, linesofar);
        if (this.e1 >= 0 && this.e2 >= 0) {
            this.buffer.pushElement(this.e1, this.e2, this.e3);
        }
        this.e1 = this.e2;
        this.e2 = this.e3;

        extrude = joinNormal.normal[1];
        this.e3 = this._addVertex(vertex, extrude, linesofar);
        if (this.e1 >= 0 && this.e2 >= 0) {
            this.buffer.pushElement(this.e1, this.e2, this.e3);
        }
        this.e1 = this.e2;
        this.e2 = this.e3;
    }

    _addVertex(currentVertex, normal, linesofar) {
        this.buffer.pushVertex(
            currentVertex.x,
            currentVertex.y,
            this._precise(normal.x),
            this._precise(normal.y),
            linesofar,
            this._currentStyleValue
        );
        return this._vertexCount++;
    }

    _getVertice(line) {
        if (line.geometry) {
            line = line.geometry.coordinates;
        } else if (line.coordinates) {
            line = line.coordinates;
        }
        return line;
    }

    _computeStyleValue(style) {
        let v = (style.symbol['lineWidth'] || 2) / 2 * 100 + (style.symbol['lineOpacity'] || 1) * 10;
        v = v * 10000 + style.index;
        return v;
    }

    _getStartNormal(normal, preNormal) {
        return this._getJoinNormal(normal, preNormal, normal);
    }

    _getEndNormal(normal, nextNormal) {
        return this._getJoinNormal(normal, normal, nextNormal);
    }

    _getJoinNormal(currentNormal, preNormal, normal) {
        if (!preNormal || !normal) {
            return {
                'normal' : [currentNormal, currentNormal.mult(-1)]
            };
        }
        const joinNormal = preNormal.add(normal)._unit();
        const cosHalfAngle = joinNormal.x * normal.x + joinNormal.y * normal.y;
        const miterLength = 1 / cosHalfAngle;
        joinNormal._mult(miterLength);
        return {
            'normal' : [joinNormal, joinNormal.mult(-1)]
        };
    }

    _precise(f) {
        return Math.round(f * 1E7) / 1E7;
    }
}

LinePainter.mergeOptions(options);
