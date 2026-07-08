// marker's 2d point at max zoom
attribute vec4 a_pos;

// texture idx in u_sprite
attribute float a_sprite_idx;

// instanced quad vertices
attribute vec2 a_quad_pos;

uniform mat4 u_matrix;

// scale of current zoom
uniform float u_scale;

// viewport size for clip space pixel mapping
uniform vec2 u_viewportSize;

// sprites, an array of sprites
uniform float u_sprite[maxUniformLength];

varying vec3 v_texCoord;
varying vec2 v_quadCoord;

void main() {
  int idx = int(a_sprite_idx) * 6;
  float size = u_sprite[idx + 3];
  vec2 textOffset = vec2(u_sprite[idx + 4], u_sprite[idx + 5]);

  vec4 pos = vec4(a_pos.x + textOffset.x * u_scale, a_pos.y + textOffset.y * u_scale, a_pos.z, a_pos.w);

  gl_Position = u_matrix * pos;

  vec2 pixelOffset = (a_quad_pos - 0.5) * size;
  // Convert pixel offset to clip space: (pixels / viewport) * 2.0
  vec2 clipOffset = pixelOffset / u_viewportSize * 2.0;
  
  // Y-axis flip in clip space if necessary depending on the engine, 
  // but Maptalks 2D canvas is top-down (0 at top).
  // In WebGL, clip space Y goes UP. So pixelOffset positive Y should go DOWN.
  // Therefore clipOffset.y should be inverted.
  gl_Position.xy += vec2(clipOffset.x, -clipOffset.y) * gl_Position.w;

  // texture coord for fragment
  v_texCoord = vec3(u_sprite[idx], u_sprite[idx + 1], u_sprite[idx + 2]);
  
  // map quad pos [0, 1] to v_quadCoord which is used just like gl_PointCoord
  v_quadCoord = a_quad_pos;
}
