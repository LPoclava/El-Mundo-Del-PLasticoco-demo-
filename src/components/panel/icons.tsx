import type { IconName } from "@/lib/panel-demo/roles";

/** Íconos de trazo único (24 px, 1,75 de grosor). Dibujados aquí para no sumar dependencias. */
const PATHS: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20",
  barcode: "M4 5v14M7.5 5v14M11 5v14M15.5 5v14M19 5v14M9 5v9M13 5v6",
  box: "M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3ZM3.5 7.5 12 12m0 0 8.5-4.5M12 12v9",
  tag: "M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7a1.5 1.5 0 0 1 1.06.44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-7.7 7.7a1.5 1.5 0 0 1-2.12 0l-7.3-7.3A1.5 1.5 0 0 1 3 12.2ZM8 8h.01",
  image: "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13ZM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4 16.5l4.5-4.5 4 4 3-3 4.5 4.5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  history: "M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2",
  users: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.7a3.5 3.5 0 0 1 0 6.6",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 13.5l1.4 1.1-1.8 3.1-1.7-.6a7.5 7.5 0 0 1-1.6.9l-.3 1.8H9.6l-.3-1.8a7.5 7.5 0 0 1-1.6-.9l-1.7.6L4 14.6l1.4-1.1a7.7 7.7 0 0 1 0-3l-1.4-1.1 1.8-3.1 1.7.6a7.5 7.5 0 0 1 1.6-.9L9.6 4h3.6l.3 1.8a7.5 7.5 0 0 1 1.6.9l1.7-.6 1.8 3.1-1.4 1.1a7.7 7.7 0 0 1 0 3.2Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14 8l3 3",
  archive: "M3.5 5h17v4h-17zM5 9v10h14V9M10 13h4",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  eyeOff: "M4 4l16 16M9.9 5.8A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.4 7.4A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.7-.3 3.8-.8M9.9 9.9a2.5 2.5 0 0 0 3.2 3.2",
  check: "m5 12.5 4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  logout: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16.5 14.5 12 10 7.5M14.5 12H4",
  chevronLeft: "m14.5 6-6 6 6 6",
  chevronRight: "m9.5 6 6 6-6 6",
  chevronDown: "m6 9.5 6 6 6-6",
  alert: "M12 4 2.8 19.5h18.4L12 4ZM12 10v4.5M12 17.2h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1",
  sort: "M8 4v16m0 0-3.5-3.5M8 20l3.5-3.5M16 20V4m0 0-3.5 3.5M16 4l3.5 3.5",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  refresh: "M20 11a8 8 0 0 0-14.5-4M4 4v3.5h3.5M4 13a8 8 0 0 0 14.5 4M20 20v-3.5h-3.5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0",
  trash: "M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5",
  dashboard: "M4 4h7v8H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 14h7v6H4z",
  scan: "M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8 9v6M11 9v6M14 9v6M17 9v6",
  boxes: "M3 11.5h8.5V20H3zM12.5 11.5H21V20h-8.5zM7.5 3.5H16v8H7.5zM7 15.5h1.5M16.5 15.5H18",
  cart: "M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.95-1.5L21 8H6.2M10 20.2h.01M17 20.2h.01",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const size = /(^|\s)size-/.test(className) ? "" : "size-5";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${size} ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
