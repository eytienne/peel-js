<script lang="ts">
	import { Peel, PeelCorners } from "peel.js";
	import "peel.js/style"
	import "./demo.css"
	import "./page.css"
	import { onMount } from "svelte";
	import { Tween } from "svelte/motion";
	import { quadInOut, sineIn, sineOut } from "svelte/easing";
	import { on } from "svelte/events";
	import { base } from "$app/paths";

	onMount(()=> {
		const offs = Array.from(
				document.querySelectorAll<HTMLDivElement>(".tap-me")
			).map(el => on(el, "click", function({ currentTarget }) {
				currentTarget.classList.add("tapped");
			}));

		{
			const p = new Peel('#intro-peel', {
				corner: [170, 170],
				backReflection: true,
				backReflectionAlpha: .3,
				fadeThreshold: 0.9,
				circle: {
					cx: 100,
					cy: 100,
					r: 97
				}
			});
			p.setPeelPath(170, 170, 130, 130, -179, 180, -180, -26);
			const tween = new Tween(0, { duration: 1200, easing: quadInOut });

			let visible = $state(true);
			const observer = new IntersectionObserver((e) => {
				visible = e[0].isIntersecting;
			});
			observer.observe(p.el);

			let clicked = $state(false);
			let hovered = $state(false);
			p.el.addEventListener("mouseenter", () => {
				hovered = true;
			});
			p.el.addEventListener("mouseleave", () => {
				hovered = false;
			});

			const aLittle = 0.07;
			const onHoverOptions: TweenedOptions<number> = {
				duration: 350,
			};
			$effect(() => {
				if (!visible || clicked) return;
				if (hovered) {
					tween.set(aLittle*2, onHoverOptions);
				} else {
					tween.set(0, onHoverOptions);
				}
			});
			$effect(() => {
				if (!visible || clicked || hovered) return;
				const { current } = tween;
				if (current === aLittle) {
					tween.set(0);
				} else if (current === 0) {
					tween.set(aLittle);
				}
			});
			$effect(() => {
				p.setTimeAlongPath(tween.current);
			});
			p.handle("press", function() {
				p.removeDragListeners();
				tween.set(1, {
					duration: 1500,
					easing: sineIn,
				});
				clicked = true;
			});
		}
		{
			const p = new Peel('#simple');
			p.setPeelPosition(80, 120);
		}
		{
			const p = new Peel('#top-left', {
				corner: PeelCorners.TOP_LEFT
			});
			p.setPeelPosition(80, 70);
		}
		{
			const p = new Peel('#shadows', {
				topShadow: false,
				backShadowSize: .12,
				bottomShadowDarkAlpha: 1,
				bottomShadowLightAlpha: .4,
			});
			p.setPeelPosition(150, 0);
		}
		{
			const p = new Peel('#reflection', {
			backReflection: true,
			backReflectionAlpha: .3
			});
			p.setPeelPosition(150, 0);
		}
		{
			const p = new Peel('#circle', {
				circle: {
					cx: 100,
					cy: 100,
					r: 100
				}
			});
			p.setPeelPosition(100, 80);
		}
		{
			const p = new Peel('#heart', {
				path: {
					d: 'M101.260605,31.4241113 C122.403839,-11.2687842 173.108983,1.11145064 183.007355,11.8447551 C237.311569,70.7295532 142.521446,119.347653 101.260608,174.571349 C51.8099036,119.347653 -39.0680406,68.307428 18.4502396,11.8447553 C33.183089,-2.61770866 77.7850024,-11.2687842 101.260605,31.4241113 Z'
				}
			});
			p.setPeelPosition(150, 0);
		}
		{
			const p = new Peel('#dragging');
			p.handle("drag", function(evt, x, y) {
				p.setPeelPosition(x, y);
			});
		}
		{
			const p = new Peel('#heart-drag', {
				path: {
				d: 'M101.260605,31.4241113 C122.403839,-11.2687842 173.108983,1.11145064 183.007355,11.8447551 C237.311569,70.7295532 142.521446,119.347653 101.260608,174.571349 C51.8099036,119.347653 -39.0680406,68.307428 18.4502396,11.8447553 C33.183089,-2.61770866 77.7850024,-11.2687842 101.260605,31.4241113 Z'
				}
			});
			p.corner = p.getPoint(101, 175);
			p.handle("drag", function(evt, x, y) {
				p.setPeelPosition(x, y);
			});
		}
		{
			const p = new Peel('#constraint');
			p.addPeelConstraint(PeelCorners.BOTTOM_LEFT);
			p.handle("drag", function(evt, x, y) {
				p.setPeelPosition(x, y);
			});
		}
		{
			const p = new Peel('#book');
			p.applyPreset('book');
			p.handle("drag", function(evt, x, y) {
				p.setPeelPosition(x, y);
			});
		}
		{
			const p = new Peel('#fade', {
				fadeThreshold: 0.9
			});
			p.handle("drag", function(evt, x, y) {
				p.setPeelPosition(x, y);
			});
		}
		{
			const p = new Peel('#fade-out', {
				fadeThreshold: 0.9
			});
			p.handle("drag", function(evt, x, y) {
				p.setPeelPosition(x, y);
				if (p.getAmountClipped() === 1) {
					p.removeDragListeners();
				}
			});
		}
		{
			const p = new Peel('#peel-path');
			p.setPeelPath(200, 200, -200, -200);
			p.handle("drag", function(evt, x, y) {
			const t = (x - p.width) / -p.width;
				p.setTimeAlongPath(t);
			});
		}
		{
			const p = new Peel('#peel-curve');
			p.applyPreset('book');
			p.setPeelPath(130, 160, 50, 60, -70, 210, -130, 160);
			p.handle("drag", function(evt, x, y) {
			const t = (x - p.width) / (-p.width * 2);
				p.setTimeAlongPath(t);
			});
		}
		{
			const p = new Peel('#peel-press');
			p.applyPreset('book');
			p.setPeelPath(130, 160, 50, 60, -70, 210, -130, 160);
			const tween = new Tween(0, {
				easing: sineOut,
				duration: 1500,
			});
			$effect(() => {
				p.setTimeAlongPath(tween.current);
			});
			p.handle("press", function(evt) {
				if (tween.current > .5) {
					tween.set(0);
				} else {
					tween.set(1);
				}
			});
		}
		{
			const p = new Peel('#peel-fade-path', {
				fadeThreshold: 0.7,
			});
			p.setPeelPosition(170, 170);
			p.setPeelPath(170, 170, 50, 170, 0, 0, 170, -170);
			const tween = new Tween(0, {
				easing: sineIn,
				duration: 1500,
			});
			$effect(() => {
				p.setTimeAlongPath(tween.current);
			});
			p.handle("press", function(evt) {
				if (tween.current < 1) {
					tween.set(1);
				} else {
					tween.set(0, { duration: 0 });
				}
			});
		}

		return offs;
	});
