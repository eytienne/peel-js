
  // Constants

  var PRECISION       = 1e2; // 2 decimals
  var SVG_NAMESPACE   = 'http://www.w3.org/2000/svg';
  var CSS_PREFIX      = 'peel-';

  // General helpers

  function round(n) {
    return Math.round(n * PRECISION) / PRECISION;
  }

  // Clamps the number to be between 0 and 1.
  function clamp(n) {
    return Math.max(0, Math.min(1, n));
  }

  function normalize(n, min, max) {
    return (n - min) / (max - min);
  }

  // Distributes a number between 0 and 1 along a bell curve.
  function distribute(t, mult) {
    return (mult || 1) * 2 * (.5 - Math.abs(t - .5));
  }

  function capitalize(str) {
    return str.slice(0,1).toUpperCase() + str.slice(1);
  }

  function camelize(str) {
    return str.replace(/-(\w)/g, function(a, b) {
      return b.toUpperCase();
    });
  }

  function prefix(str) {
    return CSS_PREFIX + str;
  }

  // CSS Helper
  function setTransform(el: HTMLElement, t) {
    el.style.transform = t;
  }

  function setBoxShadow(el: HTMLElement, x, y, blur, spread, intensity) {
    el.style.boxShadow = getShadowCss(x, y, blur, spread, intensity);
  }

  function setDropShadow(el: HTMLElement, x, y, blur, intensity) {
    el.style.filter = 'drop-shadow(' + getShadowCss(x, y, blur, null, intensity) + ')';
  }

  function getShadowCss(x, y, blur, spread, intensity) {
    return round(x) + 'px ' +
           round(y) + 'px ' +
           round(blur) + 'px ' +
           (spread ? round(spread) + 'px ' : '') +
           'rgba(0,0,0,' + round(intensity) + ')';
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

  function addEvent(el, type, fn) {
    el.addEventListener(type, fn)
  }

  function removeEvent(el, type, fn) {
    el.removeEventListener(type, fn);
  }

  function getEventCoordinates(evt, el) {
    var pos = evt.changedTouches ? evt.changedTouches[0] : evt;
    return {
      'x': pos.clientX - el.offsetLeft + window.scrollX,
      'y': pos.clientY - el.offsetTop + window.scrollY
    }
  }

  function bindWithEvent(fn, scope, arg1, arg2) {
    return function(evt) {
      fn.call(scope, evt, arg1, arg2);
    }
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

  function getElement(obj: string|Element, node: Element) {
    if (typeof obj === 'string') {
      obj = (node || document).querySelector(obj);
    }
    return obj;
  }

  function createElement(parent, className) {
    var el = document.createElement('div');
    addClass(el, className);
    parent.appendChild(el);
    return el;
  }

  function removeClass(el, str) {
    el.classList.remove(str);
  }

  function addClass(el, str) {
    el.classList.add(str);
  }

  function getZIndex(el) {
    return el.style.zIndex;
  }

  function setZIndex(el, index) {
    el.style.zIndex = index;
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


/**
 * Main class that controls the peeling effect.
 */
export class Peel {
  el: Element;
  constraints: unknown[];
  events: Event[];
  corner: unknown;

  /**
   * @param {HTMLElement|string} el The main container element (can be query).
   * @param {object} options Options for the effect.
   */
  constructor(el, opt) {
    this.setOptions(opt);
    this.el = getElement(el, document.documentElement);
    this.constraints = [];
    this.events = [];
    this.setupLayers();
    this.setupDimensions();
    this.setCorner(this.getOption('corner'));
    this.setMode(this.getOption('mode'));
    this.init();
  }

  /**
   * Four constants representing the corners of the element from which peeling can occur.
   */
  static readonly Corners = {
    TOP_LEFT:     0x0,
    TOP_RIGHT:    0x1,
    BOTTOM_LEFT:  0x2,
    BOTTOM_RIGHT: 0x3
  }

  /**
   * Defaults
   */
  static readonly Defaults = {
    'topShadow': true,
    'topShadowBlur': 5,
    'topShadowAlpha': .5,
    'topShadowOffsetX': 0,
    'topShadowOffsetY': 1,
    'topShadowCreatesShape': true,

    'backReflection': false,
    'backReflectionSize': .02,
    'backReflectionOffset': 0,
    'backReflectionAlpha': .15,
    'backReflectionDistribute': true,

    'backShadow': true,
    'backShadowSize': .04,
    'backShadowOffset': 0,
    'backShadowAlpha': .1,
    'backShadowDistribute': true,

    'bottomShadow': true,
    'bottomShadowSize': 1.5,
    'bottomShadowOffset': 0,
    'bottomShadowDarkAlpha': .7,
    'bottomShadowLightAlpha': .1,
    'bottomShadowDistribute': true,

    'setPeelOnInit': true,
    'clippingBoxScale': 4,
    'flipConstraintOffset': 5,
    'dragPreventsDefault': true
  }

  /**
   * Sets the corner for the peel effect to happen from (default is bottom right).
   * @param {Mixed} [...] Either x,y or a corner id.
   */
  setCorner(...args) {
    if (args[0] === undefined) {
      args = [Peel.Corners.BOTTOM_RIGHT];
    } else if (args[0].length) {
      args = args[0];
    }
    this.corner = this.getPointOrCorner(args);
  }

  /**
   * Sets a pre-defined "mode".
   * @param {string} mode The mode to set.
   */
  setMode = function(mode) {
    if (mode === 'book') {
      // The order of constraints is important here so that the peel line
      // approaches the horizontal smoothly without jumping.
      this.addPeelConstraint(Peel.Corners.BOTTOM_LEFT);
      this.addPeelConstraint(Peel.Corners.TOP_LEFT);
      // Removing effect distribution will make the book still have some
      // depth to the effect while fully open.
      this.setOption('backReflection', false);
      this.setOption('backShadowDistribute', false);
      this.setOption('bottomShadowDistribute', false);
    } else if (mode === 'calendar') {
      this.addPeelConstraint(Peel.Corners.TOP_RIGHT);
      this.addPeelConstraint(Peel.Corners.TOP_LEFT);
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
  setPeelPath = function(x1, y1) {
    var args = arguments, p1, p2, c1, c2;
    p1 = new Point(x1, y1);
    if (args.length === 4) {
      p2 = new Point(args[2], args[3]);
      this.path = new LineSegment(p1, p2);
    } else if (args.length === 8) {
      c1 = new Point(args[2], args[3]);
      c2 = new Point(args[4], args[5]);
      p2 = new Point(args[6], args[7]);
      this.path = new BezierCurve(p1, c1, c2, p2);
    }
  }

  /**
   * Sets a function to be called when the user drags, either with a mouse or
   * with a finger (touch events).
   * @param {Function} fn The function to be called on drag. This function will
   *     be called with the Peel instance as the "this" keyword, the original
   *     event as the first argument, and the x, y coordinates of the drag as
   *     the 2nd and 3rd arguments, respectively.
   * @param {HTMLElement} el The element to initiate the drag on mouse/touch start.
   *     If not passed, this will be the element associated with the Peel
   *     instance. Allowing this to be passed lets another element serve as a
   *     "hit area" that can be larger than the element itself.
   */
  handleDrag = function(fn, el) {
    this.dragHandler = fn;
    this.setupDragEvents(el);
  }

  /**
   * Sets a function to be called when the user either clicks with a mouse or
   * taps with a finger (touch events).
   * @param {Function} fn The function to be called on press. This function will
   *     be called with the Peel instance as the "this" keyword, the original
   *     event as the first argument, and the x, y coordinates of the event as
   *     the 2nd and 3rd arguments, respectively.
   * @param {HTMLElement} el The element to initiate the event.
   *     If not passed, this will be the element associated with the Peel
   *     instance. Allowing this to be passed lets another element serve as a
   *     "hit area" that can be larger than the element itself.
   */
  handlePress = function(fn, el) {
    this.pressHandler = fn;
    this.setupDragEvents(el);
  }

  /**
   * Sets up the drag events needed for both drag and press handlers.
   * @param {HTMLElement} el The element to initiate the dragStart event on.
   */
  private setupDragEvents = function(el) {
    var self = this, isDragging, moveName, endName;

    if (this.dragEventsSetup) {
      return;
    }

    el = el || this.el;

    function dragStart (touch, evt) {
      if (self.getOption('dragPreventsDefault')) {
        evt.preventDefault();
      }
      moveName = touch ? 'touchmove' : 'mousemove';
      endName  = touch ? 'touchend' : 'mouseup';

      addEvent(document.documentElement, moveName, dragMove);
      addEvent(document.documentElement, endName, dragEnd);
      isDragging = false;
    }

    function dragMove (evt) {
      if (self.dragHandler) {
        callHandler(self.dragHandler, evt);
      }
      isDragging = true;
    }

    function dragEnd(evt) {
      if (!isDragging && self.pressHandler) {
        callHandler(self.pressHandler, evt);
      }
      removeEvent(document.documentElement, moveName, dragMove);
      removeEvent(document.documentElement, endName, dragEnd);
    }

    function callHandler(fn, evt) {
      var coords = getEventCoordinates(evt, self.el);
      fn.call(self, evt, coords.x, coords.y);
    }

    this.addEvent(el, 'mousedown', dragStart.bind(this, false));
    this.addEvent(el, 'touchstart', dragStart.bind(this, true));
    this.dragEventsSetup = true;
  }

  /**
   * Remove all event handlers previously added to the instance.
   */
  removeEvents = function() {
    this.events.forEach(function(e, i) {
      removeEvent(e.el, e.type, e.handler);
    });
    this.events = [];
  }

  /**
   * Sets the peel effect to a point in time along a previously
   * specified path. Will throw an error if no path exists.
   * @param {number} n The time value (between 0 and 1).
   */
  setTimeAlongPath = function(t) {
    t = clamp(t);
    var point = this.path.getPointForTime(t);
    this.timeAlongPath = t;
    this.setPeelPosition(point.x, point.y);
  }

  /**
   * Sets a threshold above which the top layer (including the backside) layer
   * will begin to fade out. This is calculated based on the visible clipped
   * area of the polygon. If a peel path is set, it will use the progress along
   * the path instead.
   * @param {number} n A point between 0 and 1.
   */
  setFadeThreshold = function(n) {
    this.fadeThreshold = n;
  }

  /**
   * Sets the position of the peel effect. This point is the position
   * of the corner that is being peeled back.
   * @param {Mixed} [...] Either x,y or a corner id.
   */
  setPeelPosition = function() {
    var pos = this.getPointOrCorner(arguments);
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
   * @param {Mixed} [...] Either x,y or a corner id.
   */
  /**
   * Sets the corner for the peel effect to happen from.
   */
  addPeelConstraint = function() {
    var p = this.getPointOrCorner(arguments);
    var radius = this.corner.subtract(p).getLength();
    this.constraints.push(new Circle(p, radius));
    this.calculateFlipConstraint();
  }

  /**
   * Sets an option to use for the effect.
   * @param {string} key The option to set.
   * @param {Mixed} value The value for the option.
   */
  setOption = function(key, value) {
    this.options[key] = value;
  }

  /**
   * Gets an option set by the user.
   * @param {string} key The key of the option to get.
   * @returns {Mixed}
   */
  getOption = function(key) {
    return this.options[camelize(key)];
  }

  /**
   * Gets the ratio of the area of the clipped top layer to the total area.
   * @returns {number} A value between 0 and 1.
   */
  getAmountClipped = function() {
    var topArea = this.getTopClipArea();
    var totalArea = this.width * this.height;
    return normalize(topArea, totalArea, 0);
  }

  /**
   * Adds an event listener to the element and keeps track of it for later
   * removal.
   * @param {Element} el The element to add the handler to.
   * @param {string} type The event type.
   * @param {Function} fn The handler function.
   */
  private addEvent = function(el, type, fn) {
    addEvent(el, type, fn);
    this.events.push({
      el: el,
      type: type,
      handler: fn
    });
    return fn;
  }
  /**
   * Gets the area of the clipped top layer.
   * @returns {number}
   */
  private getTopClipArea = function() {
    var top  = new Polygon();
    this.elementBox.forEach(function(side) {
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
  private calculateFlipConstraint = function() {
    var corner = this.corner, arr = this.constraints.concat();
    this.flipConstraint = arr.sort(function(a, b) {
      var aY = corner.y - a.center.y;
      var bY = corner.y - b.center.y;
      return a - b;
    })[0];
  }

  /**
   * Called when the drag event starts.
   * @param {Event} evt The original DOM event.
   * @param {string} type The event type, "mouse" or "touch".
   * @param {Function} fn The handler function to be called on drag.
   */
  private dragStart = function(evt, type, fn) {
  }

  /**
   * Calls an event handler using the coordinates of the event.
   * @param {Event} evt The original event.
   * @param {Function} fn The handler to call.
   */
  private fireHandler = function(evt, fn) {
    var coords = getEventCoordinates(evt, this.el);
    fn.call(this, evt, coords.x, coords.y);
  }

  /**
   * Sets the clipping points of the top and back layers based on a line
   * segment that represents the peel line.
   */
  private setClipping = function() {
    var top  = new Polygon();
    var back = new Polygon();
    this.clippingBox.forEach(function(side) {
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
  private distributeLineByPeelLine = function(seg, poly1, poly2) {
    var intersect = this.peelLineSegment.getIntersectPoint(seg);
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
  private distributePointByPeelLine = function(p, poly1, poly2) {
    if (!p) return;
    var d = this.peelLineSegment.getPointDeterminant(p);
    if (d <= 0) {
      poly1.addPoint(p);
    }
    if (d >= 0 && poly2) {
      poly2.addPoint(this.flipPointHorizontally(p));
    }
  }

  /**
   * Sets the options for the effect, merging in defaults.
   * @param {Object} opt User options.
   */
  private setOptions = function(opt) {
    var options = opt || {}, defaults = Peel.Defaults;
    for (var key in defaults) {
      if (!defaults.hasOwnProperty(key) || key in options) {
        continue;
      }
      options[key] = defaults[key];
    }
    this.options = options;
  }

  /**
   * Finds or creates a layer in the dom.
   * @param {string} id The internal id of the element to be found or created.
   * @param {HTMLElement} parent The parent if the element needs to be created.
   * @param {numer} zIndex The z index of the layer.
   * @returns {HTMLElement}
   */
  private findOrCreateLayer = function(id, parent, zIndex) {
    var optId = id + '-element';
    var domId = prefix(id);
    var el = getElement(this.getOption(optId) || '.' + domId, parent);
    if (!el) {
      el = createElement(parent, domId);
    }
    addClass(el, prefix('layer'));
    setZIndex(el, zIndex);
    return el;
  }

  /**
   * Returns either a point created from 2 arguments (x/y) or a corner point
   * created from the first argument as a corner id.
   * @param {Arguments} args The arguments object from the original function.
   * @returns {Point}
   */
  private getPointOrCorner = function(args) {
    if (args.length === 2) {
      return new Point(args[0], args[1]);
    } else if(typeof args[0] === 'number') {
      return this.getCornerPoint(args[0]);
    }
    return args[0];
  }

  /**
   * Returns a corner point based on an id defined in Peel.Corners.
   * @param {number} id The id of the corner.
   */
  private getCornerPoint = function(id) {
    var x = +!!(id & 1) * this.width;
    var y = +!!(id & 2) * this.height;
    return new Point(x, y);
  }

  /**
   * Gets an optional clipping shape that may be set by the user.
   * @returns {Object}
   */
  private getOptionalShape = function() {
    var shapes = ['rect', 'polygon', 'path', 'circle'], found;
    shapes.some(function(type) {
      var attr = this.getOption(type), obj;
      if (attr) {
        obj = {};
        obj.attributes = attr;
        obj.type = type;
        found = obj;
      }
      return found;
    }, this);
    return found;
  }

  /**
   * Sets up the main layers used for the effect that may include a possible
   * subclip shape.
   */
  private setupLayers = function() {
    var shape = this.getOptionalShape();

    // The inner layers may be wrapped later, so keep a reference to them here.
    var topInnerLayer  = this.topLayer  = this.findOrCreateLayer('top', this.el, 2);
    var backInnerLayer = this.backLayer = this.findOrCreateLayer('back', this.el, 3);

    this.bottomLayer = this.findOrCreateLayer('bottom', this.el, 1);

    if (shape) {
      // If there is an SVG shape specified in the options, then this needs to
      // be a separate clipped element because Safari/Mobile Safari can't handle
      // nested clip-paths. The current top/back element will become the shape
      // clip, so wrap them with an "outer" clip element that will become the
      // new layer for the peel effect. The bottom layer does not require this
      // effect, so the shape clip can be set directly on it.
      this.topLayer  = this.wrapShapeLayer(this.topLayer, 'top-outer-clip');
      this.backLayer = this.wrapShapeLayer(this.backLayer, 'back-outer-clip');

      this.topShapeClip    = new SVGClip(topInnerLayer, shape);
      this.backShapeClip   = new SVGClip(backInnerLayer, shape);
      this.bottomShapeClip = new SVGClip(this.bottomLayer, shape);

      if (this.getOption('topShadowCreatesShape')) {
        this.topShadowElement = this.setupDropShadow(shape, topInnerLayer);
      }
    } else {
      this.topShadowElement = this.findOrCreateLayer('top-shadow', topInnerLayer, 1);
    }

    this.topClip = new SVGClip(this.topLayer);
    this.backClip = new SVGClip(this.backLayer);

    this.backShadowElement     = this.findOrCreateLayer('back-shadow', backInnerLayer, 1);
    this.backReflectionElement = this.findOrCreateLayer('back-reflection', backInnerLayer, 2);
    this.bottomShadowElement   = this.findOrCreateLayer('bottom-shadow', this.bottomLayer, 1);

    this.usesBoxShadow = !shape;
  }

  /**
   * Creates an inline SVG element to be used as a layer for a drop shadow filter
   * effect. Note that drop shadow filters currently have some odd quirks in
   * Blink such as blur radius changing depending on rotation, etc.
   * @param {Object} shape A shape describing the SVG element to be used.
   * @param {HTMLElement} parent The parent element where the layer will be added.
   * @returns {SVGElement}
   */
  private setupDropShadow = function(shape, parent) {
    var svg = createSVGElement('svg', parent, {
      'class': prefix('layer')
    });
    createSVGElement(shape.type, svg, shape.attributes);
    return svg;
  }

  /**
   * Wraps the passed element in another layer, preserving its z-index. Also
   * add a "shape-layer" class to the layer which now becomes a shape clip.
   * @param {HTMLElement} el The element to become the wrapped shape layer.
   * @param {string} id The identifier for the new layer that will wrap the element.
   * @returns {HTMLElement} The new element that wraps the shape layer.
   */
  private wrapShapeLayer = function(el, id) {
    var zIndex = getZIndex(el);
    addClass(el, prefix('shape-layer'));
    var outerLayer = this.findOrCreateLayer(id, this.el, zIndex);
    outerLayer.appendChild(el);
    return outerLayer;
  }

  /**
   * Sets up the dimensions of the element box and clipping box that area used
   * in the effect.
   */
  private setupDimensions = function() {
    this.width  = this.el.offsetWidth;
    this.height = this.el.offsetHeight;
    this.center = new Point(this.width / 2, this.height / 2);

    this.elementBox  = this.getScaledBox(1);
    this.clippingBox = this.getScaledBox(this.getOption('clippingBoxScale'));
  }

  /**
   * Gets a box defined by 4 line segments that is at a scale of the main
   * element.
   * @param {number} scale The scale for the box to be.
   */
  private getScaledBox = function(scale) {

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
  private getConstrainedPeelPosition = function(pos) {
    this.constraints.forEach(function(area) {
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
   * @returns {number|undefined}
   */
  private getFlipConstraintOffset = function(area, pos) {
    var offset = this.getOption('flipConstraintOffset');
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
  private getPeelLineSegment = function(point) {
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
  private setBackTransform = function(pos) {
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
  private getPeelLineDistance = function() {
    var cornerId, opposingCornerId, corner, opposingCorner;
    if (this.peelLineRotation < 90) {
      cornerId = Peel.Corners.TOP_RIGHT;
      opposingCornerId = Peel.Corners.BOTTOM_LEFT;
    } else if (this.peelLineRotation < 180) {
      cornerId = Peel.Corners.BOTTOM_RIGHT;
      opposingCornerId = Peel.Corners.TOP_LEFT;
    } else if (this.peelLineRotation < 270) {
      cornerId = Peel.Corners.BOTTOM_LEFT;
      opposingCornerId = Peel.Corners.TOP_RIGHT;
    } else if (this.peelLineRotation < 360) {
      cornerId = Peel.Corners.TOP_LEFT;
      opposingCornerId = Peel.Corners.BOTTOM_RIGHT;
    }
    corner = this.getCornerPoint(cornerId);
    opposingCorner = this.getCornerPoint(opposingCornerId);

    // Scale the line segment past the original corners so that the effects
    // can have a nice fadeout even past 1.
    var cornerToCorner = new LineSegment(corner, opposingCorner).scale(2);
    var intersect = this.peelLineSegment.getIntersectPoint(cornerToCorner);
    if (!intersect) {
      // If there is no intersect, then assume that it has run past the opposing
      // corner and set the distance to well past the full distance.
      return 2;
    }
    var distanceToPeelLine = corner.subtract(intersect).getLength();
    var totalDistance      = corner.subtract(opposingCorner).getLength();
    return (distanceToPeelLine / totalDistance);
  }

  /**
   * Sets shadows and fade effects.
   */
  private setEffects = function() {
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
  private setTopShadow = function(t) {
    if (!this.getOption('topShadow')) {
      return;
    }
    var sBlur  = this.getOption('topShadowBlur');
    var sX     = this.getOption('topShadowOffsetX');
    var sY     = this.getOption('topShadowOffsetY');
    var alpha  = this.getOption('topShadowAlpha');
    var sAlpha = this.exponential(t, 5, alpha);
    if (this.usesBoxShadow) {
      setBoxShadow(this.topShadowElement, sX, sY, sBlur, 0, sAlpha);
    } else {
      setDropShadow(this.topShadowElement, sX, sY, sBlur, sAlpha);
    }
  }

  /**
   * Gets a number either distributed along a bell curve or increasing linearly.
   * @param {number} n The number to transform.
   * @param {boolean} dist Whether or not to use distribution.
   * @param {number} mult A multiplier for the result.
   * @returns {number}
   */
  private distributeOrLinear = function(n, dist, mult) {
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
  private exponential = function(n, exp, mult) {
    return mult * clamp(Math.pow(1 + n, exp) - 1);
  }

  /**
   * Sets reflection of the back face as a linear gradient.
   * @param {number} t Position of the peel line from corner to corner.
   */
  private setBackReflection = function(t) {
    var stops = [];
    if (this.canSetLinearEffect('backReflection', t)) {

      var rDistribute = this.getOption('backReflectionDistribute');
      var rSize = this.getOption('backReflectionSize');
      var rOffset = this.getOption('backReflectionOffset');
      var rAlpha = this.getOption('backReflectionAlpha');

      var reflectionSize = this.distributeOrLinear(t, rDistribute, rSize);
      var rStop  = t - rOffset;
      var rMid   = rStop - reflectionSize;
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
  private setBackShadow = function(t) {
    var stops = [];
    if (this.canSetLinearEffect('backShadow', t)) {

      var sSize       = this.getOption('backShadowSize');
      var sOffset     = this.getOption('backShadowOffset');
      var sAlpha      = this.getOption('backShadowAlpha');
      var sDistribute = this.getOption('backShadowDistribute');

      var shadowSize  = this.distributeOrLinear(t, sDistribute, sSize);
      var shadowStop  = t - sOffset;
      var shadowMid   = shadowStop - shadowSize;
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
  private setBottomShadow = function(t) {
    var stops = [];
    if (this.canSetLinearEffect('bottomShadow', t)) {

      // Options
      var sSize = this.getOption('bottomShadowSize');
      var offset = this.getOption('bottomShadowOffset');
      var darkAlpha = this.getOption('bottomShadowDarkAlpha');
      var lightAlpha = this.getOption('bottomShadowLightAlpha');
      var sDistribute = this.getOption('bottomShadowDistribute');

      var darkShadowStart = t - (.025 - offset);
      var midShadowStart = darkShadowStart - (this.distributeOrLinear(t, sDistribute, .03) * sSize) - offset;
      var lightShadowStart = midShadowStart - ((.02 * sSize) - offset);
      stops = [
        getBlackStop(0, 0),
        getBlackStop(0, lightShadowStart),
        getBlackStop(lightAlpha, midShadowStart),
        getBlackStop(lightAlpha, darkShadowStart),
        getBlackStop(darkAlpha, t)
      ];
    }
    setBackgroundGradient(this.bottomShadowElement, this.peelLineRotation + 180, stops);
  }

  /**
   * Whether a linear effect can be set.
   * @param {string} name Name of the effect
   * @param {number} t Current position of the linear effect line.
   * @returns {boolean}
   */
  private canSetLinearEffect = function(name, t) {
    return this.getOption(name) && t > 0;
  }

  /**
   * Sets the fading effect of the top layer, if a threshold is set.
   */
  private setFade = function() {
    var threshold = this.fadeThreshold, opacity = 1, n;
    if (threshold) {
      if (this.timeAlongPath !== undefined) {
        n = this.timeAlongPath;
      } else {
        n = this.getAmountClipped();
      }
      if (n > threshold) {
        opacity = (1 - n) / (1 - threshold);
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
  private flipPointHorizontally = function(p) {
    return new Point(p.x - ((p.x - this.center.x) * 2), p.y);
  }

  /**
   * Post setup initialization.
   */
  private init = function() {
    if (this.getOption('setPeelOnInit')) {
      this.setPeelPosition(this.corner);
    }
    addClass(this.el, prefix('ready'));
  }
}

/**
 * Class that clips an HTMLElement by an SVG path.
*/
class SVGClip {
  el: HTMLElement;
  shape: unknown;

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
  static getDefs = function() {
    if (!this.defs) {
      this.svg  = createSVGElement('svg', null, {
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
  static getId = function() {
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
  setPoints = function(points) {
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
  containsPoint = function(p) {
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
  private boundingRectContainsPoint = function(p) {
    return p.x >= this.center.x - this.radius && p.x <= this.center.x + this.radius &&
           p.y >= this.center.y - this.radius && p.y <= this.center.y + this.radius;
  }

  /**
   * Moves a point outside the circle to the closest point on the circumference.
   * Rotated angle from the center point should be the same.
   * @param {Point} p The point.
   * @returns {boolean}
   */
  constrainPoint = function(p) {
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
  static getArea = function(points) {
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
  addPoint = function(point) {
    this.points.push(point);
  }

  /**
   * Gets the points of the polygon as an array.
   * @returns {Array}
   */
  getPoints = function() {
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
  getPointForTime = function(t) {
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
  getPointForTime = function(t) {
    return this.p1.add(this.getVector().scale(t));
  }

  /**
   * Takes a scalar and returns a new scaled line segment.
   * @param {number} n The amount to scale the segment by.
   * @returns {LineSegment}
   */
  scale = function(n) {
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
  getPointDeterminant = function(p) {
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
  getIntersectPoint = function(seg2) {
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
  getAngle = function() {
    return this.getVector().getAngle();
  }

  /**
   * Gets the vector that represents the line segment.
   * @returns {Point}
   */
  private getVector = function() {
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
    public x: number,
    public y: number
  ) {
  }

  static readonly DEGREES_IN_RADIANS = 180 / Math.PI;

  /**
   * Gets degrees in radians.
   * @param {number} deg
   * @returns {number}
   */
  static degToRad = function(deg) {
    return deg / Point.DEGREES_IN_RADIANS;
  };

  /**
   * Gets radians in degrees.
   * @param {number} rad
   * @returns {number}
   */
  static radToDeg = function(rad) {
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
  static vector = function(deg, len) {
    var rad = Point.degToRad(deg);
    return new Point(Math.cos(rad) * len, Math.sin(rad) * len);
  };

  /**
   * Adds a point.
   * @param {Point} p
   * @returns {Point}
   */
  add = function(p) {
    return new Point(this.x + p.x, this.y + p.y);
  };

  /**
   * Subtracts a point.
   * @param {Point} p
   * @returns {Point}
   */
  subtract = function(p) {
    return new Point(this.x - p.x, this.y - p.y);
  };

  /**
   * Scales a point by a scalar.
   * @param {number} n
   * @returns {Point}
   */
  scale = function(n) {
    return new Point(this.x * n, this.y * n);
  };

  /**
   * Gets the length of the distance to the point.
   * @returns {number}
   */
  getLength = function() {
    return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
  };

  /**
   * Gets the angle of the point in degrees.
   * @returns {number}
   */
  getAngle = function() {
    return Point.radToDeg(Math.atan2(this.y, this.x));
  };

  /**
   * Returns a new point of the same length with a different angle.
   * @param {number} deg The angle in degrees.
   * @returns {Point}
   */
  setAngle = function(deg) {
    return Point.vector(deg, this.getLength());
  };

  /**
   * Rotates the point.
   * @param {number} deg The amount to rotate by in degrees.
   * @returns {Point}
   */
  rotate = function(deg) {
    return this.setAngle(this.getAngle() + deg);
  };
}