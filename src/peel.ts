import type { TupleOf } from "type-fest";

const PRECISION = 1e2; // 2 decimals
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// General helpers

const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

const clamp = (n: number) => Math.max(0, Math.min(1, n));

function normalize(n: number, min: number, max: number) {
  return (n - min) / (max - min);
}

// Distributes a number between 0 and 1 along a bell curve.
function distribute(t: number, mult: any) {
  return (mult || 1) * 2 * (.5 - Math.abs(t - .5));
}

function prefix(str: string) {
  return 'peel-' + str;
}

// CSS Helper
function setTransform(el: HTMLElement, t) {
  el.style.transform = t;
}

function setBoxShadow(el: HTMLElement, x: number, y: number, blur: number, spread: number | null, alpha: number) {
  el.style.boxShadow = getShadowCss(x, y, blur, spread, alpha);
}

function setDropShadow(el: HTMLElement, x: number, y: number, blur: number, alpha: number) {
  el.style.filter = 'drop-shadow(' + getShadowCss(x, y, blur, null, alpha) + ')';
}

function getShadowCss(x: number, y: number, blur: number, spread: number | null, alpha: number) {
  return round(x) + 'px ' +
          round(y) + 'px ' +
          round(blur) + 'px ' +
          (spread ? round(spread) + 'px ' : '') +
          'rgba(0,0,0,' + round(alpha) + ')';
}

function setOpacity(el, t) {
  el.style.opacity = t;
}

function setBackgroundGradient(el, rotation, stops) {
  var css;
  if (stops.length === 0) {
    css = 'none';
  } else {
    css = 'linear-gradient(' + round(rotation) + 'deg,' + stops.join(',') + ')';
  }
  el.style.backgroundImage = css;
}

// Event Helpers

function getEventCoordinates(evt: MouseEvent|TouchEvent, el: HTMLElement) {
  const pos = evt instanceof TouchEvent ? evt.changedTouches[0] : evt;
  return {
    'x': pos.clientX - el.offsetLeft + window.scrollX,
    'y': pos.clientY - el.offsetTop + window.scrollY
  };
}

// Color Helpers

function getBlackStop(a, pos) {
  return getColorStop(0, 0, 0, a, pos);
}

function getWhiteStop(a, pos) {
  return getColorStop(255, 255, 255, a, pos);
}

function getColorStop(r, g, b, a, pos) {
  a = round(clamp(a));
  return 'rgba('+ r +','+ g +','+ b +','+ a +') ' + round(pos * 100) + '%';
}


// DOM Element Helpers

function createElement(parent, className) {
  var el = document.createElement('div');
  el.classList.add(className);
  parent.appendChild(el);
  return el;
}

// SVG Helpers

function createSVGElement(tag, parent, attributes?: object) {
  parent = parent || document.documentElement;
  var el = document.createElementNS(SVG_NAMESPACE, tag);
  parent.appendChild(el);
  for (var key in attributes) {
    if (!attributes.hasOwnProperty(key)) continue;
    setSVGAttribute(el, key, attributes[key]);
  }
  return el;
}

function setSVGAttribute(el, key, value) {
  el.setAttributeNS(null, key, value);
}

type Handler = (evt: Event, x: number, y: number) => void;

const shapes = ["circle","path","polygon","rect"] as const;

type Shapes = { [P in typeof shapes[number]]?: unknown; }

export type PeelOptions = typeof Peel.defaultOptions&Shapes;

type PeelLayer = "top"|"back"|"bottom"|"top-shadow"|"back-shadow"|"bottom-shadow"|"back-reflection"|"top-outer-clip"|"back-outer-clip";

/**
 * Four constants representing the corners of the element from which peeling can occur.
 */
export enum PeelCorners {
  TOP_LEFT,
  TOP_RIGHT,
  BOTTOM_LEFT,
  BOTTOM_RIGHT
}

/**
 * @inline
 */
type PointOption =
  | { x: number; y: number }
  | PeelCorners
  | [number, number]
;

/**
 * @inline
 */
type PointArgs = Readonly<[PointOption|Point]|[number, number]>;

/**
 * @inline
 */
type Preset = "book"|"calendar";

/**
 * Main class that controls the peeling effect.
 */
export class Peel {
  el: HTMLElement;
  options: PeelOptions;
  constraints: Circle[];
  corner: Point;
  path?: LineSegment|BezierCurve;
  dragHandler?: Handler;
  pressHandler?: Handler;
  private _removeDragListeners?: () => void;
  timeAlongPath?: number;
  peelLineSegment?: LineSegment;
  peelLineRotation = 0;
  width = 0;
  height = 0;

  elementBox: any;
  flipConstraint?: Circle;
  clippingBox: any;
  topClip: any;
  backClip: any;
  topLayer?: HTMLElement;
  backLayer!: HTMLElement;
  bottomLayer?: HTMLElement;
  topShapeClip?: SVGClip;
  backShapeClip?: SVGClip;
  bottomShapeClip?: SVGClip;
  topShadowElement!: HTMLElement;
  backShadowElement?: HTMLElement;
  backReflectionElement?: HTMLElement;
  bottomShadowElement?: HTMLElement;
  usesBoxShadow?: boolean;
  center!: Point;

  /**
   * The constructor will look for the required elements to make the peel effect
   * in the options, and create them if they do not exist.
   */
  constructor(
    el: HTMLElement|string,
    options: Partial<PeelOptions> = {},
  ) {
    this.el = typeof el === "string" ? document.querySelector(el)! : el;
    this.options = Object.assign({}, Peel.defaultOptions, options);
    this.constraints = [];
    this.setupLayers();
    this.setupDimensions();
    this.corner = this.getPoint(this.options.corner);
    if (this.options.preset) {
      this.applyPreset(this.options.preset);
    }
    this.init();
  }

