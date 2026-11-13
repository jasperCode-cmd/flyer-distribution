import L from "leaflet";

// A screenshot laid over the map where its alignment puts it: placed by
// three corners (top left, top right, bottom left), so a fit with a small
// rotation lines up too, which Leaflet's own image overlay can't do. It is
// hidden while the map zooms and redrawn after. Browser only.

export class AffineImageOverlay extends L.Layer {
  private img: HTMLImageElement | null = null;

  constructor(
    private url: string,
    private corners: [L.LatLng, L.LatLng, L.LatLng],
    private size: { width: number; height: number },
    private opacityValue = 0.5
  ) {
    super();
  }

  onAdd(map: L.Map): this {
    const img = document.createElement("img");
    img.src = this.url;
    img.alt = "";
    img.draggable = false;
    Object.assign(img.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${this.size.width}px`,
      height: `${this.size.height}px`,
      transformOrigin: "0 0",
      pointerEvents: "none",
      opacity: String(this.opacityValue),
      maxWidth: "none",
    });
    map.getPanes().overlayPane.appendChild(img);
    this.img = img;
    map.on("zoomstart", this.hide, this);
    map.on("zoomend viewreset moveend resize", this.update, this);
    this.update();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off("zoomstart", this.hide, this);
    map.off("zoomend viewreset moveend resize", this.update, this);
    this.img?.remove();
    this.img = null;
    return this;
  }

  setCorners(corners: [L.LatLng, L.LatLng, L.LatLng]) {
    this.corners = corners;
    this.update();
  }

  setOpacity(opacity: number) {
    this.opacityValue = opacity;
    if (this.img) this.img.style.opacity = String(opacity);
  }

  private hide() {
    if (this.img) this.img.style.visibility = "hidden";
  }

  private update() {
    const map = this._map;
    if (!map || !this.img) return;
    const [p0, p1, p2] = this.corners.map((c) => map.latLngToLayerPoint(c));
    const { width, height } = this.size;
    const a = (p1.x - p0.x) / width;
    const b = (p1.y - p0.y) / width;
    const c = (p2.x - p0.x) / height;
    const d = (p2.y - p0.y) / height;
    this.img.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${p0.x}, ${p0.y})`;
    this.img.style.visibility = "visible";
  }
}
