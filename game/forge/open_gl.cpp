#include "forge/open_gl.h"

#include <gl/glew.h>
#include <gl/wglew.h>
#include <gl/gl.h>
#include <algorithm>
#include <map>
#include <memory>
#include <vector>
#include <string>
#include <utility>

#include "forge/indirect_draw.h"
#include "forge/forge.h"
#include "logger/logger.h"

namespace sbat {
namespace forge {

using std::array;
using std::map;
using std::pair;
using std::string;
using std::unique_ptr;
using std::vector;


string OpenGl::last_error_ = "";  // NOLINT

unique_ptr<OpenGl> OpenGl::Create(HWND window, uint32 ddraw_width, uint32 ddraw_height,
    RendererDisplayMode display_mode, bool maintain_aspect_ratio,
    const map<string, pair<string, string>>& shaders) {
  unique_ptr<OpenGl> open_gl(
      new OpenGl(window, ddraw_width, ddraw_height, display_mode, maintain_aspect_ratio, shaders));

  if (open_gl->has_error()) {
    Logger::Log(LogLevel::Error, "IndirectDraw failed to initialize OpenGL");
    last_error_ = open_gl->error();
    Logger::Log(LogLevel::Error, open_gl->error().c_str());
    open_gl.release();
  } else {
    last_error_ = "";
    Logger::Log(LogLevel::Verbose, "IndirectDraw initialized OpenGL successfully");
  }

  return open_gl;
}

string OpenGl::GetLastError() {
  return last_error_;
}

GlContext::GlContext(const WinHdc& dc)
  : context_(wglCreateContext(dc.get())) {
  if (context_ == NULL) {
    return;
  }
  wglMakeCurrent(dc.get(), context_);
}

GlContext::~GlContext() {
  if (!has_error()) {
    wglMakeCurrent(NULL, NULL);
    wglDeleteContext(context_);
  }
}

GlShader::GlShader(GLenum type, const std::string& src)
  : id_(glCreateShader(type)) {
  GLint length = src.length();
  const GLchar* src_cstr = src.c_str();
  glShaderSource(id_, 1, reinterpret_cast<const GLchar**>(&src_cstr), &length);
  glCompileShader(id_);

  GLint shader_ok;
  glGetShaderiv(id_, GL_COMPILE_STATUS, &shader_ok);
  if (!shader_ok) {
    Logger::Log(LogLevel::Error, "OpenGl: compiling shader failed");
    GLint log_length;
    glGetShaderiv(id_, GL_INFO_LOG_LENGTH, &log_length);

    vector<char> log_str(log_length);
    glGetShaderInfoLog(id_, log_length, NULL, log_str.data());
    Logger::Log(LogLevel::Error, log_str.data());
    glDeleteShader(id_);
    id_ = 0;
  }
}

GlShader::~GlShader() {
  if (!has_error()) {
    glDeleteShader(id_);
  }
}

GlVertexShader::GlVertexShader(const std::string& src)
  : GlShader(GL_VERTEX_SHADER, src) {
}

GlVertexShader::~GlVertexShader() {
}

GlFragmentShader::GlFragmentShader(const std::string& src)
  : GlShader(GL_FRAGMENT_SHADER, src) {
}

GlFragmentShader::~GlFragmentShader() {
}

GlShaderProgram::GlShaderProgram(const std::string& vertex_src, const std::string& fragment_src)
  : id_(0),
    vertex_(vertex_src),
    fragment_(fragment_src) {
  if (vertex_.has_error() || fragment_.has_error()) {
    return;
  }

  id_ = glCreateProgram();
  glAttachShader(id_, vertex_.get());
  glAttachShader(id_, fragment_.get());
  glLinkProgram(id_);

  GLint program_ok;
  glGetProgramiv(id_, GL_LINK_STATUS, &program_ok);
  if (!program_ok) {
    Logger::Log(LogLevel::Error, "OpenGl: linking program failed");
    GLint log_length;
    glGetProgramiv(id_, GL_INFO_LOG_LENGTH, &log_length);

    vector<char> log_str(log_length);
    glGetProgramInfoLog(id_, log_length, NULL, log_str.data());
    Logger::Log(LogLevel::Error, log_str.data());
    glDeleteProgram(id_);
    id_ = 0;
  }
}

GlShaderProgram::~GlShaderProgram() {
  if (!has_error()) {
    glDeleteProgram(id_);
  }
}

GlTexture::GlTexture()
  : id_() {
  glGenTextures(1, &id_);
}

GlTexture::~GlTexture() {
  glDeleteTextures(1, &id_);
}

GlTextureBinder::GlTextureBinder(const GlTexture& texture, uint32 active_texture, GLenum bind_target)
  : active_texture_(active_texture),
    bind_target_(bind_target) {
  glActiveTexture(GL_TEXTURE0 + active_texture);
  glBindTexture(GL_TEXTURE_2D, texture.get());
}

GlTextureBinder::~GlTextureBinder() {
  // nothing to do, the only reason/way to unbind textures is glDeleteTextures
}

GlTextureBinder& GlTextureBinder::TexParameteri(GLenum param_name, GLint param) {
  glTexParameteri(bind_target_, param_name, param);
  return *this;
}

GlTextureBinder& GlTextureBinder::TexImage2d(GLint level, GLint internal_format, GLsizei width,
      GLsizei height, GLint border, GLenum format, GLenum type, const GLvoid* data) {
  glTexImage2D(bind_target_, level, internal_format, width, height, border, format, type, data);
  return *this;
}

GlTextureBinder& GlTextureBinder::TexSubImage2d(GLint level, GLint xoffset, GLint yoffset,
    GLsizei width, GLsizei height, GLenum format, GLenum type, const GLvoid* data) {
  glTexSubImage2D(bind_target_, level, xoffset, yoffset, width, height, format, type, data);
  return *this;
}

GlTextureBinder& GlTextureBinder::Uniform1i(GLint location) {
  glUniform1i(location, active_texture_);
  return *this;
}

GlFramebuffer::GlFramebuffer()
  : id_() {
  glGenFramebuffers(1, &id_);
}

GlFramebuffer::~GlFramebuffer() {
  glDeleteFramebuffers(1, &id_);
}

GlFramebufferBinder::GlFramebufferBinder(const GlFramebuffer& framebuffer, GLenum bind_target)
  : bind_target_(bind_target) {
  glBindFramebuffer(bind_target, framebuffer.get());
}

GlFramebufferBinder::~GlFramebufferBinder() {
  glBindFramebuffer(bind_target_, 0);
}

GlFramebufferBinder& GlFramebufferBinder::Texture2d(GLenum attachment, GLenum textarget,
    GLuint texture, GLint level) {
  glFramebufferTexture2D(bind_target_, attachment, textarget, texture, level);
  return *this;
}

GlFramebufferBinder& GlFramebufferBinder::DrawBuffers(GLsizei n, const GLenum* bufs) {
  glDrawBuffers(n, bufs);
  return *this;
}

// Constructing this *can* fail and leave a partially uninitialized object. The assumption is that
// this constructor will only ever be called by the factory method, and the factory method will take
// care of deleting any errored objects instead of returning them higher up, so no methods outside
// of the constructor will need to check for such a state.
OpenGl::OpenGl(HWND window, uint32 ddraw_width, uint32 ddraw_height,
    RendererDisplayMode display_mode, bool maintain_aspect_ratio,
    const map<string, pair<string, string>>& shaders)
  : error_(),
    window_(window),
    dc_(window),
    client_rect_(),
    gl_context_(),
    screen_shader_(),
    fbo_shader_(),
    shader_resources_(),
    ddraw_width_(ddraw_width),
    ddraw_height_(ddraw_height),
    output_rect_(),
    texture_format_(GL_RED),
    palette_texture_(),
    palette_texture_data_(),
    ddraw_texture_(),
    framebuffer_(),
    framebuffer_texture_(),
    vertex_buffer_(),
    element_buffer_(),
    fbo_vertex_buffer_(),
    fbo_element_buffer_(),
    render_skipper_(window) {
  Logger::Log(LogLevel::Verbose, "IndirectDraw initializing OpenGL");
  GetClientRect(window, &client_rect_);

  PIXELFORMATDESCRIPTOR pixel_format = PIXELFORMATDESCRIPTOR();
  pixel_format.nSize = sizeof(pixel_format);
  pixel_format.nVersion = 1;
  pixel_format.dwFlags = PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER;
  pixel_format.iPixelType = PFD_TYPE_RGBA;
  pixel_format.cColorBits = 24;
  pixel_format.cDepthBits = 16;
  int format = ChoosePixelFormat(dc_.get(), &pixel_format);
  SetPixelFormat(dc_.get(), format, &pixel_format);

  gl_context_.reset(new GlContext(dc_));
  if (gl_context_->has_error()) {
    error_ = "Could not initialize OpenGL context";
    return;
  }

  GLenum err = glewInit();
  if (err != GLEW_OK)  {
    Logger::Logf(LogLevel::Error, "GLEW error: %s", glewGetErrorString(err));
    error_ = "Could not initialize GLEW";
    return;
  }
  if (!GLEW_VERSION_3_1) {
    Logger::Log(LogLevel::Error, "OpenGL 3.1 not available");
    error_ = "This computer does not support OpenGL 3.1. Please try a different renderer.";
    return;
  }

  if (!WGLEW_EXT_swap_control) {
    Logger::Log(LogLevel::Warning, "OpenGL does not support swap control, vsync may cause issues");
  } else {
    wglSwapIntervalEXT(0);  // disable vsync, which causes some pretty annoying issues in BW
  }

  output_rect_ = GetOutputSize(display_mode, maintain_aspect_ratio, client_rect_,
      ddraw_width_, ddraw_height_);

  if (!InitShaders(shaders)) {
    return;
  }

  if (!InitTextures()) {
    return;
  }

  if (!InitVertices()) {
    return;
  }
}

bool OpenGl::InitShaders(const map<string, pair<string, string>>& shaders) {
  // TODO(tec27): make a more generic shader manager instead of finding these keys by literal
  if (shaders.count("depalettizing") != 0) {
    const pair<string, string> shader_pair = shaders.at("depalettizing");
    screen_shader_.reset(new GlShaderProgram(shader_pair.first, shader_pair.second));
  } else {
    error_ = "No depalettizing shader found";
    return false;
  }
  if (shaders.count("scaling") != 0) {
    const pair<string, string> shader_pair = shaders.at("scaling");
    fbo_shader_.reset(new GlShaderProgram(shader_pair.first, shader_pair.second));
  } else {
    error_ = "No scaling shader found";
    return false;
  }

  if (screen_shader_->has_error() || fbo_shader_->has_error()) {
    error_ = "Could not build shaders";
    return false;
  }

  shader_resources_.uniforms.bw_screen = screen_shader_->GetUniformLocation("bw_screen");
  shader_resources_.uniforms.palette = screen_shader_->GetUniformLocation("palette");
  shader_resources_.attributes.position = screen_shader_->GetAttribLocation("position");
  shader_resources_.attributes.texpos = screen_shader_->GetAttribLocation("texpos");
  shader_resources_.uniforms.rendered_texture = fbo_shader_->GetUniformLocation("rendered_texture");

  return true;
}

bool OpenGl::InitTextures() {
  palette_texture_.reset(new GlTexture());
  {
    GlTextureBinder binder(*palette_texture_, 0, GL_TEXTURE_2D);
    binder
        .TexParameteri(GL_TEXTURE_MIN_FILTER, GL_NEAREST)
        .TexParameteri(GL_TEXTURE_MAG_FILTER, GL_NEAREST)
        .TexParameteri(GL_TEXTURE_BASE_LEVEL, 0)
        .TexParameteri(GL_TEXTURE_MAX_LEVEL, 0)
        .TexParameteri(GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE)
        .TexParameteri(GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
  }

  // Texture that BW's rendered data will be placed in
  ddraw_texture_.reset(new GlTexture());
  {
    GlTextureBinder binder(*ddraw_texture_, 0, GL_TEXTURE_2D);
    binder
        .TexParameteri(GL_TEXTURE_MIN_FILTER, GL_NEAREST)
        .TexParameteri(GL_TEXTURE_MAG_FILTER, GL_NEAREST)
        .TexParameteri(GL_TEXTURE_BASE_LEVEL, 0)
        .TexParameteri(GL_TEXTURE_MAX_LEVEL, 0)
        .TexParameteri(GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE)
        .TexParameteri(GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE)
        .TexImage2d(0, GL_R8, ddraw_width_, ddraw_height_, 0,
            texture_format_, GL_UNSIGNED_BYTE, NULL);
  }

  // Framebuffer that gets rendered to in order to convert from palletized -> RGB
  framebuffer_.reset(new GlFramebuffer());
  framebuffer_texture_.reset(new GlTexture());
  {
    GlFramebufferBinder framebuffer_binder(*framebuffer_, GL_FRAMEBUFFER);
    GlTextureBinder texture_binder(*framebuffer_texture_, 0, GL_TEXTURE_2D);
    texture_binder
        .TexParameteri(GL_TEXTURE_MAG_FILTER, GL_LINEAR)
        .TexParameteri(GL_TEXTURE_MIN_FILTER, GL_LINEAR)
        .TexParameteri(GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE)
        .TexParameteri(GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE)
        .TexImage2d(0, GL_RGB, ddraw_width_, ddraw_height_, 0, GL_RGB, GL_UNSIGNED_BYTE,
            NULL);

    GLenum draw_buffers[1] = { GL_COLOR_ATTACHMENT0 };
    framebuffer_binder
        .Texture2d(GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, framebuffer_texture_->get(), 0)
        .DrawBuffers(1, draw_buffers);

    if (framebuffer_binder.CheckStatus() != GL_FRAMEBUFFER_COMPLETE) {
      error_ = "Could not initialize framebuffer";
      return false;
    }
  }

  return true;
}

bool OpenGl::InitVertices() {
  // X, Y, U, V -- this flips the texture vertically so it matches the orientation of DDraw surfaces
  const array<GLfloat, 16> vertex_data =
      { -1.0f, -1.0f, 0.0f, 1.0f,
        1.0f, -1.0f, 1.0f, 1.0f,
        -1.0f, 1.0f, 0.0f, 0.0f,
        1.0f, 1.0f, 1.0f, 0.0f };
  vertex_buffer_.reset(new GlStaticBuffer<GLfloat, 16>(GL_ARRAY_BUFFER, vertex_data));
  const array<GLushort, 4> element_data = { 0, 1, 2, 3 };
  element_buffer_.reset(new GlStaticBuffer<GLushort, 4>(GL_ELEMENT_ARRAY_BUFFER, element_data));

  const array<GLfloat, 16> fbo_vertex_data =
      { -1.0f, -1.0f, 0.0f, 0.0f,
        1.0f, -1.0f, 1.0f, 0.0f,
        -1.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f };
  fbo_vertex_buffer_.reset(new GlStaticBuffer<GLfloat, 16>(GL_ARRAY_BUFFER, fbo_vertex_data));
  const array<GLushort, 4> fbo_element_data = { 0, 1, 2, 3 };
  fbo_element_buffer_.reset(new GlStaticBuffer<GLushort, 4>(GL_ELEMENT_ARRAY_BUFFER,
      fbo_element_data));

  return true;
}

OpenGl::~OpenGl() {
}

void OpenGl::SwapBuffers() {
  ::SwapBuffers(dc_.get());
}

void OpenGl::UpdatePalette(const IndirectDrawPalette& palette) {
  std::transform(palette.entries().begin(), palette.entries().end(), palette_texture_data_.begin(),
      ConvertToPaletteTextureEntry);

  GlTextureBinder palette_binder(*palette_texture_, 10, GL_TEXTURE_2D);
  palette_binder.TexImage2d(0, GL_RGBA8, palette.entries().size(), 1, 0, GL_BGRA,
      GL_UNSIGNED_BYTE, &palette_texture_data_[0]);
}

void OpenGl::Render(const vector<byte>& surface_data) {
  if (render_skipper_.ShouldSkipRender()) {
    return;
  }

  if (DIRECTDRAWLOG) {
    Logger::Log(LogLevel::Verbose, "OpenGl rendering");
  }

  CopyDdrawSurface(surface_data);
  if (DIRECTDRAWLOG) {
    Logger::Log(LogLevel::Verbose, "OpenGl rendering - after ddraw texture copied");
  }
  ConvertToFullColor();
  if (DIRECTDRAWLOG) {
    Logger::Log(LogLevel::Verbose, "OpenGl rendering - after converted to full color");
  }
  RenderToScreen();
  SwapBuffers();

  render_skipper_.UpdateLastFrameTime();
  if (DIRECTDRAWLOG) {
    Logger::Log(LogLevel::Verbose, "OpenGl rendering completed");
  }
}

void OpenGl::CopyDdrawSurface(const vector<byte>& surface_data) {
  GlTextureBinder binder(*ddraw_texture_, 0, GL_TEXTURE_2D);
  binder.TexSubImage2d(0, 0, 0, ddraw_width_, ddraw_height_, texture_format_, GL_UNSIGNED_BYTE,
      &surface_data[0]);
}

void OpenGl::ConvertToFullColor() {
  // Converts from 8-bit palette -> RGB by doing a palette lookup and rendering to an FBO texture
  const ShaderResources* resources = &shader_resources_;
  GlFramebufferBinder fb_binder(*framebuffer_, GL_FRAMEBUFFER);
  glViewport(0, 0, ddraw_width_, ddraw_height_);

  screen_shader_->Use();

  // Draw from the ddraw texture to the FBO texture (8-bit palette -> RGB)
  GlTextureBinder tex_binder(*ddraw_texture_, 0, GL_TEXTURE_2D);
  tex_binder.Uniform1i(resources->uniforms.bw_screen);
  GlTextureBinder palette_binder(*palette_texture_, 10, GL_TEXTURE_2D);
  palette_binder.Uniform1i(resources->uniforms.palette);

  glBindBuffer(GL_ARRAY_BUFFER, vertex_buffer_->buffer());
  glEnableVertexAttribArray(resources->attributes.position);
  glVertexAttribPointer(resources->attributes.position, 2, GL_FLOAT, GL_FALSE,
      sizeof(GLfloat) * 4, reinterpret_cast<void*>(0));
  glEnableVertexAttribArray(resources->attributes.texpos);
  glVertexAttribPointer(resources->attributes.texpos, 2, GL_FLOAT, GL_TRUE, sizeof(GLfloat) * 4,
      reinterpret_cast<void*>(sizeof(GLfloat) * 2));
  glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, element_buffer_->buffer());
  glDrawElements(GL_TRIANGLE_STRIP, 4, GL_UNSIGNED_SHORT, reinterpret_cast<void*>(0));

  glDisableVertexAttribArray(resources->attributes.texpos);
  glDisableVertexAttribArray(resources->attributes.position);
}

void OpenGl::RenderToScreen() {
  // Render from the framebuffer to the actual screen
  const ShaderResources* resources = &shader_resources_;
  glViewport(output_rect_.left, output_rect_.top,
      output_rect_.right - output_rect_.left, output_rect_.bottom - output_rect_.top);

  fbo_shader_->Use();

  GlTextureBinder binder(*framebuffer_texture_, 1, GL_TEXTURE_2D);
  binder.Uniform1i(resources->uniforms.rendered_texture);

  glBindBuffer(GL_ARRAY_BUFFER, fbo_vertex_buffer_->buffer());
  glEnableVertexAttribArray(0);
  glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, sizeof(GLfloat) * 4,
    reinterpret_cast<void*>(0));
  glEnableVertexAttribArray(1);
  glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, sizeof(GLfloat) * 4,
    reinterpret_cast<void*>(sizeof(GLfloat) * 2));
  glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, fbo_element_buffer_->buffer());
  glDrawElements(GL_TRIANGLE_STRIP, 4, GL_UNSIGNED_SHORT, reinterpret_cast<void*>(0));

  glDisableVertexAttribArray(0);
}

}  // namespace forge
}  // namespace sbat