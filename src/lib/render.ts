/**
 * Kinesynth · Canvas2D 렌더러 (원리 뷰)
 *
 * 어두운 배경 + 밝은 점·선·면. 물질(색·질감)은 v0.2 이후 — 지금은 원리만 보인다.
 * 월드 좌표는 카메라(space 레벨 채널)를 거쳐 화면에 놓인다. 카메라가 기본값이면 항등 변환.
 *
 * 선 굵기는 화면 기준으로 고정한다: 경로는 카메라 변환 아래에서 만들고,
 * 그리기 직전에 변환을 화면 기준으로 되돌린다 (Canvas 경로는 만들 때 좌표가 확정된다).
 *
 * core/·cores/와 달리 이 파일은 DOM(Canvas2D)에 의존한다. 순수성 규칙은 코어 쪽에만 적용된다.
 */

import type { Camera, Entity, Vec, World } from './core/types';

export const BG = '#0a0c11';
const STROKE = '#dce7ff';
const FILL = 'rgba(120, 170, 255, 0.13)';
const GROUND = 'rgba(220, 231, 255, 0.16)';
const TRAIL = 'rgba(150, 190, 255, 0.34)';
const DOT_R = 3.2;
const GLOW_LIMIT = 60; // 엔티티가 이보다 많으면 글로우를 끈다 (성능)

export interface DrawOpts {
	/** 엔진이 기록한 궤적. 없으면 트레일을 그리지 않는다. */
	trails?: Vec[][];
	groundY?: number;
}

/** 캔버스를 CSS 크기 × devicePixelRatio로 맞춘다. 크기가 바뀌었으면 true. */
export function fitCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): boolean {
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const w = Math.max(1, Math.round(cssW * dpr));
	const h = Math.max(1, Math.round(cssH * dpr));
	if (canvas.width === w && canvas.height === h) return false;
	canvas.width = w;
	canvas.height = h;
	return true;
}

/** 월드 → 화면. 카메라가 바라보는 지점이 화면 중앙에 온다. */
function setWorld(
	ctx: CanvasRenderingContext2D,
	dpr: number,
	cam: Camera,
	cssW: number,
	cssH: number
): void {
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.translate(cssW / 2, cssH / 2);
	ctx.scale(cam.zoom, cam.zoom);
	ctx.rotate(cam.rot);
	ctx.translate(-cam.x, -cam.y);
}

const setScreen = (ctx: CanvasRenderingContext2D, dpr: number) =>
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

/**
 * 궤적을 균일 알파의 폴리라인으로 — 점이 선이 되는 순간.
 * jump보다 먼 이동(토러스 랩어라운드)은 선을 끊는다.
 */
function traceTrails(ctx: CanvasRenderingContext2D, trails: Vec[][], jump: number): void {
	for (const h of trails) {
		if (h.length < 2) continue;
		ctx.moveTo(h[0].x, h[0].y);
		for (let i = 1; i < h.length; i++) {
			const dx = h[i].x - h[i - 1].x;
			const dy = h[i].y - h[i - 1].y;
			if (Math.abs(dx) > jump || Math.abs(dy) > jump) ctx.moveTo(h[i].x, h[i].y);
			else ctx.lineTo(h[i].x, h[i].y);
		}
	}
}

function traceEntity(ctx: CanvasRenderingContext2D, e: Entity): void {
	ctx.save();
	ctx.translate(e.pos.x, e.pos.y);
	ctx.rotate(e.rot);
	ctx.scale(e.scale.x, e.scale.y);
	ctx.moveTo(e.points[0].x, e.points[0].y);
	for (let i = 1; i < e.points.length; i++) ctx.lineTo(e.points[i].x, e.points[i].y);
	if (e.closed) ctx.closePath();
	ctx.restore();
}

export function drawWorld(
	ctx: CanvasRenderingContext2D,
	w: World,
	cssW: number,
	cssH: number,
	opts: DrawOpts
): void {
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const cam = w.camera;

	setScreen(ctx, dpr);
	ctx.fillStyle = BG;
	ctx.fillRect(0, 0, cssW, cssH);

	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	if (opts.groundY !== undefined) {
		const span = Math.max(cssW, cssH) * 4;
		setWorld(ctx, dpr, cam, cssW, cssH);
		ctx.beginPath();
		ctx.moveTo(-span, opts.groundY);
		ctx.lineTo(span, opts.groundY);
		setScreen(ctx, dpr);
		ctx.strokeStyle = GROUND;
		ctx.lineWidth = 1;
		ctx.stroke();
	}

	if (opts.trails?.length) {
		setWorld(ctx, dpr, cam, cssW, cssH);
		ctx.beginPath();
		traceTrails(ctx, opts.trails, Math.min(w.bounds.w, w.bounds.h) * 0.5);
		setScreen(ctx, dpr);
		ctx.strokeStyle = TRAIL;
		ctx.lineWidth = 1.4;
		ctx.stroke();
	}

	const glow = w.entities.length <= GLOW_LIMIT;
	if (glow) {
		ctx.shadowColor = 'rgba(150, 190, 255, 0.55)';
		ctx.shadowBlur = 10;
	}

	// 점은 한 경로에 모아 한 번에 칠한다 — 수백 개여도 드로우 콜은 하나.
	// 반지름은 월드 단위라 줌을 따라 커진다: 확대하면 구조가 실제로 드러난다.
	let dots = 0;
	setWorld(ctx, dpr, cam, cssW, cssH);
	ctx.beginPath();
	for (const e of w.entities) {
		if (e.points.length >= 2) continue;
		ctx.moveTo(e.pos.x + DOT_R, e.pos.y);
		ctx.arc(e.pos.x, e.pos.y, DOT_R, 0, Math.PI * 2);
		dots++;
	}
	if (dots > 0) {
		ctx.fillStyle = STROKE;
		ctx.fill();
	}

	for (const e of w.entities) {
		if (e.points.length < 2) continue;
		setWorld(ctx, dpr, cam, cssW, cssH);
		ctx.beginPath();
		traceEntity(ctx, e);
		setScreen(ctx, dpr);
		if (e.closed) {
			ctx.fillStyle = FILL; // 면 — 옅은 채움
			ctx.fill();
		}
		ctx.strokeStyle = STROKE;
		ctx.lineWidth = 1.8;
		ctx.stroke(); // 선 · 면의 윤곽
	}

	ctx.shadowBlur = 0;
	setScreen(ctx, dpr);
}
