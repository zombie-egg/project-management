/**
 * 统一响应格式
 */
function ok(res, data = null, message = 'success') {
  return res.json({ code: 0, message, data });
}

function fail(res, message = 'error', code = 400, httpStatus) {
  return res.status(httpStatus || (code >= 400 && code < 600 ? code : 400)).json({ code, message, data: null });
}

module.exports = { ok, fail };
