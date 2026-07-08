precision mediump float;
uniform sampler2D u_sampler;
varying vec3 v_texCoord;
varying vec2 v_quadCoord;
void main() {
    gl_FragColor = texture2D(u_sampler, vec2(v_texCoord[0] + v_quadCoord[0] * v_texCoord[1], 1.0 + v_quadCoord[1] * v_texCoord[2]));
}
