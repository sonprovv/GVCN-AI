// One HTTP adapter for the entire frontend. It never reads/writes backend JSON files.
export async function api(route, { method = 'GET', body } = {}) {
  const response = await fetch(route, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store'
  });
  let payload;
  try { payload = await response.json(); } catch { throw new Error(`API trả về dữ liệu không hợp lệ (${response.status})`); }
  if (!response.ok) throw new Error(payload.error?.message || `Lỗi HTTP ${response.status}`);
  return payload.data ?? payload;
}
export const withClass = (route, classId) => `${route}${route.includes('?') ? '&' : '?'}classId=${encodeURIComponent(classId)}`;