  static readonly defaultOptions = {
    /**
     * Sets the corner for the effect to peel back from.
     *
     * @defaults PeelCorners.BOTTOM_RIGHT
     */
    corner: PeelCorners.BOTTOM_RIGHT as PointOption,
    /**
     * Threshold above which the top layer (including the backside) layer
     * will begin to fade out. This is calculated based on the visible clipped
     * area of the polygon. If a peel path is set, it will use the progress along
     * the path instead.
     */
    fadeThreshold: 0,
    /**
     * Creates a shadow effect on the top layer of the peel. This may be a box-shadow or drop-shadow (filter) depending on the shape of the clipping.
     */
    topShadow: true,
    topShadowBlur: 5,
    topShadowAlpha: .5,
    topShadowOffsetX: 0,
    topShadowOffsetY: 1,
    /**
     * When a complex (non-rectangular) shape is used for the clipping effect, if this option is true another SVG shape will be embedded in the top layer to be used as the drop shadow. This is required for the drop-shadow filter effect but can be turned off here as the drop shadow effect can sometimes produce odd results.
     */
    topShadowCreatesShape: true,
    /**
     * Creates a shiny effect on the back layer of the peel.
     */
    backReflection: false,
    backReflectionSize: .02,
    backReflectionOffset: 0,
    backReflectionAlpha: .15,
    /**
     * When true, the reflection effect will reach its maximum halfway through the peel, then diminish again. If false, it will continue to grow as the peel advances.
     */
    backReflectionDistribute: true,
    /**
     * Creates a shadow effect on the back layer of the peel.
     */
    backShadow: true,
    backShadowSize: .04,
    backShadowOffset: 0,
    backShadowAlpha: .1,
    /**
     * When true, the back shadow effect will reach its maximum halfway through
     * the peel, then diminish again. If false, it will continue to grow as the
     * peel advances. "Book" mode sets this to false so that the effect can still
     * have some depth when the book is "fully open".
     */
    backShadowDistribute: true,
    /**
     * Creates a shadow effect on the bottom layer of the peel.
     */
    bottomShadow: true,
    bottomShadowSize: 1.5,
    bottomShadowOffset: 0,
    /**
     * Alpha value (color is black) of the dark shadow on the bottom layer.
     */
    bottomShadowDarkAlpha: .7,
    /**
     * Alpha value (color is black) of the light shadow on the bottom layer.
     */
    bottomShadowLightAlpha: .1,
    /**
     * When true, the bottom shadow effect will reach its maximum halfway through the peel, then diminish again. If false, it will continue to grow as the peel advances. "Book" mode sets this to false so that the effect can still have some depth when the book is "fully open".
     */
    bottomShadowDistribute: true,
    /**
     * If true, the peel effect will be set to its relative corner on initialization.
     */
    setPeelOnInit: true,
    /**
     * Sets the scale of the clipping box around the element. Default is 4, which means 4 times the element size. This allows the effects like box shadow to be seen even when the upper layer falls outsize the element boundaries. Setting this too high may encounter odd effects with clipping.
     */
    clippingBoxScale: 4,
    /**
     * When constraining the peel, the effect will "flip" around the axis of the constraint, which tends to look unnatural. This offset will pull the corner in a few pixels when approaching the axis line, which results in a smoother transition instead of a sudden flip. The value here determines how many pixels the corner is pulled in.
     */
    flipConstraintOffset: 5,
    /**
     * Whether initiating a drag event (by mouse or touch) will call `preventDefault` on the original event.
     */
    dragPreventsDefault: true,
    preset: undefined as Preset|undefined,
  };

  applyPreset(preset: Preset) {
    if (preset === 'book') {
      // The order of constraints is important here so that the peel line
      // approaches the horizontal smoothly without jumping.
      this.addPeelConstraint(PeelCorners.BOTTOM_LEFT);
      this.addPeelConstraint(PeelCorners.TOP_LEFT);
      // Removing effect distribution will make the book still have some
      // depth to the effect while fully open.
      this.options.backReflection = false;
      this.options.backShadowDistribute = false;
      this.options.bottomShadowDistribute = false;
    } else if (preset === 'calendar') {
      this.addPeelConstraint(PeelCorners.TOP_RIGHT);
      this.addPeelConstraint(PeelCorners.TOP_LEFT);
    }
  }

  /**
   * Sets a path along which the peel will follow.
   * Can be a flat line segment or a bezier curve.
   * @param {...number} x/y Points along the path. 4 arguments indicates a
   *     linear path along 2 points (p1 to p2), while 8 arguments indicates a
   *     bezier curve from p1 to p2 using control points c1 and c2. The first
   *     and last two arguments represent p1 and p2, respectively.
   */
  setPeelPath(...args: TupleOf<4|8, number>) {
    const p1 = new Point(args[0], args[1]);
    if (args.length === 4) {
      const p2 = new Point(args[2], args[3]);
      this.path = new LineSegment(p1, p2);
    } else if (args.length === 8) {
      const c1 = new Point(args[2], args[3]);
      const c2 = new Point(args[4], args[5]);
      const p2 = new Point(args[6], args[7]);
      this.path = new BezierCurve(p1, c1, c2, p2);
    }
  }

  /**
   * Sets a function to be called when the user either presses or drags.
   * @param {Function} fn The function to be called on press. This function will
   *     be called with the original event as the first argument, and the x, y
   *     coordinates of the event as the 2nd and 3rd arguments, respectively.
   * @param {HTMLElement} el The element to initiate the event.
   *     If not passed, this will be the element associated with the Peel
   *     instance. Allowing this to be passed lets another element serve as a
   *     "hit area" that can be larger than the element itself.
   */
  handle(event: "drag"|"press",fn: Handler, el?: HTMLElement) {
    if (event === "drag") {
      this.dragHandler = fn;
    } else if (event === "press") {
      this.pressHandler = fn;
    }
    this.setupDragListeners(el);
  }

