import shaders from '../shader/Shader';
import ExtrudePainter from '../painter/ExtrudePainter';
import BigDataLayer from './BigDataLayer';
import PathRenderer from './renderer/PathRenderer';
import { vec3 } from '@mapbox/gl-matrix';
import { getTargetZoom } from '../painter/Painter';
import rbush from 'rbush';

const options = {
    'lightPos' : [10, 0, 35],
    'lightColor' : [1, 1, 1],
    'lightIntensity' : 0.5,
    'ambientLight' : [0.02, 0.02, 0.02]
};

export default class ExtrudePolygonLayer extends BigDataLayer {
    identify(coordinate, options) {
        const renderer = this._getRenderer();
        if (!renderer) {
            return null;
        }
        return renderer.identify(coordinate, options);
    }
}

ExtrudePolygonLayer.mergeOptions(options);
ExtrudePolygonLayer.registerJSONType('ExtrudePolygonLayer');

export class ExtrudeRenderer extends PathRenderer {

    onContextCreate() {
        const uniforms = ['u_matrix', 'u_fill_styles[0]', 'u_lightcolor', 'u_lightpos', 'u_ambientlight', 'u_lightintensity'];
        this.program = this.createProgram(shaders.extrude.vertexSource, shaders.extrude.fragmentSource, uniforms);
        super.onContextCreate();
        const gl = this.gl;
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.disable(gl.STENCIL_TEST);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    }

    draw() {
        this.prepareCanvas();
        this._drawExtrudes();
        this.completeRender();
    }

    drawOnInteracting() {
        this._drawExtrudes();
        this.completeRender();
    }

    onRemove() {
        delete this._extrudeArrays;
        delete this._extrudeRbush;
        super.onRemove.apply(this, arguments);
    }

    getTexture(symbol) {
        return this.getFillTexture(symbol);
    }

    identify(coordinate, options) {
        if (!this._extrudeRbush) return null;

        const map = this.getMap();
        const targetZ = getTargetZoom(map);
        const cp = map.coordinateToPoint(coordinate, targetZ);

        const scale = map.getScale() / map.getScale(targetZ);
        const tolerance = 2 / scale;

        const hits = this._extrudeRbush.search({
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

    _drawExtrudes() {
        const gl = this.gl,
            program = this.program;
        this.useProgram(program);
        this._checkSprites();

        this._prepareData();
        const m = this.calcMatrices();
        gl.uniformMatrix4fv(gl.program['u_matrix'], false, m);
        gl.uniform1fv(program['u_fill_styles'], this._uFillStyle);

        const lightpos = this.layer.options['lightPos'] || [0, 0, 35];
        gl.uniform3fv(gl.program['u_lightpos'], vec3.normalize([], lightpos));

        const lightColor = this.layer.options['lightColor'] || [1, 1, 1];
        gl.uniform3f(gl.program['u_lightcolor'], lightColor[0], lightColor[1], lightColor[2]);

        const ambient = this.layer.options['ambientLight'] || [0.02, 0.02, 0.02];
        gl.uniform3f(gl.program['u_ambientlight'], ambient[0], ambient[1], ambient[2]);

        const lightIntensity = this.layer.options['lightIntensity'] || 0.5;
        gl.uniform1f(gl.program['u_lightintensity'], lightIntensity);

        this._bufferExtrudeData(this._extrudeArrays);
        gl.drawElements(gl.TRIANGLES, this._elementCount, gl.UNSIGNED_INT, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    _prepareData() {
        if (this._extrudeArrays) {
            return;
        }
        const gl = this.gl,
            map = this.getMap();
        const targetZ = getTargetZoom(map);
        const data = this.layer.data;
        const painter = new ExtrudePainter(gl, map);
        for (let i = 0, l = data.length; i < l; i++) {
            if (!data[i]) continue;
            if (Array.isArray(data[i])) {
                const symbol = this.getDataSymbol(data[i][1]);
                const height = data[i][1]['height'];
                const pHeight = map.distanceToPixel(height, 0, targetZ).width;
                painter.addPolygon(data[i][0], pHeight, symbol);
            } else if (data[i].type) {
                const symbol = this.getDataSymbol(data[i].properties);
                const height = data[i].properties['height'];
                const pHeight = map.distanceToPixel(height, 0, targetZ).width;
                painter.addPolygon(data[i], pHeight, symbol);
            }
        }
        this._extrudeArrays = painter.getArrays();
        this._elementCount = this._extrudeArrays.elementArray.length;

        this._extrudeRbush = new rbush(16);
        this._extrudeRbush.load(painter.bboxes);
    }

    _bufferExtrudeData(extrudeArrays) {
        const gl = this.gl;
        const FSIZE = extrudeArrays.vertexArray.BYTES_PER_ELEMENT;
        const stride = 7 * FSIZE;

        if (!this._vertexBuffer) {
            const vertexBuffer = this._vertexBuffer = this.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, extrudeArrays.vertexArray, gl.STATIC_DRAW);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
        }

        const posAttr = gl.getAttribLocation(gl.program, 'a_pos');
        gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(posAttr);

        const normalAttr = gl.getAttribLocation(gl.program, 'a_normal');
        if (normalAttr >= 0) {
            gl.vertexAttribPointer(normalAttr, 3, gl.FLOAT, false, stride, 3 * FSIZE);
            gl.enableVertexAttribArray(normalAttr);
        }

        const styleAttr = gl.getAttribLocation(gl.program, 'a_fill_style');
        if (styleAttr >= 0) {
            gl.vertexAttribPointer(styleAttr, 1, gl.FLOAT, false, stride, 6 * FSIZE);
            gl.enableVertexAttribArray(styleAttr);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        if (!this._elementBuffer) {
            const elementBuffer = this._elementBuffer = this.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, extrudeArrays.elementArray, gl.STATIC_DRAW);
        } else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._elementBuffer);
        }
    }
}

ExtrudePolygonLayer.registerRenderer('webgl', ExtrudeRenderer);
