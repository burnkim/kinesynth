/**
 * Kinesynth · Canvas2D 렌더러 (원리 뷰)
 *
 * 어두운 배경 + 밝은 점·선·면. 물질(색·질감)은 v0.2 이후 — 지금은 원리만 보인다.
 * core/·cores/와 달리 이 파일은 DOM(Canvas2D)에 의존한다. 순수성 규칙은 코어 쪽에만 적용된다.
 */

import type { Entity, Vec, World } from './core/types';

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

function tracePath(ctx: CanvasRenderingContext2D, e: Entity): void {
	ctx.save();
	ctx.translate(e.pos.x, e.pos.y);
	ctx.rotate(e.rot);
	ctx.scale(e.scale.x, e.scale.y);
	ctx.beginPath();
	ctx.moveTo(e.points[0].x, e.points[0].y);
	for (let i = 1; i < e.points.length; i++) ctx.lineTo(e.points[i].x, e.points[i].y);
	if (e.closed) ctx.closePath();
	// 경로는 만들 때 좌표가 확정되므로, 변환을 되돌린 뒤 그려야 선 굵기가 찌그러지지 않는다.
	ctx.restore();
}

/**
 * 궤적을 균일 알파의 폴리라인으로 — 점이 선이 되는 순간.
 * jump보다 먼 이동(토러스 랩어라운드)은 선을 끊는다.
 */
function drawTrails(ctx: CanvasRenderingContext2D, trails: Vec[][], jump: number): void {
	ctx.strokeStyle = TRAIL;
	ctx.lineWidth = 1.4;
	for (const h of trails) {
		if (h.length < 2) continue;
		ctx.beginPath();
		ctx.moveTo(h[0].x, h[0].y);
		for (let i = 1; i < h.length; i++) {
			const dx = h[i].x - h[i - 1].x;
			const dy = h[i].y - h[i - 1].y;
			if (Math.abs(dx) > jump || Math.abs(dy) > jump) ctx.moveTo(h[i].x, h[i].y);
			else ctx.lineTo(h[i].x, h[i].y);
		}
		ctx.stroke();
	}
}

export function drawWorld(
	ctx: CanvasRenderingContext2D,
	w: World,
	cssW: number,
	cssH: number,
	opts: DrawOpts
): void {
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	ctx.fillStyle = BG;
	ctx.fillRect(0, 0, cssW, cssH);

	if (opts.groundY !== undefined) {
		ctx.strokeStyle = GROUND;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, opts.groundY + 0.5);
		ctx.lineTo(cssW, opts.groundY + 0.5);
		ctx.stroke();
	}

	if (opts.trails?.length) drawTrails(ctx, opts.trails, Math.min(cssW, cssH) * 0.5);

	const glow = w.entities.length <= GLOW_LIMIT;
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	ctx.strokeStyle = STROKE;
	ctx.fillStyle = STROKE;
	if (glow) {
		ctx.shadowColor = 'rgba(150, 190, 255, 0.55)';
		ctx.shadowBlur = 10;
	}

	for (const e of w.entities) {
		if (e.points.length < 2) {
			// 점 — 변환의 영향을 받지 않는 화면 좌표 도트
			ctx.beginPath();
			ctx.arc(e.pos.x, e.pos.y, DOT_R, 0, Math.PI * 2);
			ctx.fill();
			continue;
		}
		tracePath(ctx, e);
		if (e.closed) {
			ctx.fillStyle = FILL; // 면 — 옅은 채움
			ctx.fill();
			ctx.fillStyle = STROKE;
		}
		ctx.lineWidth = 1.8;
		ctx.stroke(); // 선 · 면의 윤곽
	}

	ctx.shadowBlur = 0;
}