  /**
   * Sets up the drag events needed for both drag and press handlers.
   * @returns {Function} A function that can be called to remove the listeners.
   */
  private setupDragListeners(el?: HTMLElement) {
    if (this._removeDragListeners) return;

    el = el || this.el;
    let isDragging = false;

    const dragStart = (evt) => {
      if (this.options.dragPreventsDefault) {
        evt.preventDefault();
      }
      isDragging = true;
    }

    const dragMove = (evt) => {
      if (isDragging) {
        callHandlerIfAny(this.dragHandler, evt);
      }
    }

    const dragEnd = (evt: MouseEvent|TouchEvent) => {
      if (isDragging && this.el.contains(evt.target as Node)) {
        callHandlerIfAny(this.pressHandler, evt);
      }
      isDragging = false;
    }

    const callHandlerIfAny = (fn: Handler|undefined, evt) => {
      var coords = getEventCoordinates(evt, this.el);
      if (fn) {
        fn(evt, coords.x, coords.y);
      }
    }

    el.addEventListener('mousedown', dragStart);
    el.addEventListener('touchstart', dragStart);

    document.documentElement.addEventListener('mousemove', dragMove);
    document.documentElement.addEventListener('touchmove', dragMove);

    document.documentElement.addEventListener('mouseup', dragEnd, { passive: false });
    document.documentElement.addEventListener('touchend', dragEnd, { passive: false });


    this._removeDragListeners = () => {
      el.removeEventListener('mousedown', dragStart);
      el.removeEventListener('touchstart', dragStart);

      document.documentElement.removeEventListener('mousemove', dragMove);
      document.documentElement.removeEventListener('touchmove', dragMove);

      document.documentElement.removeEventListener('mouseup', dragEnd);
      document.documentElement.removeEventListener('touchend', dragEnd);
    };
  }

  removeDragListeners() {
    this._removeDragListeners?.();
    this._removeDragListeners = undefined;
  }

  /**
   * Sets the peel effect to a point in time along a previously
   * specified path. Will throw an error if no path exists.
   * @param {number} n The time value (between 0 and 1).
   */
  setTimeAlongPath(t) {
    t = clamp(t);
    var point = this.path!.getPointForTime(t);
    this.timeAlongPath = t;
    this.setPeelPosition(point);
  }

  /**
   * Sets the position of the peel effect. This point is the position
   * of the corner that is being peeled back.
   */
  setPeelPosition(...args: PointArgs) {
    var pos = this.getPoint(...args);
    pos = this.getConstrainedPeelPosition(pos);
    if (!pos) {
      return;
    }
    this.peelLineSegment = this.getPeelLineSegment(pos);
    this.peelLineRotation = this.peelLineSegment.getAngle();
    this.setClipping();
    this.setBackTransform(pos);
    this.setEffects();
  }

  /**
   * Sets a constraint on the distance of the peel. This can be thought of as a
   * point on the layers that are connected and cannot be torn apart. Typically
   * this only makes sense as a point on the outer edge, such as the left edge
   * of an open book, or the top edge of a calendar. In this case, simply using
   * 2 constraint points (top-left/bottom-left for a book, etc) will create the
   * desired effect. An arbitrary point can also be used with an effect like a
   * thumbtack holding the pages together.
   */
  addPeelConstraint(...args: PointArgs) {
    var p = this.getPoint(...args);
    var radius = this.corner!.subtract(p).getLength();
    this.constraints.push(new Circle(p, radius));
    this.calculateFlipConstraint();
  }

  /**
   * Gets the ratio of the area of the clipped top layer to the total area. This
   * is used to calculate a fade threshold.
   * @returns {number} A value between 0 and 1.
   */
  getAmountClipped() {
    var topArea = this.getTopClipArea();
    var totalArea = this.width * this.height;
    return normalize(topArea, totalArea, 0);
  }

  /**
   * Gets the area of the clipped top layer.
   * @returns {number}
   */
  private getTopClipArea() {
    var top = new Polygon();
    this.elementBox.forEach((side) => {
      this.distributeLineByPeelLine(side, top);
    }, this);
    return Polygon.getArea(top.getPoints());
  }

  /**
   * Determines which of the constraints should be used as the flip constraint
   * by checking which has a y value closes to the corner (because the
   * constraint operates relative to the vertical midline). Only one constraint
   * should be required - changing the order of the constraints can help to
   * achieve the proper effect and more than one will interfere with each other.
   */
  private calculateFlipConstraint() {
    this.flipConstraint = this.constraints.slice().sort((a, b) => {
      var aY = this.corner.y - a.center.y;
      var bY = this.corner.y - b.center.y;
      return aY - bY;
    })[0];
  }

  /**
   * Sets the clipping points of the top and back layers based on a line
   * segment that represents the peel line.
   */
  private setClipping() {
    var top = new Polygon();
    var back = new Polygon();
    this.clippingBox.forEach((side) => {
      this.distributeLineByPeelLine(side, top, back);
    }, this);

    this.topClip.setPoints(top.getPoints());
    this.backClip.setPoints(back.getPoints());
  }

  /**
   * Distributes the first point in the given line segment and its intersect
   * with the peel line, if there is one.
   * @param {LineSegment} seg The line segment to check against.
   * @param {Polygon} poly1 The first polygon.
   * @param {Polygon} [poly2] The second polygon.
   */
  private distributeLineByPeelLine(seg: LineSegment, poly1: Polygon, poly2?: Polygon) {
    var intersect = this.peelLineSegment!.getIntersectPoint(seg);
    this.distributePointByPeelLine(seg.p1, poly1, poly2);
    this.distributePointByPeelLine(intersect, poly1, poly2);
  }

