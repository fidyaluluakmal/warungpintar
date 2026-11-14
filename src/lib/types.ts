// Shared data contract for Warung Pintar.
// These shapes mirror the Supabase tables described in the PRD.

export type TransactionType = "sale" | "purchase" | "adjustment"

export interface Product {
  id: string
  name: string
  unit: string
  /** Current stock. The database trigger keeps this in sync with transactions. */
  stock: number
  min_stock: number
  buy_price: number
  sell_price: number
  /**
   * Lama barang sampai dari pemasok dalam hari. Kalau kosong, dipakai
   * perkiraan berdasarkan kategori barang.
   */
  lead_time_days?: number
  /** Convenience field for the UI. Stored in product_aliases in Supabase. */
  aliases: string[]
  /**
   * Barang tidak dijual lagi. Tersembunyi dari Kasir, Stok Barang, saran
   * restok, dan pencarian suara; riwayat transaksi tetap utuh.
   */
  archived?: boolean
}

export interface Transaction {
  id: string
  type: TransactionType
  product_id: string
  qty: number
  unit_price: number
  created_at: string
  /**
   * Catat jenis penyesuaian (untuk type "adjustment"):
   * - "opname": hasil hitung fisik di gudang.
   * - "simpen-dulu": barang keluar untuk Piutang yang menyimpan dulu.
   */
  note?: string | null
}

export interface TransactionWithProduct extends Transaction {
  product: Product
}

/** Output of the parse-voice edge function. */
export interface VoiceItem {
  name: string
  qty: number
  unit: string
  confidence: number
}

export interface VoiceParseResult {
  items: VoiceItem[]
  /** Terisi kalau ucapan menandakan barang disimpan dulu (utang). */
  debtor?: string | null
}

/** Output of the scan-receipt edge function. */
export interface ReceiptItem {
  name: string
  qty: number
  unit: string
  unit_price: number
}

export interface ReceiptScanResult {
  items: ReceiptItem[]
  total: number
}

/** Output of the advisor edge function. */
export interface AdvisorTip {
  text: string
  reason: string
}

export interface AdvisorResult {
  tips: AdvisorTip[]
}

/** Satu baris buku utang ("simpen dulu"). */
export interface Debt {
  id: string
  debtor: string
  product_name: string
  qty: number
  unit: string
  amount: number
  note: string | null
  created_at: string
  settled_at: string | null
}

/** Output of the ask-warung edge function. */
export interface AskWarungResult {
  answer: string
}

/** Satu Piutang/langganan warung (bukan transaksi). */
export interface Customer {
  id: string
  name: string
  phone: string | null
  note: string | null
  /**
   * Batas maksimal total utang (Rp) untuk orang ini, diatur pedagang.
   * `null` = tanpa batas. Kalau utang berjalan sudah menyentuh batas,
   * tidak bisa menambah utang lagi kecuali dilunasi dulu.
   */
  maxDebt: number | null
  /**
   * Hari terakhir mengembalikkan utang (ISO date `yyyy-mm-dd`), diatur
   * pedagang. Lewat tanggal ini orang dianggap menunggak. `null` = tanpa batas.
   */
  debtDeadline: string | null
  createdAt: string
}

/** Harga pasar yang dilaporkan (dari warung lain di sekitar). */
export interface MarketPrice {
  id: string
  productId: string
  productName: string
  /** Harga yang terlihat di pasar. */
  price: number
  /** Sumber laporan, mis. "Warung sebelah". */
  sourceName: string
  reportedAt: string
}

/** Barang titipan milik orang lain yang dijual warung (konsinyasi). */
export interface Consignment {
  id: string
  /** Nama yang menitipkan barang. */
  depositor: string
  productName: string
  unit: string
  /** Jumlah yang dititipkan. */
  qty: number
  /** Dari jumlah titipan, berapa yang sudah terjual. */
  soldQty: number
  /** Harga dari pemilik barang (informasi). */
  buyPrice: number
  /** Harga jual ke Piutang. */
  sellPrice: number
  /** Komisi warung dalam persen dari omzet. */
  commissionPct: number
  status: "active" | "selesai"
  note: string | null
  createdAt: string
  settledAt: string | null
}

