/** The map credit the OpenStreetMap and OpenFreeMap licences ask for. */
export function MapAttribution() {
  const a = "underline underline-offset-2";
  return (
    <p className="mt-8 text-[12px] text-secondary">
      Map data ©{" "}
      <a href="https://www.openstreetmap.org/copyright" className={a}>
        OpenStreetMap contributors
      </a>
      , served by{" "}
      <a href="https://openfreemap.org" className={a}>
        OpenFreeMap
      </a>{" "}
      with{" "}
      <a href="https://openmaptiles.org" className={a}>
        OpenMapTiles
      </a>
      .
    </p>
  );
}