  /**
   * Distributes the given point to one of two polygons based on which side of
   * the peel line it falls upon (if it falls directly on the line segment
   * it is added to both).
   * @param {Point} p The point to be distributed.
   * @param {Polygon} poly1 The first polygon.
   * @param {Polygon} [poly2] The second polygon.
   */
  private distributePointByPeelLine(p: Point|null, poly1: Polygon, poly2?: Polygon) {
    if (!p) return;
    var d = this.peelLineSegment!.getPointDeterminant(p);
    if (d <= 0) {
      poly1.addPoint(p);
    }
    if (d >= 0 && poly2) {
      poly2.addPoint(this.flipPointHorizontally(p));
    }
  }

  /**
   * Finds or creates a layer in the dom.
   * @param {HTMLElement} parent The parent if the element needs to be created.
   * @param {numer} zIndex The z index of the layer.
   * @returns {HTMLElement}
   */
  private findOrCreateLayer(layer: PeelLayer, parent: HTMLElement, zIndex: number) {
    const optId = layer + '-element';
    const domId = prefix(layer);
    let el = parent.querySelector<HTMLElement>(this.options[optId] as string || (`.${domId}`));
    if (!el) {
      el = createElement(parent, domId);
    }
    el.classList.add(prefix('layer'));
    el.style.zIndex = "" + zIndex;
    return el;
  }

  getPoint(...args: PointArgs) {
    let xy: Readonly<ConstructorParameters<typeof Point>>;
    if (args.length === 1) {
      const value = args[0];
      if (typeof value === "number") {
        return this.getCornerPoint(value);
      } else if (Array.isArray(value)) {
        xy = value;
      } else {
        xy = [value.x, value.y];
      }
    } else {
      xy = args;
    }
    return new Point(...xy);
  }

  /**
   * Returns a corner point based on an id defined in PeelCorners.
   */
  private getCornerPoint(corner: PeelCorners) {
    var x = +!!(corner & 1) * this.width;
    var y = +!!(corner & 2) * this.height;
    return new Point(x, y);
  }

  /**
   * Sets up the main layers used for the effect that may include a possible
   * subclip shape.
   */
  private setupLayers() {
    // The inner layers may be wrapped later, so keep a reference to them here.
    var topInnerLayer = this.topLayer = this.findOrCreateLayer('top', this.el, 2);
    var backInnerLayer = this.backLayer = this.findOrCreateLayer('back', this.el, 3);

    this.bottomLayer = this.findOrCreateLayer('bottom', this.el, 1);

    const matchedShapes = shapes.filter(key => key in this.options);
    if (matchedShapes.length > 1) {
      throw new Error(`You must specify at most one of the shapes: ${shapes}`);
    }
    if (matchedShapes.length === 1) {
      const shape = {
        type: matchedShapes[0],
        attributes: this.options[matchedShapes[0]],
      };
      // If there is an SVG shape specified in the options, then this needs to
      // be a separate clipped element because Safari/Mobile Safari can't handle
      // nested clip-paths. The current top/back element will become the shape
      // clip, so wrap them with an "outer" clip element that will become the
      // new layer for the peel effect. The bottom layer does not require this
      // effect, so the shape clip can be set directly on it.
      this.topLayer = this.wrapShapeLayer(this.topLayer, 'top-outer-clip');
      this.backLayer = this.wrapShapeLayer(this.backLayer, 'back-outer-clip');

      this.topShapeClip = new SVGClip(topInnerLayer, shape);
      this.backShapeClip = new SVGClip(backInnerLayer, shape);
      this.bottomShapeClip = new SVGClip(this.bottomLayer, shape);

      if (this.options.topShadowCreatesShape) {
        this.topShadowElement = this.setupDropShadow(shape, topInnerLayer);
      }
    } else {
      this.topShadowElement = this.findOrCreateLayer('top-shadow', topInnerLayer, 1);
    }

    this.topClip = new SVGClip(this.topLayer);
    this.backClip = new SVGClip(this.backLayer);

    this.backShadowElement = this.findOrCreateLayer('back-shadow', backInnerLayer, 1);
    this.backReflectionElement = this.findOrCreateLayer('back-reflection', backInnerLayer, 2);
    this.bottomShadowElement = this.findOrCreateLayer('bottom-shadow', this.bottomLayer, 1);

    this.usesBoxShadow = matchedShapes.length === 0;
  }

  /**
   * Creates an inline SVG element to be used as a layer for a drop shadow filter
   * effect. Note that drop shadow filters currently have some odd quirks in
   * Blink such as blur radius changing depending on rotation, etc.
   * @param {Object} shape A shape describing the SVG element to be used.
   * @param {HTMLElement} parent The parent element where the layer will be added.
   * @returns {SVGElement}
   */
  private setupDropShadow(shape, parent) {
    var svg = createSVGElement('svg', parent, {
      'class': prefix('layer')
    });
    createSVGElement(shape.type, svg, shape.attributes);
    return svg;
  }

  /**
   * Wraps the passed element in another layer, preserving its z-index. Also
   * add a "shape-layer" class to the layer which now becomes a shape clip.
   */
  private wrapShapeLayer(el: HTMLElement, layer: PeelLayer) {
    el.classList.add(prefix('shape-layer'));
    var outerLayer = this.findOrCreateLayer(layer, this.el, Number.parseInt(el.style.zIndex));
    outerLayer.appendChild(el);
    return outerLayer;
  }

  /**
   * Sets up the dimensions of the element box and clipping box that area used
   * in the effect.
   */
  private setupDimensions() {
    this.width = this.el.offsetWidth;
    this.height = this.el.offsetHeight;
    this.center = new Point(this.width / 2, this.height / 2);

    this.elementBox = this.getScaledBox(1);
    this.clippingBox = this.getScaledBox(this.options.clippingBoxScale);
  }

