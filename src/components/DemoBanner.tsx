import { Icon } from "./Icon"

export function DemoBanner({
  source,
  syncError,
  onOpenSettings,
}: {
  source: "demo" | "supabase"
  syncError: string
  onOpenSettings: () => void
}) {
  if (source === "supabase" && !syncError) return null
  return (
    <div className={`data-banner ${syncError ? "warning" : ""}`}>
      <Icon name={syncError ? "warning" : "spark"} size={17} />
      <span>
        <strong>{syncError ? "Koneksi Supabase bermasalah." : "Mode demo aktif."}</strong>{" "}
        {syncError ||
          "Data disimpan di browser. Hubungkan Supabase lewat file .env agar data tersimpan di cloud."}
      </span>
      <button onClick={onOpenSettings}>Atur</button>
    </div>
  )
}