/** Satu baris nota belanja yang dipakai menambah stok. */
export interface PurchaseNoteItem {
  name: string
  qty: number
  unit: string
  unitPrice: number
}

/**
 * Bukti pembelian: foto nota, isi nota, dan siapa yang menambah stok.
 * Dipakai pemilik untuk memeriksa karyawannya tanpa perlu menebak.
 */
export interface PurchaseNote {
  id: string
  createdAt: string
  /** Nama orang yang menambah stok (pegawai atau pemilik). */
  addedBy: string
  total: number
  items: PurchaseNoteItem[]
  /** Foto nota (data URL); boleh kosong untuk nota manual. */
  image: string
  source: "scan" | "contoh" | "manual"
}

/** A row the merchant edits in the confirmation screen. */
export interface ConfirmItem {
  key: string
  productId: string
  name: string
  qty: number
  unit: string
  unitPrice: number
  confidence?: number
  isNew?: boolean
  /** Suggested selling price when the item does not exist yet. */
  newSellPrice?: number
  /**
   * Terpasang kalau baris ini adalah barang titipan (bukan stok warung).
   * `depositor` dipakai untuk menampilkan siapa pemilik barangnya.
   */
  consignmentId?: string | null
  depositor?: string
}

/** Satu baris penjualan barang titipan — dipakai menghitung komisi hari ini. */
export interface ConsignmentSaleRecord {
  id: string
  consignmentId: string
  depositor: string
  productName: string
  qty: number
  unitPrice: number
  /** qty × unitPrice — uang yang masuk ke kasir dari titipan. */
  omzet: number
  /** Komisi warung dari pencicilan barang titipan. */
  commission: number
  createdAt: string
}

export interface NewProductInput {
  name: string
  unit: string
  stock: number
  min_stock: number
  buy_price: number
  sell_price: number
  /** Lama barang dari pemasok dalam hari. */
  lead_time_days?: number
  aliases: string[]
}

/** Bagian produk yang boleh diubah setelah barang dibuat. */
export interface ProductUpdate {
  name?: string
  unit?: string
  min_stock?: number
  buy_price?: number
  sell_price?: number
  lead_time_days?: number
  aliases?: string[]
}

export interface DaySales {
  date: string
  label: string
  sales: number
  profit: number
  transactions: number
}

export interface TopProduct {
  productId: string
  name: string
  unit: string
  qty: number
  revenue: number
}

export interface PurchaseSuggestion {
  productId: string
  name: string
  unit: string
  stock: number
  avgPerDay: number
  suggestedQty: number
  estimatedCost: number
  reason: string
}

export interface DashboardStats {
  todaySales: number
  /** Laba kotor hari ini, sudah termasuk komisi barang titipan. */
  todayGrossProfit: number
  /** Omzet barang titipan hari ini; tidak dihitung sebagai milik warung. */
  todayConsignmentSales: number
  /** Komisi barang titipan yang masuk hari ini. */
  todayConsignmentCommission: number
  /** Bagian omzet titipan yang menjadi hak pemilik barang. */
  todayConsignmentPayable: number
  /** Jumlah barang titipan terjual hari ini. */
  todayConsignmentItems: number
  /** Komisi barang titipan 7 hari terakhir. */
  weekConsignmentCommission: number
  /** Omzet barang titipan 7 hari terakhir. */
  weekConsignmentSales: number
  todayTransactions: number
  weekSales: number
  weekGrossProfit: number
  weekTransactions: number
  totalProducts: number
  lowStockCount: number
  lowStock: Product[]
  recentTransactions: TransactionWithProduct[]
  salesByDay: DaySales[]
  topProducts: TopProduct[]
  suggestions: PurchaseSuggestion[]
  tips: AdvisorTip[]
}
