import { useMemo, useState } from "react"
import type { ConfirmItem, PurchaseNote, ReceiptItem } from "../lib/types"
import { useWarung } from "../lib/store"
import { callScanReceipt } from "../lib/api"
import { isSupabaseConfigured } from "../lib/supabase"
import { findProduct } from "../lib/parser"
import { prepareImage, shrinkDataUrl } from "../lib/image"
import { rupiah } from "../lib/format"
import { Icon } from "./Icon"
import { ConfirmEditor, confirmIsValid, confirmTotal } from "./ConfirmEditor"
import { Modal } from "./Modal"

type Step = "upload" | "scanning" | "review" | "saving" | "saved" | "error"

const SAMPLE_RECEIPT: ReceiptItem[] = [
  { name: "Minyak Goreng", qty: 5, unit: "liter", unit_price: 15000 },
  { name: "Gula Pasir", qty: 10, unit: "kg", unit_price: 14000 },
  { name: "Beras Ramos", qty: 25, unit: "kg", unit_price: 12000 },
]

const SAMPLE_TOTAL = SAMPLE_RECEIPT.reduce(
  (total, item) => total + item.qty * item.unit_price,
  0,
)

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
const SCAN_NEEDS_SETUP =
  "Pindai nota membutuhkan Supabase Edge Function dan kunci AI. Untuk demo, gunakan contoh nota di bawah."

