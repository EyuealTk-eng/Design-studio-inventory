/** Re-mounts on every navigation, so each page rises in (CSS only — see .enter-page). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="enter-page">{children}</div>;
}
