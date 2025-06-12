async function n() {
  try {
    const o = await fetch("/theme.json");
    if (!o.ok)
      throw new Error(`Failed to load theme: ${o.status}`);
    const r = await o.json();
    return t(r), r;
  } catch (o) {
    console.warn("Failed to load theme, using defaults:", o);
    const r = {
      brandColor: "#D9232E",
      fontHeading: "'Inter', sans-serif",
      logo: "/placeholder-logo.png",
      instagram: null,
      extras: {}
    };
    return t(r), r;
  }
}
function t(o) {
  const r = document.documentElement;
  o.brandColor && (r.style.setProperty("--brand", o.brandColor), r.style.setProperty("--brand-rgb", e(o.brandColor))), o.fontHeading && r.style.setProperty("--font-heading", o.fontHeading), o.secondaryColor && r.style.setProperty("--secondary", o.secondaryColor), o.backgroundColor && r.style.setProperty("--background", o.backgroundColor), o.textColor && r.style.setProperty("--text", o.textColor);
}
function e(o) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(o);
  return r ? `${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}` : "217, 35, 46";
}
export {
  n as loadTheme
};
//# sourceMappingURL=index.js.map
