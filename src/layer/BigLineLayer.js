import shaders from '../shader/Shader';
import LinePainter from '../painter/LinePainter';
import BigDataLayer from './BigDataLayer';
import PathRenderer from './renderer/PathRenderer';
import { getTargetZoom } from '../painter/Painter';
import rbush from 'rbush';

const options = {
    'blur' : 2
};

export default class BigLineLayer extends BigDataLayer {
    identify(coordinate, options) {
        const renderer = this._getRenderer();
        if (!renderer) {
            return null;
        }
        return renderer.identify(coordinate, options);
    }
}

BigLineLayer.mergeOptions(options);
BigLineLayer.registerJSONType('BigLineLayer');

export class BigLineRenderer extends PathRenderer {

    onContextCreate() {
        const uniforms = ['u_matrix', 'u_scale', 'u_tex_size', 'u_styles[0]'];
        this._lineProgram = this.createProgram(shaders.line.vertexSource, shaders.line.fragmentSource, uniforms);
        super.onContextCreate();
    }

    draw() {
        this.prepareCanvas();
        this._drawLines();
        this.completeRender();
    }

    drawOnInteracting() {
        this._drawLines();
        this.completeRender();
    }

    onRemove() {
        delete this._lineArrays;
        delete this._rbush;
        super.onRemove.apply(this, arguments);
    }

    getTexture(symbol) {
        return this.getLineTexture(symbol);
    }

    identify(coordinate, options) {
        if (!this._rbush) return null;
        const map = this.getMap();
        const targetZ = getTargetZoom(map);
        const cp = map.coordinateToPoint(coordinate, targetZ);

        const scale = map.getScale() / map.getScale(targetZ);
        const tolerance = 5 / scale;

        const hits = this._rbush.search({
            minX: cp.x - tolerance,
            minY: cp.y - tolerance,
            maxX: cp.x + tolerance,
            maxY: cp.y + tolerance
        });

        const result = [];
        const added = new Set();
        hits.forEach(hit => {
            if (!added.has(hit.data)) {
                added.add(hit.data);
                result.push(hit.data);
            }
        });
        return result;
    }

    _drawLines() {
        const gl = this.gl,
            map = this.getMap(),
            program = this._lineProgram;
        this.useProgram(program);
        this._checkSprites();

        this._prepareLineData();
        this._bufferLineData(this._lineArrays);

        const m = this.calcMatrices();
        gl.uniformMatrix4fv(gl.program.u_matrix, false, m);
        gl.uniform1f(program.u_scale, map.getScale() / map.getScale(getTargetZoom(map)));
        gl.uniform1fv(program.u_styles, this._uStyle);

        let texSize = [0, 0];
        if (this._sprites) {
            texSize = [this._sprites.canvas.width, this._sprites.canvas.height];
        }
        gl.uniform2fv(program.u_tex_size, new Float32Array(texSize));
        gl.drawElements(gl.TRIANGLES, this._elementCount, gl.UNSIGNED_INT, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    _prepareLineData() {
        if (this._lineArrays) return;

        const gl = this.gl,
            map = this.getMap();
        const data = this.layer.data;
        const painter = new LinePainter(gl, map);
        let symbol;
        for (let i = 0, l = data.length; i < l; i++) {
            if (!data[i]) continue;
            if (Array.isArray(data[i])) {
                symbol = this.getDataSymbol(data[i][1]);
                painter.addLine(data[i][0], symbol);
            } else if (data[i].type) {
                symbol = this.getDataSymbol(data[i].properties);
                painter.addLine(data[i], symbol);
            }
        }

        this._lineArrays = painter.getArrays();
        this._elementCount = this._lineArrays.elementArray.length;

        this._rbush = new rbush(16);
        this._rbush.load(painter.bboxes);
    }

    _bufferLineData(lineArrays) {
        const gl = this.gl;
        const FSIZE = lineArrays.vertexArray.BYTES_PER_ELEMENT;
        const stride = 6 * FSIZE;

        if (!this._vertexBuffer) {
            const vertexBuffer = this._vertexBuffer = this.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, lineArrays.vertexArray, gl.STATIC_DRAW);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
        }

        const posAttr = gl.getAttribLocation(gl.program, 'a_pos');
        gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(posAttr);

        const normalAttr = gl.getAttribLocation(gl.program, 'a_normal');
        gl.vertexAttribPointer(normalAttr, 2, gl.FLOAT, false, stride, 2 * FSIZE);
        gl.enableVertexAttribArray(normalAttr);

        const linesofarAttr = gl.getAttribLocation(gl.program, 'a_linesofar');
        gl.vertexAttribPointer(linesofarAttr, 1, gl.FLOAT, false, stride, 4 * FSIZE);
        gl.enableVertexAttribArray(linesofarAttr);

        const styleAttr = gl.getAttribLocation(gl.program, 'a_style');
        gl.vertexAttribPointer(styleAttr, 1, gl.FLOAT, false, stride, 5 * FSIZE);
        gl.enableVertexAttribArray(styleAttr);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        if (!this._elementBuffer) {
            const elementBuffer = this._elementBuffer = this.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lineArrays.elementArray, gl.STATIC_DRAW);
        } else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._elementBuffer);
        }
    }
}

BigLineLayer.registerRenderer('webgl', BigLineRenderer);