  /**
   * Gets a box defined by 4 line segments that is at a scale of the main
   * element.
   * @param {number} scale The scale for the box to be.
   */
  private getScaledBox(scale) {

    // Box scale is equal to:
    // 1 * the bottom/right scale
    // 0 * the top/left scale.
    var brScale = scale;
    var tlScale = scale - 1;

    var tl = new Point(-this.width * tlScale, -this.height * tlScale);
    var tr = new Point( this.width * brScale, -this.height * tlScale);
    var br = new Point( this.width * brScale,  this.height * brScale);
    var bl = new Point(-this.width * tlScale,  this.height * brScale);

    return [
      new LineSegment(tl, tr),
      new LineSegment(tr, br),
      new LineSegment(br, bl),
      new LineSegment(bl, tl)
    ];
  }

  /**
   * Returns the peel position adjusted by constraints, if there are any.
   * @param {Point} point The peel position to be constrained.
   * @returns {Point}
   */
  private getConstrainedPeelPosition(pos) {
    this.constraints.forEach((area) => {
      var offset = this.getFlipConstraintOffset(area, pos);
      if (offset) {
        area = new Circle(area.center, area.radius - offset);
      }
      pos = area.constrainPoint(pos);
    }, this);
    return pos;
  }

  /**
   * Returns an offset to "pull" a corner in to prevent the peel effect from
   * suddenly flipping around its axis. This offset is intended to be applied
   * on the Y axis when dragging away from the center.
   * @param {Circle} area The constraint to check against.
   * @param {Point} point The peel position to be constrained.
   */
  private getFlipConstraintOffset(area, pos) {
    const offset = this.options.flipConstraintOffset;
    if (area === this.flipConstraint && offset) {
      var cornerToCenter = this.corner.subtract(this.center);
      var cornerToConstraint = this.corner.subtract(area.center);
      var baseAngle = cornerToConstraint.getAngle();

      // Normalized angles are rotated to be in the same space relative
      // to the constraint.
      var nCornerToConstraint = cornerToConstraint.rotate(-baseAngle);
      var nPosToConstraint = pos.subtract(area.center).rotate(-baseAngle);

      // Flip the vector vertically if the corner is in the bottom left or top
      // right relative to the center, as the effect should always pull away
      // from the vertical midline.
      if (cornerToCenter.x * cornerToCenter.y < 0) {
        nPosToConstraint.y *= -1;
      }

      if (nPosToConstraint.x > 0 && nPosToConstraint.y > 0) {
        return normalize(nPosToConstraint.getAngle(), 45, 0) * offset;
      }

    }
  }

  /**
   * Gets the line segment that represents the current peel line.
   * @param {Point} point The position of the peel corner.
   * @returns {LineSegment}
   */
  private getPeelLineSegment(point) {
    // The point midway between the peel position and the corner.
    var halfToCorner = this.corner.subtract(point).scale(.5);
    var midpoint = point.add(halfToCorner);
    if (halfToCorner.x === 0 && halfToCorner.y === 0) {
      // If the corner is the same as the point, then set half to corner
      // to be the center, and keep the midpoint where it is. This will
      // ensure a non-zero peel line.
      halfToCorner = point.subtract(this.center);
    }
    var l = halfToCorner.getLength()
    var mult = (Math.max(this.width, this.height) / l) * 10;
    var half = halfToCorner.rotate(-90).scale(mult);
    var p1 = midpoint.add(half);
    var p2 = midpoint.subtract(half);
    return new LineSegment(p1, p2);
  }

  /**
   * Sets the transform of the back layer.
   * @param {Point} pos The position of the peeling corner.
   */
  private setBackTransform(pos) {
    var mirroredCorner = this.flipPointHorizontally(this.corner);
    var r = (this.peelLineRotation - 90) * 2;
    var t = pos.subtract(mirroredCorner.rotate(r));
    var css = 'translate('+ round(t.x) +'px, '+ round(t.y) +'px) rotate('+ round(r) +'deg)';
    setTransform(this.backLayer, css);

    // Set the top shadow element here as well, as the
    // position and rotation matches that of the back layer.
    setTransform(this.topShadowElement, css);
  }

  /**
   * Gets the distance of the peel line along an imaginary line that runs
   * between the corners that it "faces". For example, if the peel line
   * is rotated 45 degrees, then it can be considered to be between the top left
   * and bottom right corners. This function will return how far the peel line
   * has advanced along that line.
   * @returns {number} A position >= 0.
   */
  private getPeelLineDistance() {
    let cornerId: PeelCorners, opposingCornerId: PeelCorners;
    if (this.peelLineRotation < 90) {
      cornerId = PeelCorners.TOP_RIGHT;
      opposingCornerId = PeelCorners.BOTTOM_LEFT;
    } else if (this.peelLineRotation < 180) {
      cornerId = PeelCorners.BOTTOM_RIGHT;
      opposingCornerId = PeelCorners.TOP_LEFT;
    } else if (this.peelLineRotation < 270) {
      cornerId = PeelCorners.BOTTOM_LEFT;
      opposingCornerId = PeelCorners.TOP_RIGHT;
    } else {
      cornerId = PeelCorners.TOP_LEFT;
      opposingCornerId = PeelCorners.BOTTOM_RIGHT;
    }
    const corner = this.getCornerPoint(cornerId);
    const opposingCorner = this.getCornerPoint(opposingCornerId);

    // Scale the line segment past the original corners so that the effects
    // can have a nice fadeout even past 1.
    var cornerToCorner = new LineSegment(corner, opposingCorner).scale(2);
    var intersect = this.peelLineSegment!.getIntersectPoint(cornerToCorner);
    if (!intersect) {
      // If there is no intersect, then assume that it has run past the opposing
      // corner and set the distance to well past the full distance.
      return 2;
    }
    var distanceToPeelLine = corner.subtract(intersect).getLength();
    var totalDistance = corner.subtract(opposingCorner).getLength();
    return (distanceToPeelLine / totalDistance);
  }

