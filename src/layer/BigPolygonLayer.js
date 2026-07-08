import shaders from '../shader/Shader';
import BigDataLayer from './BigDataLayer';
import PolygonPainter from '../painter/PolygonPainter';
import { BigLineRenderer } from './BigLineLayer';
import rbush from 'rbush';
import { getTargetZoom } from '../painter/Painter';

const options = {
    'blur' : 2
};

export default class BigPolygonLayer extends BigDataLayer {
    identify(coordinate, options) {
        const renderer = this._getRenderer();
        if (!renderer) {
            return null;
        }
        return renderer.identify(coordinate, options);
    }
}

BigPolygonLayer.mergeOptions(options);
BigPolygonLayer.registerJSONType('BigPolygonLayer');

BigPolygonLayer.registerRenderer('webgl', class extends BigLineRenderer {

    onContextCreate() {
        const uniforms = ['u_matrix', 'u_fill_styles[0]'];
        this._polygonProgram = this.createProgram(shaders.polygon.vertexSource, shaders.polygon.fragmentSource, uniforms);
        super.onContextCreate();
    }

    draw() {
        this.prepareCanvas();
        this._drawPolygons();
        this.gl.disable(this.gl.BLEND);
        this._drawLines();
        this.gl.enable(this.gl.BLEND);
        this.completeRender();
    }

    drawOnInteracting() {
        this._drawPolygons();
        this.gl.disable(this.gl.BLEND);
        this._drawLines();
        this.gl.enable(this.gl.BLEND);
        this.completeRender();
    }

    getTexture(symbol) {
        return this.getFillTexture(symbol);
    }

    identify(coordinate, options) {
        // 先调用基类（线）的拾取，再调用多边形的拾取
        const hits = super.identify(coordinate, options) || [];
        if (!this._polyRbush) return hits;

        const map = this.getMap();
        const targetZ = getTargetZoom(map);
        const cp = map.coordinateToPoint(coordinate, targetZ);

        const scale = map.getScale() / map.getScale(targetZ);
        const tolerance = 2 / scale;

        const polyHits = this._polyRbush.search({
            minX: cp.x - tolerance,
            minY: cp.y - tolerance,
            maxX: cp.x + tolerance,
            maxY: cp.y + tolerance
        });

        const added = new Set(hits);
        polyHits.forEach(hit => {
            if (!added.has(hit.data)) {
                added.add(hit.data);
                hits.push(hit.data);
            }
        });
        return hits;
    }

    _drawPolygons() {
        const gl = this.gl,
            program = this._polygonProgram;
        this.useProgram(program);
        this._checkSprites();

        this._preparePolygonData();
        this._bufferPolygonData(this._polygonArrays);

        const m = this.calcMatrices();
        gl.uniformMatrix4fv(gl.program['u_matrix'], false, m);
        gl.uniform1fv(program['u_fill_styles'], this._uFillStyle);
        gl.drawElements(gl.TRIANGLES, this._polygonElementCount, gl.UNSIGNED_INT, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    _preparePolygonData() {
        if (this._polygonArrays) return;

        const gl = this.gl,
            map = this.getMap();

        const data = this.layer.data;
        const painter = new PolygonPainter(gl, map);
        let symbol;
        for (let i = 0, l = data.length; i < l; i++) {
            if (!data[i]) continue;
            if (Array.isArray(data[i])) {
                symbol = this.getDataSymbol(data[i][1]);
                painter.addPolygon(data[i][0], symbol);
            } else if (data[i].type) {
                symbol = this.getDataSymbol(data[i].properties);
                painter.addPolygon(data[i], symbol);
            }
        }

        this._polygonArrays = painter.getArrays();
        this._polygonElementCount = this._polygonArrays.elementArray.length;

        this._polyRbush = new rbush(16);
        this._polyRbush.load(painter.bboxes);
    }

    _bufferPolygonData(polygonArrays) {
        const gl = this.gl;
        const FSIZE = polygonArrays.vertexArray.BYTES_PER_ELEMENT;
        const stride = 3 * FSIZE;

        if (!this._polygonVertexBuffer) {
            const vertexBuffer = this._polygonVertexBuffer = this.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, polygonArrays.vertexArray, gl.STATIC_DRAW);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, this._polygonVertexBuffer);
        }

        const posAttr = gl.getAttribLocation(gl.program, 'a_pos');
        gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(posAttr);

        const styleAttr = gl.getAttribLocation(gl.program, 'a_fill_style');
        if (styleAttr >= 0) {
            gl.vertexAttribPointer(styleAttr, 1, gl.FLOAT, false, stride, 2 * FSIZE);
            gl.enableVertexAttribArray(styleAttr);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        if (!this._polygonElemBuffer) {
            const elementBuffer = this._polygonElemBuffer = this.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, polygonArrays.elementArray, gl.STATIC_DRAW);
        } else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._polygonElemBuffer);
        }
    }

    onRemove() {
        delete this._polygonArrays;
        delete this._polyRbush;
        super.onRemove.apply(this, arguments);
    }
});