</script>

<header class="bg-stone-500 w-full">
	<section id="api" class="max-w-6xl mx-auto flex justify-end py-1">
		<a href="{base}/api/index.html" class="py-1 px-3 mr-17 text-lg font-bold tracking-wider font-['Roboto_Slab'] rounded-md bg-yellow-100 hover:underline">API</a>
	</section>
</header>
<main class="max-w-6xl mx-auto px-4">
	<section id="intro" class="text-justify max-w-[40em] mx-auto">
		<div id="intro-peel" class="peel">
			<div class="peel-top">
				<h1>
					Peel.js
				</h1>
			</div>
			<div class="peel-back"></div>
			<div class="peel-bottom">
				<p>Dynamic peel effects with only HTML/CSS!</p>
			</div>
		</div>
		<p>Currently supported by all browsers that support CSS clip paths and transforms (generally most evergreen browsers including mobile, but excluding IE). No dependencies.</p>
	</section>
	<section id="static-examples">
		<h2>Static Examples</h2>
		<div class="demos">
			<div>
				<h3>Simple</h3>
				<p>
					Simplest possible example. 3 elements define the 3 layers used. A constructor sets up the effect, and a call to setPeelPosition tells it where to peel back to:
				</p>
				<div id="simple" class="peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Corner</h3>
				<p>
					Any corner can be used for the peel effect:
				</p>
				<div id="top-left" class="yellow peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Shadows</h3>
				<p>
					The shadow effects can be controlled through various options to the constructor (options listed below):
				</p>
				<div id="shadows" class="purple peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Reflection</h3>
				<p>
					Adding a back reflection gives the peel a shiny effect. Reflection strength can be controller in the constructor options (see below):
				</p>
				<div id="reflection" class="azure peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Circle</h3>
				<p>
					SVG shapes can also be used for clipping effects:
				</p>
				<div id="circle" class="aqua peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Path</h3>
				<p>
					More complex shapes such as paths can create custom shapes:
				</p>
				<div id="heart" class="heart peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
		</div>
	</section>
	<section id="dynamic-examples">
		<h2>Dynamic Examples</h2>
		<div class="demos">
			<div>
				<h3>Dragging</h3>
				<p>
					Allowing the user to drag the effect by mouse or touch.
				</p>
				<div id="dragging" class="azure peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Dragging Heart</h3>
				<p>
					Dragging works on custom shapes as well. Note that the corner point can be set anywhere, allowing the effect to precisely follow the mouse cursor.
				</p>
				<div id="heart-drag" class="heart peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Constraining</h3>
				<p>
					The peeling effect can be constrained at any point. This can be thought of as a point on the layers that are connected and cannot be torn apart:
				</p>
				<div id="constraint" class="yellow peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Page turning effect</h3>
				<p>
					Any number of corners can be constrained. Most often this is used to create a book-like effect, which there is a shortcut for:
				</p>
				<div id="book" class="book peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Fade threshold</h3>
				<p>
					The top layer can be faded out past a threshold which represents the clipped area of the top layer.
				</p>
				<div id="fade" class="plum peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Fading out</h3>
				<p>
					Using the <span class="code">getAmountClipped</span> method gives you greater control over behavior, such as stopping the effect after the top layer has been removed.
				</p>
				<div id="fade-out" class="purple peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Setting a peel path</h3>
				<p>
					Sometimes you want the peel animation to follow an exact path rather than being unrestricted. The <span class="code">setPeelPath</span> and <span class="code">setTimeAlongPath</span> methods can accomplish this.
				</p>
				<div id="peel-path" class="aqua peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Peel path as a bezier curve</h3>
				<p>
					Sometimes you want the peel animation to follow an exact path rather than being unrestricted. The <span class="code">setPeelPath</span> and <span class="code">setTimeAlongPath</span> methods can accomplish this.
				</p>
				<div id="peel-curve" class="book peel">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Animating a peel path</h3>
				<p>
					Since the peel path can be set simply with values between 0 and 1, that means that any animation library can tween those values to give a nice animated effect using <span class="code">setTimeAlongPath</span>.
				</p>
				<div id="peel-press" class="book peel tap-me">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
			<div>
				<h3>Fading a peel path</h3>
				<p>
					If you use <span class="code">setFadeThreshold</span> with a peel path, the threshold will be along the peel path instead of using the calculated area of the clipping effect.
				</p>
				<div id="peel-fade-path" class="azure peel tap-me">
					<div class="peel-top">Top</div>
					<div class="peel-back">Back</div>
					<div class="peel-bottom">Bottom</div>
				</div>
			</div>
		</div>
	</section>
</main>