  /**
   * Sets shadows and fade effects.
   */
  private setEffects() {
    var t = this.getPeelLineDistance();
    this.setTopShadow(t);
    this.setBackShadow(t);
    this.setBackReflection(t);
    this.setBottomShadow(t);
    this.setFade();
  }

  /**
   * Sets the top shadow as either a box-shadow or a drop-shadow filter.
   * @param {number} t Position of the peel line from corner to corner.
   */
  private setTopShadow(t) {
    if (!this.options.topShadow) {
      return;
    }
    const { topShadowBlur, topShadowOffsetX, topShadowOffsetY, topShadowAlpha } = this.options;
    const sAlpha = this.exponential(t, 5, topShadowAlpha);
    if (this.usesBoxShadow) {
      setBoxShadow(this.topShadowElement, topShadowOffsetX, topShadowOffsetY, topShadowBlur, 0, sAlpha);
    } else {
      setDropShadow(this.topShadowElement, topShadowOffsetX, topShadowOffsetY, topShadowBlur, sAlpha);
    }
  }

  /**
   * Gets a number either distributed along a bell curve or increasing linearly.
   * @param {number} n The number to transform.
   * @param {boolean} dist Whether or not to use distribution.
   * @param {number} mult A multiplier for the result.
   * @returns {number}
   */
  private distributeOrLinear(n, dist, mult) {
    if (dist) {
      return distribute(n, mult);
    } else {
      return n * mult;
    }
  }

  /**
   * Gets a number either distributed exponentially, clamped to a range between
   * 0 and 1, and multiplied by a multiplier.
   * @param {number} n The number to transform.
   * @param {number} exp The exponent to be used.
   * @param {number} mult A multiplier for the result.
   * @returns {number}
   */
  private exponential(n, exp, mult) {
    return mult * clamp(Math.pow(1 + n, exp) - 1);
  }

  /**
   * Sets reflection of the back face as a linear gradient.
   * @param {number} t Position of the peel line from corner to corner.
   */
  private setBackReflection(t) {
    const stops: string[] = [];
    if (this.options.backReflection && t > 0) {

      var rDistribute = this.options.backReflectionDistribute;
      var rSize = this.options.backReflectionSize;
      var rOffset = this.options.backReflectionOffset;
      var rAlpha = this.options.backReflectionAlpha;

      var reflectionSize = this.distributeOrLinear(t, rDistribute, rSize);
      var rStop = t - rOffset;
      var rMid = rStop - reflectionSize;
      var rStart = rMid - reflectionSize;

      stops.push(getWhiteStop(0, 0));
      stops.push(getWhiteStop(0, rStart));
      stops.push(getWhiteStop(rAlpha, rMid));
      stops.push(getWhiteStop(0, rStop));
    }
    setBackgroundGradient(this.backReflectionElement, 180 - this.peelLineRotation, stops);
  }

  /**
   * Sets shadow of the back face as a linear gradient.
   * @param {number} t Position of the peel line from corner to corner.
   */
  private setBackShadow(t) {
    const stops: string[] = [];
    if (this.options.backShadow && t > 0) {

      const {
        backShadowSize: sSize,
        backShadowOffset: sOffset,
        backShadowAlpha: sAlpha,
        backShadowDistribute: sDistribute,
      } = this.options;

      var shadowSize = this.distributeOrLinear(t, sDistribute, sSize);
      var shadowStop = t - sOffset;
      var shadowMid = shadowStop - shadowSize;
      var shadowStart = shadowMid - shadowSize;

      stops.push(getBlackStop(0, 0));
      stops.push(getBlackStop(0, shadowStart));
      stops.push(getBlackStop(sAlpha, shadowMid));
      stops.push(getBlackStop(sAlpha, shadowStop));
    }
    setBackgroundGradient(this.backShadowElement, 180 - this.peelLineRotation, stops);
  }

  /**
   * Sets the bottom shadow as a linear gradient.
   * @param {number} t Position of the peel line from corner to corner.
   */
  private setBottomShadow(t) {
    const stops: string[] = [];
    if (this.options.bottomShadow && t > 0) {
      const {
        bottomShadowSize: sSize,
        bottomShadowOffset: offset,
        bottomShadowDarkAlpha: darkAlpha,
        bottomShadowLightAlpha: lightAlpha,
        bottomShadowDistribute: sDistribute
      } = this.options;

      var darkShadowStart = t - (.025 - offset);
      var midShadowStart = darkShadowStart - (this.distributeOrLinear(t, sDistribute, .03) * sSize) - offset;
      var lightShadowStart = midShadowStart - ((.02 * sSize) - offset);

      stops.push(
        getBlackStop(0, 0),
        getBlackStop(0, lightShadowStart),
        getBlackStop(lightAlpha, midShadowStart),
        getBlackStop(lightAlpha, darkShadowStart),
        getBlackStop(darkAlpha, t)
      );
    }
    setBackgroundGradient(this.bottomShadowElement, this.peelLineRotation + 180, stops);
  }

  /**
   * Sets the fading effect of the top layer, if a threshold is set.
   */
  private setFade() {
    const { fadeThreshold } = this.options;
    let opacity = 1
    let n: number;
    if (fadeThreshold) {
      if (this.timeAlongPath !== undefined) {
        n = this.timeAlongPath;
      } else {
        n = this.getAmountClipped();
      }
      if (n > fadeThreshold) {
        opacity = (1 - n) / (1 - fadeThreshold);
      }
      setOpacity(this.topLayer, opacity);
      setOpacity(this.backLayer, opacity);
      setOpacity(this.bottomShadowElement, opacity);
    }
  }