export function ReceiptModal({ onClose }: { onClose: () => void }) {
  const { products, addProduct, savePurchaseWithNote } = useWarung()
  const [step, setStep] = useState<Step>("upload")
  const [preview, setPreview] = useState("")
  const [items, setItems] = useState<ConfirmItem[]>([])
  const [notaTotal, setNotaTotal] = useState(0)
  const [error, setError] = useState("")
  const [savedTotal, setSavedTotal] = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  // Siapa yang menambah stok — dipakai pemilik untuk memeriksa pegawainya.
  const [addedBy, setAddedBy] = useState("")
  const [source, setSource] = useState<PurchaseNote["source"]>("scan")

  const computedTotal = confirmTotal(items)
  const difference = notaTotal > 0 ? computedTotal - notaTotal : 0

  const toConfirm = (receiptItems: ReceiptItem[]): ConfirmItem[] =>
    receiptItems.map((item, index) => {
      const product = findProduct(products, item.name)
      return {
        key: `receipt-${product?.id ?? index}-${item.name}`,
        productId: product?.id ?? "",
        name: product?.name ?? item.name,
        qty: item.qty,
        unit: product?.unit ?? item.unit,
        unitPrice: item.unit_price,
        isNew: !product,
        newSellPrice: product ? undefined : Math.round(item.unit_price * 1.15),
      }
    })

  const useSample = () => {
    setPreview("")
    setNotaTotal(SAMPLE_TOTAL)
    setItems(toConfirm(SAMPLE_RECEIPT))
    setSource("contoh")
    setError("")
    setStep("review")
  }

  const handleFile = async (file: File) => {
    setError("")
    if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setStep("error")
      setError(
        "Format foto harus JPEG, PNG, atau WebP. Foto HEIC dari iPhone perlu diubah dulu.",
      )
      return
    }
    if (!isSupabaseConfigured) {
      setStep("error")
      setError(SCAN_NEEDS_SETUP)
      return
    }
    setStep("scanning")
    try {
      const image = await prepareImage(file)
      setPreview(image.dataUrl)
      setSource("scan")
      const result = await callScanReceipt(image.base64, image.mimeType)
      if (!result || !Array.isArray(result.items) || result.items.length === 0) {
        throw new Error(
          "Tidak ada barang yang terbaca. Pastikan seluruh nota terlihat jelas, atau gunakan contoh nota untuk demo.",
        )
      }
      setItems(toConfirm(result.items))
      setNotaTotal(
        typeof result.total === "number" && result.total > 0
          ? result.total
          : result.items.reduce((total, item) => total + item.qty * item.unit_price, 0),
      )
      setStep("review")
    } catch (scanError) {
      const message =
        scanError instanceof Error
          ? scanError.message
          : "Gagal memindai nota. Coba lagi atau gunakan contoh nota."
      setError(
        message.includes("Supabase") || message.includes("Functions")
          ? SCAN_NEEDS_SETUP
          : message,
      )
      setStep("error")
    }
  }

  const handleSave = async () => {
    setStep("saving")
    setError("")
    try {
      // Cek dulu semua nama yang bentrok: kalau tidak, produk yang sudah
      // terlanjur dibuat akan menggantung (yatim) tanpa muncul di daftar.
      for (const item of items) {
        if (item.isNew && findProduct(products, item.name)) {
          throw new Error(
            `"${item.name}" sudah ada sebagai "${findProduct(products, item.name)?.name}". Perbarui baris itu dulu sebelum menyimpan.`,
          )
        }
      }

      const prepared: ConfirmItem[] = []
      for (const item of items) {
        if (item.isNew) {
          const product = await addProduct({
            name: item.name.trim(),
            unit: item.unit,
            stock: 0,
            min_stock: 0,
            buy_price: item.unitPrice,
            sell_price: item.newSellPrice ?? Math.round(item.unitPrice * 1.15),
            aliases: [],
          })
          prepared.push({ ...item, productId: product.id, name: product.name, isNew: false })
        } else {
          prepared.push(item)
        }
      }
      const total = confirmTotal(prepared)
      const count = prepared.length
      // Foto nota disimpan versi kecil supaya riwayat tidak berat.
      const thumb = await shrinkDataUrl(preview)
      await savePurchaseWithNote(prepared, {
        addedBy: addedBy.trim() || "Pemilik warung",
        image: thumb,
        source,
      })
      setSavedTotal(total)
      setSavedCount(count)
      setStep("saved")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan nota.")
      setStep("review")
    }
  }

  const reset = () => {
    setStep("upload")
    setPreview("")
    setItems([])
    setNotaTotal(0)
    setSource("scan")
    setError("")
  }

  const totalLabel = useMemo(() => {
    if (notaTotal <= 0) return null
    return (
      <div className="receipt-total-compare">
        <div>
          <span>Total di nota</span>
          <strong>{rupiah(notaTotal)}</strong>
        </div>
        <div>
          <span>Total baris yang dikonfirmasi</span>
          <strong>{rupiah(computedTotal)}</strong>
        </div>
        {Math.abs(difference) >= 1 && (
          <p className={difference > 0 ? "danger" : "warning"}>
            <Icon name="warning" size={14} />
            Selisih {rupiah(Math.abs(difference))}. Periksa jumlah atau harga barang.
          </p>
        )}
      </div>
    )
  }, [computedTotal, difference, notaTotal])

  return (
    <Modal label="Pindai nota belanja" onClose={onClose}>
      {step === "saved" ? (
          <div className="modal-success">
            <span className="success-orb">
              <Icon name="check" size={30} />
            </span>
            <span className="modal-kicker">TERSIMPAN</span>
            <h2>Nota berhasil dicatat!</h2>
            <p>
              {savedCount} barang masuk · {rupiah(savedTotal)}. Stok dan harga modal sudah
              diperbarui.
            </p>
            <p className="ask-note">
              Nota tersimpan di riwayat nota — pemilik bisa melihat kapan pun bukti belanjanya.
            </p>
            <button className="primary-action full" onClick={onClose}>
              Selesai <Icon name="check" size={17} />
            </button>
          </div>
        ) : step === "review" || step === "saving" ? (
          <>
            <span className="modal-kicker">PERIKSA DULU, LALU SIMPAN</span>
            <h2>Apakah isi nota sudah benar?</h2>
            <p>
              AI hanya mengusulkan. Periksa nama barang, jumlah, dan harga modal sebelum
              menyimpan.
            </p>
            {preview && (
              <div className="receipt-preview">
                <img src={preview} alt="Pratinjau nota yang dipindai" />
                <span>Foto nota</span>
              </div>
            )}
            {!preview && (
              <div className="sample-badge">
                <Icon name="receipt" size={16} /> Contoh nota demo
              </div>
            )}
            <ConfirmEditor items={items} products={products} mode="purchase" onChange={setItems} />
            <div className="debtor-field">
              <label htmlFor="note-added-by">Siapa yang menambah stok?</label>
              <input
                id="note-added-by"
                value={addedBy}
                onChange={(event) => setAddedBy(event.target.value)}
                placeholder="Contoh: Pegawai toko"
              />
              <small className="ask-note">
                Nama ini tersimpan di riwayat nota, jadi pemilik bisa melihat siapa yang menambah
                stok.
              </small>
            </div>
            {totalLabel}
            {error && <div className="form-error">{error}</div>}
            <div className="confirm-total">
              <span>Total belanja</span>
              <strong>{rupiah(computedTotal)}</strong>
            </div>
            <div className="modal-actions">
              <button className="secondary-action" onClick={reset} disabled={step === "saving"}>
                <Icon name="camera" size={16} /> Ganti foto
              </button>
              <button
                className="primary-action"
                onClick={() => void handleSave()}
                disabled={step === "saving" || !confirmIsValid(items, products, "purchase")}
              >
                {step === "saving" ? "Menyimpan…" : "Simpan ke stok"}
                {step !== "saving" && <Icon name="check" size={16} />}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="modal-kicker">NOTA BELANJA</span>
            <h2>Foto atau unggah nota</h2>
            <p>
              Pastikan seluruh nota terlihat jelas. Hasil pindai akan muncul di layar konfirmasi
              sebelum disimpan.
            </p>

            <label className={`scan-area ${step === "scanning" ? "scanning" : ""}`}>
              {step === "scanning" ? (
                <>
                  <span className="scan-spinner" />
                  <strong>Sedang membaca nota…</strong>
                  <span>Biasanya 3–10 detik. Jangan tutup layar ini.</span>
                </>
              ) : (
                <>
                  <Icon name="camera" size={42} />
                  <strong>Ambil foto nota</strong>
                  <span>atau pilih foto dari galeri</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void handleFile(file)
                      event.target.value = ""
                    }}
                  />
                </>
              )}
            </label>

            {error && <div className="form-error">{error}</div>}

            <small className="ask-note receipt-scan-note">
              <Icon name="warning" size={13} /> {SCAN_NEEDS_SETUP}
            </small>

            <div className="receipt-demo">
              <div>
                <strong>Belum ada foto nota?</strong>
                <span>Coba alur lengkapnya dengan contoh nota demo.</span>
              </div>
              <button className="secondary-action" onClick={useSample} disabled={step === "scanning"}>
                <Icon name="receipt" size={16} /> Gunakan contoh nota
              </button>
            </div>
          </>
        )}
    </Modal>
  )
}
