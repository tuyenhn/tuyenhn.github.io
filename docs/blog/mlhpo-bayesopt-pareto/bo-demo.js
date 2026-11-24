// Demo for the post: Bayesian optimisation (BO) of one hyperparameter (HP), with RMSE as the measure (lower is better).
// Surrogate model: a Gaussian process (GP) with a squared-exponential kernel and fixed kernel settings (no fitting).
// Acquisition function: the lower confidence bound, LCB(x) = mean(x) - KAPPA * sd(x). The next HP value is where the LCB is lowest.
// The script runs the full loop (the initial HP values, then N_ITER iterations) once, when the page loads.
// The CV noise is seeded, so the run is the same on each load. The controls only step through the saved iterations.
// The markup is `<figure class="bo-demo">` in `index.md`; the styles are `.bo-demo` in `assets/styles.css`.
// Colours are Tailwind values, as in the SVG figures of the post.
(() => {
  const figure = document.querySelector(".bo-demo");
  if (!figure) {
    return;
  }

  // ---- settings of the run

  const N_ITER = 30;
  const KAPPA = 2;
  const INIT_X = [0.05, 0.35, 0.95];
  // the HP goes from 0 to 1; the GP and the LCB are computed on this grid, and the next HP value is a grid point
  const GRID = Array.from({length: 201}, (_, i) => i / 200);
  // GP kernel: how far apart two HP values can be and still have similar RMSE (HP units), and the prior SD (RMSE units)
  const LENGTH_SCALE = 0.08;
  const SIGNAL_SD = 0.3;
  // CV noise: the same HP value gives a slightly different CV RMSE each time (other folds, other random seeds)
  const NOISE_SD = 0.03;
  const SEED = 1;

  // the true RMSE curve (unknown in practice): three dips, the lowest at 0.8
  const dip = (x, centre, width) => Math.exp(-((x - centre) ** 2) / (2 * width ** 2));
  const trueRmse = x => 1.3 - 0.3 * dip(x, 0.15, 0.07) - 0.32 * dip(x, 0.47, 0.06) - 0.55 * dip(x, 0.8, 0.04) + 0.3 * (x - 0.5) ** 2;

  // seeded random numbers (mulberry32), and normal noise from them (Box-Muller)
  let seed = SEED;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const cvRmse = x => trueRmse(x) + NOISE_SD * normal();

  // ---- GP posterior

  const kernel = (a, b) => SIGNAL_SD ** 2 * Math.exp(-((a - b) ** 2) / (2 * LENGTH_SCALE ** 2));

  // A = L L^T, for a symmetric positive-definite matrix A
  const cholesky = a => {
    const n = a.length;
    const l = a.map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = a[i][j];
        for (let p = 0; p < j; p++) {
          sum -= l[i][p] * l[j][p];
        }
        l[i][j] = i === j ? Math.sqrt(Math.max(sum, 1e-12)) : sum / l[j][j];
      }
    }
    return l;
  };
  // solve L y = b (forward), and L^T x = y (backward)
  const solveLower = (l, b) => {
    const y = [];
    b.forEach((value, i) => {
      let sum = value;
      for (let p = 0; p < i; p++) {
        sum -= l[i][p] * y[p];
      }
      y.push(sum / l[i][i]);
    });
    return y;
  };
  const solveUpper = (l, y) => {
    const x = new Array(y.length);
    for (let i = y.length - 1; i >= 0; i--) {
      let sum = y[i];
      for (let p = i + 1; p < y.length; p++) {
        sum -= l[p][i] * x[p];
      }
      x[i] = sum / l[i][i];
    }
    return x;
  };

  // mean and SD of the GP at each grid point, given the evaluated HP values (xs) and their CV RMSE (ys);
  // the prior mean is the mean of ys
  const posterior = (xs, ys) => {
    const priorMean = ys.reduce((a, b) => a + b, 0) / ys.length;
    const l = cholesky(xs.map((a, i) => xs.map((b, j) => kernel(a, b) + (i === j ? NOISE_SD ** 2 : 0))));
    const alpha = solveUpper(l, solveLower(l, ys.map(y => y - priorMean)));
    return GRID.map(x => {
      const k = xs.map(a => kernel(a, x));
      const v = solveLower(l, k);
      return {
        mean: priorMean + k.reduce((sum, ki, i) => sum + ki * alpha[i], 0),
        sd: Math.sqrt(Math.max(SIGNAL_SD ** 2 - v.reduce((sum, vi) => sum + vi * vi, 0), 0))
      };
    });
  };

  // ---- the BO loop: state i is the archive after i iterations, the GP fitted to it, and the next HP value

  const states = [];
  const xs = [...INIT_X];
  const ys = INIT_X.map(cvRmse);
  for (let i = 0; i <= N_ITER; i++) {
    const gp = posterior(xs, ys);
    const lcb = gp.map(p => p.mean - KAPPA * p.sd);
    const next = lcb.indexOf(Math.min(...lcb));
    const best = ys.indexOf(Math.min(...ys));
    states.push({xs: [...xs], ys: [...ys], gp, lcb, next, best});
    if (i < N_ITER) {
      xs.push(GRID[next]);
      ys.push(cvRmse(GRID[next]));
    }
  }

  // ---- the plot (SVG, made once; `show` changes its paths and points)

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svgEl = (name, attrs, parent) => {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    parent?.append(node);
    return node;
  };
  const svgText = (content, attrs, parent) => {
    const node = svgEl("text", attrs, parent);
    node.textContent = content;
    return node;
  };

  // plot box and axis ranges
  const box = {left: 70, right: 650, top: 70, bottom: 330};
  const yMin = 0.6;
  const yMax = 1.6;
  const sx = x => box.left + x * (box.right - box.left);
  const sy = y => box.bottom - ((y - yMin) / (yMax - yMin)) * (box.bottom - box.top);
  const pathOf = (values, xOf = i => GRID[i]) => values
    .map((y, i) => `${i ? "L" : "M"}${sx(xOf(i)).toFixed(1)} ${sy(y).toFixed(1)}`)
    .join(" ");

  const colours = {
    axis: "#6b7280",
    grid: "#e5e7eb",
    label: "#1f2937",
    muted: "#4b5563",
    truth: "#9ca3af",
    band: "#3b82f6",
    mean: "#2563eb",
    lcb: "#f97316",
    point: "#1f2937",
    best: "#1d4ed8"
  };

  const svg = svgEl("svg", {
    viewBox: "0 0 680 390",
    role: "img",
    "aria-label": "Bayesian optimisation of one hyperparameter with a Gaussian process and the lower confidence bound. "
      + "The x-axis is the hyperparameter value, the y-axis is RMSE. "
      + "The plot shows the evaluated values, the GP mean and band, the LCB curve, and the next value to evaluate."
  });
  const defs = svgEl("defs", {}, svg);
  const clip = svgEl("clipPath", {id: "bo-demo-clip"}, defs);
  svgEl("rect", {x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top}, clip);

  const root = svgEl("g", {"font-family": "Montserrat, ui-sans-serif, system-ui, sans-serif", "dominant-baseline": "central"}, svg);

  // grid lines, ticks, and axis titles
  for (let y = yMin; y <= yMax + 1e-9; y += 0.2) {
    svgEl("path", {d: `M${box.left} ${sy(y)} H${box.right}`, stroke: colours.grid, "stroke-width": 1}, root);
    svgText(y.toFixed(1), {x: box.left - 8, y: sy(y), "text-anchor": "end", "font-size": 11, fill: colours.axis}, root);
  }
  for (let x = 0; x <= 1 + 1e-9; x += 0.2) {
    svgEl("path", {d: `M${sx(x)} ${box.bottom} v5`, stroke: colours.axis, "stroke-width": 1}, root);
    svgText(x.toFixed(1), {x: sx(x), y: box.bottom + 16, "text-anchor": "middle", "font-size": 11, fill: colours.axis}, root);
  }
  svgEl("path", {d: `M${box.left} ${box.top} V${box.bottom} H${box.right}`, fill: "none", stroke: colours.axis, "stroke-width": 1.5}, root);
  svgText("Hyperparameter value", {x: (box.left + box.right) / 2, y: box.bottom + 40, "text-anchor": "middle", "font-size": 13, fill: colours.label}, root);
  const yTitle = svgEl("g", {transform: "rotate(-90)", "text-anchor": "middle"}, root);
  svgText("CV RMSE", {x: -(box.top + box.bottom) / 2, y: 18, "font-size": 13, fill: colours.label}, yTitle);
  svgText("lower is better", {x: -(box.top + box.bottom) / 2, y: 34, "font-size": 11, fill: colours.axis}, yTitle);

  // legend, two rows above the plot
  const legend = svgEl("g", {"font-size": 12, fill: colours.muted}, root);
  svgEl("circle", {cx: 82, cy: 18, r: 4.5, fill: colours.point, stroke: "#ffffff", "stroke-width": 1.5}, legend);
  svgText("Evaluated HP value, at its CV RMSE", {x: 94, y: 18}, legend);
  svgEl("path", {d: "M352 18 H372", stroke: colours.truth, "stroke-width": 2, "stroke-dasharray": "6 4"}, legend);
  svgText("True RMSE (unknown in practice)", {x: 378, y: 18}, legend);
  svgEl("path", {d: "M72 42 H92", stroke: colours.mean, "stroke-width": 2}, legend);
  svgText("GP mean (μ)", {x: 98, y: 42}, legend);
  svgEl("rect", {x: 196, y: 36, width: 20, height: 12, fill: colours.band, "fill-opacity": 0.15}, legend);
  svgText("μ ± 2σ", {x: 222, y: 42}, legend);
  svgEl("path", {d: "M292 42 H312", stroke: colours.lcb, "stroke-width": 2}, legend);
  svgText("LCB = μ − 2σ (acquisition function)", {x: 318, y: 42}, legend);

  // the parts that change with the iteration
  const plot = svgEl("g", {"clip-path": "url(#bo-demo-clip)"}, root);
  const band = svgEl("path", {fill: colours.band, "fill-opacity": 0.15, stroke: "none"}, plot);
  svgEl("path", {d: pathOf(GRID.map(trueRmse)), fill: "none", stroke: colours.truth, "stroke-width": 2, "stroke-dasharray": "6 4", "stroke-linecap": "round"}, plot);
  const mean = svgEl("path", {fill: "none", stroke: colours.mean, "stroke-width": 2}, plot);
  const lcb = svgEl("path", {fill: "none", stroke: colours.lcb, "stroke-width": 2}, plot);
  const nextMark = svgEl("g", {}, root);
  const nextLine = svgEl("path", {fill: "none", stroke: colours.lcb, "stroke-width": 1.5, "stroke-dasharray": "4 3"}, nextMark);
  const nextDot = svgEl("circle", {r: 5, fill: colours.lcb, stroke: "#ffffff", "stroke-width": 1.5}, nextMark);
  const nextLabel = svgText("next", {y: box.top - 9, "text-anchor": "middle", "font-size": 12, "font-weight": 600, fill: colours.lcb}, nextMark);
  const points = svgEl("g", {fill: colours.point, stroke: "#ffffff", "stroke-width": 1.5}, root);
  const bestRing = svgEl("circle", {r: 9, fill: "none", stroke: colours.best, "stroke-width": 1.5}, root);

  // ---- the controls and the status line (below the plot, above the caption)

  const controls = document.createElement("div");
  controls.className = "bo-demo-controls";
  const button = (label, ariaLabel) => {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = label;
    if (ariaLabel) {
      node.setAttribute("aria-label", ariaLabel);
    }
    controls.append(node);
    return node;
  };
  const playButton = button("Play");
  const backButton = button("‹", "Previous iteration");
  const slider = document.createElement("input");
  Object.assign(slider, {type: "range", min: 0, max: N_ITER, step: 1, value: 0});
  slider.setAttribute("aria-label", "Iteration");
  controls.append(slider);
  const nextButton = button("›", "Next iteration");

  const status = document.createElement("p");
  status.className = "bo-demo-status";
  status.setAttribute("aria-live", "polite");

  figure.prepend(svg, controls, status);

  // ---- show one state

  const fmt = value => value.toFixed(2);
  let current = 0;
  const show = index => {
    current = index;
    const state = states[index];
    const isLast = index === N_ITER;

    band.setAttribute("d", `${pathOf(state.gp.map(p => p.mean + KAPPA * p.sd))} ${pathOf(
      [...state.gp].reverse().map(p => p.mean - KAPPA * p.sd),
      i => GRID[GRID.length - 1 - i]
    ).replace(/^M/, "L")} Z`);
    mean.setAttribute("d", pathOf(state.gp.map(p => p.mean)));
    lcb.setAttribute("d", pathOf(state.lcb));

    // the next HP value: a dashed line, and a dot at the lowest point of the LCB; none after the last iteration
    nextMark.setAttribute("visibility", isLast ? "hidden" : "visible");
    const nx = sx(GRID[state.next]);
    nextLine.setAttribute("d", `M${nx} ${box.top} V${box.bottom}`);
    nextDot.setAttribute("cx", nx);
    nextDot.setAttribute("cy", Math.min(Math.max(sy(state.lcb[state.next]), box.top), box.bottom));
    nextLabel.setAttribute("x", nx);

    points.replaceChildren(...state.xs.map((x, i) => svgEl("circle", {cx: sx(x), cy: sy(state.ys[i]), r: 4.5})));
    bestRing.setAttribute("cx", sx(state.xs[state.best]));
    bestRing.setAttribute("cy", sy(state.ys[state.best]));

    const bestText = `best CV RMSE ${fmt(state.ys[state.best])} at HP value ${fmt(state.xs[state.best])} (circled)`;
    status.textContent = isLast
      ? `Iteration ${index} of ${N_ITER}: the budget is used up. The result is the ${bestText}.`
      : `Iteration ${index} of ${N_ITER}: ${state.xs.length} HP values evaluated, ${bestText}. `
        + `Next: HP value ${fmt(GRID[state.next])}, where the LCB is lowest.`;

    slider.value = index;
    backButton.disabled = index === 0;
    nextButton.disabled = isLast;
  };

  // ---- play, step, and drag

  let timer = 0;
  const pause = () => {
    clearInterval(timer);
    timer = 0;
    playButton.textContent = "Play";
  };
  const play = () => {
    if (current === N_ITER) {
      show(0);
    }
    playButton.textContent = "Pause";
    timer = setInterval(() => {
      show(current + 1);
      if (current === N_ITER) {
        pause();
      }
    }, 700);
  };
  playButton.addEventListener("click", () => (timer ? pause() : play()));
  backButton.addEventListener("click", () => {
    pause();
    show(Math.max(current - 1, 0));
  });
  nextButton.addEventListener("click", () => {
    pause();
    show(Math.min(current + 1, N_ITER));
  });
  slider.addEventListener("input", () => {
    pause();
    show(Number(slider.value));
  });

  show(0);
})();