  /**
   * Flips a point along an imaginary vertical midpoint.
   * @param {Array} points The points to be flipped.
   * @returns {Array}
   */
  private flipPointHorizontally(p) {
    return new Point(p.x - ((p.x - this.center.x) * 2), p.y);
  }

  /**
   * Post setup initialization.
   */
  private init() {
    if (this.options.setPeelOnInit) {
      this.setPeelPosition(this.corner);
    }
    this.el.classList.add(prefix('ready'));
  }
}

/**
 * Class that clips an HTMLElement by an SVG path.
*/
class SVGClip {
  el: HTMLElement;
  shape: unknown;
  static defs: any;
  static svg: Element;

  /**
   * @param {HTMLElement} el The element to be clipped.
   * @param {Object} [shape] An object defining the SVG element to use in the new
   *     clip path. Defaults to a polygon.
   */
  constructor(el, shape?: unknown) {
    this.el = el;
    this.shape = SVGClip.createClipPath(el, shape || {
      'type': 'polygon'
    });
    // Chrome needs this for some reason for the clipping to work.
    setTransform(this.el, 'translate(0px,0px)');
  }

  /**
   * Sets up the global SVG element and its nested defs object to use for new
   * clip paths.
   * @returns {SVGElement}
   */
  static getDefs() {
    if (!this.defs) {
      this.svg = createSVGElement('svg', null, {
        'class': prefix('svg-clip-element')
      });
      this.defs = createSVGElement('defs', this.svg);
    }
    return this.defs;
  }

  /**
   * Creates a new <clipPath> SVG element and sets the passed html element to be
   * clipped by it.
   * @param {HTMLElement} el The html element to be clipped.
   * @param {Object} obj An object defining the SVG element to be used in the
   *     clip path.
   * @returns {SVGElement}
   */
  static createClipPath(el: HTMLElement, obj) {
    var id = SVGClip.getId();
    var clipPath = createSVGElement('clipPath', this.getDefs());
    var svgEl = createSVGElement(obj.type, clipPath, obj.attributes);
    setSVGAttribute(clipPath, 'id', id);
    el.style.clipPath = 'url(#' + id + ')';
    return svgEl;
  }

  static id: number;
  /**
   * Gets the next svg clipping id.
   */
  static getId() {
    if (!SVGClip.id) {
      SVGClip.id = 1;
    }
    return 'svg-clip-' + SVGClip.id++;
  }

  /**
   * Sets the "points" attribute of the clip path shape. This only makes sense
   * for polygon shapes.
   * @param {Array} points The points to be used.
   */
  setPoints(points) {
    var str = points.map(function(p) {
      return round(p.x) + ',' + round(p.y);
    }).join(' ');
    setSVGAttribute(this.shape, 'points', str);
  }
}

/**
 * A class that represents a circle.
 */
class Circle {
  constructor(
    public center: Point,
    public radius: number
  ) {
  }

  /**
   * Determines whether a point is contained within the circle.
   * @param {Point} p The point.
   * @returns {boolean}
   */
  containsPoint(p) {
    if(this.boundingRectContainsPoint(p)) {
        var dx = this.center.x - p.x;
        var dy = this.center.y - p.y;
        dx *= dx;
        dy *= dy;
        var distanceSquared = dx + dy;
        var radiusSquared = this.radius * this.radius;
        return distanceSquared <= radiusSquared;
    }
    return false;
  }

  /**
   * Determines whether a point is contained within the bounding box of the circle.
   * @param {Point} p The point.
   * @returns {boolean}
   */
  private boundingRectContainsPoint(p) {
    return p.x >= this.center.x - this.radius && p.x <= this.center.x + this.radius &&
           p.y >= this.center.y - this.radius && p.y <= this.center.y + this.radius;
  }

  /**
   * Moves a point outside the circle to the closest point on the circumference.
   * Rotated angle from the center point should be the same.
   * @param {Point} p The point.
   * @returns {boolean}
   */
  constrainPoint(p) {
    if (!this.containsPoint(p)) {
      var rotation = p.subtract(this.center).getAngle();
      p = this.center.add(new Point(this.radius, 0).rotate(rotation));
    }
    return p;
  }
}

/**
 * A class that represents a polygon.
 */
class Polygon {
  points: unknown[];

  constructor() {
    this.points = [];
  }

  /**
   * Gets the area of the polygon.
   * @param {Array} points The points describing the polygon.
   */
  static getArea(points) {
    var sum1 = 0, sum2 = 0;
    points.forEach(function(p, i, arr) {
      var next = arr[(i + 1) % arr.length];
      sum1 += (p.x * next.y);
      sum2 += (p.y * next.x);
    });
    return (sum1 - sum2) / 2;
  }

  /**
   * Adds a point to the polygon.
   * @param {Point} point
   */
  addPoint(point) {
    this.points.push(point);
  }

  /**
   * Gets the points of the polygon as an array.
   * @returns {Array}
   */
  getPoints() {
    return this.points;
  }
}

/**
 * A class representing a bezier curve.
 */
class BezierCurve {
  /**
   * @param p1 The starting point.
   * @param c1 The control point of p1.
   * @param c2 The control point of p2.
   * @param p2 The ending point.
   */
  constructor(
    public p1: Point,
    public c1: Point,
    public c2: Point,
    public p2: Point
  ) {
  }

