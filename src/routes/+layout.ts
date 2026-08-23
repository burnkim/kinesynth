// 서버 로직이 없는 클라이언트 전용 앱 — 통째로 정적으로 굽는다.
// Vercel에서 서버리스 함수 없이 CDN에서 바로 서빙된다.
export const prerender = true;