  /**
   * Gets a point along the line segment for a given time.
   * @param {number} t The time along the segment, between 0 and 1.
   * @returns {Point}
   */
  getPointForTime(t) {
    var b0 = Math.pow(1 - t, 3);
    var b1 = 3 * t * Math.pow(1 - t, 2);
    var b2 = 3 * Math.pow(t, 2) * (1 - t);
    var b3 = Math.pow(t, 3);

    var x = (b0 * this.p1.x) + (b1 * this.c1.x) + (b2 * this.c2.x) + (b3 * this.p2.x)
    var y = (b0 * this.p1.y) + (b1 * this.c1.y) + (b2 * this.c2.y) + (b3 * this.p2.y)
    return new Point(x, y);
  }
}

/**
 * A class that represents a line segment.
 */
class LineSegment {
  vector?: Point;

  constructor(
    public p1: Point,
    public p2: Point
  ) {
  }

  static readonly EPSILON = 1e-6;

  /**
   * Gets a point along the line segment for a given time.
   * @param {number} t The time along the segment, between 0 and 1.
   * @returns {Point}
   */
  getPointForTime(t) {
    return this.p1.add(this.getVector().scale(t));
  }

  /**
   * Takes a scalar and returns a new scaled line segment.
   * @param {number} n The amount to scale the segment by.
   * @returns {LineSegment}
   */
  scale(n) {
    var half = 1 + (n / 2);
    var p1 = this.p1.add(this.p2.subtract(this.p1).scale(n));
    var p2 = this.p2.add(this.p1.subtract(this.p2).scale(n));
    return new LineSegment(p1, p2);
  }

  /**
   * The determinant is a number that indicates which side of a line a point
   * falls on. A positive number means that the point falls inside the area
   * "clockwise" of the line, ie. the area that the line would sweep if it were
   * rotated 180 degrees. A negative number would mean the point is in the area
   * the line would sweep if it were rotated counter-clockwise, or -180 degrees.
   * 0 indicates that the point falls exactly on the line.
   * @param {Point} p The point to test against.
   * @returns {number} A signed number.
   */
  getPointDeterminant(p) {
    var d = ((p.x - this.p1.x) * (this.p2.y - this.p1.y)) - ((p.y - this.p1.y) * (this.p2.x - this.p1.x));
    // Tolerance for near-zero.
    if (d > -LineSegment.EPSILON && d < LineSegment.EPSILON) {
      d = 0;
    }
    return d;
  }

  /**
   * Calculates the point at which another line segment intersects, if any.
   * @param {LineSegment} seg The second line segment.
   * @returns {Point|null}
   */
  getIntersectPoint(seg2) {
    var seg1 = this;

    function crossProduct(p1, p2) {
      return p1.x * p2.y - p1.y * p2.x;
    }

    var r = seg1.p2.subtract(seg1.p1);
    var s = seg2.p2.subtract(seg2.p1);

    var uNumerator = crossProduct(seg2.p1.subtract(seg1.p1), r);
    var denominator = crossProduct(r, s);

    if (denominator == 0) {
      // ignoring colinear and parallel
      return null;
    }

    var u = uNumerator / denominator;
    var t = crossProduct(seg2.p1.subtract(seg1.p1), s) / denominator;

    if ((t >= 0) && (t <= 1) && (u >= 0) && (u <= 1)) {
      return seg1.p1.add(r.scale(t));
    }

    return null;
  }

  /**
   * Returns the angle of the line segment in degrees.
   * @returns {number}
   */
  getAngle() {
    return this.getVector().getAngle();
  }

  /**
   * Gets the vector that represents the line segment.
   * @returns {Point}
   */
  private getVector() {
    if (!this.vector) {
      this.vector = this.p2.subtract(this.p1);
    }
    return this.vector;
  }
}

/**
 * A class representing a point or 2D vector.
 */
class Point {
  constructor(
    public readonly x: number,
    public readonly y: number
  ) {
  }

  static readonly DEGREES_IN_RADIANS = 180 / Math.PI;

  /**
   * Gets degrees in radians.
   * @param {number} deg
   * @returns {number}
   */
  static degToRad(deg) {
    return deg / Point.DEGREES_IN_RADIANS;
  };

  /**
   * Gets radians in degrees.
   * @param {number} rad
   * @returns {number}
   */
  static radToDeg(rad) {
    var deg = rad * Point.DEGREES_IN_RADIANS;
    while(deg < 0) deg += 360;
    return deg;
  };

  /**
   * Creates a new point given a rotation in degrees and a length.
   * @param {number} deg The rotation of the vector.
   * @param {number} len The length of the vector.
   * @returns {Point}
   */
  static vector(deg, len) {
    var rad = Point.degToRad(deg);
    return new Point(Math.cos(rad) * len, Math.sin(rad) * len);
  };

  /**
   * Adds a point.
   * @param {Point} p
   * @returns {Point}
   */
  add(p) {
    return new Point(this.x + p.x, this.y + p.y);
  };

  /**
   * Subtracts a point.
   * @param {Point} p
   * @returns {Point}
   */
  subtract(p) {
    return new Point(this.x - p.x, this.y - p.y);
  };

  /**
   * Scales a point by a scalar.
   * @param {number} n
   * @returns {Point}
   */
  scale(n) {
    return new Point(this.x * n, this.y * n);
  };

  /**
   * Gets the length of the distance to the point.
   * @returns {number}
   */
  getLength() {
    return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
  };

  /**
   * Gets the angle of the point in degrees.
   * @returns {number}
   */
  getAngle() {
    return Point.radToDeg(Math.atan2(this.y, this.x));
  };

  /**
   * Returns a new point of the same length with a different angle.
   * @param {number} deg The angle in degrees.
   * @returns {Point}
   */
  setAngle(deg) {
    return Point.vector(deg, this.getLength());
  };

  /**
   * Rotates the point.
   * @param {number} deg The amount to rotate by in degrees.
   * @returns {Point}
   */
  rotate(deg) {
    return this.setAngle(this.getAngle() + deg);
  };
}